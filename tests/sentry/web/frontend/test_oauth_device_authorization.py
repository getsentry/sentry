from functools import cached_property

from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apidevicecode import ApiDeviceCode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test
class OAuthDeviceAuthorizationTest(TestCase):
    """Tests for the OAuth 2.0 Device Authorization endpoint (RFC 8628 §3.1/§3.2)."""

    @cached_property
    def path(self) -> str:
        return "/oauth/device_authorization/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )

    def test_get_not_allowed(self) -> None:
        """GET method should not be allowed."""
        resp = self.client.get(self.path)
        assert resp.status_code == 405

    def test_missing_client_id(self) -> None:
        """Missing client_id should return invalid_client error."""
        resp = self.client.post(self.path, {})
        assert resp.status_code == 401
        data = json.loads(resp.content)
        assert data["error"] == "invalid_client"
        assert "client_id" in data.get("error_description", "")

    def test_invalid_client_id(self) -> None:
        """Invalid client_id should return invalid_client error."""
        resp = self.client.post(self.path, {"client_id": "invalid"})
        assert resp.status_code == 401
        data = json.loads(resp.content)
        assert data["error"] == "invalid_client"

    def test_inactive_application(self) -> None:
        """Inactive application should return invalid_client error."""
        self.application.status = ApiApplicationStatus.inactive
        self.application.save()

        resp = self.client.post(self.path, {"client_id": self.application.client_id})
        assert resp.status_code == 401
        data = json.loads(resp.content)
        assert data["error"] == "invalid_client"

    def test_success_no_scope(self) -> None:
        """Successful request without scope should return device code."""
        resp = self.client.post(self.path, {"client_id": self.application.client_id})
        assert resp.status_code == 200

        data = json.loads(resp.content)
        assert "device_code" in data
        assert "user_code" in data
        assert "verification_uri" in data
        assert "verification_uri_complete" in data
        assert "expires_in" in data
        assert "interval" in data

        # Verify device code was created
        device_code = ApiDeviceCode.objects.get(device_code=data["device_code"])
        assert device_code.application == self.application
        assert device_code.scope_list == []
        assert device_code.user_code == data["user_code"]

    def test_success_with_scope(self) -> None:
        """Successful request with scope should return device code."""
        resp = self.client.post(
            self.path,
            {"client_id": self.application.client_id, "scope": "project:read org:read"},
        )
        assert resp.status_code == 200

        data = json.loads(resp.content)
        device_code = ApiDeviceCode.objects.get(device_code=data["device_code"])
        assert set(device_code.scope_list) == {"project:read", "org:read"}

    def test_invalid_scope(self) -> None:
        """Invalid scope should return invalid_scope error."""
        resp = self.client.post(
            self.path,
            {"client_id": self.application.client_id, "scope": "invalid:scope"},
        )
        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_scope"

    def test_user_code_format(self) -> None:
        """User code should be in XXXX-XXXX format."""
        resp = self.client.post(self.path, {"client_id": self.application.client_id})
        assert resp.status_code == 200

        data = json.loads(resp.content)
        user_code = data["user_code"]

        # Should be 9 characters: XXXX-XXXX
        assert len(user_code) == 9
        assert user_code[4] == "-"
        # Should only contain uppercase letters (base-20 alphabet)
        assert user_code[:4].isupper()
        assert user_code[5:].isupper()

    def test_verification_uri_complete(self) -> None:
        """verification_uri_complete should include the user code."""
        resp = self.client.post(self.path, {"client_id": self.application.client_id})
        assert resp.status_code == 200

        data = json.loads(resp.content)
        assert data["user_code"] in data["verification_uri_complete"]

    def test_cache_headers(self) -> None:
        """Response should have no-cache headers."""
        resp = self.client.post(self.path, {"client_id": self.application.client_id})
        assert resp.status_code == 200
        assert "no-cache" in resp.get("Cache-Control", "") or "no-store" in resp.get(
            "Cache-Control", ""
        )

    def test_org_level_app_scope_exceeds_max(self) -> None:
        """Org-level app should reject scope exceeding application max permissions."""
        org_app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="https://example.com",
            requires_org_level_access=True,
            scopes=["org:read"],  # App only allows org:read
        )

        # Request scope that exceeds app's max permissions
        resp = self.client.post(
            self.path,
            {"client_id": org_app.client_id, "scope": "org:read project:write"},
        )
        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_scope"
        assert "exceeds" in data.get("error_description", "").lower()

    def test_org_level_app_scope_within_max(self) -> None:
        """Org-level app should accept scope within application max permissions."""
        org_app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="https://example.com",
            requires_org_level_access=True,
            scopes=["org:read", "project:read"],
        )

        resp = self.client.post(
            self.path,
            {"client_id": org_app.client_id, "scope": "org:read"},
        )
        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert "device_code" in data
