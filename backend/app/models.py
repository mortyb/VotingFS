from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

# Таблица пользователей
class User(Base):
    __tablename__ = "users"  # Название таблицы в базе данных
    
    # Колонки (поля) таблицы:
    id = Column(Integer, primary_key=True, index=True)  # Уникальный ID
    email = Column(String, unique=True, index=True)     # Email (уникальный)
    hashed_password = Column(String)                    # Зашифрованный пароль
    full_name = Column(String, nullable=True)           # Полное имя (может быть пустым)
    avatar_url = Column(String, nullable=True)          # Ссылка на фото профиля
    bio = Column(Text, nullable=True)                   # Информация о себе
    role = Column(String, nullable=False, default="user", server_default="user")  # Роль в системе RBAC
    is_active = Column(Boolean, default=True)           # Активен ли пользователь
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # Дата регистрации
    
    # Связи с другими таблицами:
    polls = relationship("Poll", backref="creator")      # Созданные опросы
    votes = relationship("Vote", back_populates="user")  # Голоса пользователя
    refresh_tokens = relationship("RefreshToken", back_populates="user")  # refresh-сессии пользователя

# Таблица опросов
class Poll(Base):
    __tablename__ = "polls"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)                   # Заголовок опроса
    description = Column(Text)                           # Описание
    image_url = Column(String, nullable=True)            # Картинка опроса
    is_active = Column(Boolean, default=True)            # Активен ли опрос
    is_anonymous = Column(Boolean, default=True)         # Анонимное голосование?
    created_by = Column(Integer, ForeignKey("users.id")) # Кто создал (ссылка на User)
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # Дата создания
    category = Column(String, nullable=True, default="Общее") # Простая категория
    # Связи:
    options = relationship("PollOption", back_populates="poll")  # Варианты ответов
    votes = relationship("Vote", back_populates="poll")          # Голоса в этом опросе

# Таблица вариантов ответов
class PollOption(Base):
    __tablename__ = "poll_options"
    
    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(Integer, ForeignKey("polls.id"))  # К какому опросу относится
    text = Column(String)                              # Текст варианта ("Да", "Нет" и т.д.)
    
    # Связи:
    poll = relationship("Poll", back_populates="options")  # Связь с опросом
    votes = relationship("Vote", back_populates="option")  # Голоса за этот вариант

# Таблица голосов
class Vote(Base):
    __tablename__ = "votes"
    
    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(Integer, ForeignKey("polls.id"))          # В каком опросе
    option_id = Column(Integer, ForeignKey("poll_options.id")) # За какой вариант
    user_id = Column(Integer, ForeignKey("users.id"))          # Кто проголосовал
    voted_at = Column(DateTime(timezone=True), server_default=func.now())  # Когда проголосовал
    
    # Связи:
    poll = relationship("Poll", back_populates="votes")        # Связь с опросом
    option = relationship("PollOption", back_populates="votes") # Связь с вариантом
    user = relationship("User", back_populates="votes")        # Связь с пользователем


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    jti_hash = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    replaced_by_jti_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="refresh_tokens")
