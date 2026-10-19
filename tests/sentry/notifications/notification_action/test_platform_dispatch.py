from __future__ import annotations

import uuid
from typing import Any
from unittest import mock

from slack_sdk.web import SlackResponse

from sentry.analytics.events.alert_sent import AlertSentEvent
from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.integrations.slack.analytics import SlackIntegrationNotificationSent
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.issue_alert_registry import (
    DiscordIssueAlertHandler,
    SlackIssueAlertHandler,
)
from sentry.notifications.notification_action.metric_alert_registry import SlackMetricAlertHandler
from sentry.notifications.platform.provider import SendSuccessResult
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.types import NotificationProviderKey
from sentry.silo.base import SiloMode
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

PLATFORM_DISPATCH_PATH = "sentry.notifications.notification_action.platform_dispatch"
SLACK_ISSUE_LEGACY_CLIENT = "sentry.integrations.slack.actions.notification.SlackSdkClient"
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


@with_feature("organizations:notification-platform.internal-testing")
class MetricAlertPlatformDispatchTest(MetricAlertHandlerBase):
    def setUp(self) -> None:
        self.enterContext(
            override_options(
                {
                    "notifications.platform-rollout.internal-testing": {"metric-alert": 1.0},
                    "notifications.platform.alert-providers": {
                        "metric-alert": ["slack", "slack_staging"]
                    },
                }
            )
        )
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

    @mock.patch.object(NotificationService, "notify_target", return_value=SendSuccessResult())
    def test_slack_staging_targets_staging_provider(self, mock_notify: mock.MagicMock) -> None:
        action = self.create_slack_action(Action.Type.SLACK_STAGING)

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(action))

        target = mock_notify.call_args.kwargs["target"]
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
        # The config schema rejects a missing target_identifier, so drop it after saving
        action = self.create_slack_action(Action.Type.SLACK)
        action.config["target_identifier"] = None

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(action))

        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "notification_action.platform_dispatch.missing_target"
        assert call_args[1]["extra"]["target_identifier"] is None
        assert call_args[1]["extra"]["provider"] == "slack"

    @mock.patch(f"{PLATFORM_DISPATCH_PATH}.logger")
    def test_logs_when_integration_inactive(self, mock_logger: mock.MagicMock) -> None:
        # Mark integration as inactive
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(status=ObjectStatus.DISABLED)

        SlackMetricAlertHandler.invoke_legacy_registry(self.invocation(self.action))

        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "notification_action.platform_dispatch.integration_inactive"
        assert call_args[1]["extra"]["integration_id"] == self.integration.id
        assert call_args[1]["extra"]["provider"] == "slack"
        assert call_args[1]["extra"]["has_integration"] is True
        assert call_args[1]["extra"]["integration_status"] == 1


ISSUE_PLATFORM_OPTIONS = {
    "notifications.platform-rollout.internal-testing": {"issue": 1.0},
    "notifications.platform.alert-providers": {"issue": ["slack", "discord"]},
}


