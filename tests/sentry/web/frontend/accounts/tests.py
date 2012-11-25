# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from sentry.models import UserOption
from sentry.testutils import fixture
from sentry.testutils import TestCase


class LoginTest(TestCase):
    @fixture
    def user(self):
        user = User(username="admin", email="admin@localhost")
        user.set_password('foobar')
        user.save()
        return user

    @fixture
    def path(self):
        return reverse('sentry-login')

    def test_renders_correct_template(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed('sentry/login.html')

    def test_invalid_password(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(self.path, {
            'username': self.user.username,
            'password': 'bizbar',
        })
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp.context['form'].errors['__all__'],
            [u'Please enter a correct username and password. Note that both fields are case-sensitive.'])

    def test_valid_credentials(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(self.path, {
            'username': self.user.username,
            'password': 'foobar',
        })
        self.assertEquals(resp.status_code, 302)


class RegisterTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-register')

    def test_renders_correct_template(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed('sentry/register.html')

    def test_with_required_params(self):
        resp = self.client.post(self.path, {
            'username': 'test',
            'email': 'test@example.com',
            'password': 'foobar',
        })
        self.assertEquals(resp.status_code, 302)
        user = User.objects.get(username='test')
        self.assertEquals(user.email, 'test@example.com')
        self.assertTrue(user.check_password('foobar'))


class AppearanceSettingsTest(TestCase):
    @fixture
    def user(self):
        user = User(username="admin", email="admin@localhost")
        user.set_password('password')
        user.save()
        return user

    def test_requires_auth(self):
        resp = self.client.get(reverse('sentry-account-settings-appearance'))
        self.assertEquals(resp.status_code, 302)

    def test_does_use_template(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-account-settings-appearance'))
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/account/appearance.html')

    def test_does_save_settings(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.post(reverse('sentry-account-settings-appearance'), {
            'language': 'en',
            'stacktrace_order': '2',
        })
        self.assertEquals(resp.status_code, 302)

        options = UserOption.objects.get_all_values(user=self.user, project=None)

        self.assertEquals(options.get('stacktrace_order'), '2')
        self.assertEquals(options.get('language'), 'en')
