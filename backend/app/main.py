import json  # Для работы с JSON данными
import os  # Для работы с системными переменными
import uuid  # Для генерации уникальных имён файлов
from datetime import timedelta
from pathlib import Path
from typing import List, Literal, Optional  # Для типизации списков
from urllib.parse import urlparse
from xml.sax.saxutils import escape as xml_escape

from dotenv import load_dotenv  # Для загрузки настроек
from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware  # Для работы с фронтендом

# MinIO - хранилище для файлов (как Dropbox, но локальное)
from minio import Minio
from minio.error import S3Error
from sqlalchemy import func, inspect, or_, text
from sqlalchemy.orm import Session  # Для работы с базой данных

from .auth import (
    get_current_user,
    get_password_hash,
    get_permissions_for_role,
    require_permissions,
)  # Функции авторизации

# Наши локальные файлы
from .database import Base, engine, get_db  # Подключение к базе данных
from .dependencies import get_auth_service
from .models import Poll as PollModel
from .models import PollOption as PollOptionModel
from .models import User as UserModel  # Таблицы базы данных
from .models import Vote as VoteModel
from .schemas import (
    AccessTokenResponse,
    FeaturedQuote,
    LoginRequest,
    PaginatedPolls,
    PollOptionWithVotes,
    PollWithResults,
    UpdateUserRoleRequest,
    UserCreate,
    UserProfile,
    UserRole,
    UserSession,
    UserUpdate,
    VoteCreate,
)  # Структуры данных
from .schemas import (
    Poll as PollSchema,
)
from .schemas import (
    User as UserSchema,
)
from .services.auth_service import AuthService
from .services.external_quote_service import build_featured_quote_payload

# Загружаем настройки из файла .env (пароли, адреса и т.д.)
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# Создаём таблицы в базе данных если их нет
Base.metadata.create_all(bind=engine)


def apply_rbac_migrations():
    with engine.begin() as connection:
        inspector = inspect(connection)
        column_names = {column["name"] for column in inspector.get_columns("users")}
        if "role" not in column_names:
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'user'"
                )
            )


apply_rbac_migrations()

# Создаём основное приложение
app = FastAPI(title="Polling System API")


def get_cors_origins() -> list[str]:
    raw_origins = os.getenv("BACKEND_CORS_ORIGINS", "")
    if raw_origins.strip():
        return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost",
        "http://127.0.0.1",
    ]

# Настройка CORS - разрешаем общение с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),  # Явно разрешённые origin
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",  # Любой локальный dev-порт
    allow_credentials=True,  # Разрешаем куки
    allow_methods=["*"],  # Разрешаем все методы (GET, POST и т.д.)
    allow_headers=["*"],  # Разрешаем все заголовки
)

# --- НАСТРОЙКА ХРАНИЛИЩА ФАЙЛОВ (MinIO) ---
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")  # Адрес хранилища
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")  # Ключ доступа
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")  # Секретный ключ
MINIO_BUCKET = os.getenv("MINIO_BUCKET_NAME", "polls-images")  # Название "папки"
MINIO_SECURE = (
    os.getenv("MINIO_SECURE", "False").lower() == "true"
)  # Использовать HTTPS?
MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Создаём клиент для работы с хранилищем
minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE,
)


def init_minio():
    """Создаёт bucket для картинок (по умолчанию приватный)."""
    try:
        if not minio_client.bucket_exists(MINIO_BUCKET):
            minio_client.make_bucket(MINIO_BUCKET)
            print(f"Папка '{MINIO_BUCKET}' создана.")
        private_policy = {"Version": "2012-10-17", "Statement": []}
        minio_client.set_bucket_policy(MINIO_BUCKET, json.dumps(private_policy))
    except Exception as err:
        print(
            f"\n ВНИМАНИЕ: Не удалось подключиться к хранилищу по адресу {MINIO_ENDPOINT}."
        )
        print(" Загрузка картинок работать НЕ БУДЕТ.")
        print(f" Ошибка: {err}\n")


