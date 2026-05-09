import uuid
from pathlib import Path

from flask import Blueprint, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_
from werkzeug.utils import secure_filename

from extensions import db
from middleware import role_required
from models import Category, InventoryLog, Product
from utils.audit import record_audit
from utils.responses import error, paginated, success
from utils.validators import clean_text, decimal_value, int_value, parse_bool, require_fields


product_bp = Blueprint("products", __name__)
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


def payload_data():
    return request.get_json(silent=True) or request.form.to_dict()


def category_from_payload(payload):
    category_id = payload.get("category_id")
    if category_id:
        category = db.session.get(Category, int(category_id))
        if not category:
            raise ValueError("Category not found")
        return category

    category_name = clean_text(payload.get("category"), 80)
    if not category_name:
        raise ValueError("Category is required")
    category = Category.query.filter(Category.name == category_name).first()
    if not category:
        category = Category(name=category_name)
        db.session.add(category)
        db.session.flush()
    return category


def save_image(file_storage):
    if not file_storage or not file_storage.filename:
        return None
    extension = file_storage.filename.rsplit(".", 1)[-1].lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError("Unsupported image format")
    upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = secure_filename(f"{uuid.uuid4().hex}.{extension}")
    file_storage.save(upload_dir / filename)
    return f"/uploads/products/{filename}"


@product_bp.get("/categories")
@jwt_required()
def categories():
    return success([category.to_dict() for category in Category.query.order_by(Category.name).all()])


@product_bp.post("/categories")
@role_required("admin", "accountant")
def create_category():
    payload = request.get_json(silent=True) or {}
    name = clean_text(payload.get("name"), 80)
    if not name:
        return error("Category name is required", 422)
    if Category.query.filter_by(name=name).first():
        return error("Category already exists", 409)
    category = Category(name=name, description=clean_text(payload.get("description")))
    db.session.add(category)
    db.session.flush()
    record_audit("create", "category", category.id, {"name": name})
    db.session.commit()
    return success(category.to_dict(), "Category created", 201)


@product_bp.get("")
@jwt_required()
def list_products():
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    search = clean_text(request.args.get("search"))
    category = clean_text(request.args.get("category"))
    low_stock = parse_bool(request.args.get("low_stock", False))

    query = Product.query.filter(Product.is_active.is_(True))
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(like),
                Product.product_code.ilike(like),
                Product.barcode.ilike(like),
            )
        )
    if category:
        query = query.join(Category).filter(Category.name == category)
    if low_stock:
        query = query.filter(Product.stock_quantity <= Product.low_stock_threshold)

    query = query.order_by(Product.created_at.desc())
    return success(paginated(query, lambda product: product.to_dict(), page, per_page))


@product_bp.get("/barcode/<barcode>")
@jwt_required()
def by_barcode(barcode):
    product = Product.query.filter_by(barcode=clean_text(barcode)).first()
    if not product:
        return error("Product not found", 404)
    return success(product.to_dict())


@product_bp.post("")
@role_required("admin", "accountant")
def create_product():
    payload = payload_data()
    missing = require_fields(payload, ["name", "purity", "selling_price"])
    if missing:
        return error(missing, 422)
    try:
        category = category_from_payload(payload)
        image_path = save_image(request.files.get("image"))
        product = Product(
            product_code=clean_text(payload.get("product_code") or payload.get("product_id") or f"JW-{uuid.uuid4().hex[:8].upper()}", 50),
            name=clean_text(payload["name"], 180),
            category_id=category.id,
            weight=decimal_value(payload.get("weight")),
            purity=clean_text(payload["purity"], 50),
            stone_details=clean_text(payload.get("stone_details"), 255),
            making_charges=decimal_value(payload.get("making_charges")),
            gst_percentage=decimal_value(payload.get("gst_percentage"), 3),
            purchase_price=decimal_value(payload.get("purchase_price")),
            selling_price=decimal_value(payload.get("selling_price")),
            barcode=clean_text(payload.get("barcode"), 120) or None,
            stock_quantity=int_value(payload.get("stock_quantity")),
            low_stock_threshold=int_value(payload.get("low_stock_threshold"), current_app.config["LOW_STOCK_THRESHOLD"]),
            image_path=image_path,
            description=clean_text(payload.get("description")),
        )
        db.session.add(product)
        db.session.flush()
        if product.stock_quantity:
            log = InventoryLog(
                product_id=product.id,
                user_id=int(get_jwt_identity()),
                change_quantity=product.stock_quantity,
                previous_stock=0,
                new_stock=product.stock_quantity,
                log_type="opening_stock",
                reason="Initial product entry",
                reference=product.product_code,
            )
            db.session.add(log)
        record_audit("create", "product", product.id, {"product_code": product.product_code})
        db.session.commit()
        return success(product.to_dict(), "Product created", 201)
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc), 422)


@product_bp.get("/<int:product_id>")
@jwt_required()
def get_product(product_id):
    product = db.session.get(Product, product_id)
    if not product or not product.is_active:
        return error("Product not found", 404)
    return success(product.to_dict())


@product_bp.put("/<int:product_id>")
@role_required("admin", "accountant")
def update_product(product_id):
    product = db.session.get(Product, product_id)
    if not product or not product.is_active:
        return error("Product not found", 404)

    payload = payload_data()
    try:
        if payload.get("category_id") or payload.get("category"):
            product.category_id = category_from_payload(payload).id
        for field, cleaner in {
            "name": lambda v: clean_text(v, 180),
            "purity": lambda v: clean_text(v, 50),
            "stone_details": lambda v: clean_text(v, 255),
            "barcode": lambda v: clean_text(v, 120) or None,
            "description": clean_text,
        }.items():
            if field in payload:
                setattr(product, field, cleaner(payload[field]))
        for field in ["weight", "making_charges", "gst_percentage", "purchase_price", "selling_price"]:
            if field in payload:
                setattr(product, field, decimal_value(payload[field]))
        for field in ["stock_quantity", "low_stock_threshold"]:
            if field in payload:
                setattr(product, field, int_value(payload[field]))
        image_path = save_image(request.files.get("image"))
        if image_path:
            product.image_path = image_path
        record_audit("update", "product", product.id, {"product_code": product.product_code})
        db.session.commit()
        return success(product.to_dict(), "Product updated")
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc), 422)


@product_bp.delete("/<int:product_id>")
@role_required("admin")
def delete_product(product_id):
    product = db.session.get(Product, product_id)
    if not product or not product.is_active:
        return error("Product not found", 404)
    product.is_active = False
    record_audit("delete", "product", product.id, {"product_code": product.product_code})
    db.session.commit()
    return success(message="Product deleted")
