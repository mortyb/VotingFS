import pytest

from app.services.external_quote_service import ExternalQuoteService


@pytest.mark.unit
def test_normalize_payload_supports_dummyjson_shape():
    service = ExternalQuoteService(base_url="https://dummyjson.com")

    quote = service._normalize_payload(
        {
            "id": 1,
            "quote": "Stay hungry, stay foolish",
            "author": "Steve Jobs",
        }
    )

    assert quote is not None
    assert quote.text == "Stay hungry, stay foolish"
    assert quote.author == "Steve Jobs"
    assert quote.fallback is False


@pytest.mark.unit
def test_get_featured_quote_returns_fallback_on_remote_failure(monkeypatch):
    service = ExternalQuoteService(base_url="https://example.invalid")

    monkeypatch.setattr(service, "_fetch_remote_quote", lambda: None)

    quote = service.get_featured_quote()

    assert quote.fallback is True
    assert quote.source == "local-fallback"
    assert quote.text


@pytest.mark.unit
def test_get_featured_quote_uses_cache(monkeypatch):
    service = ExternalQuoteService(base_url="https://dummyjson.com")
    calls = {"count": 0}

    def _fake_fetch():
        calls["count"] += 1
        return service._normalize_payload(
            {"quote": "One quote", "author": "Author"}
        )

    monkeypatch.setattr(service, "_fetch_remote_quote", _fake_fetch)

    first = service.get_featured_quote()
    second = service.get_featured_quote()

    assert calls["count"] == 1
    assert first.text == second.text


@pytest.mark.unit
def test_normalize_payload_handles_empty_payload():
    service = ExternalQuoteService(base_url="https://dummyjson.com")

    quote = service._normalize_payload({})

    assert quote is None
