from unittest.mock import patch

import pytest
from django.conf import settings
from django.test.utils import override_settings

from sentry import newsletter
from sentry.auth.authenticators.totp import TotpInterface
from sentry.newsletter.dummy import DummyNewsletter
from sentry.receivers import create_default_projects
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.web.frontend.auth_login import additional_context


@control_silo_test
class AuthConfigEndpointTest(APITestCase):
    path = "/api/0/auth/config/"

    def test_logged_in(self) -> None:
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["nextUri"] == "/organizations/new/"

    def test_logged_in_active_org(self) -> None:
        user = self.create_user("foo@example.com")
        self.create_organization(owner=user, slug="ricks-org")
        self.login_as(user)
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["nextUri"] == "/organizations/ricks-org/issues/"

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @assume_test_silo_mode(SiloMode.MONOLITH)  # Single org IS monolith mode
    def test_single_org(self) -> None:
        create_default_projects()
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["nextUri"] == "/auth/login/sentry/"

    def test_superuser_is_not_redirected(self) -> None:
        user = self.create_user("foo@example.com", is_superuser=True)
        self.login_as(user)
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["nextUri"] == "/organizations/new/"

    def test_unauthenticated(self) -> None:
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data == {
            "canRegister": False,
            "hasNewsletter": False,
            "pendingMfa": None,
            "serverHostname": "testserver",
        }

    def test_pending_mfa_login(self) -> None:
        TotpInterface().enroll(self.user)
        self.client.get(self.path, {"next": "/settings/account/"})
        login_response = self.client.post(
            "/api/0/auth/login/",
            data={"username": self.user.username, "password": "admin"},
        )

        response = self.client.get(self.path)

        assert login_response.status_code == 202
        assert response.status_code == 200
        assert response.data == {
            "canRegister": False,
            "hasNewsletter": False,
            "pendingMfa": {
                "mfaRequired": True,
                "mfaMethods": [{"id": "totp"}],
            },
            "serverHostname": "testserver",
        }
        assert self.client.session["_pending_2fa"][0] == self.user.id
        assert self.client.session["_next"] == "/settings/account/"

    def test_pending_mfa_consumes_session_expired_warning(self) -> None:
        TotpInterface().enroll(self.user)
        self.client.get(self.path)
        self.client.post(
            "/api/0/auth/login/",
            data={"username": self.user.username, "password": "admin"},
        )
        self.client.cookies["session_expired"] = "1"

        response = self.client.get(self.path)

        assert response.data["warning"] == "Your session has expired."
        assert response.cookies["session_expired"]["max-age"] == 0
        assert response.data["pendingMfa"] == {
            "mfaRequired": True,
            "mfaMethods": [{"id": "totp"}],
        }

    def test_login_banner(self) -> None:
        banner = 'Banner message <a href="https://example.com">Learn more</a>.'
        with patch.object(
            additional_context,
            "_callbacks",
            {lambda request: {"login_banner": banner}},
        ):
            response = self.client.get(self.path)

        assert response.data["loginBanner"] == banner
        assert "login_banner" not in response.data

    def test_additional_context_keys_are_camelized(self) -> None:
        with patch.object(
            additional_context,
            "_callbacks",
            {
                lambda request: {
                    "github_login_link": "/identity/login/github/",
                    "google_login_link": "/identity/login/google/",
                    "vsts_login_link": "/identity/login/vsts/",
                }
            },
        ):
            response = self.client.get(self.path)

        assert response.data["githubLoginLink"] == "/identity/login/github/"
        assert response.data["googleLoginLink"] == "/identity/login/google/"
        assert response.data["vstsLoginLink"] == "/identity/login/vsts/"
        assert "github_login_link" not in response.data
        assert "google_login_link" not in response.data
        assert "vsts_login_link" not in response.data

    @pytest.mark.skipif(
        settings.SENTRY_NEWSLETTER != "sentry.newsletter.dummy.DummyNewsletter",
        reason="Requires DummyNewsletter.",
    )
    def test_has_newsletter(self) -> None:
        with newsletter.backend.test_only__downcast_to(DummyNewsletter).enable():
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["hasNewsletter"]

    def test_can_register(self) -> None:
        with self.options({"auth.allow-registration": True}):
            with self.feature("auth:register"):
                response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["canRegister"]

    def test_session_expired(self) -> None:
        self.client.cookies["session_expired"] = "1"
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["warning"] == "Your session has expired."
