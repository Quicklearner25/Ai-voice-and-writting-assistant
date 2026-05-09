from pathlib import Path

from flask import Flask, send_from_directory
from sqlalchemy.exc import IntegrityError

from config import Config
from extensions import cors, db, jwt
from routes import register_blueprints
from utils.responses import error, success


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    register_blueprints(app)
    register_handlers(app)
    register_cli(app)

    @app.get("/health")
    def health():
        return success({"status": "healthy"})

    @app.get("/uploads/products/<path:filename>")
    def uploaded_product(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    @app.after_request
    def secure_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        return response

    return app


def register_handlers(app):
    @app.errorhandler(IntegrityError)
    def integrity_error(exc):
        db.session.rollback()
        return error("Database constraint violation", 409, str(exc.orig))

    @app.errorhandler(404)
    def not_found(_):
        return error("Resource not found", 404)

    @app.errorhandler(500)
    def server_error(exc):
        db.session.rollback()
        return error("Internal server error", 500, str(exc))

    @jwt.unauthorized_loader
    def missing_token(message):
        return error(message, 401)

    @jwt.invalid_token_loader
    def invalid_token(message):
        return error(message, 422)

    @jwt.expired_token_loader
    def expired_token(_jwt_header, _jwt_payload):
        return error("Token has expired", 401)


def register_cli(app):
    @app.cli.command("init-db")
    def init_db():
        db.create_all()
        print("Database tables created.")

    @app.cli.command("seed-db")
    def seed_db():
        from utils.seed import seed_database

        seed_database()
        print("Sample data inserted.")


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
