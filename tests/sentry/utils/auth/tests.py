from __future__ import absolute_import

import six

from django.contrib.auth.models import AnonymousUser
from django.core.urlresolvers import reverse
from django.http import HttpRequest

from sentry.models import User
from sentry.testutils import TestCase
from sentry.utils.auth import EmailAuthBackend, login, get_login_redirect


class EmailAuthBackendTest(TestCase):
    def setUp(self):
        self.user = User(username="foo", email="baz@example.com")
        self.user.set_password("bar")
        self.user.save()

    @property
    def backend(self):
        return EmailAuthBackend()

    def test_can_authenticate_with_username(self):
        result = self.backend.authenticate(username="foo", password="bar")
        self.assertEquals(result, self.user)

    def test_can_authenticate_with_email(self):
        result = self.backend.authenticate(username="baz@example.com", password="bar")
        self.assertEquals(result, self.user)

    def test_does_not_authenticate_with_invalid_password(self):
        result = self.backend.authenticate(username="foo", password="pizza")
        self.assertEquals(result, None)


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
        assert request.session["sso"] == six.text_type(org.id)

    def test_with_nonce(self):
        self.user.refresh_session_nonce()
        self.user.save()
        assert self.user.session_nonce is not None
        request = self.make_request()
        assert login(request, self.user)
        assert request.user == self.user
        assert request.session["_nonce"] == self.user.session_nonce
