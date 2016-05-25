from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase


class ReactivateAccountTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-reactivate-account')

    def test_renders(self):
        user = self.create_user('foo@example.com', is_active=False)

        self.login_as(user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/reactivate-account.html')

    def test_does_reactivate(self):
        user = self.create_user('foo@example.com', is_active=False)

        self.login_as(user)

        resp = self.client.post(self.path, data={'op': 'confirm'})
        assert resp.status_code == 302