def normalize_storage_key(file_ref: Optional[str]) -> Optional[str]:
    """Преобразует ссылку/ключ в ключ объекта внутри bucket."""
    if not file_ref:
        return None
    if "://" not in file_ref:
        return file_ref.lstrip("/")

    parsed = urlparse(file_ref)
    path = parsed.path.lstrip("/")
    bucket_prefix = f"{MINIO_BUCKET}/"
    if path.startswith(bucket_prefix):
        return path[len(bucket_prefix) :]
    return path


def build_presigned_url(
    file_ref: Optional[str], expires_seconds: int = 3600
) -> Optional[str]:
    """Генерирует временную ссылку на приватный объект."""
    object_key = normalize_storage_key(file_ref)
    if not object_key:
        return None
    try:
        return minio_client.presigned_get_object(
            MINIO_BUCKET,
            object_key,
            expires=timedelta(seconds=expires_seconds),
        )
    except Exception:
        return None


def validate_image_upload(file: UploadFile, file_size: int) -> None:
    """Проверяет тип и размер загружаемого изображения."""
    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Допустимые типы файлов: {', '.join(sorted(ALLOWED_IMAGE_CONTENT_TYPES))}",
        )
    if file_size > MAX_IMAGE_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400, detail="Размер файла не должен превышать 5MB"
        )


# Инициализируем хранилище
init_minio()

APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5173").rstrip("/")


def build_public_url(path: str) -> str:
    """Собирает абсолютный URL для sitemap/robots и SEO-ссылок."""
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{APP_BASE_URL}{normalized_path}"


def format_sitemap_lastmod(value) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


@app.get("/health", include_in_schema=False)
def healthcheck(db: Session = Depends(get_db)):
    """Проверка готовности backend и ключевых зависимостей."""
    db.execute(text("SELECT 1"))
    minio_status = "ok"
    try:
        minio_client.bucket_exists(MINIO_BUCKET)
    except Exception:
        minio_status = "degraded"

    return {
        "status": "ok",
        "database": "ok",
        "storage": minio_status,
    }


def build_sitemap_xml(db: Session) -> str:
    """Генерирует sitemap только для индексируемых страниц."""
    url_entries: list[dict[str, str | None]] = [
        {
            "loc": build_public_url("/"),
            "lastmod": None,
            "changefreq": "daily",
            "priority": "1.0",
        }
    ]

    sitemap_items = []
    for entry in url_entries:
        loc = entry["loc"] or ""
        changefreq = entry["changefreq"] or ""
        priority = entry["priority"] or ""

        item_parts = [
            "<url>",
            f"<loc>{xml_escape(loc)}</loc>",
        ]
        if entry.get("lastmod"):
            lastmod = entry["lastmod"] or ""
            item_parts.append(f"<lastmod>{xml_escape(lastmod)}</lastmod>")
        if changefreq:
            item_parts.append(f"<changefreq>{xml_escape(changefreq)}</changefreq>")
        if priority:
            item_parts.append(f"<priority>{xml_escape(priority)}</priority>")
        item_parts.append("</url>")
        sitemap_items.append("".join(item_parts))

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(sitemap_items)
        + "\n</urlset>"
    )


@app.get("/robots.txt", include_in_schema=False)
def robots_txt():
    """Открываем только индексируемые разделы и указываем sitemap."""
    content = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /login",
            "Disallow: /register",
            "Disallow: /profile",
            "Disallow: /create",
            "Disallow: /admin",
            "Disallow: /auth/",
            "Disallow: /app",
            f"Sitemap: {build_public_url('/sitemap.xml')}",
            "",
        ]
    )
    return Response(content=content, media_type="text/plain; charset=utf-8")


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap_xml(db: Session = Depends(get_db)):
    """Карта сайта для индексируемых страниц."""
    return Response(
        content=build_sitemap_xml(db),
        media_type="application/xml; charset=utf-8",
    )


