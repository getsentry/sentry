from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpRequest

from sentry.models import User
from sentry.testutils import TestCase
from sentry.utils.auth import EmailAuthBackend, get_login_redirect


class EmailAuthBackendTest(TestCase):
    def setUp(self):
        self.user = User(username="foo", email="baz@example.com")
        self.user.set_password("bar")
        self.user.save()

    @property
    def backend(self):
        return EmailAuthBackend()

    def test_can_authenticate_with_username(self):
        result = self.backend.authenticate(username='foo', password='bar')
        self.assertEquals(result, self.user)

    def test_can_authenticate_with_email(self):
        result = self.backend.authenticate(username='baz@example.com', password='bar')
        self.assertEquals(result, self.user)

    def test_does_not_authenticate_with_invalid_password(self):
        result = self.backend.authenticate(username='foo', password='pizza')
        self.assertEquals(result, None)


class GetLoginRedirectTest(TestCase):
    def make_request(self, next=None):
        request = HttpRequest()
        request.session = {}
        request.user = self.user
        if next:
            request.session['_next'] = next
        return request

    def test_schema_uses_default(self):
        result = get_login_redirect(self.make_request('http://example.com'))
        assert result == reverse('sentry-login')

    def test_login_uses_default(self):
        result = get_login_redirect(self.make_request(reverse('sentry-login')))
        assert result == reverse('sentry-login')

    def test_no_value_uses_default(self):
        result = get_login_redirect(self.make_request())
        assert result == reverse('sentry-login')
