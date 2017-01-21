# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
import pytest
import responses
import six

from django.core.urlresolvers import reverse
from exam import fixture
from social_auth.models import UserSocialAuth

from sentry.models import (
    UserEmail, LostPasswordHash, User, UserOption
)
from sentry.testutils import TestCase


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
            'clock_24_hours': True
        })
        assert resp.status_code == 302

        options = UserOption.objects.get_all_values(user=self.user, project=None)

        assert options.get('language') == 'en'
        assert options.get('stacktrace_order') == '2'
        assert options.get('clock_24_hours') is True


class SettingsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-account-settings')

    def params(self, without=()):
        params = {
            'email': 'admin@localhost',
            'name': 'Foo bar',
        }
        return dict((k, v) for k, v in six.iteritems(params) if k not in without)

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

    def test_requires_name(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, self.params(without=['name']))
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings.html')
        assert 'form' in resp.context
        assert 'name' in resp.context['form'].errors

    def test_minimum_valid_params(self):
        self.login_as(self.user)

        params = self.params()

        resp = self.client.post(self.path, params)
        assert resp.status_code == 302
        user = User.objects.get(id=self.user.id)
        assert user.name == params['name']

    def test_can_change_password_with_password(self):
        old_nonce = self.user.session_nonce
        self.login_as(self.user)

        params = self.params()
        params['password'] = 'admin'
        params['new_password'] = 'foobar'

        resp = self.client.post(self.path, params)
        assert resp.status_code == 302
        user = User.objects.get(id=self.user.id)
        assert user.check_password('foobar')
        assert user.session_nonce != old_nonce

    def test_cannot_change_password_with_invalid_password(self):
        self.login_as(self.user)

        params = self.params()
        params['new_password'] = 'foobar'

        resp = self.client.post(self.path, params)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings.html')
        assert resp.context['form'].errors
        user = User.objects.get(id=self.user.id)
        assert not user.check_password('foobar')

    def test_cannot_change_password_with_managed_user(self):
        user = self.create_user('foo@example.com', is_managed=True)

        self.login_as(user)

        params = self.params()
        params['email'] = user.email
        params['password'] = 'admin'
        params['new_password'] = 'foobar'

        resp = self.client.post(self.path, params)
        assert resp.status_code == 302
        user = User.objects.get(id=self.user.id)
        assert not user.check_password('foobar')

    def test_can_change_email_with_password(self):
        self.login_as(self.user)

        params = self.params()
        params['password'] = 'admin'
        params['email'] = 'bizbaz@example.com'

        resp = self.client.post(self.path, params)
        assert resp.status_code == 302
        user = User.objects.get(id=self.user.id)
        assert user.email == 'bizbaz@example.com'

    def test_can_change_email_without_set_password(self):
        self.login_as(self.user)

        self.user.update(password='')

        params = self.params()
        params['email'] = 'bizbaz@example.com'

        resp = self.client.post(self.path, params)
        assert resp.status_code == 302
        user = User.objects.get(id=self.user.id)
        assert user.email == 'bizbaz@example.com'

    def test_cannot_change_email_with_invalid_password(self):
        self.login_as(self.user)

        params = self.params()
        params['email'] = 'bizbaz@example.com'

        resp = self.client.post(self.path, params)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings.html')
        assert resp.context['form'].errors
        user = User.objects.get(id=self.user.id)
        assert user.email == 'admin@localhost'


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

    def test_managed_account_is_invalid(self):
        user = self.create_user('foo@example.com', is_managed=True)

        resp = self.client.post(self.path, {
            'user': user.email,
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
        old_nonce = self.user.session_nonce
        resp = self.client.post(self.path, {
            'password': 'bar',
            'confirm_password': 'bar'
        })
        assert resp.status_code == 302
        user = User.objects.get(id=self.user.id)
        assert user.check_password('bar')
        assert user.session_nonce != old_nonce


class ConfirmEmailSendTest(TestCase):
    @mock.patch('sentry.models.User.send_confirm_emails')
    def test_valid(self, send_confirm_email):
        self.login_as(self.user)
        resp = self.client.post(reverse('sentry-account-confirm-email-send'))
        self.assertRedirects(resp, reverse('sentry-account-settings-emails'), status_code=302)
        send_confirm_email.assert_called_once_with()

    def test_get_request_not_valid(self):
        self.login_as(self.user)
        resp = self.client.get(reverse('sentry-account-confirm-email-send'))
        assert resp.status_code == 405

    @mock.patch('sentry.models.User.send_confirm_email_singular')
    def test_send_single_email(self, send_confirm_email):
        user = self.create_user('foo@example.com')
        email = UserEmail.objects.create(user=user, email='bar@example.com')
        email.save()
        self.login_as(user)
        self.client.post(reverse('sentry-account-confirm-email-send'),
                        data={'primary-email': '', 'email': 'foo@example.com'},
                        follow=True)
        send_confirm_email.assert_called_once_with(UserEmail.get_primary_email(user))


class ConfirmEmailTest(TestCase):

    def test_invalid(self):
        self.user.save()
        resp = self.client.get(reverse('sentry-account-confirm-email',
                                       args=[self.user.id, '5b1f2f266efa03b721cc9ea0d4742c5e']))
        assert resp.status_code == 302
        email = UserEmail.objects.get(email=self.user.email)
        assert not email.is_verified

    def test_valid(self):
        self.user.save()
        self.login_as(self.user)
        self.client.post(reverse('sentry-account-confirm-email-send'))
        email = self.user.emails.first()
        resp = self.client.get(reverse('sentry-account-confirm-email',
                                       args=[self.user.id, email.validation_hash]))
        self.assertRedirects(resp, reverse('sentry-account-settings-emails'), status_code=302)
        email = self.user.emails.first()
        assert email.is_verified


class DisconnectIdentityTest(TestCase):
    @responses.activate
    def test_simple(self):
        self.login_as(self.user)

        auth = UserSocialAuth.objects.create(
            user=self.user,
            provider='github',
            extra_data={'access_token': 'abcdef'},
        )

        with self.settings(GITHUB_APP_ID='app_id', GITHUB_API_SECRET='secret'):
            resp = self.client.post(reverse('sentry-account-disconnect-identity', args=[
                auth.id,
            ]))

        assert resp['Location'] == 'http://testserver{}'.format(
            reverse('sentry-account-settings-identities'),
        )

        assert not UserSocialAuth.objects.filter(id=auth.id).exists()

    @responses.activate
    def test_invalid_backend(self):
        self.login_as(self.user)

        auth = UserSocialAuth.objects.create(
            user=self.user,
            provider='invalid',
            extra_data={'access_token': 'abcdef'},
        )

        with pytest.raises(Exception):
            # this should just error hard
            self.client.post(reverse('sentry-account-disconnect-identity', args=[
                auth.id,
            ]))
