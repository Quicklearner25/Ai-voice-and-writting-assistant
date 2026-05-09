from .admin_routes import admin_bp
from .auth_routes import auth_bp
from .customer_routes import customer_bp
from .dashboard_routes import dashboard_bp
from .inventory_routes import inventory_bp
from .product_routes import product_bp
from .report_routes import report_bp
from .sales_routes import sales_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(product_bp, url_prefix="/api/products")
    app.register_blueprint(customer_bp, url_prefix="/api/customers")
    app.register_blueprint(sales_bp, url_prefix="/api/sales")
    app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
    app.register_blueprint(report_bp, url_prefix="/api/reports")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
