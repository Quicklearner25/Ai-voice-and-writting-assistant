from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from controllers.report_controller import build_report, parse_range
from extensions import db
from middleware import role_required
from models import Report
from utils.audit import record_audit
from utils.exports import report_to_excel, report_to_pdf
from utils.responses import error, success
from utils.validators import clean_text


report_bp = Blueprint("reports", __name__)
REPORT_TYPES = {
    "daily_sales",
    "monthly_sales",
    "profit",
    "inventory",
    "employee_sales",
    "customer",
    "gst",
    "stock_movement",
}


@report_bp.get("")
@jwt_required()
def get_report():
    report_type = clean_text(request.args.get("type") or "daily_sales")
    if report_type not in REPORT_TYPES:
        return error("Unsupported report type", 422)
    try:
        start_date, end_date = parse_range(request.args)
        report = build_report(report_type, start_date, end_date)
        return success(report)
    except ValueError as exc:
        return error(str(exc), 422)


@report_bp.get("/export")
@role_required("admin", "accountant")
def export_report():
    report_type = clean_text(request.args.get("type") or "daily_sales")
    file_format = clean_text(request.args.get("format") or "excel").lower()
    if report_type not in REPORT_TYPES:
        return error("Unsupported report type", 422)
    try:
        start_date, end_date = parse_range(request.args)
        report = build_report(report_type, start_date, end_date)
        generated = Report(
            report_type=report_type,
            title=report["title"],
            generated_by_id=int(get_jwt_identity()),
            params={
                "start_date": start_date.date().isoformat(),
                "end_date": (end_date.date()).isoformat(),
                "format": file_format,
            },
            summary=report.get("summary", {}),
        )
        db.session.add(generated)
        record_audit("export", "report", report_type, {"format": file_format})
        db.session.commit()

        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M")
        if file_format == "pdf":
            buffer = report_to_pdf(report)
            return send_file(buffer, mimetype="application/pdf", as_attachment=True, download_name=f"{report_type}-{timestamp}.pdf")
        if file_format in {"excel", "xlsx"}:
            buffer = report_to_excel(report)
            return send_file(
                buffer,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=f"{report_type}-{timestamp}.xlsx",
            )
        return error("Unsupported export format", 422)
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc), 422)
