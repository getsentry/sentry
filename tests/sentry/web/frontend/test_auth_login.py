from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase
from sentry.models import User


# TODO(dcramer): need tests for SSO behavior and single org behavior
class AuthLoginTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-login')

    def test_renders_correct_template(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/login.html')

    def test_login_invalid_password(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(self.path, {
            'username': self.user.username,
            'password': 'bizbar',
            'op': 'login',
        })
        assert resp.status_code == 200
        assert resp.context['login_form'].errors['__all__'] == [
            u'Please enter a correct username and password. Note that both fields may be case-sensitive.'
        ]

    def test_login_valid_credentials(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(self.path, {
            'username': self.user.username,
            'password': 'admin',
            'op': 'login',
        })
        assert resp.status_code == 302

    def test_registration_disabled(self):
        with self.feature('auth:register', False):
            resp = self.client.get(self.path)
            assert resp.context['register_form'] is None

    def test_registration_valid(self):
        with self.feature('auth:register'):
            resp = self.client.post(self.path, {
                'username': 'test-a-really-long-email-address@example.com',
                'password': 'foobar',
                'op': 'register',
            })
        assert resp.status_code == 302
        user = User.objects.get(username='test-a-really-long-email-address@example.com')
        assert user.email == 'test-a-really-long-email-address@example.com'
        assert user.check_password('foobar')

    def test_register_renders_correct_template(self):
        register_path = reverse('sentry-register')
        resp = self.client.get(register_path)

        assert resp.status_code == 200
        assert resp.context['op'] == 'register'
        self.assertTemplateUsed('sentry/login.html')
