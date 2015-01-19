# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse
from exam import fixture
from social_auth.models import UserSocialAuth

from sentry.models import UserOption, LostPasswordHash, User
from sentry.testutils import TestCase


class RegisterTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-register')

    def test_redirects_if_registration_disabled(self):
        with self.settings(SENTRY_ALLOW_REGISTRATION=False):
            resp = self.client.get(self.path)
            assert resp.status_code == 302

    def test_renders_correct_template(self):
        with self.settings(SENTRY_ALLOW_REGISTRATION=True):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            self.assertTemplateUsed('sentry/register.html')

    def test_with_required_params(self):
        with self.settings(SENTRY_ALLOW_REGISTRATION=True):
            resp = self.client.post(self.path, {
                'username': 'test-a-really-long-email-address@example.com',
                'password': 'foobar',
            })
            assert resp.status_code == 302
            user = User.objects.get(username='test-a-really-long-email-address@example.com')
            assert user.email == 'test-a-really-long-email-address@example.com'
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
            'username': 'foobar',
            'email': 'foo@example.com',
            'first_name': 'Foo bar',
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
            'user': 'nonexistent'
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
    def setUp(self):
        super(RecoverPasswordConfirmTest, self).setUp()
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
