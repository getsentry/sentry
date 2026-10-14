from __future__ import annotations

import uuid
from typing import Any
from unittest import mock

from slack_sdk.web import SlackResponse

from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.metric_alert_registry import SlackMetricAlertHandler
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.types import NotificationProviderKey
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

PLATFORM_DISPATCH_PATH = "sentry.notifications.notification_action.platform_dispatch"
SLACK_HANDLER_PATH = "sentry.notifications.notification_action.metric_alert_registry.handlers.slack_metric_alert_handler"


def slack_response(client: mock.MagicMock, ts: str) -> SlackResponse:
    return SlackResponse(
        client=client,
        http_verb="POST",
        api_url="https://slack.com/api/chat.postMessage",
        req_args={},
        data={"ok": True, "ts": ts},
        headers={},
        status_code=200,
    )


@override_options({"notifications.platform-rollout.internal-testing": {"metric-alert": 1.0}})
@override_options({"notifications.platform.alert-providers": {"metric-alert": ["slack", "slack_staging"]}})
@with_feature("organizations:notification-platform.internal-testing")
class MetricAlertPlatformDispatchTest(MetricAlertHandlerBase):
    def setUp(self) -> None:
        self.create_models()
        self.integration, _ = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )
        self.action = self.create_slack_action(Action.Type.SLACK)

    def create_slack_action(self, action_type: str) -> Action:
        return self.create_action(
            type=action_type,
            integration_id=self.integration.id,
            data={"notes": "Check <https://example.com/runbook|the runbook>"},
            config={
                "target_identifier": "channel123",
                "target_display": "Channel 123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

    def invocation(self, action: Action, workflow_id: int | None = None) -> ActionInvocation:
        return ActionInvocation(
            event_data=self.event_data,
            action=action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id if workflow_id is None else workflow_id,
        )

    @mock.patch(f"{SLACK_HANDLER_PATH}.send_incident_alert_notification")
    @mock.patch("sentry.integrations.slack.integration.SlackSdkClient")
    @freeze_time("2021-01-01 00:00:00")
    def test_sends_to_slack_channel(
        self, mock_slack_client: mock.MagicMock, mock_legacy_send: mock.MagicMock
    ) -> None:
        client = mock_slack_client.return_value
        client.chat_postMessage.return_value = slack_response(client, "123.456")

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(self.action))

        mock_legacy_send.assert_not_called()
        client.chat_postMessage.assert_called_once()
        call_kwargs = client.chat_postMessage.call_args.kwargs
        assert call_kwargs["channel"] == "channel123"
        assert "referrer=metric_alert_slack&" in call_kwargs["text"]
        assert "thread_ts" not in call_kwargs
        blocks: list[Any] = call_kwargs["attachments"][0]["blocks"]
        assert "123.45" in blocks[0]["text"]["text"]
        assert blocks[1] == {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "notes: Check <https://example.com/runbook|the runbook>",
            },
        }

    @mock.patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_follow_up_replies_in_thread(self, mock_slack_client: mock.MagicMock) -> None:
        client = mock_slack_client.return_value
        client.chat_postMessage.side_effect = [
            slack_response(client, "123.456"),
            slack_response(client, "123.789"),
        ]

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(self.action))
        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(self.action))

        follow_up = client.chat_postMessage.call_args_list[1].kwargs
        assert follow_up["thread_ts"] == "123.456"
        assert follow_up["reply_broadcast"] is True

    @mock.patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_metric_thread_flag_off_posts_top_level(
        self, mock_slack_client: mock.MagicMock
    ) -> None:
        self.organization.update_option("sentry:metric_alerts_thread_flag", False)
        client = mock_slack_client.return_value
        client.chat_postMessage.side_effect = [
            slack_response(client, "123.456"),
            slack_response(client, "123.789"),
        ]

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(self.action))
        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(self.action))

        assert "thread_ts" not in client.chat_postMessage.call_args_list[1].kwargs

    @mock.patch.object(NotificationService, "notify_sync", return_value={})
    def test_slack_staging_targets_staging_provider(self, mock_notify: mock.MagicMock) -> None:
        action = self.create_slack_action(Action.Type.SLACK_STAGING)

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(action))

        [target] = mock_notify.call_args.kwargs["targets"]
        assert target.provider_key == NotificationProviderKey.SLACK_STAGING

    @override_options({"notifications.platform.alert-providers": {"metric-alert": []}})
    @mock.patch(f"{SLACK_HANDLER_PATH}.send_incident_alert_notification")
    def test_provider_not_allowed_uses_legacy(self, mock_legacy_send: mock.MagicMock) -> None:
        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(self.action))

        mock_legacy_send.assert_called_once()

    @mock.patch(f"{PLATFORM_DISPATCH_PATH}.logger")
    def test_logs_when_integration_id_missing(self, mock_logger: mock.MagicMock) -> None:
        # Create action without integration_id
        action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=None,
            config={
                "target_identifier": "channel123",
                "target_display": "Channel 123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(action))

        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "notification_action.platform_dispatch.missing_target"
        assert call_args[1]["extra"]["integration_id"] is None
        assert call_args[1]["extra"]["provider"] == "slack"

    @mock.patch(f"{PLATFORM_DISPATCH_PATH}.logger")
    def test_logs_when_target_identifier_missing(self, mock_logger: mock.MagicMock) -> None:
        # Create action without target_identifier
        action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_identifier": None,
                "target_display": "Channel 123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(action))

        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "notification_action.platform_dispatch.missing_target"
        assert call_args[1]["extra"]["target_identifier"] is None
        assert call_args[1]["extra"]["provider"] == "slack"

    @mock.patch(f"{PLATFORM_DISPATCH_PATH}.logger")
    def test_logs_when_integration_inactive(self, mock_logger: mock.MagicMock) -> None:
        # Mark integration as inactive
        self.integration.update(status=1)  # ObjectStatus.DISABLED

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(self.action))

        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "notification_action.platform_dispatch.integration_inactive"
        assert call_args[1]["extra"]["integration_id"] == self.integration.id
        assert call_args[1]["extra"]["provider"] == "slack"
        assert call_args[1]["extra"]["has_integration"] is True
        assert call_args[1]["extra"]["integration_status"] == 1
