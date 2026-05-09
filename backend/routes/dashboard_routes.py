from flask import Blueprint
from flask_jwt_extended import jwt_required

from controllers.dashboard_controller import dashboard_stats
from utils.gold_rates import fetch_gold_rate
from utils.responses import success


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/stats")
@jwt_required()
def stats():
    return success(dashboard_stats())


@dashboard_bp.get("/gold-rate")
@jwt_required()
def gold_rate():
    return success(fetch_gold_rate())
