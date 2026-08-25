from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.auth.authenticators.totp import TotpInterface
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.auth import SsoSession


@control_silo_test
class AuthLoginEndpointTest(APITestCase):
    endpoint = "sentry-api-0-auth-login"
    method = "post"

    def setUp(self) -> None:
        # Requests to set the test cookie
        self.client.get(reverse("sentry-api-0-auth-config"))

    def test_login_invalid_password(self) -> None:
        response = self.get_error_response(
            username=self.user.username, password="bizbar", status_code=400
        )
        assert response.data["errors"]["__all__"] == [
            "Please enter a correct username and password. Note that both fields may be case-sensitive."
        ]

    def test_login_valid_credentials(self) -> None:
        response = self.get_success_response(username=self.user.username, password="admin")
        assert response.data["nextUri"] == "/organizations/new/"

    def test_login_valid_credentials_with_organization(self) -> None:
        organization = self.create_organization(owner=self.user)

        response = self.get_success_response(username=self.user.username, password="admin")

        assert response.data["nextUri"] == f"/organizations/{organization.slug}/issues/"
        assert self.client.session["activeorg"] == organization.slug

    def test_login_valid_credentials_with_requested_organization(self) -> None:
        self.create_organization(owner=self.user, slug="org-a")
        requested_organization = self.create_organization(owner=self.user, slug="org-b")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            orgSlug=requested_organization.slug,
        )

        assert response.data["nextUri"] == f"/organizations/{requested_organization.slug}/issues/"
        assert self.client.session["activeorg"] == requested_organization.slug

    def test_login_valid_credentials_with_snake_case_organization(self) -> None:
        self.create_organization(owner=self.user, slug="org-a")
        requested_organization = self.create_organization(owner=self.user, slug="org-b")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            org_slug=requested_organization.slug,
        )

        assert response.data["nextUri"] == f"/organizations/{requested_organization.slug}/issues/"
        assert self.client.session["activeorg"] == requested_organization.slug

    def test_login_with_unknown_requested_organization_uses_default(self) -> None:
        default_organization = self.create_organization(owner=self.user, slug="org-a")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            orgSlug="missing-org",
        )

        assert response.data["nextUri"] == f"/organizations/{default_organization.slug}/issues/"
        assert self.client.session["activeorg"] == default_organization.slug

    def test_login_with_unauthorized_requested_organization_uses_default(self) -> None:
        self.user.update(is_superuser=False)
        default_organization = self.create_organization(owner=self.user, slug="org-a")
        other_user = self.create_user("other@example.com")
        self.create_organization(owner=other_user, slug="org-b")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            orgSlug="org-b",
        )

        assert response.data["nextUri"] == f"/organizations/{default_organization.slug}/issues/"
        assert self.client.session["activeorg"] == default_organization.slug

    def test_password_login_cannot_select_sso_required_organization(self) -> None:
        user = self.create_user(email="member@example.com")
        user.set_password("password")
        user.save()
        organization = self.create_organization(slug="sso-org")
        self.create_member(organization=organization, user=user)
        self.create_auth_provider(organization_id=organization.id, provider="dummy")

        response = self.get_success_response(
            username=user.username,
            password="password",
            orgSlug=organization.slug,
        )

        assert response.data["nextUri"] == reverse("sentry-account-settings")
        assert "activeorg" not in self.client.session
        assert SsoSession.django_session_key(organization.id) not in self.client.session

    def test_password_login_falls_back_from_sso_required_organization(self) -> None:
        user = self.create_user(email="member@example.com")
        user.set_password("password")
        user.save()
        sso_organization = self.create_organization(slug="sso-org")
        self.create_member(organization=sso_organization, user=user)
        self.create_auth_provider(organization_id=sso_organization.id, provider="dummy")
        password_organization = self.create_organization(owner=user, slug="password-org")

        response = self.get_success_response(
            username=user.username,
            password="password",
            orgSlug=sso_organization.slug,
        )

        assert response.data["nextUri"] == (f"/organizations/{password_organization.slug}/issues/")
        assert self.client.session["activeorg"] == password_organization.slug
        assert SsoSession.django_session_key(sso_organization.id) not in self.client.session

    def test_login_requires_mfa(self) -> None:
        TotpInterface().enroll(self.user)

        response = self.get_response(username=self.user.username, password="admin")

        assert response.status_code == 202
        assert response.data == {
            "mfaRequired": True,
            "mfaMethods": [{"id": "totp"}],
        }
        assert "_auth_user_id" not in self.client.session
        assert self.client.session["_pending_2fa"][0] == self.user.id

    def test_must_reactivate(self) -> None:
        self.user.update(is_active=False)

        response = self.get_success_response(username=self.user.username, password="admin")
        assert response.data["nextUri"] == "/auth/reactivate/"

    def test_login_suspended_user(self) -> None:
        self.user.update(is_suspended=True)

        response = self.get_error_response(
            username=self.user.username, password="admin", status_code=400
        )
        assert "Your account has been suspended." in str(response.data["errors"])

    @patch(
        "sentry.api.endpoints.auth_login.ratelimiter.backend.is_limited",
        autospec=True,
        return_value=True,
    )
    def test_login_ratelimit(self, is_limited: MagicMock) -> None:
        response = self.get_error_response(
            username=self.user.username, password="admin", status_code=400
        )
        assert [str(s) for s in response.data["errors"]["__all__"]] == [
            "You have made too many failed authentication attempts. Please try again later."
        ]
