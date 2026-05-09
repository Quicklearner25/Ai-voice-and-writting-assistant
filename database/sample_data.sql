USE jewellery_shop;

INSERT IGNORE INTO categories (id, name, description) VALUES
  (1, 'Gold', 'Gold jewellery'),
  (2, 'Silver', 'Silver jewellery'),
  (3, 'Diamond', 'Diamond jewellery'),
  (4, 'Platinum', 'Platinum jewellery');

INSERT IGNORE INTO products
  (product_code, name, category_id, weight, purity, stone_details, making_charges, gst_percentage, purchase_price, selling_price, barcode, stock_quantity, low_stock_threshold, description)
VALUES
  ('JW-GD-001', '22K Temple Necklace', 1, 42.500, '22K', 'Ruby accents', 8500, 3, 248000, 286000, '8901001001', 6, 2, 'Traditional handcrafted necklace.'),
  ('JW-DM-014', 'Diamond Solitaire Ring', 3, 6.250, '18K', '0.72 ct VS1 diamond', 14500, 3, 165000, 210000, '8901001014', 3, 2, 'Certified solitaire ring.'),
  ('JW-SV-023', 'Silver Anklet Pair', 2, 58.000, '925', 'None', 850, 3, 4200, 6200, '8901001023', 14, 5, 'Daily wear silver anklet pair.'),
  ('JW-PT-007', 'Platinum Couple Band', 4, 12.800, '950', 'Matte finish', 18000, 3, 220000, 275000, '8901001007', 2, 2, 'Matching platinum bands.');

INSERT IGNORE INTO customers (name, phone, email, address) VALUES
  ('Anika Sharma', '9876543210', 'anika@example.com', 'MG Road, Bengaluru'),
  ('Rohan Mehta', '9988776655', 'rohan@example.com', 'Park Street, Kolkata'),
  ('Meera Iyer', '9123456780', 'meera@example.com', 'T Nagar, Chennai');