@app.get(
    "/integration/featured-quote", response_model=FeaturedQuote, include_in_schema=False
)
def featured_quote():
    """Сторонний API: мотивационная цитата для главной страницы."""
    try:
        payload = build_featured_quote_payload()
        return {
            "text": payload.get("text", "Каждый голос имеет значение."),
            "author": payload.get("author", "PollMaster"),
            "source": payload.get("source", "external-api"),
            "source_url": payload.get("source_url"),
            "fallback": bool(payload.get("fallback", False)),
        }
    except Exception:
        return {
            "text": "Каждый голос имеет значение.",
            "author": "PollMaster",
            "source": "local-fallback",
            "source_url": None,
            "fallback": True,
        }


@app.post("/register", response_model=UserSchema)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    # Проверяем, не зарегистрирован ли уже такой email
    db_user = db.query(UserModel).filter(UserModel.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    # Хешируем пароль (превращаем в безопасный код)
    hashed_password = get_password_hash(user.password)
    is_first_user = db.query(UserModel).count() == 0

    # Создаём нового пользователя
    db_user = UserModel(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        role=UserRole.admin.value if is_first_user else UserRole.user.value,
    )

    # Сохраняем в базу данных
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.post("/auth/login", response_model=AccessTokenResponse)
def login(
    credentials: LoginRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Вход: выдача короткого access + httpOnly refresh cookie."""
    tokens = auth_service.login(credentials.email, credentials.password)

    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/auth",
    )
    return {"access_token": tokens["access_token"], "token_type": tokens["token_type"]}


@app.post("/auth/refresh", response_model=AccessTokenResponse)
def refresh_access_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Обновление access token с ротацией refresh token."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token отсутствует"
        )

    tokens = auth_service.refresh(refresh_token)
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/auth",
    )
    return {"access_token": tokens["access_token"], "token_type": tokens["token_type"]}


@app.post("/auth/logout")
def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Выход: отзыв refresh token + очистка cookie."""
    auth_service.logout(refresh_token)
    response.delete_cookie(key="refresh_token", path="/auth")
    return {"message": "Сессия завершена"}


@app.get("/auth/me", response_model=UserSession)
def get_authenticated_user_session(
    current_user: UserModel = Depends(get_current_user),
):
    """Краткая информация о текущем пользователе."""
    return UserSession(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        permissions=sorted(list(get_permissions_for_role(current_user.role))),
    )


@app.get("/files/presigned-url")
def get_presigned_file_url(
    object_key: str = Query(..., min_length=1),
    current_user: UserModel = Depends(get_current_user),
):
    """Выдать защищённую временную ссылку для скачивания/просмотра файла."""
    _ = current_user
    signed_url = build_presigned_url(object_key)
    if not signed_url:
        raise HTTPException(status_code=404, detail="Файл не найден или недоступен")
    return {"url": signed_url}


@app.get("/profile", response_model=UserProfile)
def get_current_user_profile(
    current_user: UserModel = Depends(require_permissions("profile:read_own")),
    db: Session = Depends(get_db),
):
    """Получить профиль текущего пользователя"""
    # Подсчитываем статистику пользователя
    polls_created = (
        db.query(PollModel).filter(PollModel.created_by == current_user.id).count()
    )
    votes_count = (
        db.query(VoteModel).filter(VoteModel.user_id == current_user.id).count()
    )

    # Создаём профиль с данными
    user_profile = UserProfile(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        bio=current_user.bio,
        avatar_url=build_presigned_url(current_user.avatar_url),
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        polls_created=polls_created,
        votes_count=votes_count,
        permissions=sorted(list(get_permissions_for_role(current_user.role))),
    )

    return user_profile


@app.put("/profile", response_model=UserSchema)
def update_profile(
    user_update: UserUpdate,
    current_user: UserModel = Depends(require_permissions("profile:update_own")),
    db: Session = Depends(get_db),
):
    """Обновить данные профиля (имя, описание, пароль)"""
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name

    if user_update.bio is not None:
        current_user.bio = user_update.bio

    if user_update.password is not None:
        current_user.hashed_password = get_password_hash(user_update.password)

    db.commit()
    db.refresh(current_user)
    return current_user


@app.post("/profile/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(require_permissions("profile:avatar_manage")),
    db: Session = Depends(get_db),
):
    """Загрузить новую аватарку пользователя"""
    # Удаляем старую аватарку если она есть
    old_avatar_key = normalize_storage_key(current_user.avatar_url)
    if old_avatar_key:
        try:
            minio_client.remove_object(MINIO_BUCKET, old_avatar_key)
        except Exception:
            pass  # Игнорируем ошибки при удалении старого файла

    # Загружаем новую аватарку
    try:
        # Определяем размер файла
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        validate_image_upload(file, file_size)

        # Генерируем уникальное имя файла
        file_extension = file.filename.split(".")[-1]
        object_key = f"avatars/{uuid.uuid4()}.{file_extension}"

        # Загружаем в хранилище
        minio_client.put_object(
            MINIO_BUCKET,
            object_key,
            file.file,
            length=file_size,
            content_type=file.content_type,
        )

        # Сохраняем ссылку в базу данных
        current_user.avatar_url = object_key
        db.commit()

        return {
            "avatar_url": build_presigned_url(object_key),
            "message": "Аватар загружен успешно",
        }

    except S3Error as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка загрузки аватара: {str(e)}"
        )


@app.delete("/profile/avatar")
async def delete_avatar(
    current_user: UserModel = Depends(require_permissions("profile:avatar_manage")),
    db: Session = Depends(get_db),
):
    """Удалить аватарку пользователя"""
    if not current_user.avatar_url:
        raise HTTPException(status_code=404, detail="Нет аватара для удаления")

    try:
        # Удаляем файл из хранилища
        object_key = normalize_storage_key(current_user.avatar_url)
        if object_key:
            minio_client.remove_object(MINIO_BUCKET, object_key)

        # Удаляем ссылку из базы данных
        current_user.avatar_url = None
        db.commit()

        return {"message": "Аватар удалён успешно"}

    except S3Error as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка удаления аватара: {str(e)}"
        )


