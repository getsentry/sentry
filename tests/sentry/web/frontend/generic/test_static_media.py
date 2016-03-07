from __future__ import absolute_import

from django.test.utils import override_settings
from sentry.testutils import TestCase
from sentry.web.frontend.generic import FOREVER_CACHE, NEVER_CACHE


class StaticMediaTest(TestCase):
    @override_settings(DEBUG=False)
    def test_basic(self):
        url = '/_static/sentry/app/index.js'
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert response['Cache-Control'] == NEVER_CACHE
        assert 'Vary' not in response
        assert response['Access-Control-Allow-Origin'] == '*'

    @override_settings(DEBUG=False)
    def test_versioned(self):
        url = '/_static/1234567890/sentry/app/index.js'
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert response['Cache-Control'] == FOREVER_CACHE
        assert 'Vary' not in response
        assert response['Access-Control-Allow-Origin'] == '*'

        url = '/_static/a43db3b08ddd4918972f80739f15344b/sentry/app/index.js'
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert response['Cache-Control'] == FOREVER_CACHE
        assert 'Vary' not in response
        assert response['Access-Control-Allow-Origin'] == '*'

        with override_settings(DEBUG=True):
            response = self.client.get(url)
            assert response.status_code == 200, response
            assert response['Cache-Control'] == NEVER_CACHE
            assert 'Vary' not in response
            assert response['Access-Control-Allow-Origin'] == '*'

    @override_settings(DEBUG=False)
    def test_no_cors(self):
        url = '/_static/sentry/images/favicon.ico'
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert response['Cache-Control'] == NEVER_CACHE
        assert 'Vary' not in response
        assert 'Access-Control-Allow-Origin' not in response
