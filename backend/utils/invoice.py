from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


SHOP_DETAILS = {
    "name": "Aurum Jewellery House",
    "address": "Main Bazaar Road, Your City, India",
    "phone": "+91 98765 43210",
    "gstin": "GSTIN: 29ABCDE1234F1Z5",
}


def invoice_pdf(sale):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=16 * mm)
    styles = getSampleStyleSheet()
    elements = []

    header = Table(
        [
            [
                Paragraph("<b>Aurum</b><br/>Jewellery", styles["Title"]),
                Paragraph(
                    f"<b>{SHOP_DETAILS['name']}</b><br/>{SHOP_DETAILS['address']}<br/>"
                    f"Phone: {SHOP_DETAILS['phone']}<br/>{SHOP_DETAILS['gstin']}",
                    styles["Normal"],
                ),
            ]
        ],
        colWidths=[45 * mm, 120 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#111827")),
                ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("PADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(header)
    elements.append(Spacer(1, 8))

    customer = sale.customer
    invoice_info = Table(
        [
            ["Invoice No", sale.invoice_no, "Date", sale.created_at.strftime("%d %b %Y %I:%M %p")],
            ["Customer", customer.name, "Phone", customer.phone],
            ["Address", customer.address or "-", "Payment", sale.payment_method.upper()],
        ],
        colWidths=[28 * mm, 58 * mm, 24 * mm, 55 * mm],
    )
    invoice_info.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")), ("PADDING", (0, 0), (-1, -1), 6)]))
    elements.append(invoice_info)
    elements.append(Spacer(1, 10))

    item_rows = [["Product", "Qty", "Weight", "Rate", "Making", "GST", "Total"]]
    for item in sale.items:
        item_rows.append(
            [
                item.product_name,
                item.quantity,
                f"{float(item.weight):.3f}g",
                f"INR {float(item.unit_price):,.2f}",
                f"INR {float(item.making_charges):,.2f}",
                f"INR {float(item.gst_amount):,.2f}",
                f"INR {float(item.line_total):,.2f}",
            ]
        )

    items = Table(item_rows, colWidths=[48 * mm, 14 * mm, 20 * mm, 27 * mm, 25 * mm, 24 * mm, 28 * mm])
    items.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(items)
    elements.append(Spacer(1, 10))

    totals = Table(
        [
            ["Subtotal", f"INR {float(sale.subtotal):,.2f}"],
            ["GST", f"INR {float(sale.gst_amount):,.2f}"],
            ["Discount", f"INR {float(sale.discount_amount):,.2f}"],
            ["Grand Total", f"INR {float(sale.total_amount):,.2f}"],
            ["Paid", f"INR {float(sale.paid_amount):,.2f}"],
            ["Due", f"INR {float(sale.due_amount):,.2f}"],
        ],
        colWidths=[40 * mm, 48 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#111827")),
                ("TEXTCOLOR", (0, 3), (-1, 3), colors.white),
                ("PADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    elements.append(totals)
    elements.append(Spacer(1, 18))

    footer = Table(
        [
            [
                Paragraph("QR payment placeholder<br/><br/>[ Scan to pay ]", styles["Normal"]),
                Paragraph("Customer Signature<br/><br/>____________________", styles["Normal"]),
                Paragraph("Authorized Signature<br/><br/>____________________", styles["Normal"]),
            ]
        ],
        colWidths=[55 * mm, 55 * mm, 55 * mm],
    )
    footer.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")), ("PADDING", (0, 0), (-1, -1), 10)]))
    elements.append(footer)

    doc.build(elements)
    buffer.seek(0)
    return buffer
