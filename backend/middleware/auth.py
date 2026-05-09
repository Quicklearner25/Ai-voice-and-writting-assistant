from functools import wraps

from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models import User
from utils.responses import error


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user_id = get_jwt_identity()
            user = db.session.get(User, int(user_id)) if user_id else None
            if not user or not user.is_active:
                return error("User account is inactive or missing", 401)
            if roles and user.role not in roles:
                return error("You do not have permission to perform this action", 403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
