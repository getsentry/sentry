from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.web.frontend.js_sdk_loader import SDK_VERSION
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
        assert resp['Vary'] == 'Accept-Encoding'
        'Content-Encoding' not in resp
        'Set-Cookie' not in resp
