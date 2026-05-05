import json

import pytest



def _register_and_login(client, email: str, password: str, full_name: str) -> str:
    assert (
        client.post(
            "/register",
            json={"email": email, "password": password, "full_name": full_name},
        ).status_code
        == 200
    )
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.mark.e2e
def test_end_to_end_auth_crud_filter_vote_and_logout(client):
    admin_token = _register_and_login(client, "admin@e2e.com", "StrongPass123!", "Admin")
    user_token = _register_and_login(client, "user@e2e.com", "StrongPass123!", "User")

    create_poll = client.post(
        "/polls",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={
            "title": "E2E Poll",
            "description": "Scenario",
            "is_anonymous": "false",
            "category": "Общее",
            "options_json": json.dumps([{"text": "A"}, {"text": "B"}]),
        },
    )
    assert create_poll.status_code == 200
    poll = create_poll.json()
    poll_id = poll["id"]

    list_filtered = client.get(
        "/polls",
        headers={"Authorization": f"Bearer {user_token}"},
        params={"search": "E2E", "category": "Общее", "sort_by": "title_asc"},
    )
    assert list_filtered.status_code == 200
    assert any(item["id"] == poll_id for item in list_filtered.json()["polls"])

    details = client.get(f"/polls/{poll_id}", headers={"Authorization": f"Bearer {user_token}"})
    assert details.status_code == 200
    option_id = details.json()["options"][0]["id"]

    vote = client.post(
        f"/polls/{poll_id}/vote",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"poll_id": poll_id, "option_id": option_id},
    )
    assert vote.status_code == 200

    duplicate_vote = client.post(
        f"/polls/{poll_id}/vote",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"poll_id": poll_id, "option_id": option_id},
    )
    assert duplicate_vote.status_code == 400

    delete_by_non_owner = client.delete(
        f"/polls/{poll_id}", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert delete_by_non_owner.status_code == 403

    delete_by_admin = client.delete(
        f"/polls/{poll_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert delete_by_admin.status_code == 200

    logout = client.post("/auth/logout")
    assert logout.status_code == 200


@pytest.mark.e2e
def test_end_to_end_external_api_graceful_degradation(client, monkeypatch):
    from app import main as main_module

    def _raise_external():
        raise TimeoutError("external api timeout")

    monkeypatch.setattr(main_module, "build_featured_quote_payload", _raise_external)

    response = client.get("/integration/featured-quote")
    assert response.status_code == 200
    body = response.json()
    assert body["fallback"] is True
    assert body["source"] == "local-fallback"
