from __future__ import absolute_import

from mock import patch
from exam import fixture
from django.conf import settings
from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class JavaScriptSdkLoaderTest(TestCase):
    @fixture
    def path(self):
        settings.JS_SDK_LOADER_SDK_VERSION = '0.5.2'
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = 'https://s3.amazonaws.com/getsentry-cdn/@sentry/browser/%s/bundle.min.js'
        return reverse('sentry-js-sdk-loader', args=[self.projectkey.public_key])

    def test_noop_no_pub_key(self):
        resp = self.client.get(reverse('sentry-js-sdk-loader', args=['abc']))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/js-sdk-loader-noop.js.tmpl')

    def test_noop(self):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = ''
        resp = self.client.get(reverse('sentry-js-sdk-loader', args=[self.projectkey.public_key]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/js-sdk-loader-noop.js.tmpl')

    def test_no_replace(self):
        settings.JS_SDK_LOADER_SDK_VERSION = '0.5.2'
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = 'https://s3.amazonaws.com/getsentry-cdn/@sentry/browser/0.0.0/bundle.min.js'
        resp = self.client.get(reverse('sentry-js-sdk-loader', args=[self.projectkey.public_key]))
        assert resp.status_code == 200
        self.assertIn(settings.JS_SDK_LOADER_DEFAULT_SDK_URL, resp.content)
        self.assertTemplateUsed(resp, 'sentry/js-sdk-loader.js.tmpl')

    def test_renders_js_loader(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/js-sdk-loader.js.tmpl')
        self.assertIn(self.projectkey.public_key, resp.content)
        self.assertIn('bundle.min.js', resp.content)

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
        self.assertTemplateUsed(min_resp, 'sentry/js-sdk-loader.min.js.tmpl')
        self.assertIn(self.projectkey.public_key, min_resp.content)
        self.assertIn('bundle.min.js', min_resp.content)
        assert len(resp.content) > len(min_resp.content)

    @patch('sentry.loader.browsersdkversion.load_version_from_file')
    def test_headers(self, mock_load_version_from_file):
        mocked_version = '9.9.9'
        mock_load_version_from_file.return_value = mocked_version

        resp = self.client.get(self.path)
        assert resp.status_code == 200, resp
        self.assertIn('*', resp['Access-Control-Allow-Origin'])
        self.assertIn('stale-if-error', resp['Cache-Control'])
        self.assertIn('stale-while-revalidate', resp['Cache-Control'])
        self.assertIn('s-maxage', resp['Cache-Control'])
        self.assertIn('max-age', resp['Cache-Control'])
        self.assertIn('project/%s' % self.projectkey.project_id, resp['Surrogate-Key'])
        self.assertIn('sdk/%s' % mocked_version, resp['Surrogate-Key'])
        self.assertIn('sdk-loader', resp['Surrogate-Key'])
        assert 'Content-Encoding' not in resp
        assert 'Set-Cookie' not in resp
        assert 'Vary' not in resp

    def test_absolute_url(self):
        assert reverse(
            'sentry-js-sdk-loader',
            args=[
                self.projectkey.public_key,
                '.min']) in self.projectkey.js_sdk_loader_cdn_url
        settings.JS_SDK_LOADER_CDN_URL = 'https://js.sentry-cdn.com/'
        assert 'https://js.sentry-cdn.com/%s.min.js' % (
            self.projectkey.public_key == self.projectkey.js_sdk_loader_cdn_url
        )
