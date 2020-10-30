from __future__ import absolute_import

import pytest
from django.conf import settings
from django.test.utils import override_settings

from sentry import newsletter
from sentry.testutils import APITestCase


class AuthConfigEndpointTest(APITestCase):
    path = "/api/0/auth/config/"

    def test_logged_in(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["nextUri"] == "/organizations/new/"

    def test_logged_in_active_org(self):
        user = self.create_user("foo@example.com")
        self.create_organization(owner=user, slug="ricks-org")
        self.login_as(user)
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["nextUri"] == "/organizations/ricks-org/issues/"

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    def test_single_org(self):
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["nextUri"] == "/auth/login/sentry/"

    def test_superuser_is_not_redirected(self):
        user = self.create_user("foo@example.com", is_superuser=True)
        self.login_as(user)
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert "nextUri" not in response.data

    def test_unauthenticated(self):
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert not response.data["canRegister"]
        assert not response.data["hasNewsletter"]
        assert response.data["serverHostname"] == "testserver"

    @pytest.mark.skipIf(
        lambda x: settings.SENTRY_NEWSLETTER != "sentry.newsletter.dummy.DummyNewsletter"
    )
    def test_has_newsletter(self):
        newsletter.backend.enable()
        response = self.client.get(self.path)
        newsletter.backend.disable()

        assert response.status_code == 200
        assert response.data["hasNewsletter"]

    def test_can_register(self):
        with self.options({"auth.allow-registration": True}):
            with self.feature("auth:register"):
                response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["canRegister"]

    def test_session_expired(self):
        self.client.cookies["session_expired"] = "1"
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["warning"] == "Your session has expired."
