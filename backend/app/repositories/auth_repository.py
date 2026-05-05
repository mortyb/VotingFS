from datetime import datetime, timezone
from sqlalchemy.orm import Session

from ..models import User, RefreshToken


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def get_user_by_id(self, user_id: int) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def revoke_all_active_refresh_tokens_for_user(self, user_id: int) -> None:
        now = datetime.now(timezone.utc)
        self.db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        ).update({RefreshToken.revoked_at: now}, synchronize_session=False)
        self.db.commit()

    def create_refresh_token(self, user_id: int, jti_hash: str, expires_at: datetime) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            jti_hash=jti_hash,
            expires_at=expires_at,
        )
        self.db.add(token)
        self.db.commit()
        self.db.refresh(token)
        return token

    def get_active_refresh_token_by_jti_hash(self, jti_hash: str) -> RefreshToken | None:
        now = datetime.now(timezone.utc)
        return self.db.query(RefreshToken).filter(
            RefreshToken.jti_hash == jti_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        ).first()

    def rotate_refresh_token(self, old_jti_hash: str, new_jti_hash: str, new_expires_at: datetime) -> RefreshToken | None:
        now = datetime.now(timezone.utc)
        old_token = self.get_active_refresh_token_by_jti_hash(old_jti_hash)
        if not old_token:
            return None

        old_token.revoked_at = now
        old_token.replaced_by_jti_hash = new_jti_hash

        new_token = RefreshToken(
            user_id=old_token.user_id,
            jti_hash=new_jti_hash,
            expires_at=new_expires_at,
        )
        self.db.add(new_token)
        self.db.commit()
        self.db.refresh(new_token)
        return new_token

    def revoke_refresh_token(self, jti_hash: str) -> bool:
        token = self.get_active_refresh_token_by_jti_hash(jti_hash)
        if not token:
            return False

        token.revoked_at = datetime.now(timezone.utc)
        self.db.commit()
        return True
