from unittest.mock import ANY, Mock, patch

from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.notifications.platform.templates.seer import SeerAutofixUpdate
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.integrations.slack import (
    SlackEntrypoint,
    SlackEntrypointCachePayload,
    _send_thread_update,
)
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.testutils.cases import TestCase

RUN_ID = 123
MOCK_SEER_WEBHOOKS = {
    SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED: {
        "run_id": RUN_ID,
        "root_cause": {
            "description": "Test description",
            "steps": [{"title": "Step 1"}, {"title": "Step 2"}],
        },
    },
    SentryAppEventType.SEER_SOLUTION_COMPLETED: {
        "run_id": RUN_ID,
        "solution": {
            "description": "Test description",
            "steps": [{"title": "Step 1"}, {"title": "Step 2"}],
        },
    },
    SentryAppEventType.SEER_CODING_COMPLETED: {
        "run_id": RUN_ID,
        "changes": [
            {
                "repo_name": "Test repo",
                "diff": "Test diff",
                "title": "Test title",
                "description": "Test description",
            }
        ],
    },
    SentryAppEventType.SEER_PR_CREATED: {
        "run_id": RUN_ID,
        "pull_requests": [
            {
                "pr_number": 123,
                "pr_url": "https://github.com/owner/repo/pull/123",
            }
        ],
    },
}


class SlackEntrypointTest(TestCase):
    def setUp(self):
        self.slack_user_id = "UXXXXXXXXX1"
        self.channel_id = "CXXXXXXXXX1"
        self.thread_ts = "1712345678.987654"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="TXXXXXXXXX1",
            provider="slack",
        )
        self.slack_request: SlackActionRequest = Mock()
        self.slack_request.integration = self.integration
        self.slack_request.channel_id = self.channel_id
        self.slack_request.user_id = self.slack_user_id
        self.slack_request.data = {"message": {"ts": self.thread_ts}}

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    def test_on_trigger_autofix_error(self, mock_send_threaded_ephemeral_message):
        ep = SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
        )
        ep.on_trigger_autofix_error(error="Test error")
        mock_send_threaded_ephemeral_message.assert_called_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
            slack_user_id=self.slack_request.user_id,
        )

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    def test_on_trigger_autofix_success(self, mock_send_threaded_ephemeral_message):
        ep = SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
        )
        ep.on_trigger_autofix_success(run_id=RUN_ID)
        mock_send_threaded_ephemeral_message.assert_called_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
            slack_user_id=self.slack_request.user_id,
        )

    def test_create_autofix_cache_payload(self):
        ep = SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
        )
        cache_payload = ep.create_autofix_cache_payload()
        SlackEntrypointCachePayload(**cache_payload)
        assert cache_payload["group_link"] == self.group.get_absolute_url()
        assert cache_payload["organization_id"] == self.organization.id
        assert cache_payload["integration_id"] == self.integration.id
        assert cache_payload["project_id"] == self.group.project.id
        assert cache_payload["group_id"] == self.group.id
        assert cache_payload["thread_ts"] == self.thread_ts
        assert cache_payload["channel_id"] == self.channel_id

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_message")
    def test_on_autofix_update_root_cause(self, mock_send_threaded_message):
        ep = SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
        )
        for event_type, event_payload in MOCK_SEER_WEBHOOKS.items():
            cache_payload = ep.create_autofix_cache_payload()
            ep.on_autofix_update(
                event_type=event_type, event_payload=event_payload, cache_payload=cache_payload
            )
            mock_send_threaded_message.assert_called_with(
                channel_id=self.channel_id,
                thread_ts=self.thread_ts,
                renderable=ANY,
            )

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_message")
    def test__send_thread_update(
        self, mock_send_threaded_message, mock_send_threaded_ephemeral_message
    ):
        data = SeerAutofixUpdate(
            run_id=RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=AutofixStoppingPoint.SOLUTION,
            group_link=self.group.get_absolute_url(),
        )
        install = self.integration.get_installation(organization_id=self.organization.id)

        _send_thread_update(
            install=install, channel_id=self.channel_id, thread_ts=self.thread_ts, data=data
        )
        mock_send_threaded_message.assert_called_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
        )
        mock_send_threaded_ephemeral_message.assert_not_called()

        mock_send_threaded_message.reset_mock()
        _send_thread_update(
            install=install,
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            data=data,
            ephemeral_user_id=self.slack_user_id,
        )
        mock_send_threaded_message.assert_not_called()
        mock_send_threaded_ephemeral_message.assert_called_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
            slack_user_id=self.slack_user_id,
        )
