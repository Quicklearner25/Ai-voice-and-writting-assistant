from datetime import datetime

from flask import Blueprint, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, verify_jwt_in_request

from extensions import db
from models import User
from utils.audit import record_audit
from utils.responses import error, success
from utils.validators import ALLOWED_ROLES, clean_text, require_fields


auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    missing = require_fields(payload, ["name", "email", "password"])
    if missing:
        return error(missing, 422)

    has_users = User.query.count() > 0
    role = clean_text(payload.get("role") or "sales_staff")
    if role not in ALLOWED_ROLES:
        return error("Invalid role", 422)

    if has_users:
        verify_jwt_in_request()
        current_user = db.session.get(User, int(get_jwt_identity()))
        if not current_user or current_user.role != "admin":
            return error("Only admins can create staff accounts", 403)
    else:
        role = "admin"

    email = clean_text(payload["email"], 180).lower()
    if User.query.filter_by(email=email).first():
        return error("Email is already registered", 409)

    user = User(
        name=clean_text(payload["name"], 120),
        email=email,
        role=role,
        is_active=True,
    )
    user.set_password(payload["password"])
    db.session.add(user)
    db.session.flush()
    record_audit("create", "user", user.id, {"email": email, "role": role}, user_id=user.id if not has_users else None)
    db.session.commit()
    return success(user.to_dict(), "User registered", 201)


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    missing = require_fields(payload, ["email", "password"])
    if missing:
        return error(missing, 422)

    email = clean_text(payload["email"], 180).lower()
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(payload["password"]):
        return error("Invalid email or password", 401)
    if not user.is_active:
        return error("Account is inactive", 403)

    user.last_login_at = datetime.utcnow()
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role, "email": user.email})
    record_audit("login", "user", user.id)
    db.session.commit()
    return success({"token": token, "user": user.to_dict()}, "Login successful")


@auth_bp.get("/me")
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active:
        return error("User account is inactive or missing", 401)
    return success(user.to_dict())


@auth_bp.post("/logout")
@jwt_required()
def logout():
    record_audit("logout", "user", get_jwt_identity())
    db.session.commit()
    return success(message="Logged out")
