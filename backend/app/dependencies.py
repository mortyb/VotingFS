from fastapi import Depends
from sqlalchemy.orm import Session

from .database import get_db
from .repositories.auth_repository import AuthRepository
from .services.auth_service import AuthService


def get_auth_repository(db: Session = Depends(get_db)) -> AuthRepository:
    return AuthRepository(db)


def get_auth_service(repository: AuthRepository = Depends(get_auth_repository)) -> AuthService:
    return AuthService(repository)
