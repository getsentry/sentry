from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase


class AuthLoginTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-login')

    def test_renders_correct_template(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/login.html')

    def test_invalid_password(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(self.path, {
            'username': self.user.username,
            'password': 'bizbar',
        })
        assert resp.status_code == 200
        assert resp.context['form'].errors['__all__'] == [
            u'Please enter a correct username and password. Note that both fields may be case-sensitive.'
        ]

    def test_valid_credentials(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(self.path, {
            'username': self.user.username,
            'password': 'admin',
        })
        assert resp.status_code == 302
