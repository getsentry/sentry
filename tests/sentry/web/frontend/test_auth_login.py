from __future__ import absolute_import

from django.utils.http import urlquote

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

    def test_renders_session_expire_message(self):
        self.client.cookies['session_expired'] = '1'
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/login.html')
        assert len(resp.context['messages']) == 1

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

    def test_already_logged_in(self):
        self.login_as(self.user)
        with self.feature('organizations:create'):
            resp = self.client.get(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-create-organization')

    def test_register_prefills_invite_email(self):
        self.session['invite_email'] = 'foo@example.com'
        self.session['can_register'] = True
        self.save_session()

        register_path = reverse('sentry-register')
        resp = self.client.get(register_path)

        assert resp.status_code == 200
        assert resp.context['op'] == 'register'
        assert resp.context['register_form'].initial['username'] == 'foo@example.com'
        self.assertTemplateUsed('sentry/login.html')

    def test_redirects_to_relative_next_url(self):
        next = '/welcome'
        self.client.get(self.path + '?next=' + next)

        resp = self.client.post(self.path, {
            'username': self.user.username,
            'password': 'admin',
            'op': 'login',
        })
        assert resp.status_code == 302
        assert resp.get('Location', '').endswith(next)

    def test_doesnt_redirect_to_external_next_url(self):
        next = "http://example.com"
        self.client.get(self.path + '?next=' + urlquote(next))

        resp = self.client.post(self.path, {
            'username': self.user.username,
            'password': 'admin',
            'op': 'login',
        })
        assert resp.status_code == 302
        assert next not in resp['Location']
        assert resp['Location'] == 'http://testserver/auth/login/'
