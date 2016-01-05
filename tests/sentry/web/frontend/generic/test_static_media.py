from __future__ import absolute_import

from sentry.testutils import TestCase


class StaticMediaTest(TestCase):
    def test_basic(self):
        url = '/_static/sentry/app/index.js'
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert 'Cache-Control' not in response
        assert 'Vary' not in response
        assert response['Access-Control-Allow-Origin'] == '*'

    def test_versioned(self):
        url = '/_static/1234567890/sentry/app/index.js'
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert 'Cache-Control' in response
        assert 'Vary' not in response
        assert response['Access-Control-Allow-Origin'] == '*'

        url = '/_static/a43db3b08ddd4918972f80739f15344b/sentry/app/index.js'
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert 'Cache-Control' in response
        assert 'Vary' not in response
        assert response['Access-Control-Allow-Origin'] == '*'

    def test_no_cors(self):
        url = '/_static/sentry/images/favicon.ico'
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert 'Cache-Control' not in response
        assert 'Vary' not in response
        assert 'Access-Control-Allow-Origin' not in response
