import pytest


@pytest.mark.integration
def test_auth_login_me_refresh_logout_flow(client, admin_payload):
    register = client.post("/register", json=admin_payload)
    assert register.status_code == 200

    login = client.post(
        "/auth/login",
        json={"email": admin_payload["email"], "password": admin_payload["password"]},
    )
    assert login.status_code == 200
    login_data = login.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"

    access_token = login_data["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me.status_code == 200
    me_data = me.json()
    assert me_data["email"] == admin_payload["email"]
    assert me_data["role"] == "admin"
    assert "user:manage_roles" in me_data["permissions"]

    refreshed = client.post("/auth/refresh")
    assert refreshed.status_code == 200
    refreshed_token = refreshed.json()["access_token"]
    assert refreshed_token

    me_after_refresh = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {refreshed_token}"}
    )
    assert me_after_refresh.status_code == 200

    logout = client.post("/auth/logout")
    assert logout.status_code == 200

    after_logout_refresh = client.post("/auth/refresh")
    assert after_logout_refresh.status_code == 401


@pytest.mark.integration
def test_register_duplicate_email_returns_400(client, user_payload):
    first = client.post("/register", json=user_payload)
    second = client.post("/register", json=user_payload)

    assert first.status_code == 200
    assert second.status_code == 400


@pytest.mark.integration
def test_auth_me_requires_valid_access_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
