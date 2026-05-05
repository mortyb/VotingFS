from __future__ import annotations

import json
import logging
import os
import random
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

logger = logging.getLogger(__name__)
_external_quote_service_singleton: "ExternalQuoteService | None" = None

# Гарантированно загружаем backend/app/.env даже если сервис используется вне app.main.
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")


@dataclass
class FeaturedQuote:
    text: str
    author: str = "Неизвестный автор"
    source: str = "external-api"
    source_url: str | None = None
    tags: list[str] = field(default_factory=list)
    fallback: bool = False
    fetched_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ExternalQuoteService:
    """
    Сервис-адаптер для получения мотивационной цитаты из стороннего API.

    По умолчанию использует совместимый с Quotable endpoint:
    - GET {base_url}/random
    - ответ: {"content": "...", "author": "...", "tags": [...]}

    Если внешний API недоступен, сервис возвращает безопасный fallback,
    чтобы приложение продолжало работать без деградации бизнес-логики.
    """

    DEFAULT_FALLBACK_QUOTES: list[tuple[str, str]] = [
        ("Хороший опрос начинается с хорошего вопроса.", "PollMaster"),
        ("Лучший способ узнать мнение — спросить людей.", "PollMaster"),
        ("Простота делает интерфейс понятным, а SEO — заметным.", "PollMaster"),
        ("Каждый голос имеет значение.", "PollMaster"),
        ("Проверяйте гипотезы, а не предположения.", "PollMaster"),
    ]

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        retry_count: Optional[int] = None,
        min_backoff_seconds: float = 0.3,
    ) -> None:
        self.base_url = (
            base_url
            or os.getenv("EXTERNAL_QUOTE_API_BASE_URL")
            or "https://api.quotable.io"
        ).rstrip("/")
        self.api_key = (
            api_key if api_key is not None else os.getenv("EXTERNAL_QUOTE_API_KEY")
        )
        self.timeout_seconds = float(
            timeout_seconds
            if timeout_seconds is not None
            else os.getenv("EXTERNAL_QUOTE_API_TIMEOUT_SECONDS", "3")
        )
        self.retry_count = int(
            retry_count
            if retry_count is not None
            else os.getenv("EXTERNAL_QUOTE_API_RETRY_COUNT", "2")
        )
        self.min_backoff_seconds = min_backoff_seconds
        self.min_interval_seconds = float(
            os.getenv("EXTERNAL_QUOTE_MIN_INTERVAL_SECONDS", "5")
        )
        self.cache_ttl_seconds = int(
            os.getenv("EXTERNAL_QUOTE_CACHE_TTL_SECONDS", "60")
        )
        self._last_request_monotonic = 0.0
        self._cached_quote: FeaturedQuote | None = None
        self._cached_at_monotonic = 0.0

    def get_featured_quote(self) -> FeaturedQuote:
        """
        Возвращает цитату для главной страницы.
        При сбое внешнего API всегда отдаёт fallback.
        """
        now = time.monotonic()
        if (
            self._cached_quote is not None
            and now - self._cached_at_monotonic <= self.cache_ttl_seconds
        ):
            return self._cached_quote

        if now - self._last_request_monotonic < self.min_interval_seconds:
            if self._cached_quote is not None:
                return self._cached_quote
            return self._fallback_quote()

        self._last_request_monotonic = now
        remote_result = self._fetch_remote_quote()
        if remote_result is not None:
            self._cached_quote = remote_result
            self._cached_at_monotonic = time.monotonic()
            return remote_result
        fallback = self._fallback_quote()
        self._cached_quote = fallback
        self._cached_at_monotonic = time.monotonic()
        return fallback

    def _fetch_remote_quote(self) -> Optional[FeaturedQuote]:
        path_candidates = [
            "/random",
            "/quotes/random",
            "/api/random",
        ]

        last_error: Exception | None = None

        for attempt in range(self.retry_count + 1):
            for path in path_candidates:
                try:
                    payload = self._perform_request(path)
                    normalized = self._normalize_payload(payload)
                    if normalized:
                        return normalized
                except Exception as exc:  # noqa: BLE001 - намеренно делаем graceful degradation
                    last_error = exc
                    logger.warning(
                        "External quote API request failed on attempt %s/%s: %s",
                        attempt + 1,
                        self.retry_count + 1,
                        exc,
                    )

            if attempt < self.retry_count:
                sleep_seconds = self.min_backoff_seconds * (2**attempt)
                time.sleep(sleep_seconds)

        if last_error:
            logger.info(
                "Falling back to local quote because external API is unavailable: %s",
                last_error,
            )
        return None

    def _perform_request(self, path: str) -> Any:
        url = f"{self.base_url}{path}"
        request = Request(url, method="GET")
        request.add_header("Accept", "application/json")

        if self.api_key:
            request.add_header("Authorization", f"Bearer {self.api_key}")

        with urlopen(request, timeout=self.timeout_seconds) as response:
            raw_body = response.read().decode("utf-8")
            if not raw_body.strip():
                raise ValueError("External quote API returned an empty response")
            return json.loads(raw_body)

    def _normalize_payload(self, payload: Any) -> Optional[FeaturedQuote]:
        """
        Поддерживает несколько форматов ответа:
        - dict: {content, author, tags}
        - dict: {text, author}
        - list[dict]: берём первый элемент
        """
        if isinstance(payload, list):
            if not payload:
                return None
            payload = payload[0]

        if not isinstance(payload, dict):
            return None

        text = (
            payload.get("content")
            or payload.get("text")
            or payload.get("quote")
            or payload.get("message")
        )
        if not text or not str(text).strip():
            return None

        author = payload.get("author") or payload.get("name") or "Неизвестный автор"

        tags_value = payload.get("tags") or payload.get("categories") or []
        if isinstance(tags_value, str):
            tags = [tag.strip() for tag in tags_value.split(",") if tag.strip()]
        elif isinstance(tags_value, list):
            tags = [str(tag).strip() for tag in tags_value if str(tag).strip()]
        else:
            tags = []

        source = payload.get("source") or self._extract_source_name()
        source_url = payload.get("source_url") or payload.get("url") or payload.get("link")
        return FeaturedQuote(
            text=str(text).strip(),
            author=str(author).strip(),
            source=source,
            source_url=str(source_url).strip() if source_url else None,
            tags=tags,
            fallback=False,
        )

    def _extract_source_name(self) -> str:
        try:
            return self.base_url.split("://", 1)[-1].split("/", 1)[0]
        except Exception:
            return "external-api"

    def _fallback_quote(self) -> FeaturedQuote:
        text, author = random.choice(self.DEFAULT_FALLBACK_QUOTES)
        return FeaturedQuote(
            text=text,
            author=author,
            source="local-fallback",
            source_url=None,
            tags=["fallback", "seo", "motivation"],
            fallback=True,
        )


def get_external_quote_service() -> ExternalQuoteService:
    global _external_quote_service_singleton
    if _external_quote_service_singleton is None:
        _external_quote_service_singleton = ExternalQuoteService()
    return _external_quote_service_singleton


def build_featured_quote_payload() -> dict[str, Any]:
    """
    Удобный helper для FastAPI-эндпоинта:
    возвращает уже нормализованный словарь.
    """
    service = get_external_quote_service()
    return service.get_featured_quote().to_dict()
