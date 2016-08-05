from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase


class AuthLogoutTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-logout')

    def test_logs_user_out(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 302
        assert list(self.client.session.keys()) == []

    def test_same_behavior_with_anonymous_user(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 302
        assert list(self.client.session.keys()) == []