@requires_snuba
@with_feature("organizations:notification-platform.internal-testing")
class IssueAlertPlatformDispatchTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(ISSUE_PLATFORM_OPTIONS))
        self.workflow = self.create_workflow(organization=self.organization)
        self.detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        event = self.store_event(
            data={"message": "oh no", "level": "error"}, project_id=self.project.id
        )
        assert event.group is not None
        self.group = event.group
        self.event = event.for_group(self.group)

    def create_channel_action(self, action_type: str, provider: str) -> Action:
        integration, _ = self.create_provider_integration_for(
            provider=provider,
            organization=self.organization,
            user=self.user,
            name=f"test-{provider}",
            external_id=f"{provider}-workspace",
        )
        return self.create_action(
            type=action_type,
            integration_id=integration.id,
            config={
                "target_identifier": "channel123",
                "target_display": "Channel 123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

    def invocation(self, action: Action) -> ActionInvocation:
        return ActionInvocation(
            event_data=WorkflowEventData(event=self.event, group=self.group),
            action=action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

    @mock.patch(SLACK_ISSUE_LEGACY_CLIENT)
    @mock.patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_slack_sends_to_channel(
        self, mock_slack_client: mock.MagicMock, mock_legacy_client: mock.MagicMock
    ) -> None:
        action = self.create_channel_action(Action.Type.SLACK, IntegrationProviderSlug.SLACK)
        client = mock_slack_client.return_value
        client.chat_postMessage.return_value = slack_response(client, "123.456")

        SlackIssueAlertHandler.invoke_legacy_registry(self.invocation(action))

        mock_legacy_client.return_value.chat_postMessage.assert_not_called()
        client.chat_postMessage.assert_called_once()
        call_kwargs = client.chat_postMessage.call_args.kwargs
        assert call_kwargs["channel"] == "channel123"
        assert "thread_ts" not in call_kwargs
        assert "oh no" in call_kwargs["text"]

    @mock.patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_slack_follow_up_replies_in_thread_and_broadcasts(
        self, mock_slack_client: mock.MagicMock
    ) -> None:
        action = self.create_channel_action(Action.Type.SLACK, IntegrationProviderSlug.SLACK)
        client = mock_slack_client.return_value
        client.chat_postMessage.side_effect = [
            slack_response(client, "123.456"),
            slack_response(client, "123.789"),
        ]

        SlackIssueAlertHandler.invoke_legacy_registry(self.invocation(action))
        SlackIssueAlertHandler.invoke_legacy_registry(self.invocation(action))

        follow_up = client.chat_postMessage.call_args_list[1].kwargs
        assert follow_up["thread_ts"] == "123.456"
        assert follow_up["reply_broadcast"] is True

    @mock.patch("sentry.analytics.record")
    @mock.patch(f"{PLATFORM_DISPATCH_PATH}.metrics")
    @mock.patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_slack_records_legacy_analytics(
        self,
        mock_slack_client: mock.MagicMock,
        mock_metrics: mock.MagicMock,
        mock_record: mock.MagicMock,
    ) -> None:
        action = self.create_channel_action(Action.Type.SLACK, IntegrationProviderSlug.SLACK)
        client = mock_slack_client.return_value
        client.chat_postMessage.return_value = slack_response(client, "123.456")
        invocation = self.invocation(action)

        SlackIssueAlertHandler.invoke_legacy_registry(invocation)

        mock_metrics.incr.assert_called_once_with(
            "notifications.sent",
            instance="slack.notification",
            tags={"issue_type": self.group.issue_type.slug},
            skip_internal=False,
        )
        assert_any_analytics_event(
            mock_record,
            SlackIntegrationNotificationSent(
                category="issue_alert",
                organization_id=self.organization.id,
                project_id=self.project.id,
                group_id=self.group.id,
                notification_uuid=invocation.notification_uuid,
                alert_id=action.id,
            ),
        )
        assert_any_analytics_event(
            mock_record,
            AlertSentEvent(
                provider="slack",
                alert_id=action.id,
                alert_type="issue_alert",
                organization_id=self.organization.id,
                project_id=self.project.id,
                external_id="channel123",
                notification_uuid=invocation.notification_uuid,
            ),
        )

    @mock.patch(f"{PLATFORM_DISPATCH_PATH}.prepare_slack_thread_for_autofix_updates")
    @mock.patch(f"{PLATFORM_DISPATCH_PATH}.SeerAutofixOperator.has_access", return_value=True)
    @mock.patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_slack_follow_up_caches_root_thread_for_seer(
        self,
        mock_slack_client: mock.MagicMock,
        mock_has_access: mock.MagicMock,
        mock_prepare_thread: mock.MagicMock,
    ) -> None:
        action = self.create_channel_action(Action.Type.SLACK, IntegrationProviderSlug.SLACK)
        client = mock_slack_client.return_value
        client.chat_postMessage.side_effect = [
            slack_response(client, "123.456"),
            slack_response(client, "123.789"),
        ]

        SlackIssueAlertHandler.invoke_legacy_registry(self.invocation(action))
        SlackIssueAlertHandler.invoke_legacy_registry(self.invocation(action))

        assert [c.kwargs["thread_ts"] for c in mock_prepare_thread.call_args_list] == [
            "123.456",
            "123.456",
        ]

    @mock.patch(f"{PLATFORM_DISPATCH_PATH}.prepare_slack_thread_for_autofix_updates")
    @mock.patch(f"{PLATFORM_DISPATCH_PATH}.SeerAutofixOperator.has_access", return_value=True)
    @mock.patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_slack_thread_flag_off_caches_message_for_seer(
        self,
        mock_slack_client: mock.MagicMock,
        mock_has_access: mock.MagicMock,
        mock_prepare_thread: mock.MagicMock,
    ) -> None:
        self.organization.update_option("sentry:issue_alerts_thread_flag", False)
        action = self.create_channel_action(Action.Type.SLACK, IntegrationProviderSlug.SLACK)
        client = mock_slack_client.return_value
        client.chat_postMessage.return_value = slack_response(client, "123.456")

        SlackIssueAlertHandler.invoke_legacy_registry(self.invocation(action))

        assert "thread_ts" not in client.chat_postMessage.call_args.kwargs
        mock_prepare_thread.assert_called_once()
        assert mock_prepare_thread.call_args.kwargs["thread_ts"] == "123.456"

    @mock.patch("sentry.integrations.discord.integration.DiscordClient")
    def test_discord_sends_to_channel(self, mock_discord_client: mock.MagicMock) -> None:
        action = self.create_channel_action(Action.Type.DISCORD, IntegrationProviderSlug.DISCORD)

        DiscordIssueAlertHandler.invoke_legacy_registry(self.invocation(action))

        send_message = mock_discord_client.return_value.send_message
        send_message.assert_called_once()
        assert send_message.call_args.kwargs["channel_id"] == "channel123"
