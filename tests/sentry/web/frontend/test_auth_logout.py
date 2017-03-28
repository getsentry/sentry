from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture
from six.moves.urllib.parse import quote

from sentry.models import User
from sentry.testutils import TestCase


class AuthLogoutTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-logout')

    def test_logs_user_out(self):
        self.login_as(self.user)

        session_nonce = self.user.session_nonce
        resp = self.client.post(self.path)
        assert resp.status_code == 302
        assert list(self.client.session.keys()) == []
        assert User.objects.get(id=self.user.id).session_nonce == session_nonce

    def test_same_behavior_with_anonymous_user(self):
        resp = self.client.post(self.path)
        assert resp.status_code == 302
        assert list(self.client.session.keys()) == []

    def test_redirects_to_relative_next_url(self):
        self.login_as(self.user)

        next = '/welcome'
        resp = self.client.post(self.path + '?next=' + next)
        assert resp.status_code == 302
        assert resp.get('Location', '').endswith(next)

    def test_doesnt_redirect_to_external_next_url(self):
        self.login_as(self.user)

        next = "http://example.com"
        self.client.post(self.path + '?next=' + quote(next))

        resp = self.client.get(self.path)
        assert resp.status_code == 302
        assert next not in resp['Location']
        assert resp['Location'] == 'http://testserver/auth/login/'

    def test_logout_all_sessions(self):
        self.login_as(self.user)
        session_nonce = self.user.session_nonce
        resp = self.client.post(self.path, data={'all': '1'})
        assert resp.status_code == 302
        assert User.objects.get(id=self.user.id).session_nonce != session_nonce

    def test_logout_get(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        self.assertTemplateUsed(resp, 'sentry/logout.html')
