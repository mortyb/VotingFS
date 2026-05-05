from datetime import datetime, timedelta
from jose import JWTError, jwt  # Для работы с токенами
from passlib.context import CryptContext  # Для шифрования паролей
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer  # Для авторизации через токены
from sqlalchemy.orm import Session
from typing import Iterable, Set
import os
from pathlib import Path
from dotenv import load_dotenv
from .database import get_db
from .models import User as UserModel
from .schemas import TokenData, UserRole

# Загружаем настройки из файла .env
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# Секретный ключ для шифрования токенов
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    # Ошибка если ключ не найден
    raise ValueError("SECRET_KEY environment variable not set. Please set it in your .env file.")

ALGORITHM = "HS256"  # Алгоритм шифрования токенов
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # Короткоживущий access token
REFRESH_TOKEN_EXPIRE_DAYS = 7     # Долгоживущий refresh token

# Настройки для шифрования паролей
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# Настройки OAuth2 (стандарт авторизации)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

ROLE_PERMISSIONS = {
    UserRole.user.value: {
        "poll:read",
        "poll:create",
        "poll:vote",
        "poll:update_own",
        "poll:delete_own",
        "profile:read_own",
        "profile:update_own",
        "profile:avatar_manage",
    },
    UserRole.moderator.value: {
        "poll:read",
        "poll:create",
        "poll:vote",
        "poll:update_own",
        "poll:update_any",
        "poll:delete_own",
        "poll:delete_any",
        "profile:read_own",
        "profile:update_own",
        "profile:avatar_manage",
    },
    UserRole.admin.value: {
        "poll:read",
        "poll:create",
        "poll:vote",
        "poll:update_own",
        "poll:update_any",
        "poll:delete_own",
        "poll:delete_any",
        "profile:read_own",
        "profile:update_own",
        "profile:avatar_manage",
        "user:manage_roles",
    },
}

def verify_password(plain_password, hashed_password):
    """Сравнивает введённый пароль с зашифрованным из базы данных"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Превращает обычный пароль в безопасный хеш"""
    return pwd_context.hash(password)

def get_user(db: Session, email: str):
    """Ищет пользователя в базе данных по email"""
    return db.query(UserModel).filter(UserModel.email == email).first()


def get_user_by_id(db: Session, user_id: int):
    """Ищет пользователя в базе данных по id"""
    return db.query(UserModel).filter(UserModel.id == user_id).first()

def authenticate_user(db: Session, email: str, password: str):
    """Проверяет правильность email и пароля"""
    # 1. Ищем пользователя по email
    user = get_user(db, email)
    if not user:
        return False

    # 2. Проверяем правильность пароля
    if not verify_password(password, user.hashed_password):
        return False

    return user  # Возвращаем пользователя если всё правильно

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Создаёт новый токен доступа"""
    # Копируем данные чтобы не испортить оригинал
    to_encode = data.copy()

    # Устанавливаем срок действия токена
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)

    # Добавляем срок действия в данные
    to_encode.update({"exp": expire})

    # Шифруем данные в токен
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Проверяет токен и возвращает текущего пользователя"""
    # Готовим стандартную ошибку для неверных токенов
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось подтвердить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 1. Расшифровываем токен
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        token_type = payload.get("type")
        if token_type != "access":
            raise credentials_exception

        # 2. Получаем user_id из токена
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
        try:
            user_id = int(sub)
        except ValueError:
            raise credentials_exception

        # 3. Сохраняем данные токена
        token_data = TokenData(user_id=user_id, email=payload.get("email"))

    except JWTError:
        # Если токен неверный или истёк
        raise credentials_exception

    # 4. Ищем пользователя в базе данных
    user = get_user_by_id(db, user_id=token_data.user_id)
    if user is None:
        raise credentials_exception

    return user  # Возвращаем найденного пользователя


def get_permissions_for_role(role: str) -> Set[str]:
    """Возвращает множество разрешений для роли."""
    return ROLE_PERMISSIONS.get(role, set())


def has_permissions(user: UserModel, required_permissions: Iterable[str]) -> bool:
    """Проверяет, есть ли у пользователя все требуемые права."""
    user_permissions = get_permissions_for_role(user.role)
    return all(permission in user_permissions for permission in required_permissions)


def require_permissions(*required_permissions: str):
    """FastAPI dependency-guard: блокирует доступ если не хватает прав."""
    async def permissions_guard(current_user: UserModel = Depends(get_current_user)):
        if not has_permissions(current_user, required_permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для выполнения действия" ,
            )
        return current_user

    return permissions_guard
