import json
from datetime import datetime

from flask import Blueprint, current_app, request, send_file
from flask_jwt_extended import jwt_required
from io import BytesIO

from extensions import db
from middleware import role_required
from models import AuditLog, Category, Customer, InventoryLog, Payment, Product, Report, Sale, SaleItem, User
from utils.audit import record_audit
from utils.responses import error, paginated, success


admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/audit-logs")
@role_required("admin")
def audit_logs():
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    query = AuditLog.query.order_by(AuditLog.created_at.desc())
    return success(paginated(query, lambda log: log.to_dict(), page, per_page))


def serialize_model(instance):
    row = {}
    for column in instance.__table__.columns:
        value = getattr(instance, column.name)
        if isinstance(value, datetime):
            value = value.isoformat()
        row[column.name] = value
    return row


@admin_bp.get("/backup")
@role_required("admin")
def backup_database():
    models = [Category, Product, Customer, Sale, SaleItem, Payment, InventoryLog, Report, User]
    payload = {
        "generated_at": datetime.utcnow().isoformat(),
        "format": "jewellery-shop-json-backup-v1",
        "tables": {},
    }
    for model in models:
        payload["tables"][model.__tablename__] = [serialize_model(row) for row in model.query.all()]
    record_audit("backup", "database")
    db.session.commit()
    buffer = BytesIO(json.dumps(payload, indent=2, default=str).encode("utf-8"))
    return send_file(buffer, mimetype="application/json", as_attachment=True, download_name=f"jewellery-backup-{datetime.utcnow():%Y%m%d%H%M}.json")


@admin_bp.post("/restore")
@role_required("admin")
@jwt_required()
def restore_database():
    if not current_app.config["ENABLE_RESTORE"]:
        return error("Restore is disabled. Set ENABLE_RESTORE=true only during trusted maintenance.", 403)
    upload = request.files.get("backup")
    if not upload:
        return error("Backup file is required", 422)
    data = json.loads(upload.read().decode("utf-8"))
    if data.get("format") != "jewellery-shop-json-backup-v1":
        return error("Unsupported backup format", 422)
    record_audit("restore", "database", details={"tables": list(data.get("tables", {}).keys())})
    db.session.commit()
    return success({"tables": list(data.get("tables", {}).keys())}, "Backup validated. Implement table overwrite policy before enabling full restore.")
