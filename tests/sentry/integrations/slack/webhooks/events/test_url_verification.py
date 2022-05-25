from unittest.mock import patch

from . import BaseEventTest


class UrlVerificationEventTest(BaseEventTest):
    challenge = "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"

    @patch(
        "sentry.integrations.slack.requests.SlackRequest._check_signing_secret", return_value=True
    )
    def test_valid_event(self, check_signing_secret_mock):
        resp = self.client.post(
            "/extensions/slack/event/",
            {
                "type": "url_verification",
                "challenge": self.challenge,
            },
        )
        assert resp.status_code == 200, resp.content
        assert resp.data["challenge"] == self.challenge
