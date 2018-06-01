from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.web.frontend.js_sdk_loader import SDK_VERSION, DEFAULT_SDK_URL
from sentry.testutils import TestCase


class JavaScriptSdkLoaderTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-js-sdk-loader', args=[self.projectkey.public_key])

    def test_renders_js_loader(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/js-sdk-loader.js.tmpl')
        self.assertIn(self.projectkey.public_key, resp.content)
        self.assertIn(DEFAULT_SDK_URL, resp.content)

    def test_minified(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        min_resp = self.client.get(
            reverse(
                'sentry-js-sdk-loader',
                args=[
                    self.projectkey.public_key,
                    '.min']))
        assert min_resp.status_code == 200
        self.assertIn(self.projectkey.public_key, min_resp.content)
        self.assertIn(DEFAULT_SDK_URL, min_resp.content)
        assert len(resp.content) > len(min_resp.content)

    def test_headers(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200, resp
        self.assertIn('stale-if-error', resp['Cache-Control'])
        self.assertIn('stale-while-revalidate', resp['Cache-Control'])
        self.assertIn('s-maxage', resp['Cache-Control'])
        self.assertIn('max-age', resp['Cache-Control'])
        self.assertIn('project/%s' % self.projectkey.project_id, resp['Surrogate-Key'])
        self.assertIn('sdk/%s' % SDK_VERSION, resp['Surrogate-Key'])
        self.assertIn('sdk-loader', resp['Surrogate-Key'])
        assert 'Content-Encoding' not in resp
        assert 'Set-Cookie' not in resp
        assert 'Vary' not in resp
