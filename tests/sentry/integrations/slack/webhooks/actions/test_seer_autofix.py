from unittest.mock import patch

import orjson

from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.seer.autofix.utils import AutofixStoppingPoint

from . import BaseEventTest


class SeerAutofixActionTest(BaseEventTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def get_original_message(self):
        return {
            "ts": "1458170866.000004",
            "blocks": [
                {
                    "type": "section",
                    "block_id": orjson.dumps({"issue": self.group.id}).decode(),
                    "text": {"type": "mrkdwn", "text": "boop", "verbatim": False},
                }
            ],
        }

    def get_autofix_start_action(self):
        return {
            "action_id": encode_action_id(
                action=SlackAction.SEER_AUTOFIX_START,
                organization_id=self.organization.id,
                project_id=self.project.id,
            ),
            "block_id": "autofix",
            "text": {"type": "plain_text", "text": "Find Root Cause", "emoji": True},
            "value": AutofixStoppingPoint.ROOT_CAUSE.value,
            "type": "button",
            "action_ts": "1458170917.164398",
        }

    def get_autofix_handoff_action(self):
        return {
            "action_id": encode_action_id(
                action=SlackAction.SEER_AUTOFIX_HANDOFF,
                organization_id=self.organization.id,
                project_id=self.project.id,
            ),
            "block_id": "autofix",
            "text": {"type": "plain_text", "text": "Hand off to Cursor", "emoji": True},
            "value": "",
            "type": "button",
            "action_ts": "1458170917.164398",
        }

    def non_member_slack_user(self):
        """A Slack user with a linked Sentry identity but no membership in the org"""
        non_member = self.create_user()
        external_id = "slack:2"
        self.create_identity(non_member, self.idp, external_id)
        return {
            "id": external_id,
            "name": "outsider",
            "username": "outsider",
            "team_id": "TXXXXXXX1",
        }

    @patch("sentry.integrations.slack.webhooks.action.send_not_org_member_message")
    @patch("sentry.integrations.slack.webhooks.action.SeerAutofixOperator.trigger_autofix")
    def test_autofix_start_non_member_is_blocked(self, mock_trigger, mock_not_member_message):
        response = self.post_webhook_block_kit(
            action_data=[self.get_autofix_start_action()],
            original_message=self.get_original_message(),
            slack_user=self.non_member_slack_user(),
        )

        assert response.status_code == 200
        assert not mock_trigger.called
        assert mock_not_member_message.called
        assert mock_not_member_message.call_args.kwargs["org_name"] == self.organization.name

    @patch("sentry.integrations.slack.webhooks.action.send_not_org_member_message")
    @patch("sentry.integrations.slack.webhooks.action.SeerAutofixOperator.trigger_autofix")
    def test_autofix_start_member_is_allowed(self, mock_trigger, mock_not_member_message):
        # The default Slack user is linked to the org owner
        response = self.post_webhook_block_kit(
            action_data=[self.get_autofix_start_action()],
            original_message=self.get_original_message(),
        )

        assert response.status_code == 200
        assert mock_trigger.called
        assert not mock_not_member_message.called

    @patch("sentry.integrations.slack.webhooks.action.send_not_org_member_message")
    @patch("sentry.integrations.slack.webhooks.action.SeerAutofixOperator.trigger_handoff")
    def test_autofix_handoff_non_member_is_blocked(self, mock_trigger, mock_not_member_message):
        response = self.post_webhook_block_kit(
            action_data=[self.get_autofix_handoff_action()],
            original_message=self.get_original_message(),
            slack_user=self.non_member_slack_user(),
            callback_id=orjson.dumps({"issue": self.group.id, "run_id": 123}).decode(),
        )

        assert response.status_code == 200
        assert not mock_trigger.called
        assert mock_not_member_message.called
        assert mock_not_member_message.call_args.kwargs["org_name"] == self.organization.name

    @patch("sentry.integrations.slack.webhooks.action.send_not_org_member_message")
    @patch("sentry.integrations.slack.webhooks.action.SeerAutofixOperator.trigger_handoff")
    def test_autofix_handoff_member_is_allowed(self, mock_trigger, mock_not_member_message):
        response = self.post_webhook_block_kit(
            action_data=[self.get_autofix_handoff_action()],
            original_message=self.get_original_message(),
            callback_id=orjson.dumps({"issue": self.group.id, "run_id": 123}).decode(),
        )

        assert response.status_code == 200
        assert mock_trigger.called
        assert not mock_not_member_message.called
