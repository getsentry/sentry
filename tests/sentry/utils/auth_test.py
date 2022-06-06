import importlib
from datetime import timedelta

from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest
from django.test import override_settings
from django.urls import reverse

import sentry.utils.auth
from sentry.models import User
from sentry.testutils import TestCase
from sentry.utils.auth import EmailAuthBackend, SsoSession, get_login_redirect, login


class EmailAuthBackendTest(TestCase):
    def setUp(self):
        self.user = User(username="foo", email="baz@example.com")
        self.user.set_password("bar")
        self.user.save()

    @property
    def backend(self):
        return EmailAuthBackend()

    def test_can_authenticate_with_username(self):
        result = self.backend.authenticate(HttpRequest(), username="foo", password="bar")
        self.assertEqual(result, self.user)

    def test_can_authenticate_with_email(self):
        result = self.backend.authenticate(
            HttpRequest(), username="baz@example.com", password="bar"
        )
        self.assertEqual(result, self.user)

    def test_does_not_authenticate_with_invalid_password(self):
        result = self.backend.authenticate(HttpRequest(), username="foo", password="pizza")
        self.assertEqual(result, None)


class GetLoginRedirectTest(TestCase):
    def make_request(self, next=None):
        request = HttpRequest()
        request.META["SERVER_NAME"] = "testserver"
        request.META["SERVER_PORT"] = "80"
        request.session = {}
        request.user = self.user
        if next:
            request.session["_next"] = next
        return request

    def test_schema_uses_default(self):
        result = get_login_redirect(self.make_request("http://example.com"))
        assert result == reverse("sentry-login")

    def test_login_uses_default(self):
        result = get_login_redirect(self.make_request(reverse("sentry-login")))
        assert result == reverse("sentry-login")

    def test_no_value_uses_default(self):
        result = get_login_redirect(self.make_request())
        assert result == reverse("sentry-login")


class LoginTest(TestCase):
    def make_request(self, next=None):
        request = HttpRequest()
        request.META["REMOTE_ADDR"] = "127.0.0.1"
        request.session = self.session
        request.user = AnonymousUser()
        if next:
            request.session["_next"] = next
        return request

    def test_simple(self):
        request = self.make_request()
        assert login(request, self.user)
        assert request.user == self.user
        assert "_nonce" not in request.session

    def test_with_organization(self):
        org = self.create_organization(name="foo", owner=self.user)
        request = self.make_request()
        assert login(request, self.user, organization_id=org.id)
        assert request.user == self.user
        assert f"{SsoSession.SSO_SESSION_KEY}:{org.id}" in request.session

    def test_with_nonce(self):
        self.user.refresh_session_nonce()
        self.user.save()
        assert self.user.session_nonce is not None
        request = self.make_request()
        assert login(request, self.user)
        assert request.user == self.user
        assert request.session["_nonce"] == self.user.session_nonce


class TestSsoSession(TestCase):
    def test_expiry_default(self):
        from sentry.utils.auth import SSO_EXPIRY_TIME

        # make sure no accidental changes affect sso timeout
        assert SSO_EXPIRY_TIME == timedelta(hours=20)

    @override_settings(SENTRY_SSO_EXPIRY_SECONDS="20")
    def test_expiry_from_env(self):
        importlib.reload(sentry.utils.auth)
        from sentry.utils.auth import SSO_EXPIRY_TIME

        assert SSO_EXPIRY_TIME == timedelta(seconds=20)
