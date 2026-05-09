from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from extensions import db
from middleware import role_required
from models import Customer
from utils.audit import record_audit
from utils.responses import error, paginated, success
from utils.validators import clean_text, decimal_value, require_fields


customer_bp = Blueprint("customers", __name__)


@customer_bp.get("")
@jwt_required()
def list_customers():
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    search = clean_text(request.args.get("search"))

    query = Customer.query.filter(Customer.is_active.is_(True))
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Customer.name.ilike(like), Customer.phone.ilike(like), Customer.email.ilike(like)))
    query = query.order_by(Customer.created_at.desc())
    return success(paginated(query, lambda customer: customer.to_dict(), page, per_page))


@customer_bp.post("")
@role_required("admin", "sales_staff")
def create_customer():
    payload = request.get_json(silent=True) or {}
    missing = require_fields(payload, ["name", "phone"])
    if missing:
        return error(missing, 422)
    phone = clean_text(payload["phone"], 30)
    if Customer.query.filter_by(phone=phone).first():
        return error("Customer phone already exists", 409)

    customer = Customer(
        name=clean_text(payload["name"], 140),
        phone=phone,
        email=clean_text(payload.get("email"), 180),
        address=clean_text(payload.get("address")),
        due_amount=decimal_value(payload.get("due_amount")),
    )
    db.session.add(customer)
    db.session.flush()
    record_audit("create", "customer", customer.id, {"phone": phone})
    db.session.commit()
    return success(customer.to_dict(), "Customer created", 201)


@customer_bp.get("/<int:customer_id>")
@jwt_required()
def get_customer(customer_id):
    customer = db.session.get(Customer, customer_id)
    if not customer or not customer.is_active:
        return error("Customer not found", 404)
    return success(customer.to_dict(include_history=True))


@customer_bp.get("/<int:customer_id>/history")
@jwt_required()
def purchase_history(customer_id):
    customer = db.session.get(Customer, customer_id)
    if not customer or not customer.is_active:
        return error("Customer not found", 404)
    return success(customer.to_dict(include_history=True)["purchase_history"])


@customer_bp.put("/<int:customer_id>")
@role_required("admin", "sales_staff", "accountant")
def update_customer(customer_id):
    customer = db.session.get(Customer, customer_id)
    if not customer or not customer.is_active:
        return error("Customer not found", 404)
    payload = request.get_json(silent=True) or {}
    for field, max_length in {"name": 140, "phone": 30, "email": 180}.items():
        if field in payload:
            setattr(customer, field, clean_text(payload[field], max_length))
    if "address" in payload:
        customer.address = clean_text(payload["address"])
    if "due_amount" in payload:
        customer.due_amount = decimal_value(payload["due_amount"])
    record_audit("update", "customer", customer.id)
    db.session.commit()
    return success(customer.to_dict(), "Customer updated")


@customer_bp.delete("/<int:customer_id>")
@role_required("admin")
def delete_customer(customer_id):
    customer = db.session.get(Customer, customer_id)
    if not customer or not customer.is_active:
        return error("Customer not found", 404)
    customer.is_active = False
    record_audit("delete", "customer", customer.id)
    db.session.commit()
    return success(message="Customer deleted")