@app.post("/polls", response_model=PollSchema)
def create_poll(
    title: str = Form(...),
    description: str = Form(None),
    is_anonymous: bool = Form(True),
    category: str = Form("Общее"),
    options_json: str = Form(...),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permissions("poll:create")),
):
    """Создать новый опрос"""
    cleaned_title = title.strip()
    if not cleaned_title:
        raise HTTPException(
            status_code=400, detail="Название опроса не может быть пустым"
        )
    cleaned_category = category.strip() if category else "Общее"
    if not cleaned_category:
        raise HTTPException(status_code=400, detail="Категория не может быть пустой")

    image_key = None

    # 1. Загрузка картинки опроса (если есть)
    if file:
        try:
            # Определяем размер файла
            file.file.seek(0, 2)
            file_size = file.file.tell()
            file.file.seek(0)
            validate_image_upload(file, file_size)

            # Генерируем уникальное имя файла
            file_extension = file.filename.split(".")[-1]
            object_key = f"polls/{uuid.uuid4()}.{file_extension}"

            # Загружаем в хранилище
            minio_client.put_object(
                MINIO_BUCKET,
                object_key,
                file.file,
                length=file_size,
                content_type=file.content_type,
            )

            image_key = object_key

        except S3Error as e:
            raise HTTPException(
                status_code=500, detail=f"Ошибка загрузки картинки: {str(e)}"
            )

    # 2. Обработка вариантов ответа (они приходят как JSON строка)
    try:
        options_list = json.loads(options_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Неверный формат вариантов ответа")
    if not isinstance(options_list, list):
        raise HTTPException(
            status_code=400, detail="Варианты ответа должны быть списком"
        )
    cleaned_option_texts = [
        item.get("text", "").strip() for item in options_list if isinstance(item, dict)
    ]
    if len(cleaned_option_texts) < 2 or any(not text for text in cleaned_option_texts):
        raise HTTPException(
            status_code=400, detail="Нужно минимум 2 непустых варианта ответа"
        )

    # 3. Сохранение опроса в базу данных
    db_poll = PollModel(
        title=cleaned_title,
        description=description,
        is_anonymous=is_anonymous,
        category=cleaned_category,
        image_url=image_key,
        created_by=current_user.id,
    )
    db.add(db_poll)
    db.commit()
    db.refresh(db_poll)

    # 4. Сохранение вариантов ответа
    for option_text in cleaned_option_texts:
        db_option = PollOptionModel(poll_id=db_poll.id, text=option_text)
        db.add(db_option)

    db.commit()
    db.refresh(db_poll)
    db_poll.image_url = build_presigned_url(db_poll.image_url)
    return db_poll


@app.get("/polls", response_model=PaginatedPolls)  # response_model
def get_polls(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=50),
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Literal["newest", "oldest", "title_asc", "title_desc"] = "newest",
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permissions("poll:read")),
):
    """Получить список активных опросов с фильтрацией и пагинацией"""

    # Базовый запрос
    query = db.query(PollModel).filter(PollModel.is_active == True)

    # Фильтр по категории
    if category and category != "Все":
        query = query.filter(PollModel.category == category)

    # Поиск
    if search and search.strip():
        search_lower = search.lower().strip()
        search_pattern = f"%{search_lower}%"
        query = query.filter(
            or_(
                func.lower(PollModel.title).like(search_pattern),
                func.lower(PollModel.description).like(search_pattern),
            )
        )

    # Получаем общее количество (до пагинации)
    total = query.count()

    # Сортировка
    if sort_by == "newest":
        query = query.order_by(PollModel.created_at.desc())
    elif sort_by == "oldest":
        query = query.order_by(PollModel.created_at.asc())
    elif sort_by == "title_asc":
        query = query.order_by(func.lower(PollModel.title).asc())
    elif sort_by == "title_desc":
        query = query.order_by(func.lower(PollModel.title).desc())

    # Пагинация
    polls = query.offset(skip).limit(limit).all()
    for poll in polls:
        poll.image_url = build_presigned_url(poll.image_url)

    # Возвращаем пагинированный ответ
    return PaginatedPolls(
        polls=polls, total=total, skip=skip, limit=limit, has_more=skip + limit < total
    )


