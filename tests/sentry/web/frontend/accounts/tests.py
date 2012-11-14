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

    def test_auth(self):
        # load it once for test cookie
        self.client.get(reverse('sentry-login'))

        resp = self.client.post(reverse('sentry-login'), {
            'username': self.user.username,
            'password': 'foobar',
        })
        self.assertEquals(resp.status_code, 302)


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

        print options
        self.assertEquals(options.get('stacktrace_order'), '2')
        self.assertEquals(options.get('language'), 'en')
