from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry import options
from sentry.testutils import APITestCase


class SystemOptionsTest(APITestCase):
    url = reverse('sentry-api-0-system-options')

    def test_simple(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert 'system.secret-key' in response.data
        assert 'system.url-prefix' in response.data
        assert 'system.admin-email' in response.data

    def test_bad_query(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, {'query': 'nonsense'})
        assert response.status_code == 400
        assert 'nonsense' in response.data

    def test_required(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, {'query': 'is:required'})
        assert response.status_code == 200
        assert 'system.rate-limit' not in response.data
        assert 'system.url-prefix' in response.data

    def test_not_logged_in(self):
        response = self.client.get(self.url)
        assert response.status_code == 401
        response = self.client.put(self.url)
        assert response.status_code == 401

    def test_disabled_smtp(self):
        self.login_as(user=self.user)

        with self.options({'mail.backend': 'smtp'}):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.data['mail.host']['field']['disabled'] is False
            assert response.data['mail.host']['field']['disabledReason'] is None

        with self.options({'mail.backend': 'dummy'}):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.data['mail.host']['field']['disabled'] is True
            assert response.data['mail.host']['field']['disabledReason'] == 'smtpDisabled'

    def test_put_unknown_option(self):
        self.login_as(user=self.user)
        response = self.client.put(self.url, {
            'xxx': 'lol',
        })
        assert response.status_code == 400
        assert response.data['error'] == 'unknown_option'

    def test_put_simple(self):
        self.login_as(user=self.user)
        assert options.get('mail.host') != 'lolcalhost'
        response = self.client.put(self.url, {
            'mail.host': 'lolcalhost',
        })
        assert response.status_code == 200
        assert options.get('mail.host') == 'lolcalhost'
