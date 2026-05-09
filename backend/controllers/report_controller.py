from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import desc, func

from extensions import db
from models import Customer, InventoryLog, Product, Sale, SaleItem, User
from models.entities import money


def parse_range(args):
    today = date.today()
    start = args.get("start_date")
    end = args.get("end_date")
    if start:
        start_date = datetime.strptime(start, "%Y-%m-%d")
    else:
        start_date = datetime(today.year, today.month, today.day)
    if end:
        end_date = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)
    else:
        end_date = start_date + timedelta(days=1)
    return start_date, end_date


def sales_query(start_date, end_date):
    return Sale.query.filter(
        Sale.created_at >= start_date,
        Sale.created_at < end_date,
        Sale.status == "completed",
    )


def build_report(report_type, start_date, end_date):
    sales = sales_query(start_date, end_date)

    if report_type in {"daily_sales", "monthly_sales"}:
        rows = [sale.to_dict(include_items=False) for sale in sales.order_by(desc(Sale.created_at)).all()]
        total = sum(row["total_amount"] for row in rows)
        return {
            "title": "Sales Report",
            "columns": ["invoice_no", "customer", "payment_method", "total_amount", "due_amount", "created_at"],
            "rows": rows,
            "summary": {"sales_count": len(rows), "total_sales": round(total, 2)},
        }

    if report_type == "profit":
        rows = []
        total_revenue = Decimal("0")
        total_cost = Decimal("0")
        for sale in sales.all():
            sale_cost = Decimal("0")
            for item in sale.items:
                sale_cost += Decimal(str(item.product.purchase_price if item.product else 0)) * item.quantity
            revenue = Decimal(str(sale.total_amount or 0))
            total_revenue += revenue
            total_cost += sale_cost
            rows.append(
                {
                    "invoice_no": sale.invoice_no,
                    "revenue": money(revenue),
                    "cost": money(sale_cost),
                    "profit": money(revenue - sale_cost),
                    "created_at": sale.created_at.isoformat(),
                }
            )
        return {
            "title": "Profit Report",
            "columns": ["invoice_no", "revenue", "cost", "profit", "created_at"],
            "rows": rows,
            "summary": {
                "revenue": money(total_revenue),
                "cost": money(total_cost),
                "profit": money(total_revenue - total_cost),
            },
        }

    if report_type == "inventory":
        products = Product.query.filter(Product.is_active.is_(True)).order_by(Product.name).all()
        rows = [product.to_dict() for product in products]
        stock_value = sum(row["purchase_price"] * row["stock_quantity"] for row in rows)
        return {
            "title": "Inventory Report",
            "columns": ["product_code", "name", "category", "stock_quantity", "purchase_price", "selling_price"],
            "rows": rows,
            "summary": {
                "products": len(rows),
                "low_stock": sum(1 for row in rows if row["low_stock"]),
                "stock_value": round(stock_value, 2),
            },
        }

    if report_type == "employee_sales":
        rows = (
            db.session.query(
                User.id,
                User.name,
                User.role,
                func.count(Sale.id).label("sales_count"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_sales"),
            )
            .join(Sale, Sale.user_id == User.id)
            .filter(Sale.created_at >= start_date, Sale.created_at < end_date)
            .group_by(User.id, User.name, User.role)
            .order_by(desc("total_sales"))
            .all()
        )
        return {
            "title": "Employee Sales Report",
            "columns": ["name", "role", "sales_count", "total_sales"],
            "rows": [
                {
                    "user_id": row.id,
                    "name": row.name,
                    "role": row.role,
                    "sales_count": int(row.sales_count or 0),
                    "total_sales": money(row.total_sales),
                }
                for row in rows
            ],
            "summary": {"employees": len(rows)},
        }

    if report_type == "customer":
        customers = Customer.query.filter(Customer.is_active.is_(True)).order_by(desc(Customer.total_spent)).all()
        rows = [customer.to_dict() for customer in customers]
        return {
            "title": "Customer Report",
            "columns": ["customer_id", "name", "phone", "total_spent", "due_amount"],
            "rows": rows,
            "summary": {
                "customers": len(rows),
                "total_spent": round(sum(row["total_spent"] for row in rows), 2),
                "dues": round(sum(row["due_amount"] for row in rows), 2),
            },
        }

    if report_type == "gst":
        rows = (
            db.session.query(
                Sale.invoice_no,
                Sale.created_at,
                func.coalesce(func.sum(SaleItem.gst_amount), 0).label("gst_amount"),
                Sale.total_amount,
            )
            .join(SaleItem, SaleItem.sale_id == Sale.id)
            .filter(Sale.created_at >= start_date, Sale.created_at < end_date)
            .group_by(Sale.id, Sale.invoice_no, Sale.created_at, Sale.total_amount)
            .order_by(desc(Sale.created_at))
            .all()
        )
        return {
            "title": "GST Report",
            "columns": ["invoice_no", "gst_amount", "total_amount", "created_at"],
            "rows": [
                {
                    "invoice_no": row.invoice_no,
                    "gst_amount": money(row.gst_amount),
                    "total_amount": money(row.total_amount),
                    "created_at": row.created_at.isoformat(),
                }
                for row in rows
            ],
            "summary": {"gst_collected": money(sum((row.gst_amount or 0) for row in rows))},
        }

    if report_type == "stock_movement":
        logs = InventoryLog.query.filter(
            InventoryLog.created_at >= start_date,
            InventoryLog.created_at < end_date,
        ).order_by(desc(InventoryLog.created_at)).all()
        return {
            "title": "Stock Movement Report",
            "columns": ["product", "log_type", "change_quantity", "previous_stock", "new_stock", "created_at"],
            "rows": [log.to_dict() for log in logs],
            "summary": {"movements": len(logs)},
        }

    raise ValueError("Unsupported report type")
