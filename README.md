# Jewellery Shop Management Software

Full-stack jewellery shop management system with a React admin UI, Flask REST API, MySQL schema, JWT authentication, role-based authorization, inventory tracking, billing, PDF invoices, reports, exports, audit logs, and backup support.

## Tech Stack

- Frontend: React, Tailwind CSS, Axios, React Router, Context API, Chart.js
- Backend: Python Flask, Flask-JWT-Extended, SQLAlchemy, PyMySQL
- Database: MySQL
- Documents: ReportLab PDF invoices, openpyxl Excel exports

## Project Structure

```text
frontend/   React application
backend/    Flask REST API
database/   MySQL schema and sample data
```

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env` for your MySQL credentials. You can either set `DATABASE_URL` or use `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.

Create tables and seed demo data:

```bash
flask --app app init-db
flask --app app seed-db
python app.py
```

Seeded login accounts:

```text
admin@jewellery.local / Admin@12345
sales@jewellery.local / Sales@12345
accounts@jewellery.local / Accounts@12345
```

## MySQL Setup

You can create the database directly:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/sample_data.sql
```

The Flask seed command is recommended for users because it creates hashed demo passwords with Werkzeug.

## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5173`. The frontend expects the API at `http://localhost:5000/api` unless changed in `frontend/.env`.

## Core API Routes

- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- `GET/POST /api/products`, `PUT/DELETE /api/products/:id`, `GET /api/products/barcode/:barcode`
- `GET/POST /api/customers`, `PUT/DELETE /api/customers/:id`, `GET /api/customers/:id/history`
- `GET/POST /api/sales`, `GET /api/sales/:id/invoice.pdf`, `GET /api/sales/summary/daily`
- `GET /api/inventory/logs`, `POST /api/inventory/adjustments`, `POST /api/inventory/damaged`
- `GET /api/reports`, `GET /api/reports/export`
- `GET /api/dashboard/stats`, `GET /api/dashboard/gold-rate`
- `GET /api/admin/audit-logs`, `GET /api/admin/backup`

## Security Notes

- Passwords are hashed with Werkzeug.
- JWTs protect all business APIs.
- Role checks separate Admin, Sales Staff, and Accountant access.
- SQLAlchemy ORM prevents ad hoc SQL injection patterns.
- User strings are sanitized server-side with Bleach.
- Security headers are applied to API responses.
- Restore is disabled unless `ENABLE_RESTORE=true`; keep it off outside trusted maintenance.

## Production Notes

- Set strong `SECRET_KEY` and `JWT_SECRET_KEY`.
- Use a dedicated MySQL user with least privilege.
- Configure HTTPS and a production WSGI server such as Gunicorn or Waitress behind a reverse proxy.
- Store uploads in durable object storage for multi-server deployments.
- Set `FRONTEND_ORIGIN` to your deployed frontend URL.
- Configure `GOLD_RATE_API_URL` and `GOLD_RATE_API_KEY` for live rates, otherwise the fallback rate is used.
