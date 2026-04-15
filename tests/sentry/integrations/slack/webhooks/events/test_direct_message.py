from unittest.mock import patch

import pytest

from sentry.integrations.messaging.metrics import SeerSlackHaltReason
from sentry.integrations.models.integration import Integration
from sentry.integrations.slack.utils.constants import SlackScope
from sentry.testutils.asserts import assert_halt_metric
from sentry.testutils.silo import assume_test_silo_mode_of

from . import SEER_EXPLORER_FEATURES, BaseEventTest

MESSAGE_DM_EVENT = {
    "type": "message",
    "channel": "D1234567890",
    "user": "U1234567890",
    "text": "What is causing errors in my project?",
    "ts": "1234567890.123456",
}
THREADED_MESSAGE_DM_EVENT = {**MESSAGE_DM_EVENT, "thread_ts": "1234567890.000001"}
AUTHORIZATIONS_DATA = {"authorizations": [{"user_id": "U0BOT", "is_bot": True}]}


class DirectMessageTest(BaseEventTest):
    """
    Tests for DM messages triggering the Seer Explorer agentic workflow.

    These tests require the integration to have the assistant:write scope so
    that DMs are routed to on_direct_message instead of the help message handler.
    """

    def setUp(self):
        super().setUp()
        with assume_test_silo_mode_of(Integration):
            self.integration.metadata["scopes"] = [SlackScope.ASSISTANT_WRITE]
            self.integration.save()

        self.link_identity(slack_user_id=MESSAGE_DM_EVENT["user"])

    @pytest.fixture(autouse=True)
    def mock_set_thread_status(self):
        with patch(
            "sentry.integrations.slack.integration.SlackIntegration.set_thread_status",
        ) as self.mock_status:
            yield

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_dispatches_task(self, mock_apply_async):
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=MESSAGE_DM_EVENT, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["integration_id"] == self.integration.id
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["channel_id"] == MESSAGE_DM_EVENT["channel"]
        assert kwargs["ts"] == MESSAGE_DM_EVENT["ts"]
        assert kwargs["thread_ts"] is None
        assert kwargs["text"] == MESSAGE_DM_EVENT["text"]
        assert kwargs["slack_user_id"] == MESSAGE_DM_EVENT["user"]
        assert kwargs["bot_user_id"] == AUTHORIZATIONS_DATA["authorizations"][0]["user_id"]

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_threaded_dispatches_task(self, mock_apply_async):
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=THREADED_MESSAGE_DM_EVENT, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["ts"] == MESSAGE_DM_EVENT["ts"]
        assert kwargs["thread_ts"] == THREADED_MESSAGE_DM_EVENT["thread_ts"]

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.webhooks.event.send_identity_link_prompt")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_identity_not_linked(self, mock_apply_async, mock_send_link, mock_record):
        """When no identity is linked, send a link prompt and halt."""
        self.unlink_identity()
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=MESSAGE_DM_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        mock_send_link.assert_called_once()
        assert mock_send_link.call_args[1]["slack_user_id"] == MESSAGE_DM_EVENT["user"]
        assert_halt_metric(mock_record, SeerSlackHaltReason.IDENTITY_NOT_LINKED)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_feature_flag_disabled(self, mock_apply_async, mock_record):
        resp = self.post_webhook(event_data=MESSAGE_DM_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.NO_VALID_ORGANIZATION)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_no_integration(self, mock_apply_async, mock_record):
        with patch(
            "sentry.integrations.slack.webhooks.event.integration_service.get_organization_integrations",
            return_value=[],
        ):
            with self.feature(SEER_EXPLORER_FEATURES):
                resp = self.post_webhook(event_data=MESSAGE_DM_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.NO_VALID_INTEGRATION)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_dm_empty_text(self, mock_apply_async, mock_record):
        event_data = {**MESSAGE_DM_EVENT, "text": ""}
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, SeerSlackHaltReason.MISSING_EVENT_DATA)
