from unittest import mock

from rest_framework import status

from sentry.integrations.discord.requests.base import DiscordRequestError
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test

WEBHOOK_URL = "/extensions/discord/interactions/"


@region_silo_test
class DiscordWebhookTest(APITestCase):
    @mock.patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_ping_interaction(self, mock_verify_signature):
        mock_verify_signature.return_value = None
        resp = self.client.post(
            path=WEBHOOK_URL,
            data={
                "type": 1,
            },
            format="json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )

        assert resp.status_code == 200
        assert resp.json()["type"] == 1
        assert mock_verify_signature.call_count == 1

    @mock.patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_unknown_interaction(self, mock_verify_signature):
        resp = self.client.post(
            path=WEBHOOK_URL,
            data={
                "type": -1,
            },
            format="json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )

        assert resp.status_code == 200

    @mock.patch("sentry.integrations.discord.requests.base.verify_signature")
    def test_unauthorized_interaction(self, mock_verify_signature):
        mock_verify_signature.side_effect = DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)
        resp = self.client.post(
            path=WEBHOOK_URL,
            data={
                "type": -1,
            },
            format="json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )

        assert resp.status_code == 401

    def test_missing_signature(self):
        resp = self.client.post(
            path=WEBHOOK_URL,
            data={
                "type": -1,
            },
            format="json",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )

        assert resp.status_code == 401

    def test_missing_timestamp(self):
        resp = self.client.post(
            path=WEBHOOK_URL,
            data={
                "type": -1,
            },
            format="json",
            HTTP_X_SIGNATURE_ED25519="signature",
        )

        assert resp.status_code == 401
