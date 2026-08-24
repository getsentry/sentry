from unittest.mock import Mock, patch

import orjson

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.seer import agent_token
from sentry.seer.agent.client_models import PendingUserInput, SeerRunState
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.slack.cache import (
    SlackSeerAgentMessageCache,
    SlackSeerAgentMessageCachePayload,
)
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode

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


class SeerAgentWriteApprovalActionTest(BaseEventTest):
    run_id = 12345
    message_ts = "1702424381.221719"

    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        self.seer_run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=self.run_id,
            user_id=self.user.id,
        )

    def get_original_message(self):
        return {
            "ts": self.message_ts,
            "blocks": [
                {
                    "type": "markdown",
                    "text": "Allow Seer to make changes?",
                }
            ],
        }

    def get_action(self, action: SlackAction):
        return {
            "action_id": encode_action_id(
                action=action,
                organization_id=self.organization.id,
                project_id=None,
            ),
            "block_id": "approval",
            "text": {"type": "plain_text", "text": "Approve", "emoji": True},
            "value": "link_clicked",
            "type": "button",
            "action_ts": "1458170917.164398",
        }

    def cache_message(self, input_id: str = "approval-1") -> None:
        SlackSeerAgentMessageCache.set(
            integration_id=self.integration.id,
            channel_id="C065W1189",
            message_ts=self.message_ts,
            payload=SlackSeerAgentMessageCachePayload(
                thread_ts="1702424381.221719",
                run_id=self.run_id,
                input_id=input_id,
            ),
        )

    def pending_state(
        self,
        *,
        input_id: str = "approval-1",
        scopes: list[str] | None = None,
    ) -> SeerRunState:
        return SeerRunState(
            run_id=self.run_id,
            blocks=[],
            status="awaiting_user_input",
            updated_at="2026-01-01T00:00:00Z",
            pending_user_input=PendingUserInput(
                id=input_id,
                input_type="agent_write_approval",
                data={
                    "required_scopes": scopes or ["org:write"],
                    "session_id": "session-1",
                },
            ),
        )

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_approve_grants_scopes_and_resumes_run(self, mock_fetch, mock_update):
        self.cache_message()
        mock_fetch.return_value = self.pending_state()
        mock_update.return_value = Mock(status=202)

        with self.feature(agent_token.FEATURE_FLAG):
            response = self.post_webhook_block_kit(
                action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
                original_message=self.get_original_message(),
            )

        assert response.status_code == 200
        assert agent_token.active_grant_scopes(self.organization.id, self.user.id, "session-1") == {
            "org:write"
        }
        update_body = mock_update.call_args.args[0]
        assert update_body["payload"] == {
            "type": "user_input_response",
            "input_id": "approval-1",
            "response_data": {"decision": "approve"},
        }
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id,
            user_id=self.user.id,
        )
        mock_fetch.assert_called_once_with(
            self.run_id,
            self.organization,
            viewer_context=viewer_context,
        )
        mock_update.assert_called_once_with(update_body, viewer_context=viewer_context)
        assert self.mock_post.call_args.kwargs["replace_original"] is True
        result_block = self.mock_post.call_args.kwargs["blocks"][0]
        assert "Access granted" in result_block.text

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_reject_resumes_run_without_a_grant(self, mock_fetch, mock_update):
        self.cache_message()
        mock_fetch.return_value = self.pending_state()
        mock_update.return_value = Mock(status=202)

        response = self.post_webhook_block_kit(
            action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_REJECT)],
            original_message=self.get_original_message(),
        )

        assert response.status_code == 200
        assert not agent_token.active_grant_scopes(self.organization.id, self.user.id, "session-1")
        update_body = mock_update.call_args.args[0]
        assert update_body["payload"]["response_data"] == {"decision": "reject"}
        result_block = self.mock_post.call_args.kwargs["blocks"][0]
        assert "Access not granted" in result_block.text

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_approve_requires_the_agent_token_feature(self, mock_fetch, mock_update):
        self.cache_message()

        response = self.post_webhook_block_kit(
            action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
            original_message=self.get_original_message(),
        )

        assert response.status_code == 200
        assert response.data["text"] == "This approval request is no longer available."
        assert not agent_token.active_grant_scopes(self.organization.id, self.user.id, "session-1")
        mock_fetch.assert_not_called()
        mock_update.assert_not_called()

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_another_user_cannot_approve_the_run(self, mock_fetch, mock_update):
        self.cache_message()
        other_user = self.create_user()
        self.create_member(user=other_user, organization=self.organization)
        slack_user_id = "slack:2"
        self.create_identity(other_user, self.idp, slack_user_id)

        with self.feature(agent_token.FEATURE_FLAG):
            response = self.post_webhook_block_kit(
                action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
                original_message=self.get_original_message(),
                slack_user={
                    "id": slack_user_id,
                    "name": "other-user",
                    "username": "other-user",
                    "team_id": "TXXXXXXX1",
                },
            )

        assert response.status_code == 200
        assert "belongs to another user" in response.data["text"]
        mock_fetch.assert_not_called()
        mock_update.assert_not_called()

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_unrecognized_message_cannot_approve(self, mock_fetch, mock_update):
        with self.feature(agent_token.FEATURE_FLAG):
            response = self.post_webhook_block_kit(
                action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
                original_message=self.get_original_message(),
            )

        assert response.status_code == 200
        assert response.data["text"] == "This approval request is no longer available."
        mock_fetch.assert_not_called()
        mock_update.assert_not_called()

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_stale_message_cannot_approve_a_later_input(self, mock_fetch, mock_update):
        self.cache_message(input_id="approval-previous")
        mock_fetch.return_value = self.pending_state(input_id="approval-current")

        with self.feature(agent_token.FEATURE_FLAG):
            response = self.post_webhook_block_kit(
                action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
                original_message=self.get_original_message(),
            )

        assert response.status_code == 200
        assert response.data["text"] == "This approval request is no longer available."
        assert not agent_token.active_grant_scopes(self.organization.id, self.user.id, "session-1")
        mock_update.assert_not_called()

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_approve_cannot_exceed_the_slack_users_scopes(self, mock_fetch, mock_update):
        self.cache_message()
        member_user = self.create_user()
        self.create_member(user=member_user, organization=self.organization, role="member")
        slack_user_id = "slack:member"
        self.create_identity(member_user, self.idp, slack_user_id)
        self.seer_run.user_id = member_user.id
        self.seer_run.save(update_fields=["user_id"])
        mock_fetch.return_value = self.pending_state()

        with self.feature(agent_token.FEATURE_FLAG):
            response = self.post_webhook_block_kit(
                action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
                original_message=self.get_original_message(),
                slack_user={
                    "id": slack_user_id,
                    "name": "member-user",
                    "username": "member-user",
                    "team_id": "TXXXXXXX1",
                },
            )

        assert response.status_code == 200
        assert response.data["text"] == (
            "You do not have all the Sentry permissions requested by Seer."
        )
        assert not agent_token.active_grant_scopes(
            self.organization.id, member_user.id, "session-1"
        )
        mock_update.assert_not_called()

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_approve_grants_only_the_slack_users_scopes(self, mock_fetch, mock_update):
        self.cache_message()
        member_user = self.create_user()
        self.create_member(user=member_user, organization=self.organization, role="member")
        slack_user_id = "slack:member"
        self.create_identity(member_user, self.idp, slack_user_id)
        self.seer_run.user_id = member_user.id
        self.seer_run.save(update_fields=["user_id"])
        mock_fetch.return_value = self.pending_state(scopes=["org:read", "org:write"])
        mock_update.return_value = Mock(status=202)

        with self.feature(agent_token.FEATURE_FLAG):
            response = self.post_webhook_block_kit(
                action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
                original_message=self.get_original_message(),
                slack_user={
                    "id": slack_user_id,
                    "name": "member-user",
                    "username": "member-user",
                    "team_id": "TXXXXXXX1",
                },
            )

        assert response.status_code == 200
        assert agent_token.active_grant_scopes(
            self.organization.id, member_user.id, "session-1"
        ) == {"org:read"}
        update_body = mock_update.call_args.args[0]
        assert update_body["payload"]["response_data"] == {
            "decision": "reject",
            "reason": "insufficient_scope",
        }
        result_block = self.mock_post.call_args.kwargs["blocks"][0]
        assert "Access not granted" in result_block.text

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_inactive_user_cannot_approve(self, mock_fetch, mock_update):
        self.cache_message()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.is_active = False
            self.user.save(update_fields=["is_active"])

        with self.feature(agent_token.FEATURE_FLAG):
            response = self.post_webhook_block_kit(
                action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
                original_message=self.get_original_message(),
            )

        assert response.status_code == 200
        assert response.data["text"] == "This approval request is no longer available."
        mock_fetch.assert_not_called()
        mock_update.assert_not_called()

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_suspended_user_cannot_approve(self, mock_fetch, mock_update):
        self.cache_message()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.is_suspended = True
            self.user.save(update_fields=["is_suspended"])

        with self.feature(agent_token.FEATURE_FLAG):
            response = self.post_webhook_block_kit(
                action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
                original_message=self.get_original_message(),
            )

        assert response.status_code == 200
        assert response.data["text"] == "This approval request is no longer available."
        mock_fetch.assert_not_called()
        mock_update.assert_not_called()

    @patch("sentry.integrations.slack.webhooks.action.make_agent_update_request")
    @patch("sentry.integrations.slack.webhooks.action.fetch_run_status")
    def test_disabled_organization_integration_cannot_approve(self, mock_fetch, mock_update):
        self.cache_message()
        organization_integration = integration_service.get_organization_integration(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )
        assert organization_integration is not None
        integration_service.update_organization_integration(
            org_integration_id=organization_integration.id,
            status=ObjectStatus.DISABLED,
        )

        with self.feature(agent_token.FEATURE_FLAG):
            response = self.post_webhook_block_kit(
                action_data=[self.get_action(SlackAction.SEER_AGENT_WRITE_APPROVE)],
                original_message=self.get_original_message(),
            )

        assert response.status_code == 200
        assert response.data["text"] == "This approval request is no longer available."
        mock_fetch.assert_not_called()
        mock_update.assert_not_called()
