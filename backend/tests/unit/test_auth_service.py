from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.auth import get_password_hash
from app.models import User
from app.services.auth_service import AuthService


class StubRepository:
    def __init__(self, user: User | None = None):
        self.user = user
        self.revoked_for_user_id = None
        self.created_refresh = None
        self.active_token_found = True
        self.rotated = True
        self.revoked_token_hash = None

    def get_user_by_email(self, email: str):
        if self.user and self.user.email == email:
            return self.user
        return None

    def get_user_by_id(self, user_id: int):
        if self.user and self.user.id == user_id:
            return self.user
        return None

    def revoke_all_active_refresh_tokens_for_user(self, user_id: int):
        self.revoked_for_user_id = user_id

    def create_refresh_token(self, user_id: int, jti_hash: str, expires_at: datetime):
        self.created_refresh = (user_id, jti_hash, expires_at)

    def get_active_refresh_token_by_jti_hash(self, _jti_hash: str):
        return object() if self.active_token_found else None

    def rotate_refresh_token(self, _old_jti_hash: str, _new_jti_hash: str, _new_expires_at: datetime):
        return object() if self.rotated else None

    def revoke_refresh_token(self, jti_hash: str):
        self.revoked_token_hash = jti_hash
        return True


def make_user(role: str = "user") -> User:
    user = User(
        id=1,
        email="user@example.com",
        hashed_password=get_password_hash("StrongPass123!"),
        full_name="Test",
        role=role,
        is_active=True,
    )
    return user


@pytest.mark.unit
def test_login_success_returns_access_and_refresh_tokens():
    repository = StubRepository(user=make_user())
    service = AuthService(repository)

    result = service.login("user@example.com", "StrongPass123!")

    assert "access_token" in result
    assert "refresh_token" in result
    assert result["token_type"] == "bearer"
    assert repository.revoked_for_user_id == 1
    assert repository.created_refresh is not None


@pytest.mark.unit
def test_login_invalid_credentials_returns_401():
    repository = StubRepository(user=make_user())
    service = AuthService(repository)

    with pytest.raises(HTTPException) as exc:
        service.login("user@example.com", "wrong-password")

    assert exc.value.status_code == 401


@pytest.mark.unit
def test_refresh_rotates_refresh_token_and_returns_new_pair():
    repository = StubRepository(user=make_user())
    service = AuthService(repository)

    refresh_token, _, _ = service._create_refresh_token(user_id=1)
    result = service.refresh(refresh_token)

    assert "access_token" in result
    assert "refresh_token" in result
    assert result["token_type"] == "bearer"


@pytest.mark.unit
def test_refresh_with_revoked_token_returns_401():
    repository = StubRepository(user=make_user())
    repository.active_token_found = False
    service = AuthService(repository)

    refresh_token, _, _ = service._create_refresh_token(user_id=1)

    with pytest.raises(HTTPException) as exc:
        service.refresh(refresh_token)

    assert exc.value.status_code == 401


@pytest.mark.unit
def test_logout_revokes_refresh_token_hash():
    repository = StubRepository(user=make_user())
    service = AuthService(repository)

    refresh_token, jti_hash, _ = service._create_refresh_token(user_id=1)
    service.logout(refresh_token)

    assert repository.revoked_token_hash == jti_hash


@pytest.mark.unit
def test_decode_refresh_token_rejects_non_refresh_token():
    repository = StubRepository(user=make_user())
    service = AuthService(repository)

    access = service._create_access_token(make_user())

    with pytest.raises(HTTPException) as exc:
        service.decode_refresh_token(access)

    assert exc.value.status_code == 401
