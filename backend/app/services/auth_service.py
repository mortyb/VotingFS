import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from jose import JWTError, jwt

from ..auth import (
    ALGORITHM,
    REFRESH_TOKEN_EXPIRE_DAYS,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    SECRET_KEY,
    verify_password,
)
from ..models import User
from ..repositories.auth_repository import AuthRepository


class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    def _create_access_token(self, user: User) -> str:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        payload: dict[str, Any] = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "type": "access",
            "exp": expire,
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    def _create_refresh_token(self, user_id: int) -> tuple[str, str, datetime]:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        jti = uuid.uuid4().hex
        payload: dict[str, Any] = {
            "sub": str(user_id),
            "type": "refresh",
            "jti": jti,
            "exp": expire,
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token, self.hash_jti(jti), expire

    @staticmethod
    def hash_jti(jti: str) -> str:
        return hashlib.sha256(jti.encode("utf-8")).hexdigest()

    @staticmethod
    def decode_refresh_token(token: str) -> dict[str, Any]:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный refresh token",
        )
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("type") != "refresh":
                raise credentials_exception
            if not payload.get("jti") or not payload.get("sub"):
                raise credentials_exception
            return payload
        except JWTError:
            raise credentials_exception

    def login(self, email: str, password: str) -> dict[str, str]:
        user = self.repository.get_user_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
            )

        # Политика сессий: при новом входе отзываем предыдущие refresh-сессии пользователя.
        self.repository.revoke_all_active_refresh_tokens_for_user(user.id)

        access_token = self._create_access_token(user)
        refresh_token, jti_hash, expires_at = self._create_refresh_token(user.id)
        self.repository.create_refresh_token(user.id, jti_hash, expires_at)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    def refresh(self, refresh_token: str) -> dict[str, str]:
        payload = self.decode_refresh_token(refresh_token)
        user_id = int(payload["sub"])
        old_jti_hash = self.hash_jti(payload["jti"])

        active_token = self.repository.get_active_refresh_token_by_jti_hash(old_jti_hash)
        if not active_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token отозван или истек",
            )

        user = self.repository.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")

        new_refresh_token, new_jti_hash, new_expires_at = self._create_refresh_token(user.id)
        rotated = self.repository.rotate_refresh_token(old_jti_hash, new_jti_hash, new_expires_at)
        if not rotated:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не удалось обновить сессию",
            )

        access_token = self._create_access_token(user)
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }

    def logout(self, refresh_token: str | None) -> None:
        if not refresh_token:
            return

        try:
            payload = self.decode_refresh_token(refresh_token)
        except HTTPException:
            return

        jti_hash = self.hash_jti(payload["jti"])
        self.repository.revoke_refresh_token(jti_hash)
