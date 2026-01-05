from functools import cached_property
from unittest.mock import patch

from django.utils import timezone

from sentry.models.apiapplication import ApiApplication
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apidevicecode import ApiDeviceCode, DeviceCodeStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuthDeviceVerificationTest(TestCase):
    """Tests for the OAuth 2.0 Device Verification UI (RFC 8628 §3.3)."""

    @cached_property
    def path(self) -> str:
        return "/oauth/device/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com", name="Test App"
        )
        self.device_code = ApiDeviceCode.objects.create(
            application=self.application,
            scope_list=["project:read", "org:read"],
        )

    def test_get_unauthenticated_shows_login(self) -> None:
        """GET without authentication should show login form."""
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert b"login" in resp.content.lower() or b"sign in" in resp.content.lower()

    def test_get_with_user_code_stores_in_session(self) -> None:
        """GET with user_code parameter should store it in session for after login."""
        resp = self.client.get(f"{self.path}?user_code={self.device_code.user_code}")
        assert resp.status_code == 200
        assert self.client.session.get("device_user_code") == self.device_code.user_code.upper()

    def test_get_authenticated_shows_entry_form(self) -> None:
        """GET while authenticated should show user code entry form."""
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert b"user_code" in resp.content.lower()

    def test_get_with_valid_user_code_shows_approval_form(self) -> None:
        """GET with valid user_code should show approval form."""
        self.login_as(self.user)
        resp = self.client.get(f"{self.path}?user_code={self.device_code.user_code}")
        assert resp.status_code == 200
        assert b"Test App" in resp.content
        assert b"approve" in resp.content.lower()

    def test_get_with_invalid_user_code_shows_error(self) -> None:
        """GET with invalid user_code should show error."""
        self.login_as(self.user)
        resp = self.client.get(f"{self.path}?user_code=XXXX-XXXX")
        assert resp.status_code == 200
        assert b"invalid" in resp.content.lower() or b"expired" in resp.content.lower()

    def test_post_user_code_shows_approval_form(self) -> None:
        """POST with user_code should show approval form."""
        self.login_as(self.user)
        resp = self.client.post(self.path, {"user_code": self.device_code.user_code})
        assert resp.status_code == 200
        assert b"Test App" in resp.content
        assert b"approve" in resp.content.lower()

    def test_post_user_code_normalized(self) -> None:
        """POST with user_code without dash should work."""
        self.login_as(self.user)
        # Remove dash from user code
        code_without_dash = self.device_code.user_code.replace("-", "")
        resp = self.client.post(self.path, {"user_code": code_without_dash})
        assert resp.status_code == 200
        assert b"Test App" in resp.content

    def test_post_user_code_case_insensitive(self) -> None:
        """POST with lowercase user_code should work."""
        self.login_as(self.user)
        resp = self.client.post(self.path, {"user_code": self.device_code.user_code.lower()})
        assert resp.status_code == 200
        assert b"Test App" in resp.content

    def test_approve_creates_authorization(self) -> None:
        """POST approve should create ApiAuthorization and mark device code approved."""
        self.login_as(self.user)

        # First show approval form to set up session
        self.client.post(self.path, {"user_code": self.device_code.user_code})

        # Then approve
        resp = self.client.post(self.path, {"op": "approve"})
        assert resp.status_code == 200
        assert b"approved" in resp.content.lower()

        # Verify device code was approved
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.APPROVED
        assert self.device_code.user_id == self.user.id

        # Verify ApiAuthorization was created
        auth = ApiAuthorization.objects.get(application=self.application, user_id=self.user.id)
        assert set(auth.scope_list) == {"project:read", "org:read"}

    def test_deny_marks_device_code_denied(self) -> None:
        """POST deny should mark device code as denied."""
        self.login_as(self.user)

        # First show approval form to set up session
        self.client.post(self.path, {"user_code": self.device_code.user_code})

        # Then deny
        resp = self.client.post(self.path, {"op": "deny"})
        assert resp.status_code == 200
        assert b"denied" in resp.content.lower()

        # Verify device code was denied
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.DENIED

    def test_expired_device_code_shows_error(self) -> None:
        """Expired device code should show error."""
        self.login_as(self.user)
        self.device_code.expires_at = timezone.now() - timezone.timedelta(minutes=1)
        self.device_code.save()

        resp = self.client.post(self.path, {"user_code": self.device_code.user_code})
        assert resp.status_code == 200
        assert b"expired" in resp.content.lower()

        # Device code should be deleted
        assert not ApiDeviceCode.objects.filter(id=self.device_code.id).exists()

    def test_invalid_operation_shows_error(self) -> None:
        """Invalid operation should show error."""
        self.login_as(self.user)

        # First show approval form to set up session
        self.client.post(self.path, {"user_code": self.device_code.user_code})

        # Then submit invalid operation
        resp = self.client.post(self.path, {"op": "invalid"})
        assert resp.status_code == 200
        assert b"invalid" in resp.content.lower()

    def test_session_expired_shows_error(self) -> None:
        """Stale session should show error."""
        self.login_as(self.user)

        # Submit without setting up session first
        resp = self.client.post(self.path, {"op": "approve"})
        assert resp.status_code == 200
        assert b"session" in resp.content.lower() or b"start over" in resp.content.lower()

    def test_rate_limiting(self) -> None:
        """Rate limiting should prevent brute force attacks."""
        self.login_as(self.user)

        # Mock the rate limiter to simulate being rate limited
        with patch("sentry.web.frontend.oauth_device.ratelimiter") as mock_ratelimiter:
            mock_ratelimiter.is_limited.return_value = True

            resp = self.client.post(self.path, {"user_code": "XXXX-XXXX"})
            assert resp.status_code == 200
            assert b"too many" in resp.content.lower() or b"wait" in resp.content.lower()


@control_silo_test
class OAuthDeviceVerificationOrgLevelTest(TestCase):
    """Tests for org-level access applications in device flow.

    Note: Full approval flow testing with organizations is limited in control_silo_test
    due to cross-silo RPC limitations. Core org-level validation is tested here.
    """

    @cached_property
    def path(self) -> str:
        return "/oauth/device/"

    def test_org_level_app_requires_user_with_organization(self) -> None:
        """Users without organizations cannot use org-level access apps."""
        application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="https://example.com",
            name="Org Level App",
            requires_org_level_access=True,
            scopes=["project:read", "org:read"],
        )
        device_code = ApiDeviceCode.objects.create(
            application=application,
            scope_list=["project:read"],
        )
        self.login_as(self.user)

        # In control_silo_test, user_service.get_organizations returns empty
        # This correctly shows the "must be member of organization" error
        resp = self.client.post(self.path, {"user_code": device_code.user_code})
        assert resp.status_code == 200
        assert b"members of an organization" in resp.content
