# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse
from django.http import HttpRequest
from sentry.models import UserOption, LostPasswordHash, User
from sentry.testutils import TestCase, fixture, before
from sentry.web.frontend.accounts import login_redirect
from social_auth.models import UserSocialAuth


class LoginTest(TestCase):
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
        assert resp.context['form'].errors['__all__'] == \
            [u'Please enter a correct username and password. Note that both fields may be case-sensitive.']

    def test_valid_credentials(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(self.path, {
            'username': self.user.username,
            'password': 'admin',
        })
        assert resp.status_code == 302


class RegisterTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-register')

    def test_redirects_if_registration_disabled(self):
        with self.Settings(SENTRY_ALLOW_REGISTRATION=False):
            resp = self.client.get(self.path)
            assert resp.status_code == 302

    def test_renders_correct_template(self):
        with self.Settings(SENTRY_ALLOW_REGISTRATION=True):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            self.assertTemplateUsed('sentry/register.html')

    def test_with_required_params(self):
        with self.Settings(SENTRY_ALLOW_REGISTRATION=True):
            resp = self.client.post(self.path, {
                'username': 'test',
                'email': 'test@example.com',
                'password': 'foobar',
            })
            assert resp.status_code == 302
            user = User.objects.get(username='test')
            assert user.email == 'test@example.com'
            assert user.check_password('foobar')


class AppearanceSettingsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-account-settings-appearance')

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_does_use_template(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/account/appearance.html')

    def test_does_save_settings(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, {
            'language': 'en',
            'stacktrace_order': '2',
        })
        assert resp.status_code == 302

        options = UserOption.objects.get_all_values(user=self.user, project=None)

        assert options.get('language') == 'en'
        assert options.get('stacktrace_order') == '2'


class SettingsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-account-settings')

    def params(self, without=()):
        params = {
            'email': 'foo@example.com',
            'first_name': 'Foo bar',
            'old_password': 'admin',
        }
        return dict((k, v) for k, v in params.iteritems() if k not in without)

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_renders_with_required_context(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings.html')
        assert 'form' in resp.context

    def test_requires_email(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, self.params(without=['email']))
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings.html')
        assert 'form' in resp.context
        assert 'email' in resp.context['form'].errors

    def test_requires_first_name(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, self.params(without=['first_name']))
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings.html')
        assert 'form' in resp.context
        assert 'first_name' in resp.context['form'].errors

    def test_requires_old_password(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, self.params(without=['old_password']))
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings.html')
        assert 'form' in resp.context
        assert 'old_password' in resp.context['form'].errors

    def test_minimum_valid_params(self):
        self.login_as(self.user)

        params = self.params()

        resp = self.client.post(self.path, params)
        assert resp.status_code == 302
        user = User.objects.get(id=self.user.id)
        assert user.first_name == params['first_name']
        assert user.email == params['email']

    def test_can_change_password(self):
        self.login_as(self.user)

        params = self.params()
        params['new_password'] = 'foobar'

        resp = self.client.post(self.path, params)
        assert resp.status_code == 302
        user = User.objects.get(id=self.user.id)
        assert user.check_password('foobar')


class LogoutTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-logout')

    def test_logs_user_out(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 302
        assert self.client.session.keys() == []

    def test_same_behavior_with_anonymous_user(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 302
        assert self.client.session.keys() == []


class LoginRedirectTest(TestCase):
    def make_request(self, next=None):
        request = HttpRequest()
        request.session = {}
        request.user = self.user
        if next:
            request.session['_next'] = next
        return request

    def test_schema_uses_default(self):
        resp = login_redirect(self.make_request('http://example.com'))
        assert resp.status_code == 302
        assert resp['Location'] == reverse('sentry')

    def test_login_uses_default(self):
        resp = login_redirect(self.make_request(reverse('sentry-login')))
        assert resp.status_code == 302
        assert resp['Location'] == reverse('sentry')

    def test_no_value_uses_default(self):
        resp = login_redirect(self.make_request())
        assert resp.status_code == 302
        assert resp['Location'] == reverse('sentry')

    def test_standard_view_works(self):
        resp = login_redirect(self.make_request(reverse('sentry', args=[1])))
        assert resp.status_code == 302
        assert resp['Location'] == reverse('sentry', args=[1])


class NotificationSettingsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-account-settings-notifications')

    def params(self, without=()):
        params = {
            'alert_email': 'foo@example.com',
        }
        return dict((k, v) for k, v in params.iteritems() if k not in without)

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_renders_with_required_context(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/notifications.html')
        assert 'form' in resp.context

    def test_valid_params(self):
        self.login_as(self.user)

        params = self.params()

        resp = self.client.post(self.path, params)
        assert resp.status_code == 302

        options = UserOption.objects.get_all_values(user=self.user, project=None)

        assert options.get('alert_email') == 'foo@example.com'


class ListIdentitiesTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-account-settings-identities')

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_renders_with_required_context(self):
        self.login_as(self.user)
        UserSocialAuth.objects.create(user=self.user, provider='github')

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/identities.html')
        assert 'identity_list' in resp.context
        assert 'AUTH_PROVIDERS' in resp.context


class RecoverPasswordTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-account-recover')

    def test_renders_with_required_context(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/account/recover/index.html')
        assert 'form' in resp.context

    def test_invalid_username(self):
        resp = self.client.post(self.path, {
            'user': 'nonexistant'
        })
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/account/recover/index.html')
        assert 'form' in resp.context
        assert 'user' in resp.context['form'].errors

    @mock.patch('sentry.models.LostPasswordHash.send_recover_mail')
    def test_valid_username(self, send_recover_mail):
        resp = self.client.post(self.path, {
            'user': self.user.username
        })
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/account/recover/sent.html')
        assert 'email' in resp.context
        send_recover_mail.assert_called_once_with()


class RecoverPasswordConfirmTest(TestCase):
    @before
    def create_hash(self):
        self.password_hash = LostPasswordHash.objects.create(user=self.user)

    @fixture
    def path(self):
        return reverse('sentry-account-recover-confirm', args=[self.user.id, self.password_hash.hash])

    def test_valid_token(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/account/recover/confirm.html')

    def test_invalid_token(self):
        resp = self.client.get(reverse('sentry-account-recover-confirm', args=[1, 'adfadsf']))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/account/recover/failure.html')

    def test_change_password(self):
        resp = self.client.post(self.path, {
            'password': 'bar',
            'confirm_password': 'bar'
        })
        assert resp.status_code == 302
        user = User.objects.get(id=self.user.id)
        assert user.check_password('bar')
