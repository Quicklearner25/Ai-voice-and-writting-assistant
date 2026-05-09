from datetime import date, datetime, timedelta
from decimal import Decimal

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from middleware import role_required
from models import Customer, InventoryLog, Payment, Product, Sale, SaleItem
from utils.audit import record_audit
from utils.invoice import invoice_pdf
from utils.responses import error, paginated, success
from utils.validators import PAYMENT_METHODS, clean_text, decimal_value, int_value, require_fields


sales_bp = Blueprint("sales", __name__)


def generate_invoice_no():
    today = date.today()
    today_start = datetime(today.year, today.month, today.day)
    tomorrow = today_start + timedelta(days=1)
    count = Sale.query.filter(Sale.created_at >= today_start, Sale.created_at < tomorrow).count() + 1
    return f"INV-{today.strftime('%Y%m%d')}-{count:04d}"


def calculate_line(product, quantity, item_discount):
    base = Decimal(str(product.selling_price)) * quantity
    making = Decimal(str(product.making_charges)) * quantity
    discount = Decimal(str(item_discount or 0))
    taxable = max(base + making - discount, Decimal("0"))
    gst = taxable * Decimal(str(product.gst_percentage or 0)) / Decimal("100")
    line_total = taxable + gst
    return base + making, gst, line_total


@sales_bp.get("")
@jwt_required()
def list_sales():
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    query = Sale.query

    customer_id = request.args.get("customer_id")
    if customer_id:
        query = query.filter(Sale.customer_id == int(customer_id))
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    if start_date:
        query = query.filter(Sale.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(Sale.created_at < datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))

    query = query.order_by(Sale.created_at.desc())
    return success(paginated(query, lambda sale: sale.to_dict(include_items=False), page, per_page))


@sales_bp.post("")
@role_required("admin", "sales_staff")
def create_sale():
    payload = request.get_json(silent=True) or {}
    missing = require_fields(payload, ["customer_id", "items"])
    if missing:
        return error(missing, 422)
    if not payload.get("items"):
        return error("At least one product is required", 422)

    customer = db.session.get(Customer, int(payload["customer_id"]))
    if not customer or not customer.is_active:
        return error("Customer not found", 404)

    try:
        user_id = int(get_jwt_identity())
        discount_amount = decimal_value(payload.get("discount_amount"))
        gold_rate = decimal_value(payload.get("gold_rate"))
        payments_payload = payload.get("payments") or [
            {
                "method": payload.get("payment_method", "cash"),
                "amount": payload.get("paid_amount"),
                "transaction_ref": payload.get("transaction_ref"),
            }
        ]

        sale = Sale(
            invoice_no=generate_invoice_no(),
            customer_id=customer.id,
            user_id=user_id,
            discount_amount=discount_amount,
            payment_method="mixed",
            gold_rate=gold_rate,
            notes=clean_text(payload.get("notes")),
        )
        db.session.add(sale)
        db.session.flush()

        subtotal = Decimal("0")
        gst_total = Decimal("0")
        payable_before_discount = Decimal("0")

        for raw_item in payload["items"]:
            item_missing = require_fields(raw_item, ["product_id", "quantity"])
            if item_missing:
                raise ValueError(item_missing)
            product = db.session.get(Product, int(raw_item["product_id"]))
            if not product or not product.is_active:
                raise ValueError("Product not found")
            quantity = int_value(raw_item.get("quantity"), 1)
            if quantity <= 0:
                raise ValueError("Quantity must be greater than zero")
            if product.stock_quantity < quantity:
                raise ValueError(f"Insufficient stock for {product.name}")

            item_discount = decimal_value(raw_item.get("discount_amount"))
            line_subtotal, gst_amount, line_total = calculate_line(product, Decimal(quantity), item_discount)

            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                weight=product.weight,
                purity=product.purity,
                unit_price=product.selling_price,
                making_charges=product.making_charges,
                gst_percentage=product.gst_percentage,
                gst_amount=gst_amount,
                discount_amount=item_discount,
                line_total=line_total,
            )
            db.session.add(sale_item)

            previous_stock = product.stock_quantity
            product.stock_quantity -= quantity
            db.session.add(
                InventoryLog(
                    product_id=product.id,
                    user_id=user_id,
                    change_quantity=-quantity,
                    previous_stock=previous_stock,
                    new_stock=product.stock_quantity,
                    log_type="sale",
                    reason=f"Sold on invoice {sale.invoice_no}",
                    reference=sale.invoice_no,
                )
            )
            subtotal += line_subtotal
            gst_total += gst_amount
            payable_before_discount += line_total

        total_amount = max(payable_before_discount - discount_amount, Decimal("0"))
        paid_amount = Decimal("0")
        methods = []
        for payment_payload in payments_payload:
            method = clean_text(payment_payload.get("method", "cash"), 30).lower()
            if method not in PAYMENT_METHODS:
                raise ValueError("Invalid payment method")
            amount = decimal_value(payment_payload.get("amount"), total_amount if len(payments_payload) == 1 else 0)
            if amount < 0:
                raise ValueError("Payment amount cannot be negative")
            paid_amount += amount
            methods.append(method)
            if amount > 0:
                db.session.add(
                    Payment(
                        sale_id=sale.id,
                        amount=amount,
                        method=method,
                        transaction_ref=clean_text(payment_payload.get("transaction_ref"), 120),
                    )
                )

        due_amount = max(total_amount - paid_amount, Decimal("0"))
        sale.subtotal = subtotal
        sale.gst_amount = gst_total
        sale.total_amount = total_amount
        sale.paid_amount = paid_amount
        sale.due_amount = due_amount
        sale.payment_method = ",".join(sorted(set(methods))) if methods else "cash"
        sale.payment_status = "paid" if due_amount == 0 else "partial" if paid_amount > 0 else "due"

        customer.total_spent = Decimal(str(customer.total_spent or 0)) + total_amount
        customer.due_amount = Decimal(str(customer.due_amount or 0)) + due_amount

        record_audit("create", "sale", sale.id, {"invoice_no": sale.invoice_no, "total": float(total_amount)})
        db.session.commit()
        return success(sale.to_dict(), "Sale created", 201)
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc), 422)


@sales_bp.get("/summary/daily")
@jwt_required()
def daily_summary():
    selected = request.args.get("date")
    day = datetime.strptime(selected, "%Y-%m-%d").date() if selected else date.today()
    start = datetime(day.year, day.month, day.day)
    end = start + timedelta(days=1)
    sales = Sale.query.filter(Sale.created_at >= start, Sale.created_at < end, Sale.status == "completed").all()
    total = sum(float(sale.total_amount or 0) for sale in sales)
    due = sum(float(sale.due_amount or 0) for sale in sales)
    return success({"date": day.isoformat(), "transactions": len(sales), "total_sales": total, "total_due": due})


@sales_bp.get("/<int:sale_id>")
@jwt_required()
def get_sale(sale_id):
    sale = db.session.get(Sale, sale_id)
    if not sale:
        return error("Sale not found", 404)
    return success(sale.to_dict())


@sales_bp.get("/<int:sale_id>/invoice.pdf")
@jwt_required()
def download_invoice(sale_id):
    sale = db.session.get(Sale, sale_id)
    if not sale:
        return error("Sale not found", 404)
    buffer = invoice_pdf(sale)
    return send_file(buffer, mimetype="application/pdf", as_attachment=True, download_name=f"{sale.invoice_no}.pdf")
