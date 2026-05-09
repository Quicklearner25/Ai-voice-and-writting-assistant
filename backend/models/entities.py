from decimal import Decimal

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


def money(value):
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


class TimestampMixin:
    created_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(32), nullable=False, default="sales_staff", index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_login_at = db.Column(db.DateTime)

    sales = db.relationship("Sale", back_populates="user", lazy="dynamic")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Category(TimestampMixin, db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False, index=True)
    description = db.Column(db.Text)

    products = db.relationship("Product", back_populates="category", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "product_count": self.products.count() if self.id else 0,
        }


class Product(TimestampMixin, db.Model):
    __tablename__ = "products"
    __table_args__ = (
        db.Index("ix_products_category_stock", "category_id", "stock_quantity"),
        db.Index("ix_products_name_barcode", "name", "barcode"),
    )

    id = db.Column(db.Integer, primary_key=True)
    product_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(180), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    weight = db.Column(db.Numeric(10, 3), nullable=False, default=0)
    purity = db.Column(db.String(50), nullable=False)
    stone_details = db.Column(db.String(255))
    making_charges = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    gst_percentage = db.Column(db.Numeric(5, 2), nullable=False, default=3)
    purchase_price = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    selling_price = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    barcode = db.Column(db.String(120), unique=True, index=True)
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)
    low_stock_threshold = db.Column(db.Integer, nullable=False, default=5)
    image_path = db.Column(db.String(255))
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    category = db.relationship("Category", back_populates="products")
    sale_items = db.relationship("SaleItem", back_populates="product", lazy="dynamic")
    inventory_logs = db.relationship("InventoryLog", back_populates="product", lazy="dynamic")

    @property
    def is_low_stock(self):
        return self.stock_quantity <= self.low_stock_threshold

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_code,
            "product_code": self.product_code,
            "name": self.name,
            "category_id": self.category_id,
            "category": self.category.name if self.category else None,
            "weight": money(self.weight),
            "purity": self.purity,
            "stone_details": self.stone_details,
            "making_charges": money(self.making_charges),
            "gst_percentage": money(self.gst_percentage),
            "purchase_price": money(self.purchase_price),
            "selling_price": money(self.selling_price),
            "barcode": self.barcode,
            "stock_quantity": self.stock_quantity,
            "low_stock_threshold": self.low_stock_threshold,
            "low_stock": self.is_low_stock,
            "image_path": self.image_path,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Customer(TimestampMixin, db.Model):
    __tablename__ = "customers"
    __table_args__ = (
        db.Index("ix_customers_name_phone", "name", "phone"),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(140), nullable=False, index=True)
    phone = db.Column(db.String(30), unique=True, nullable=False, index=True)
    email = db.Column(db.String(180), index=True)
    address = db.Column(db.Text)
    total_spent = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    due_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    sales = db.relationship("Sale", back_populates="customer", lazy="dynamic")

    def to_dict(self, include_history=False):
        payload = {
            "id": self.id,
            "customer_id": f"CUST-{self.id:05d}" if self.id else None,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "address": self.address,
            "total_spent": money(self.total_spent),
            "due_amount": money(self.due_amount),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_history:
            payload["purchase_history"] = [
                sale.to_dict(include_items=False) for sale in self.sales.order_by(Sale.created_at.desc()).limit(20)
            ]
        return payload


class Sale(TimestampMixin, db.Model):
    __tablename__ = "sales"
    __table_args__ = (
        db.Index("ix_sales_created_status", "created_at", "status"),
        db.Index("ix_sales_customer_created", "customer_id", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    invoice_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(30), nullable=False, default="completed")
    subtotal = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    gst_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    discount_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    total_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    paid_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    due_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    payment_status = db.Column(db.String(30), nullable=False, default="paid")
    payment_method = db.Column(db.String(30), nullable=False, default="cash")
    gold_rate = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    notes = db.Column(db.Text)

    customer = db.relationship("Customer", back_populates="sales")
    user = db.relationship("User", back_populates="sales")
    items = db.relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    payments = db.relationship("Payment", back_populates="sale", cascade="all, delete-orphan")

    def to_dict(self, include_items=True):
        payload = {
            "id": self.id,
            "invoice_no": self.invoice_no,
            "customer_id": self.customer_id,
            "customer": self.customer.to_dict() if self.customer else None,
            "user": self.user.to_dict() if self.user else None,
            "status": self.status,
            "subtotal": money(self.subtotal),
            "gst_amount": money(self.gst_amount),
            "discount_amount": money(self.discount_amount),
            "total_amount": money(self.total_amount),
            "paid_amount": money(self.paid_amount),
            "due_amount": money(self.due_amount),
            "payment_status": self.payment_status,
            "payment_method": self.payment_method,
            "gold_rate": money(self.gold_rate),
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            payload["items"] = [item.to_dict() for item in self.items]
            payload["payments"] = [payment.to_dict() for payment in self.payments]
        return payload


class SaleItem(db.Model):
    __tablename__ = "sale_items"

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey("sales.id"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False, index=True)
    product_name = db.Column(db.String(180), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    weight = db.Column(db.Numeric(10, 3), nullable=False, default=0)
    purity = db.Column(db.String(50), nullable=False)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    making_charges = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    gst_percentage = db.Column(db.Numeric(5, 2), nullable=False, default=3)
    gst_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    discount_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    line_total = db.Column(db.Numeric(12, 2), nullable=False, default=0)

    sale = db.relationship("Sale", back_populates="items")
    product = db.relationship("Product", back_populates="sale_items")

    def to_dict(self):
        return {
            "id": self.id,
            "sale_id": self.sale_id,
            "product_id": self.product_id,
            "product_name": self.product_name,
            "quantity": self.quantity,
            "weight": money(self.weight),
            "purity": self.purity,
            "unit_price": money(self.unit_price),
            "making_charges": money(self.making_charges),
            "gst_percentage": money(self.gst_percentage),
            "gst_amount": money(self.gst_amount),
            "discount_amount": money(self.discount_amount),
            "line_total": money(self.line_total),
        }


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey("sales.id"), nullable=False, index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    method = db.Column(db.String(30), nullable=False, default="cash")
    transaction_ref = db.Column(db.String(120))
    paid_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)

    sale = db.relationship("Sale", back_populates="payments")

    def to_dict(self):
        return {
            "id": self.id,
            "sale_id": self.sale_id,
            "amount": money(self.amount),
            "method": self.method,
            "transaction_ref": self.transaction_ref,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
        }


class InventoryLog(TimestampMixin, db.Model):
    __tablename__ = "inventory_logs"
    __table_args__ = (
        db.Index("ix_inventory_product_created", "product_id", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    change_quantity = db.Column(db.Integer, nullable=False)
    previous_stock = db.Column(db.Integer, nullable=False)
    new_stock = db.Column(db.Integer, nullable=False)
    log_type = db.Column(db.String(40), nullable=False, index=True)
    reason = db.Column(db.String(255))
    reference = db.Column(db.String(120))

    product = db.relationship("Product", back_populates="inventory_logs")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product": self.product.to_dict() if self.product else None,
            "user": self.user.to_dict() if self.user else None,
            "change_quantity": self.change_quantity,
            "previous_stock": self.previous_stock,
            "new_stock": self.new_stock,
            "log_type": self.log_type,
            "reason": self.reason,
            "reference": self.reference,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Report(TimestampMixin, db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    report_type = db.Column(db.String(80), nullable=False, index=True)
    title = db.Column(db.String(180), nullable=False)
    generated_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    params = db.Column(db.JSON)
    summary = db.Column(db.JSON)
    file_path = db.Column(db.String(255))

    generated_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "report_type": self.report_type,
            "title": self.title,
            "generated_by": self.generated_by.to_dict() if self.generated_by else None,
            "params": self.params or {},
            "summary": self.summary or {},
            "file_path": self.file_path,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    __table_args__ = (
        db.Index("ix_audit_entity", "entity_type", "entity_id"),
        db.Index("ix_audit_user_created", "user_id", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    action = db.Column(db.String(80), nullable=False)
    entity_type = db.Column(db.String(80), nullable=False)
    entity_id = db.Column(db.String(80))
    details = db.Column(db.JSON)
    ip_address = db.Column(db.String(80))
    user_agent = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user.to_dict() if self.user else None,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "details": self.details or {},
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
