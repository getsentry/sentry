from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from tests.sentry.integrations.slack.webhooks.actions import BaseEventTest


class SeerRequestCreditsTest(BaseEventTest):
    def test_click_is_acknowledged(self) -> None:
        resp = self.post_webhook_block_kit(
            action_data=[
                {
                    "type": "button",
                    "action_id": encode_action_id(
                        action=SlackAction.SEER_REQUEST_CREDITS,
                        organization_id=self.organization.id,
                        project_id=None,
                    ),
                    "text": {"type": "plain_text", "text": "Contact Admin"},
                }
            ]
        )

        assert resp.status_code == 200, resp.content
        assert resp.content == b""
