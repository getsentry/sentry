from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase


class RelayJavaScriptLoaderTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-relay-cdn-loader', args=[self.projectkey.public_key])

    def test_renders_js_loader(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/relay-loader.js.tmpl')
        self.assertIn(self.projectkey.public_key, resp.content)

    def test_renders_js_loader_with_different_url(self):
        url = 'https://get-sentry.com'
        self.projectkey.data = {'js_sdk_url': url}
        self.projectkey.save()
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/relay-loader.js.tmpl')
        self.assertIn(url, resp.content)
