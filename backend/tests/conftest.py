import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Критично: задаем переменные до импорта app.main/app.auth
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_bootstrap.db")
os.environ.setdefault("APP_BASE_URL", "http://localhost:5173")

from app.database import Base, get_db
from app.main import app


class FakeMinio:
    def bucket_exists(self, _bucket: str) -> bool:
        return True

    def make_bucket(self, _bucket: str) -> None:
        return None

    def set_bucket_policy(self, _bucket: str, _policy: str) -> None:
        return None

    def presigned_get_object(self, bucket: str, object_key: str, expires=None) -> str:
        return f"http://minio.local/{bucket}/{object_key}"

    def remove_object(self, _bucket: str, _object_key: str) -> None:
        return None

    def put_object(self, _bucket: str, _key: str, _file, length: int, content_type: str) -> None:
        if length < 0:
            raise ValueError("length must be >= 0")
        _ = content_type


@pytest.fixture()
def db_session(tmp_path):
    test_db = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{test_db}", connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session, monkeypatch):
    from app import main as main_module

    monkeypatch.setattr(main_module, "minio_client", FakeMinio())

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture()
def user_payload():
    return {
        "email": "user@example.com",
        "password": "StrongPass123!",
        "full_name": "Test User",
    }


@pytest.fixture()
def admin_payload():
    return {
        "email": "admin@example.com",
        "password": "StrongPass123!",
        "full_name": "Admin User",
    }
