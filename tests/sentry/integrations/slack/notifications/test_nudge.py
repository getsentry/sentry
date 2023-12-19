from urllib.parse import parse_qs

import responses

from sentry.notifications.notifications.integration_nudge import (
    MESSAGE_LIBRARY,
    IntegrationNudgeNotification,
)
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.slack import get_attachment_no_text, get_blocks_and_fallback_text
from sentry.types.integrations import ExternalProviders
from sentry.utils import json

SEED = 0


class SlackNudgeNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    def test_nudge(self):
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

    @responses.activate
    @with_feature("organizations:slack-block-kit")
    def test_nudge_block(self):
        notification = IntegrationNudgeNotification(
            self.organization,
            recipient=self.user,
            provider=ExternalProviders.SLACK,
            seed=SEED,
        )

        with self.tasks():
            notification.send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        assert fallback_text == MESSAGE_LIBRARY[SEED].format(provider="Slack")
        assert blocks[0]["text"]["text"] == fallback_text
        assert len(blocks[1]["elements"]) == 1
        assert blocks[1]["elements"][0]["action_id"] == "enable_notifications"
        assert blocks[1]["elements"][0]["text"]["text"] == "Turn on personal notifications"
        assert blocks[1]["elements"][0]["value"] == "all_slack"

        # Slack requires callback_id to handle enablement
        request_data = parse_qs(responses.calls[0].request.body)
        assert json.loads(request_data["callback_id"][0]) == {"enable_notifications": True}