# endpoint для получения всех категорий
@app.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    """Получить список всех используемых категорий"""
    categories = (
        db.query(PollModel.category)
        .filter(PollModel.category.isnot(None), PollModel.is_active == True)
        .distinct()
        .all()
    )

    # Преобразуем результат
    category_list = [cat[0] for cat in categories if cat[0]]

    # Добавляем дефолтные если нет
    default_categories = ["Общее", "Развлечения", "Политика", "Технологии", "Спорт"]
    all_categories = list(set(category_list + default_categories))

    return {"categories": sorted(all_categories)}


@app.get("/polls/{poll_id}", response_model=PollWithResults)
def get_poll(
    poll_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permissions("poll:read")),
):
    """Получить подробную информацию об опросе с результатами"""
    # Ищем опрос по ID
    poll = db.query(PollModel).filter(PollModel.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Опрос не найден")

    # Проверяем, голосовал ли текущий пользователь
    user_vote = (
        db.query(VoteModel)
        .filter(VoteModel.poll_id == poll_id, VoteModel.user_id == current_user.id)
        .first()
    )
    user_voted = user_vote is not None  # True если голосовал, False если нет

    # Подсчитываем голоса для каждого варианта
    options_with_votes = []
    total_votes = 0

    for option in poll.options:
        # Считаем сколько голосов у этого варианта
        vote_count = (
            db.query(VoteModel).filter(VoteModel.option_id == option.id).count()
        )
        total_votes += vote_count

        # Если опрос не анонимный - собираем email проголосовавших
        voter_emails = []
        if not poll.is_anonymous:
            votes = db.query(VoteModel).filter(VoteModel.option_id == option.id).all()
            for vote in votes:
                user = db.query(UserModel).filter(UserModel.id == vote.user_id).first()
                if user:
                    voter_emails.append(user.email)

        # Создаём вариант ответа с результатами
        option_with_votes = PollOptionWithVotes(
            id=option.id,
            poll_id=option.poll_id,
            text=option.text,
            vote_count=vote_count,
            voter_emails=voter_emails,
        )
        options_with_votes.append(option_with_votes)

    # Возвращаем опрос со всеми данными
    return PollWithResults(
        id=poll.id,
        title=poll.title,
        description=poll.description,
        is_active=poll.is_active,
        is_anonymous=poll.is_anonymous,
        created_by=poll.created_by,
        created_at=poll.created_at,
        options=options_with_votes,
        total_votes=total_votes,
        user_voted=user_voted,
        image_url=build_presigned_url(poll.image_url),
    )


@app.put("/polls/{poll_id}", response_model=PollSchema)
def update_poll(
    poll_id: int,
    title: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    is_anonymous: Optional[bool] = Form(default=None),
    category: Optional[str] = Form(default=None),
    options_json: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Обновить опрос с проверкой прав и обработкой файлов."""
    poll = db.query(PollModel).filter(PollModel.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Опрос не найден")

    can_update_any = "poll:update_any" in get_permissions_for_role(current_user.role)
    can_update_own = "poll:update_own" in get_permissions_for_role(current_user.role)
    if not can_update_any and not (
        can_update_own and poll.created_by == current_user.id
    ):
        raise HTTPException(
            status_code=403, detail="Недостаточно прав для редактирования этого опроса"
        )

    if title is not None:
        cleaned_title = title.strip()
        if not cleaned_title:
            raise HTTPException(
                status_code=400, detail="Название опроса не может быть пустым"
            )
        poll.title = cleaned_title
    if description is not None:
        poll.description = description
    if is_anonymous is not None:
        poll.is_anonymous = is_anonymous
    if category is not None:
        cleaned_category = category.strip()
        if not cleaned_category:
            raise HTTPException(
                status_code=400, detail="Категория не может быть пустой"
            )
        poll.category = cleaned_category

    if options_json is not None:
        poll_has_votes = (
            db.query(VoteModel).filter(VoteModel.poll_id == poll_id).first() is not None
        )
        if poll_has_votes:
            raise HTTPException(
                status_code=409,
                detail="Нельзя менять варианты ответа после начала голосования",
            )

        try:
            options_list = json.loads(options_json)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400, detail="Неверный формат вариантов ответа"
            )
        if not isinstance(options_list, list) or len(options_list) < 2:
            raise HTTPException(
                status_code=400, detail="Нужно указать минимум 2 варианта ответа"
            )
        option_texts = [
            item.get("text", "").strip()
            for item in options_list
            if isinstance(item, dict)
        ]
        if len(option_texts) < 2 or any(not text for text in option_texts):
            raise HTTPException(
                status_code=400, detail="Все варианты должны содержать текст"
            )

        db.query(PollOptionModel).filter(PollOptionModel.poll_id == poll_id).delete()
        for option_text in option_texts:
            db.add(PollOptionModel(poll_id=poll_id, text=option_text))

    if file is not None:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        validate_image_upload(file, file_size)

        old_image_key = normalize_storage_key(poll.image_url)
        file_extension = file.filename.split(".")[-1]
        new_image_key = f"polls/{uuid.uuid4()}.{file_extension}"

        try:
            minio_client.put_object(
                MINIO_BUCKET,
                new_image_key,
                file.file,
                length=file_size,
                content_type=file.content_type,
            )
        except S3Error as e:
            raise HTTPException(
                status_code=500, detail=f"Ошибка загрузки картинки: {str(e)}"
            )

        poll.image_url = new_image_key
        if old_image_key:
            try:
                minio_client.remove_object(MINIO_BUCKET, old_image_key)
            except Exception:
                pass

    db.commit()
    db.refresh(poll)
    poll.image_url = build_presigned_url(poll.image_url)
    return poll


@app.post("/polls/{poll_id}/vote")
def vote(
    poll_id: int,
    vote_data: VoteCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permissions("poll:vote")),
):
    """Проголосовать в опросе"""
    # Проверяем существует ли опрос и активен ли он
    poll = (
        db.query(PollModel)
        .filter(PollModel.id == poll_id, PollModel.is_active == True)
        .first()
    )
    if not poll:
        raise HTTPException(status_code=404, detail="Опрос не найден или не активен")

    # Проверяем, что выбранный вариант относится к этому опросу
    option = (
        db.query(PollOptionModel)
        .filter(
            PollOptionModel.id == vote_data.option_id,
            PollOptionModel.poll_id == poll_id,
        )
        .first()
    )
    if not option:
        raise HTTPException(
            status_code=400, detail="Неверный вариант ответа для этого опроса"
        )

    # Проверяем, не голосовал ли пользователь уже в этом опросе
    existing_vote = (
        db.query(VoteModel)
        .filter(VoteModel.poll_id == poll_id, VoteModel.user_id == current_user.id)
        .first()
    )
    if existing_vote:
        raise HTTPException(status_code=400, detail="Вы уже голосовали в этом опросе")

    # Сохраняем голос в базу данных
    db_vote = VoteModel(
        poll_id=poll_id, option_id=vote_data.option_id, user_id=current_user.id
    )
    db.add(db_vote)
    db.commit()

    return {"message": "Голос учтён успешно"}


@app.delete("/polls/{poll_id}")
def delete_poll(
    poll_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Удалить опрос (может только создатель)"""
    # Проверяем существует ли опрос
    poll = db.query(PollModel).filter(PollModel.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Опрос не найден")

    can_delete_any = "poll:delete_any" in get_permissions_for_role(current_user.role)
    can_delete_own = "poll:delete_own" in get_permissions_for_role(current_user.role)

    # Ограничения: обычный user удаляет только свои, moderator/admin - любые
    if can_delete_any:
        pass
    elif can_delete_own and poll.created_by == current_user.id:
        pass
    else:
        raise HTTPException(
            status_code=403, detail="Недостаточно прав для удаления этого опроса"
        )

    image_key = normalize_storage_key(poll.image_url)
    if image_key:
        try:
            minio_client.remove_object(MINIO_BUCKET, image_key)
        except Exception:
            pass

    # Удаляем все связанные данные: голоса, варианты ответов, сам опрос
    db.query(VoteModel).filter(VoteModel.poll_id == poll_id).delete()
    db.query(PollOptionModel).filter(PollOptionModel.poll_id == poll_id).delete()
    db.delete(poll)
    db.commit()

    return {"message": "Опрос удалён успешно"}


@app.get("/admin/users", response_model=List[UserSchema])
def list_users_for_admin(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permissions("user:manage_roles")),
):
    """Список пользователей для админ-панели."""
    _ = current_user
    return db.query(UserModel).order_by(UserModel.created_at.desc()).all()


@app.patch("/admin/users/{user_id}/role", response_model=UserSchema)
def update_user_role(
    user_id: int,
    role_update: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permissions("user:manage_roles")),
):
    """Изменение роли пользователя (доступно только admin)."""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if user.id == current_user.id and role_update.role != UserRole.admin:
        raise HTTPException(
            status_code=400, detail="Администратор не может понизить собственную роль"
        )

    user.role = role_update.role.value
    db.commit()
    db.refresh(user)
    return user
