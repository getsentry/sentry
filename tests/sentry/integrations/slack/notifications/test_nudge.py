import orjson
import responses

from sentry.integrations.types import ExternalProviders
from sentry.notifications.notifications.integration_nudge import (
    MESSAGE_LIBRARY,
    IntegrationNudgeNotification,
)
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.types.actor import Actor

SEED = 0


class SlackNudgeNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    def test_nudge_block(self):
        notification = IntegrationNudgeNotification(
            self.organization,
            recipient=Actor.from_object(self.user),
            provider=ExternalProviders.SLACK,
            seed=SEED,
        )

        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        assert fallback_text == MESSAGE_LIBRARY[SEED].format(provider="Slack")
        assert blocks[0]["text"]["text"] == fallback_text
        assert len(blocks[1]["elements"]) == 1
        assert blocks[1]["elements"][0]["action_id"] == "enable_notifications"
        assert blocks[1]["elements"][0]["text"]["text"] == "Turn on personal notifications"
        assert blocks[1]["elements"][0]["value"] == "all_slack"

        # Slack requires callback_id to handle enablement
        callback_id = orjson.loads(self.mock_post.call_args.kwargs["callback_id"])
        assert callback_id == {"enable_notifications": True}
