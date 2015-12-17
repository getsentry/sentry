from __future__ import absolute_import

from django.core.urlresolvers import reverse

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
        assert 'cache.backend' in response.data

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
