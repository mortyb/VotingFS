import json

import pytest



def _login(client, email: str, password: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.mark.integration
def test_admin_can_manage_roles_user_cannot(client):
    admin_payload = {
        "email": "admin@example.com",
        "password": "StrongPass123!",
        "full_name": "Admin",
    }
    user_payload = {
        "email": "user@example.com",
        "password": "StrongPass123!",
        "full_name": "User",
    }

    admin_reg = client.post("/register", json=admin_payload)
    user_reg = client.post("/register", json=user_payload)
    assert admin_reg.status_code == 200
    assert user_reg.status_code == 200

    admin_access = _login(client, admin_payload["email"], admin_payload["password"])
    list_users = client.get("/admin/users", headers={"Authorization": f"Bearer {admin_access}"})
    assert list_users.status_code == 200
    users = list_users.json()
    assert len(users) == 2

    target_user_id = next(u["id"] for u in users if u["email"] == user_payload["email"])
    promote = client.patch(
        f"/admin/users/{target_user_id}/role",
        json={"role": "moderator"},
        headers={"Authorization": f"Bearer {admin_access}"},
    )
    assert promote.status_code == 200
    assert promote.json()["role"] == "moderator"

    user_access = _login(client, user_payload["email"], user_payload["password"])
    forbidden = client.get("/admin/users", headers={"Authorization": f"Bearer {user_access}"})
    assert forbidden.status_code == 403


@pytest.mark.integration
def test_poll_create_validation_and_listing(client):
    admin_payload = {
        "email": "admin2@example.com",
        "password": "StrongPass123!",
        "full_name": "Admin2",
    }
    assert client.post("/register", json=admin_payload).status_code == 200
    access = _login(client, admin_payload["email"], admin_payload["password"])

    invalid = client.post(
        "/polls",
        headers={"Authorization": f"Bearer {access}"},
        data={
            "title": "Test",
            "description": "Desc",
            "is_anonymous": "true",
            "category": "Общее",
            "options_json": json.dumps([{"text": "Only one"}]),
        },
    )
    assert invalid.status_code == 400

    created = client.post(
        "/polls",
        headers={"Authorization": f"Bearer {access}"},
        data={
            "title": "Best language",
            "description": "Choose one",
            "is_anonymous": "false",
            "category": "Технологии",
            "options_json": json.dumps([{"text": "Python"}, {"text": "Go"}]),
        },
    )
    assert created.status_code == 200

    polls = client.get(
        "/polls",
        headers={"Authorization": f"Bearer {access}"},
        params={"skip": 0, "limit": 10, "search": "best", "sort_by": "newest"},
    )
    assert polls.status_code == 200
    body = polls.json()
    assert body["total"] >= 1
    assert body["polls"][0]["title"] == "Best language"


@pytest.mark.integration
def test_featured_quote_endpoint_handles_success_and_fallback(client, monkeypatch):
    from app import main as main_module

    monkeypatch.setattr(
        main_module,
        "build_featured_quote_payload",
        lambda: {
            "text": "External quote",
            "author": "API",
            "source": "external-api",
            "source_url": "https://example.com",
            "fallback": False,
        },
    )
    success = client.get("/integration/featured-quote")
    assert success.status_code == 200
    assert success.json()["fallback"] is False

    def _boom():
        raise RuntimeError("down")

    monkeypatch.setattr(main_module, "build_featured_quote_payload", _boom)
    fallback = client.get("/integration/featured-quote")
    assert fallback.status_code == 200
    assert fallback.json()["fallback"] is True
