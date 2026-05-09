from decimal import Decimal, InvalidOperation

import bleach


ALLOWED_ROLES = {"admin", "sales_staff", "accountant"}
PAYMENT_METHODS = {"cash", "upi", "card"}
PRODUCT_CATEGORIES = {"Gold", "Silver", "Diamond", "Platinum"}


def clean_text(value, max_length=None):
    if value is None:
        return None
    cleaned = bleach.clean(str(value).strip(), tags=[], attributes={}, strip=True)
    if max_length and len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned


def require_fields(payload, fields):
    missing = [field for field in fields if payload.get(field) in (None, "")]
    if missing:
        return f"Missing required field(s): {', '.join(missing)}"
    return None


def decimal_value(value, default=0):
    if value in (None, ""):
        return Decimal(str(default))
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid decimal value: {value}") from exc


def int_value(value, default=0):
    if value in (None, ""):
        return int(default)
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"Invalid integer value: {value}") from exc


def parse_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "on"}
