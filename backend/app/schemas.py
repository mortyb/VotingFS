from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr


class UserRole(str, Enum):
    user = "user"
    moderator = "moderator"
    admin = "admin"


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    bio: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    password: Optional[str] = None


class User(UserBase):
    id: int
    role: UserRole
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True  # Позволяет создавать из SQLAlchemy объект pydantic


class UserProfile(User):
    polls_created: int = 0
    votes_count: int = 0
    permissions: List[str] = []

    class Config:
        from_attributes = True  # Позволяет создавать из SQLAlchemy объект pydantic


class PollOptionBase(BaseModel):
    text: str  # текст вариантов ответа


class PollOptionCreate(PollOptionBase):
    pass


class PollOption(PollOptionBase):
    id: int
    poll_id: int

    class Config:
        from_attributes = True  # Позволяет создавать из SQLAlchemy объект pydantic


class PollOptionWithVotes(PollOption):
    vote_count: int = 0
    voter_emails: List[str] = []

    class Config:
        from_attributes = True  # Позволяет создавать из SQLAlchemy объект pydantic


class PollBase(BaseModel):  # опрос
    title: str  # название опроса
    description: Optional[str] = None
    is_anonymous: bool = True
    category: Optional[str] = "Общее"


class PollCreate(PollBase):
    options: List[PollOptionCreate]  # список вариантов ответа


class Poll(PollBase):
    id: int
    image_url: Optional[str] = None
    is_active: bool
    created_by: int
    created_at: datetime
    options: List[PollOption]

    class Config:
        from_attributes = True  # Позволяет создавать из SQLAlchemy объект pydantic


class PollWithResults(Poll):
    options: List[PollOptionWithVotes]
    total_votes: int = 0
    user_voted: bool = False
    image_url: Optional[str] = None

    class Config:
        from_attributes = True  # Позволяет создавать из SQLAlchemy объект pydantic


class VoteBase(BaseModel):
    poll_id: int
    option_id: int


class VoteCreate(VoteBase):
    pass


class Vote(VoteBase):
    id: int
    user_id: int
    voted_at: datetime

    class Config:
        from_attributes = True  # Позволяет создавать из SQLAlchemy объект pydantic


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


class UserSession(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    permissions: List[str]

    class Config:
        from_attributes = True


class PaginatedPolls(BaseModel):
    polls: List[Poll]  # Список опросов на текущей странице
    total: int  # Общее количество опросов
    skip: int  # Сколько пропущено (offset)
    limit: int  # Сколько на странице
    has_more: bool  # Есть ли еще страницы

    class Config:
        from_attributes = True  # Позволяет создавать из SQLAlchemy объект pydantic


class FeaturedQuote(BaseModel):
    text: str
    author: str
    source: Optional[str] = None
    source_url: Optional[str] = None
    fallback: bool = False

    class Config:
        from_attributes = True
