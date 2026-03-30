from unittest.mock import patch

from sentry.integrations.messaging.metrics import AppMentionHaltReason
from sentry.testutils.asserts import assert_halt_metric

from . import BaseEventTest

APP_MENTION_EVENT = {
    "type": "app_mention",
    "channel": "C1234567890",
    "user": "U1234567890",
    "text": "<@U0BOT> What is causing this issue? https://testserver/organizations/test-org/issues/123/",
    "ts": "1234567890.123456",
    "event_ts": "1234567890.123456",
}

AUTHORIZATIONS_DATA = {
    "authorizations": [{"user_id": "U0BOT", "is_bot": True}],
}

THREADED_APP_MENTION_EVENT = {
    **APP_MENTION_EVENT,
    "thread_ts": "1234567890.000001",
}


class AppMentionEventTest(BaseEventTest):
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_dispatches_task(self, mock_apply_async):
        with self.feature("organizations:seer-slack-explorer"):
            resp = self.post_webhook(
                event_data=THREADED_APP_MENTION_EVENT, data=AUTHORIZATIONS_DATA
            )

        assert resp.status_code == 200
        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["integration_id"] == self.integration.id
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["channel_id"] == "C1234567890"
        assert kwargs["ts"] == "1234567890.123456"
        assert kwargs["thread_ts"] == "1234567890.000001"
        assert kwargs["text"] == THREADED_APP_MENTION_EVENT["text"]
        assert kwargs["slack_user_id"] == "U1234567890"
        assert kwargs["bot_user_id"] == "U0BOT"

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_dispatches_task_no_authorizations(self, mock_apply_async):
        with self.feature("organizations:seer-slack-explorer"):
            resp = self.post_webhook(event_data=THREADED_APP_MENTION_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["bot_user_id"] == ""

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_non_threaded_dispatches_task(self, mock_apply_async):
        """Non-threaded mentions dispatch with ts set and thread_ts as None."""
        with self.feature("organizations:seer-slack-explorer"):
            resp = self.post_webhook(event_data=APP_MENTION_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["ts"] == APP_MENTION_EVENT["ts"]
        assert kwargs["thread_ts"] is None

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_feature_flag_disabled(self, mock_apply_async, mock_record):
        resp = self.post_webhook(event_data=APP_MENTION_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, AppMentionHaltReason.FEATURE_NOT_ENABLED)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_empty_text(self, mock_apply_async, mock_record):
        event_data = {**APP_MENTION_EVENT, "text": ""}
        with self.feature("organizations:seer-slack-explorer"):
            resp = self.post_webhook(event_data=event_data)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, AppMentionHaltReason.MISSING_EVENT_DATA)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_no_organization(self, mock_apply_async, mock_record):
        """When the integration has no org integrations, we should not dispatch."""
        with patch(
            "sentry.integrations.slack.webhooks.event.integration_service.get_organization_integrations",
            return_value=[],
        ):
            with self.feature("organizations:seer-slack-explorer"):
                resp = self.post_webhook(event_data=APP_MENTION_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, AppMentionHaltReason.NO_ORGANIZATION)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_org_not_found(self, mock_apply_async, mock_record):
        with patch(
            "sentry.organizations.services.organization.impl.DatabaseBackedOrganizationService.get",
            return_value=None,
        ):
            with self.feature("organizations:seer-slack-explorer"):
                resp = self.post_webhook(event_data=APP_MENTION_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
        assert_halt_metric(mock_record, AppMentionHaltReason.ORGANIZATION_NOT_FOUND)
