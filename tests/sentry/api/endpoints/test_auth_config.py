from typing import int
import pytest
from django.conf import settings
from django.test.utils import override_settings

from sentry import newsletter
from sentry.newsletter.dummy import DummyNewsletter
from sentry.receivers import create_default_projects
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


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
        assert not response.data["canRegister"]
        assert not response.data["hasNewsletter"]
        assert response.data["serverHostname"] == "testserver"

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
