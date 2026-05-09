from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from middleware import role_required
from models import InventoryLog, Product
from utils.audit import record_audit
from utils.responses import error, paginated, success
from utils.validators import clean_text, int_value, require_fields


inventory_bp = Blueprint("inventory", __name__)


@inventory_bp.get("/logs")
@jwt_required()
def logs():
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    product_id = request.args.get("product_id")
    log_type = clean_text(request.args.get("type"))
    query = InventoryLog.query
    if product_id:
        query = query.filter(InventoryLog.product_id == int(product_id))
    if log_type:
        query = query.filter(InventoryLog.log_type == log_type)
    query = query.order_by(InventoryLog.created_at.desc())
    return success(paginated(query, lambda log: log.to_dict(), page, per_page))


@inventory_bp.post("/adjustments")
@role_required("admin", "accountant")
def adjust_stock():
    payload = request.get_json(silent=True) or {}
    return perform_adjustment(payload)


def perform_adjustment(payload):
    missing = require_fields(payload, ["product_id", "change_quantity"])
    if missing:
        return error(missing, 422)
    product = db.session.get(Product, int(payload["product_id"]))
    if not product or not product.is_active:
        return error("Product not found", 404)
    try:
        change_quantity = int_value(payload["change_quantity"])
        previous_stock = product.stock_quantity
        new_stock = previous_stock + change_quantity
        if new_stock < 0:
            return error("Adjustment would make stock negative", 422)
        product.stock_quantity = new_stock
        log = InventoryLog(
            product_id=product.id,
            user_id=int(get_jwt_identity()),
            change_quantity=change_quantity,
            previous_stock=previous_stock,
            new_stock=new_stock,
            log_type=clean_text(payload.get("type") or "adjustment", 40),
            reason=clean_text(payload.get("reason") or "Manual stock adjustment", 255),
            reference=clean_text(payload.get("reference"), 120),
        )
        db.session.add(log)
        record_audit("adjust_stock", "product", product.id, {"change_quantity": change_quantity})
        db.session.commit()
        return success(log.to_dict(), "Stock adjusted")
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc), 422)


@inventory_bp.post("/damaged")
@role_required("admin", "accountant")
def damaged_stock():
    payload = request.get_json(silent=True) or {}
    payload["type"] = "damaged"
    payload["change_quantity"] = -abs(int_value(payload.get("quantity", payload.get("change_quantity", 0))))
    payload["reason"] = payload.get("reason") or "Damaged stock entry"
    return perform_adjustment(payload)
