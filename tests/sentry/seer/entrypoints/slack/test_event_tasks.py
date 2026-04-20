from unittest.mock import MagicMock, patch

from sentry.integrations.messaging.metrics import SeerSlackHaltReason
from sentry.integrations.slack.integration import SlackIntegration
from sentry.integrations.slack.requests.event import SeerResolutionResult
from sentry.seer.entrypoints.slack.event_tasks import (
    handle_seer_assistant_thread_started_event,
    handle_seer_mention_event,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

MENTION_KWARGS = {
    "channel_id": "C1",
    "slack_user_id": "U_SLACK",
    "text": "<@U0BOT> what's broken?",
    "ts": "100.000",
    "thread_ts": None,
    "bot_user_id": "U0BOT",
}
ASSISTANT_KWARGS = {
    "channel_id": "C1",
    "slack_user_id": "U_SLACK",
    "thread_ts": "100.000",
}


@control_silo_test
class HandleSeerMentionEventTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, external_id="T1", provider="slack"
        )

    @patch("sentry.seer.entrypoints.slack.event_tasks.process_mention_for_slack.apply_async")
    @patch("sentry.seer.entrypoints.slack.event_tasks.resolve_seer_organization_for_slack_user")
    def test_happy_path_enqueues_process_mention(self, mock_resolve, mock_apply):
        mock_resolve.return_value = SeerResolutionResult(
            organization_id=self.organization.id, error_reason=None
        )
        mock_install = MagicMock(spec=SlackIntegration)
        with patch(
            "sentry.integrations.services.integration.model.RpcIntegration.get_installation",
            return_value=mock_install,
        ):
            handle_seer_mention_event(integration_id=self.integration.id, **MENTION_KWARGS)

        mock_install.set_thread_status.assert_called_once()
        mock_apply.assert_called_once()
        kwargs = mock_apply.call_args.kwargs["kwargs"]
        assert kwargs["integration_id"] == self.integration.id
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["text"] == MENTION_KWARGS["text"]
        assert kwargs["bot_user_id"] == "U0BOT"

    @patch("sentry.seer.entrypoints.slack.event_tasks.send_identity_link_prompt")
    @patch("sentry.seer.entrypoints.slack.event_tasks.process_mention_for_slack.apply_async")
    @patch("sentry.seer.entrypoints.slack.event_tasks.resolve_seer_organization_for_slack_user")
    def test_identity_not_linked_prompts_link(self, mock_resolve, mock_apply, mock_prompt):
        mock_resolve.return_value = SeerResolutionResult(
            organization_id=None, error_reason=SeerSlackHaltReason.IDENTITY_NOT_LINKED
        )

        handle_seer_mention_event(integration_id=self.integration.id, **MENTION_KWARGS)

        mock_apply.assert_not_called()
        mock_prompt.assert_called_once()
        assert mock_prompt.call_args.kwargs["slack_user_id"] == "U_SLACK"

    @patch("sentry.seer.entrypoints.slack.event_tasks.send_identity_link_prompt")
    @patch("sentry.seer.entrypoints.slack.event_tasks.process_mention_for_slack.apply_async")
    @patch("sentry.seer.entrypoints.slack.event_tasks.resolve_seer_organization_for_slack_user")
    def test_non_identity_error_does_not_prompt(self, mock_resolve, mock_apply, mock_prompt):
        mock_resolve.return_value = SeerResolutionResult(
            organization_id=None, error_reason=SeerSlackHaltReason.NO_VALID_ORGANIZATION
        )

        handle_seer_mention_event(integration_id=self.integration.id, **MENTION_KWARGS)

        mock_apply.assert_not_called()
        mock_prompt.assert_not_called()

    @patch("sentry.seer.entrypoints.slack.event_tasks.process_mention_for_slack.apply_async")
    def test_missing_integration_halts(self, mock_apply):
        handle_seer_mention_event(integration_id=99999, **MENTION_KWARGS)
        mock_apply.assert_not_called()


@control_silo_test
class HandleSeerAssistantThreadStartedEventTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, external_id="T1", provider="slack"
        )

    @patch("sentry.seer.entrypoints.slack.event_tasks.resolve_seer_organization_for_slack_user")
    def test_happy_path_sets_suggested_prompts(self, mock_resolve):
        mock_resolve.return_value = SeerResolutionResult(
            organization_id=self.organization.id, error_reason=None
        )
        mock_install = MagicMock(spec=SlackIntegration)
        with patch(
            "sentry.integrations.services.integration.model.RpcIntegration.get_installation",
            return_value=mock_install,
        ):
            handle_seer_assistant_thread_started_event(
                integration_id=self.integration.id, **ASSISTANT_KWARGS
            )

        mock_install.set_suggested_prompts.assert_called_once()

    @patch("sentry.seer.entrypoints.slack.event_tasks.send_identity_link_prompt")
    @patch("sentry.seer.entrypoints.slack.event_tasks.resolve_seer_organization_for_slack_user")
    def test_identity_not_linked_prompts_welcome(self, mock_resolve, mock_prompt):
        mock_resolve.return_value = SeerResolutionResult(
            organization_id=None, error_reason=SeerSlackHaltReason.IDENTITY_NOT_LINKED
        )

        handle_seer_assistant_thread_started_event(
            integration_id=self.integration.id, **ASSISTANT_KWARGS
        )

        mock_prompt.assert_called_once()
        assert mock_prompt.call_args.kwargs["is_welcome_message"] is True
