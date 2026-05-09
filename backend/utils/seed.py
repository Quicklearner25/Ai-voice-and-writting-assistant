from decimal import Decimal

from extensions import db
from models import Category, Customer, Product, User


def get_or_create(model, defaults=None, **filters):
    instance = model.query.filter_by(**filters).first()
    if instance:
        return instance
    params = {**filters, **(defaults or {})}
    instance = model(**params)
    db.session.add(instance)
    db.session.flush()
    return instance


def seed_database():
    db.create_all()
    categories = {
        name: get_or_create(Category, name=name, defaults={"description": f"{name} jewellery"})
        for name in ["Gold", "Silver", "Diamond", "Platinum"]
    }

    users = [
        ("Admin User", "admin@jewellery.local", "admin", "Admin@12345"),
        ("Sales Staff", "sales@jewellery.local", "sales_staff", "Sales@12345"),
        ("Accountant", "accounts@jewellery.local", "accountant", "Accounts@12345"),
    ]
    for name, email, role, password in users:
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(name=name, email=email, role=role, is_active=True)
            user.set_password(password)
            db.session.add(user)

    products = [
        {
            "product_code": "JW-GD-001",
            "name": "22K Temple Necklace",
            "category_id": categories["Gold"].id,
            "weight": Decimal("42.500"),
            "purity": "22K",
            "stone_details": "Ruby accents",
            "making_charges": Decimal("8500"),
            "gst_percentage": Decimal("3"),
            "purchase_price": Decimal("248000"),
            "selling_price": Decimal("286000"),
            "barcode": "8901001001",
            "stock_quantity": 6,
            "low_stock_threshold": 2,
            "description": "Traditional handcrafted necklace.",
        },
        {
            "product_code": "JW-DM-014",
            "name": "Diamond Solitaire Ring",
            "category_id": categories["Diamond"].id,
            "weight": Decimal("6.250"),
            "purity": "18K",
            "stone_details": "0.72 ct VS1 diamond",
            "making_charges": Decimal("14500"),
            "gst_percentage": Decimal("3"),
            "purchase_price": Decimal("165000"),
            "selling_price": Decimal("210000"),
            "barcode": "8901001014",
            "stock_quantity": 3,
            "low_stock_threshold": 2,
            "description": "Certified solitaire ring.",
        },
        {
            "product_code": "JW-SV-023",
            "name": "Silver Anklet Pair",
            "category_id": categories["Silver"].id,
            "weight": Decimal("58.000"),
            "purity": "925",
            "stone_details": "None",
            "making_charges": Decimal("850"),
            "gst_percentage": Decimal("3"),
            "purchase_price": Decimal("4200"),
            "selling_price": Decimal("6200"),
            "barcode": "8901001023",
            "stock_quantity": 14,
            "low_stock_threshold": 5,
            "description": "Daily wear silver anklet pair.",
        },
        {
            "product_code": "JW-PT-007",
            "name": "Platinum Couple Band",
            "category_id": categories["Platinum"].id,
            "weight": Decimal("12.800"),
            "purity": "950",
            "stone_details": "Matte finish",
            "making_charges": Decimal("18000"),
            "gst_percentage": Decimal("3"),
            "purchase_price": Decimal("220000"),
            "selling_price": Decimal("275000"),
            "barcode": "8901001007",
            "stock_quantity": 2,
            "low_stock_threshold": 2,
            "description": "Matching platinum bands.",
        },
    ]
    for item in products:
        if not Product.query.filter_by(product_code=item["product_code"]).first():
            db.session.add(Product(**item))

    customers = [
        ("Anika Sharma", "9876543210", "anika@example.com", "MG Road, Bengaluru"),
        ("Rohan Mehta", "9988776655", "rohan@example.com", "Park Street, Kolkata"),
        ("Meera Iyer", "9123456780", "meera@example.com", "T Nagar, Chennai"),
    ]
    for name, phone, email, address in customers:
        get_or_create(Customer, name=name, phone=phone, defaults={"email": email, "address": address})

    db.session.commit()
