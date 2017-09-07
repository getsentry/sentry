from __future__ import absolute_import

from sentry.testutils import APITestCase


class CloudflareWebhookTest(APITestCase):
    def test_simple(self):
        resp = self.client.post('/extensions/cloudflare/webhook/', data={
            'event': 'preview',
        })

        assert resp.status_code == 200, resp.content
        assert resp.data == {}
