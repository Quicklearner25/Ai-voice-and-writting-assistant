from flask import request
from flask_jwt_extended import get_jwt_identity

from extensions import db
from models import AuditLog


def record_audit(action, entity_type, entity_id=None, details=None, user_id=None):
    try:
        resolved_user_id = user_id or get_jwt_identity()
    except RuntimeError:
        resolved_user_id = user_id

    audit = AuditLog(
        user_id=resolved_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        details=details or {},
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr) if request else None,
        user_agent=request.headers.get("User-Agent", "")[:255] if request else None,
    )
    db.session.add(audit)
