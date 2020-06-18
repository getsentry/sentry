from __future__ import absolute_import

from sentry.testutils import APITestCase
from sentry.testutils.helpers import override_options

from .testutils import EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE

signature = "74b587857986545361e8a4253b74cd6224d34869"
secret = "AiK52QASLJXmCXX3X9gO2Zyh"


class VercelWebhookTest(APITestCase):
    def setUp(self):
        self.url = "/extensions/vercel/webhook/"

    def test_get(self):
        response = self.client.get(self.url)
        assert response.status_code == 405

    def test_valid_signature(self):
        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=self.url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

            assert response.status_code == 200

    def test_invalid_signature(self):
        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=self.url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE="xxxinvalidsignaturexxx",
            )

            assert response.status_code == 401
