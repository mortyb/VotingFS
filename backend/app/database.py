from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path
from dotenv import load_dotenv

# Загружаем настройки из файла .env (пароли, адреса)
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# Получаем адрес базы данных из настроек
# По умолчанию используем SQLite (локальный файл базы данных)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./polling.db")

# Для SQLite нужен специальный флаг, для Postgres/MySQL он не нужен.
engine_kwargs = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

# Создаём "движок" для подключения к базе данных
engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)

# Создаём фабрику для сессий (подключений к базе)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для всех моделей (таблиц)
Base = declarative_base()

# Функция для получения сессии базы данных
def get_db():
    # Создаём новое подключение к базе
    db = SessionLocal()
    try:
        # Отдаём подключение вызывающему коду
        yield db
    finally:
        # Закрываем подключение когда оно больше не нужно
        db.close()
