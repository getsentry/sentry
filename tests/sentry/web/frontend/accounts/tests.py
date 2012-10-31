# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from sentry.models import UserOption

from tests.base import TestCase


class AppearanceSettingsTest(TestCase):
    def setUp(self):
        self.user = User(username="admin", email="admin@localhost")
        self.user.set_password('admin')
        self.user.save()

    def test_requires_auth(self):
        resp = self.client.get(reverse('sentry-account-settings-appearance'))
        self.assertEquals(resp.status_code, 302)

    def test_does_use_template(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-account-settings-appearance'))
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/account/appearance.html')

    def test_does_save_settings(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.post(reverse('sentry-account-settings-appearance'), {
            'language': 'en',
            'stacktrace_display': '2',
        })
        self.assertEquals(resp.status_code, 302)

        options = UserOption.objects.get_all_values(user=self.user, project=None)

        self.assertEquals(options.get('stacktrace_display'), '2')
        self.assertEquals(options.get('language'), 'en')
