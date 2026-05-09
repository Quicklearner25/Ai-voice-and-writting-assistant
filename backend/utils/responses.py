from flask import jsonify


def success(data=None, message="OK", status=200, **meta):
    payload = {"success": True, "message": message, "data": data}
    if meta:
        payload["meta"] = meta
    return jsonify(payload), status


def error(message="Something went wrong", status=400, details=None):
    payload = {"success": False, "message": message}
    if details:
        payload["details"] = details
    return jsonify(payload), status


def paginated(query, serializer, page=1, per_page=20):
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [serializer(item) for item in pagination.items],
        "pagination": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "pages": pagination.pages,
            "has_next": pagination.has_next,
            "has_prev": pagination.has_prev,
        },
    }
