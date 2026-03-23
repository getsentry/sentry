from unittest.mock import patch

from . import BaseEventTest

APP_MENTION_EVENT = {
    "type": "app_mention",
    "channel": "C1234567890",
    "user": "U1234567890",
    "text": "<@U0BOT> What is causing this issue? https://testserver/organizations/test-org/issues/123/",
    "ts": "1234567890.123456",
    "event_ts": "1234567890.123456",
}

THREADED_APP_MENTION_EVENT = {
    **APP_MENTION_EVENT,
    "thread_ts": "1234567890.000001",
}


class AppMentionEventTest(BaseEventTest):
    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_dispatches_task(self, mock_apply_async):
        with self.feature("organizations:seer-slack-explorer"):
            resp = self.post_webhook(event_data=THREADED_APP_MENTION_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["integration_id"] == self.integration.id
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["channel_id"] == "C1234567890"
        assert kwargs["thread_ts"] == "1234567890.123456"
        assert kwargs["text"] == THREADED_APP_MENTION_EVENT["text"]
        assert kwargs["slack_user_id"] == "U1234567890"
        assert "message_ts" not in kwargs

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_feature_flag_disabled(self, mock_apply_async):
        resp = self.post_webhook(event_data=APP_MENTION_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_empty_text(self, mock_apply_async):
        event_data = {**APP_MENTION_EVENT, "text": ""}
        with self.feature("organizations:seer-slack-explorer"):
            resp = self.post_webhook(event_data=event_data)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()

    @patch("sentry.seer.entrypoints.slack.tasks.process_mention_for_slack.apply_async")
    def test_app_mention_no_organization(self, mock_apply_async):
        """When the integration has no org integrations, we should not dispatch."""
        with patch(
            "sentry.integrations.slack.webhooks.event.integration_service.get_organization_integrations",
            return_value=[],
        ):
            with self.feature("organizations:seer-slack-explorer"):
                resp = self.post_webhook(event_data=APP_MENTION_EVENT)

        assert resp.status_code == 200
        mock_apply_async.assert_not_called()
