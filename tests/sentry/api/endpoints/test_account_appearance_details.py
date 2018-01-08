from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import UserOption
from sentry.testutils import APITestCase


class AccountAppearanceDetailsTest(APITestCase):
    def test_default_options(self):
        user = self.create_user(email='a@example.com')
        self.login_as(user=user)

        url = reverse(
            'sentry-api-0-account-appearance-details'
        )

        resp = self.client.get(url)

        assert resp.status_code == 200, resp.content
        assert resp.data['timezone'] == 'UTC'
        assert resp.data['stacktrace_order'] == -1
        assert resp.data['language'] == 'en'
        assert not resp.data['clock_24_hours']

    def test_update(self):
        user = self.create_user(email='a@example.com')
        self.login_as(user=user)

        url = reverse(
            'sentry-api-0-account-appearance-details'
        )

        resp = self.client.put(url, data={
            'timezone': 'UTC',
            'stacktrace_order': '2',
            'language': 'fr',
            'clock_24_hours': True,
            'extra': True,
        })

        assert resp.status_code == 204

        assert UserOption.objects.get_value(user=user, key='timezone') == 'UTC'
        assert UserOption.objects.get_value(user=user, key='stacktrace_order') == '2'
        assert UserOption.objects.get_value(user=user, key='language') == 'fr'
        assert UserOption.objects.get_value(user=user, key='clock_24_hours')
        assert not UserOption.objects.get_value(user=user, key='extra')
