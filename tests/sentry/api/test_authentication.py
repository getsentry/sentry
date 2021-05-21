import pytest
from django.conf import settings
from django.http import HttpRequest
from django.middleware.csrf import rotate_token
from exam import fixture
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.request import Request

from sentry.api.authentication import (
    ClientIdSecretAuthentication,
    DSNAuthentication,
    ImprovedSessionAuthentication,
)
from sentry.models import ProjectKeyStatus
from sentry.testutils import TestCase


class TestClientIdSecretAuthentication(TestCase):
    def setUp(self):
        super().setUp()

        self.auth = ClientIdSecretAuthentication()
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.org)

        self.api_app = self.sentry_app.application

    def test_authenticate(self):
        request = HttpRequest()
        request.json_body = {
            "client_id": self.api_app.client_id,
            "client_secret": self.api_app.client_secret,
        }

        user, _ = self.auth.authenticate(request)

        assert user == self.sentry_app.proxy_user

    def test_without_json_body(self):
        request = HttpRequest()
        request.json_body = None

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_missing_client_id(self):
        request = HttpRequest()
        request.json_body = {"client_secret": self.api_app.client_secret}

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_missing_client_secret(self):
        request = HttpRequest()
        request.json_body = {"client_id": self.api_app.client_id}

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_id(self):
        request = HttpRequest()
        request.json_body = {"client_id": "notit", "client_secret": self.api_app.client_secret}

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_secret(self):
        request = HttpRequest()
        request.json_body = {"client_id": self.api_app.client_id, "client_secret": "notit"}

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)


class TestDSNAuthentication(TestCase):
    def setUp(self):
        super().setUp()

        self.auth = DSNAuthentication()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.project_key = self.create_project_key(project=self.project)

    def test_authenticate(self):
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = f"DSN {self.project_key.dsn_public}"

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous()
        assert auth == self.project_key

    def test_inactive_key(self):
        self.project_key.update(status=ProjectKeyStatus.INACTIVE)
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = f"DSN {self.project_key.dsn_public}"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)


class TestImprovedSessionAuthentication(TestCase):
    @fixture
    def auth(self):
        return ImprovedSessionAuthentication()

    def test_does_not_enforce_csrf_on_get(self):
        assert not settings.CSRF_USE_SESSIONS

        request = HttpRequest()
        request.method = "GET"
        assert self.auth.authenticate(Request(request)) is None

    def test_fails_without_csrf_on_post(self):
        assert not settings.CSRF_USE_SESSIONS

        request = HttpRequest()
        request.method = "POST"
        with pytest.raises(PermissionDenied):
            self.auth.authenticate(Request(request))

    def test_fails_with_invalid_csrf_on_post(self):
        assert not settings.CSRF_USE_SESSIONS

        request = HttpRequest()
        request.method = "POST"
        request.META[settings.CSRF_HEADER_NAME] = "csrf"
        with pytest.raises(PermissionDenied):
            self.auth.authenticate(Request(request))

    def test_succeeds_with_valid_csrf_on_post(self):
        assert not settings.CSRF_USE_SESSIONS

        request = HttpRequest()
        request.method = "POST"
        rotate_token(request)
        request.META[settings.CSRF_HEADER_NAME] = request.META["CSRF_COOKIE"]
        assert self.auth.authenticate(Request(request)) is None
