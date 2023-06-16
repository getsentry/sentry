from unittest import mock
from urllib.parse import parse_qs

import responses

from sentry.notifications.notifications.integration_nudge import (
    MESSAGE_LIBRARY,
    IntegrationNudgeNotification,
)
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment_no_text, send_notification
from sentry.types.integrations import ExternalProviders
from sentry.utils import json

SEED = 0


class SlackNudgeNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_nudge(self, mock_func):
        notification = IntegrationNudgeNotification(
            self.organization,
            recipient=self.user,
            provider=ExternalProviders.SLACK,
            seed=SEED,
        )

        with self.tasks():
            notification.send()

        attachment = get_attachment_no_text()
        assert attachment["text"] == MESSAGE_LIBRARY[SEED].format(provider="Slack")
        assert len(attachment["actions"]) == 1
        assert attachment["actions"][0]["action_id"] == "enable_notifications"
        assert attachment["actions"][0]["name"] == "Turn on personal notifications"
        assert attachment["actions"][0]["value"] == "all_slack"

        # Slack requires callback_id to handle enablement
        request_data = parse_qs(responses.calls[0].request.body)
        request_block_payload = json.loads(request_data["attachments"][0])
        assert request_block_payload[0]["callback_id"]
