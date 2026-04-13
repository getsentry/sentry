from typing import Any
from unittest.mock import patch

from sentry.integrations.messaging.metrics import SeerSlackHaltReason
from sentry.testutils.asserts import assert_halt_metric

from . import SEER_EXPLORER_FEATURES, BaseEventTest

ASSISTANT_THREAD: dict[str, Any] = {
    "user_id": "U1234567890",
    "context": {
        "channel_id": "C1234567890",
        "team_id": "T0123456789",
        "enterprise_id": "E1234567890",
    },
    "channel_id": "D1234567890",
    "thread_ts": "1234567890.123456",
}
ASSISTANT_THREAD_STARTED_EVENT = {
    "type": "assistant_thread_started",
    "assistant_thread": ASSISTANT_THREAD,
    "event_ts": "1234567890.123456",
}


class AssistantThreadStartedEventTest(BaseEventTest):
    def setUp(self):
        super().setUp()
        self.link_identity(slack_user_id=ASSISTANT_THREAD["user_id"])

    @patch("sentry.integrations.slack.integration.SlackIntegration.set_suggested_prompts")
    def test_sends_suggested_prompts(self, mock_set_prompts):
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=ASSISTANT_THREAD_STARTED_EVENT)

        assert resp.status_code == 200
        mock_set_prompts.assert_called_once()
        kwargs = mock_set_prompts.call_args[1]
        assert kwargs["channel_id"] == ASSISTANT_THREAD["channel_id"]
        assert kwargs["thread_ts"] == ASSISTANT_THREAD["thread_ts"]
        assert len(kwargs["prompts"]) == 4
        assert kwargs["title"]

    @patch("sentry.integrations.slack.integration.SlackIntegration.set_suggested_prompts")
    def test_prompt_titles_and_messages(self, mock_set_prompts):
        with self.feature(SEER_EXPLORER_FEATURES):
            self.post_webhook(event_data=ASSISTANT_THREAD_STARTED_EVENT)

        prompts = mock_set_prompts.call_args[1]["prompts"]
        for prompt in prompts:
            assert "title" in prompt
            assert "message" in prompt
            assert prompt["title"]
            assert prompt["message"]

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.webhooks.event.send_identity_link_prompt")
    @patch("sentry.integrations.slack.integration.SlackIntegration.set_suggested_prompts")
    def test_identity_not_linked(self, mock_set_prompts, mock_send_link, mock_record):
        self.unlink_identity()
        resp = self.post_webhook(event_data=ASSISTANT_THREAD_STARTED_EVENT)

        assert resp.status_code == 200
        mock_set_prompts.assert_not_called()
        mock_send_link.assert_called_once()
        assert mock_send_link.call_args[1]["is_welcome_message"] is True
        assert_halt_metric(mock_record, SeerSlackHaltReason.IDENTITY_NOT_LINKED)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.integration.SlackIntegration.set_suggested_prompts")
    def test_feature_flag_disabled(self, mock_set_prompts, mock_record):
        resp = self.post_webhook(event_data=ASSISTANT_THREAD_STARTED_EVENT)

        assert resp.status_code == 200
        mock_set_prompts.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.NO_VALID_ORGANIZATION)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.integration.SlackIntegration.set_suggested_prompts")
    def test_no_integration(self, mock_set_prompts, mock_record):
        with patch(
            "sentry.integrations.slack.webhooks.event.integration_service.get_organization_integrations",
            return_value=[],
        ):
            with self.feature(SEER_EXPLORER_FEATURES):
                resp = self.post_webhook(event_data=ASSISTANT_THREAD_STARTED_EVENT)

        assert resp.status_code == 200
        mock_set_prompts.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.NO_VALID_INTEGRATION)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.integration.SlackIntegration.set_suggested_prompts")
    def test_missing_channel_id(self, mock_set_prompts, mock_record):
        event_data = {
            "type": "assistant_thread_started",
            "assistant_thread": {
                "user_id": "U1234567890",
                "thread_ts": "1729999327.187299",
            },
        }
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data)

        assert resp.status_code == 200
        mock_set_prompts.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.MISSING_EVENT_DATA)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.integration.SlackIntegration.set_suggested_prompts")
    def test_missing_thread_ts(self, mock_set_prompts, mock_record):
        event_data = {
            "type": "assistant_thread_started",
            "assistant_thread": {
                "user_id": "U1234567890",
                "channel_id": "D1234567890",
            },
        }
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data)

        assert resp.status_code == 200
        mock_set_prompts.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.MISSING_EVENT_DATA)

    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.set_suggested_prompts",
        side_effect=Exception("API error"),
    )
    def test_set_prompts_failure_does_not_raise(self, mock_set_prompts):
        """If set_suggested_prompts fails, we still return 200."""
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=ASSISTANT_THREAD_STARTED_EVENT)

        assert resp.status_code == 200
        mock_set_prompts.assert_called_once()
