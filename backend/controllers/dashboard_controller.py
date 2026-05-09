from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import desc, func

from extensions import db
from models import Customer, Product, Sale, SaleItem
from models.entities import money


def start_of_month(value=None):
    current = value or date.today()
    return datetime(current.year, current.month, 1)


def dashboard_stats():
    today = date.today()
    today_start = datetime(today.year, today.month, today.day)
    tomorrow = today_start + timedelta(days=1)
    month_start = start_of_month(today)

    total_sales_today = db.session.query(func.coalesce(func.sum(Sale.total_amount), 0)).filter(
        Sale.created_at >= today_start,
        Sale.created_at < tomorrow,
        Sale.status == "completed",
    ).scalar()
    monthly_sales = db.session.query(func.coalesce(func.sum(Sale.total_amount), 0)).filter(
        Sale.created_at >= month_start,
        Sale.status == "completed",
    ).scalar()

    total_products = Product.query.filter(Product.is_active.is_(True)).count()
    low_stock_count = Product.query.filter(
        Product.is_active.is_(True),
        Product.stock_quantity <= Product.low_stock_threshold,
    ).count()
    customer_count = Customer.query.filter(Customer.is_active.is_(True)).count()

    recent_transactions = (
        Sale.query.filter(Sale.status == "completed")
        .order_by(desc(Sale.created_at))
        .limit(8)
        .all()
    )

    top_selling = (
        db.session.query(
            SaleItem.product_id,
            SaleItem.product_name,
            func.sum(SaleItem.quantity).label("quantity"),
            func.sum(SaleItem.line_total).label("revenue"),
        )
        .join(Sale)
        .filter(Sale.status == "completed")
        .group_by(SaleItem.product_id, SaleItem.product_name)
        .order_by(desc("quantity"))
        .limit(5)
        .all()
    )

    chart_labels = []
    revenue_data = []
    profit_data = []
    for i in range(5, -1, -1):
        anchor = month_start - timedelta(days=30 * i)
        bucket_start = datetime(anchor.year, anchor.month, 1)
        if anchor.month == 12:
            bucket_end = datetime(anchor.year + 1, 1, 1)
        else:
            bucket_end = datetime(anchor.year, anchor.month + 1, 1)

        sales = Sale.query.filter(
            Sale.created_at >= bucket_start,
            Sale.created_at < bucket_end,
            Sale.status == "completed",
        ).all()
        revenue = sum(Decimal(str(sale.total_amount or 0)) for sale in sales)
        cost = Decimal("0")
        for sale in sales:
            for item in sale.items:
                cost += Decimal(str(item.product.purchase_price if item.product else 0)) * item.quantity
        chart_labels.append(bucket_start.strftime("%b %Y"))
        revenue_data.append(money(revenue))
        profit_data.append(money(revenue - cost))

    if len(revenue_data) >= 2:
        recent_average = sum(revenue_data[-3:]) / min(3, len(revenue_data))
        previous_average = sum(revenue_data[:3]) / min(3, len(revenue_data[:3]))
        growth = max(min((recent_average - previous_average) / previous_average, 0.4), -0.3) if previous_average else 0.08
    else:
        growth = 0.08
    prediction = []
    last_revenue = revenue_data[-1] if revenue_data else 0
    for step in range(1, 4):
        prediction.append(round(last_revenue * ((1 + growth) ** step), 2))

    return {
        "cards": {
            "total_sales_today": money(total_sales_today),
            "monthly_sales": money(monthly_sales),
            "total_products": total_products,
            "low_stock_alerts": low_stock_count,
            "customers": customer_count,
        },
        "recent_transactions": [sale.to_dict(include_items=False) for sale in recent_transactions],
        "top_selling_jewellery": [
            {
                "product_id": row.product_id,
                "product_name": row.product_name,
                "quantity": int(row.quantity or 0),
                "revenue": money(row.revenue),
            }
            for row in top_selling
        ],
        "revenue_chart": {
            "labels": chart_labels,
            "revenue": revenue_data,
            "profit": profit_data,
            "prediction": prediction,
        },
        "customer_statistics": {
            "total": customer_count,
            "with_dues": Customer.query.filter(Customer.due_amount > 0, Customer.is_active.is_(True)).count(),
            "new_this_month": Customer.query.filter(Customer.created_at >= month_start).count(),
        },
    }
