from io import BytesIO

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet


def flatten_value(value):
    if isinstance(value, dict):
        if "name" in value:
            return value["name"]
        if "invoice_no" in value:
            return value["invoice_no"]
        return ", ".join(f"{key}: {val}" for key, val in value.items() if val is not None)
    return value


def report_to_excel(report):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = report["title"][:31]
    columns = report.get("columns", [])
    sheet.append([column.replace("_", " ").title() for column in columns])
    for row in report.get("rows", []):
        sheet.append([flatten_value(row.get(column)) for column in columns])
    sheet.append([])
    sheet.append(["Summary"])
    for key, value in report.get("summary", {}).items():
        sheet.append([key.replace("_", " ").title(), value])

    for column_cells in sheet.columns:
        max_length = max(len(str(cell.value or "")) for cell in column_cells)
        sheet.column_dimensions[column_cells[0].column_letter].width = min(max(max_length + 2, 12), 42)

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer


def report_to_pdf(report):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24)
    styles = getSampleStyleSheet()
    elements = [Paragraph(f"<b>{report['title']}</b>", styles["Title"]), Spacer(1, 12)]
    columns = report.get("columns", [])
    rows = [[column.replace("_", " ").title() for column in columns]]
    for row in report.get("rows", [])[:120]:
        rows.append([str(flatten_value(row.get(column, "")))[:80] for column in columns])
    table = Table(rows, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 12))
    summary = "<br/>".join(f"<b>{key.replace('_', ' ').title()}</b>: {value}" for key, value in report.get("summary", {}).items())
    elements.append(Paragraph(summary, styles["Normal"]))
    doc.build(elements)
    buffer.seek(0)
    return buffer
