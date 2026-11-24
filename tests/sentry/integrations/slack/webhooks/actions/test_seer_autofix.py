from typing import Any
from unittest.mock import MagicMock, patch

import orjson
from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsResponse,
)

from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.seer.agent.client_models import MemoryBlock, Message, SeerRunState
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.testutils.helpers.features import with_feature

from . import BaseEventTest


class SeerAutofixActionTest(BaseEventTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def get_original_message(self) -> dict[str, Any]:
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

    def get_autofix_start_action(self) -> dict[str, Any]:
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

    def get_autofix_handoff_action(self) -> dict[str, Any]:
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

    def non_member_slack_user(self) -> dict[str, Any]:
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
    def test_autofix_start_non_member_is_blocked(
        self, mock_trigger: MagicMock, mock_not_member_message: MagicMock
    ) -> None:
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
    def test_autofix_start_member_is_allowed(
        self, mock_trigger: MagicMock, mock_not_member_message: MagicMock
    ) -> None:
        # The default Slack user is linked to the org owner
        response = self.post_webhook_block_kit(
            action_data=[self.get_autofix_start_action()],
            original_message=self.get_original_message(),
        )

        assert response.status_code == 200
        assert mock_trigger.called
        assert not mock_not_member_message.called

    @with_feature("organizations:token-billed-seer-enabled")
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=False),
    )
    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    @patch("sentry.seer.autofix.autofix_agent.get_autofix_agent_state")
    def test_autofix_start_out_of_credits_still_points_at_an_existing_run(
        self,
        mock_get_autofix_state: MagicMock,
        mock_update_message: MagicMock,
        mock_send_threaded_ephemeral_message: MagicMock,
        _mock_check_seer_credits: MagicMock,
    ) -> None:
        mock_get_autofix_state.return_value = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="1",
                    message=Message(role="assistant", metadata={"step": "root_cause"}),
                    timestamp="2024-01-01T00:00:00Z",
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        response = self.post_webhook_block_kit(
            action_data=[self.get_autofix_start_action()],
            original_message={**self.get_original_message(), "text": "boop"},
        )

        assert response.status_code == 200
        mock_update_message.assert_called_once()
        assert not mock_send_threaded_ephemeral_message.called

    @patch("sentry.integrations.slack.webhooks.action.send_not_org_member_message")
    @patch("sentry.integrations.slack.webhooks.action.SeerAutofixOperator.trigger_handoff")
    def test_autofix_handoff_non_member_is_blocked(
        self, mock_trigger: MagicMock, mock_not_member_message: MagicMock
    ) -> None:
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
    def test_autofix_handoff_member_is_allowed(
        self, mock_trigger: MagicMock, mock_not_member_message: MagicMock
    ) -> None:
        response = self.post_webhook_block_kit(
            action_data=[self.get_autofix_handoff_action()],
            original_message=self.get_original_message(),
            callback_id=orjson.dumps({"issue": self.group.id, "run_id": 123}).decode(),
        )

        assert response.status_code == 200
        assert mock_trigger.called
        assert not mock_not_member_message.called
