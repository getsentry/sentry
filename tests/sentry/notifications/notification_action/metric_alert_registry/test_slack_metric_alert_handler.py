from __future__ import annotations

import uuid
from dataclasses import asdict
from typing import Any
from unittest import mock
from unittest.mock import patch

import orjson
from slack_sdk.web import SlackResponse

from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentStatus, TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.activity import Activity
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.metric_alert_registry import SlackMetricAlertHandler
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_detector_serializer,
)
from sentry.notifications.notification_action.utils import metric_alert_notification_data_factory
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, DetectorPriorityLevel, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

_HANDLER_PATH = "sentry.notifications.notification_action.metric_alert_registry.handlers.slack_metric_alert_handler"


class TestSlackMetricAlertHandlerSendAlert(MetricAlertHandlerBase):
    def setUp(self) -> None:
        self.create_models()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )
        self.action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_identifier": "channel123",
                "target_display": "Channel 123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        self.handler = SlackMetricAlertHandler()

    def _make_send_alert_kwargs(self) -> dict[str, Any]:
        notification_context = NotificationContext.from_action_model(self.action)
        assert self.group_event.occurrence is not None
        assert self.group_event.occurrence.priority is not None
        priority = DetectorPriorityLevel(self.group_event.occurrence.priority)
        return dict(
            notification_context=notification_context,
            alert_context=AlertContext.from_workflow_engine_models(
                self.detector,
                self.evidence_data,
                self.group_event.group.status,
                priority,
            ),
            metric_issue_context=MetricIssueContext.from_group_event(
                self.group, self.evidence_data, priority
            ),
            open_period_context=OpenPeriodContext.from_group(self.group),
            trigger_status=TriggerStatus.ACTIVE,
            project=self.detector.linked_project,
            organization=self.detector.linked_project.organization,
            notification_uuid=str(uuid.uuid4()),
        )

    @override_options({"notifications.platform-rollout.internal-testing": {"metric-alert": 1.0}})
    @with_feature("organizations:notification-platform.internal-testing")
    @patch("sentry.integrations.slack.integration.SlackSdkClient")
    @freeze_time("2021-01-01 00:00:00")
    def test_send_alert_via_np_sends_to_slack_channel(
        self, mock_slack_client: mock.MagicMock
    ) -> None:
        self.action.update(data={"notes": "Check <https://example.com/runbook|the runbook>"})
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = SlackResponse(
            client=mock_client_instance,
            http_verb="POST",
            api_url="https://slack.com/api/chat.postMessage",
            req_args={},
            data={"ok": True, "ts": "123.456"},
            headers={},
            status_code=200,
        )

        self.handler.send_alert(**self._make_send_alert_kwargs())

        mock_client_instance.chat_postMessage.assert_called_once()
        call_kwargs = mock_client_instance.chat_postMessage.call_args.kwargs
        assert call_kwargs["channel"] == "channel123"
        assert call_kwargs["attachments"] is not None
        attachments: list[Any] = call_kwargs["attachments"]
        assert len(attachments) == 1
        blocks: list[Any] = attachments[0]["blocks"]
        assert len(blocks) == 2
        assert blocks[0]["type"] == "section"
        assert blocks[0]["text"]["type"] == "mrkdwn"
        assert "123.45" in blocks[0]["text"]["text"]
        assert blocks[1] == {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "notes: Check <https://example.com/runbook|the runbook>",
            },
        }

    @with_feature("organizations:metric-alert-chartcuterie")
    @patch("sentry.integrations.slack.utils.notifications.build_metric_alert_chart")
    @patch("sentry.integrations.slack.utils.notifications.SlackSdkClient")
    @patch(f"{_HANDLER_PATH}.NotificationService.has_access", return_value=False)
    def test_send_alert_and_resolution_with_notes_and_chart(
        self,
        mock_has_access: mock.MagicMock,
        mock_slack_client: mock.MagicMock,
        mock_chart: mock.MagicMock,
    ) -> None:
        self.action.update(data={"notes": "Check <https://example.com/runbook|the runbook>"})
        mock_chart.return_value = "https://example.com/chart.png"
        client = mock_slack_client.return_value
        client.chat_postMessage.return_value = {"ok": True, "ts": "123.456"}

        kwargs = self._make_send_alert_kwargs()
        self.handler.send_alert(**kwargs)

        client.chat_postMessage.assert_called_once()
        payload = client.chat_postMessage.call_args.kwargs
        assert payload["channel"] == "channel123"
        blocks = orjson.loads(payload["attachments"])[0]["blocks"]
        assert "123.45" in blocks[0]["text"]["text"]
        expected_notes_and_chart = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "notes: Check <https://example.com/runbook|the runbook>",
                },
            },
            {
                "type": "image",
                "image_url": "https://example.com/chart.png",
                "alt_text": "Metric Alert Chart",
            },
        ]
        assert blocks[1:] == expected_notes_and_chart

        kwargs["metric_issue_context"].new_status = IncidentStatus.CLOSED
        kwargs["trigger_status"] = TriggerStatus.RESOLVED

        self.handler.send_alert(**kwargs)

        assert client.chat_postMessage.call_count == 2
        resolved_payload = client.chat_postMessage.call_args.kwargs
        assert resolved_payload["channel"] == "channel123"
        assert "Resolved" in resolved_payload["text"]
        resolved_blocks = orjson.loads(resolved_payload["attachments"])[0]["blocks"]
        assert resolved_blocks[1:] == expected_notes_and_chart

    @patch("sentry.integrations.slack.utils.notifications.SlackSdkClient")
    @patch(f"{_HANDLER_PATH}.NotificationService.has_access", return_value=False)
    def test_send_alert_with_empty_notes(
        self, mock_has_access: mock.MagicMock, mock_slack_client: mock.MagicMock
    ) -> None:
        self.action.update(data={"notes": ""})
        client = mock_slack_client.return_value
        client.chat_postMessage.return_value = {"ok": True, "ts": "123.456"}

        self.handler.send_alert(**self._make_send_alert_kwargs())

        client.chat_postMessage.assert_called_once()
        blocks = orjson.loads(client.chat_postMessage.call_args.kwargs["attachments"])[0]["blocks"]
        assert len(blocks) == 1

    @patch(f"{_HANDLER_PATH}.send_incident_alert_notification")
    @freeze_time("2021-01-01 00:00:00")
    def test_send_alert_falls_back_to_legacy_when_no_access(
        self, mock_send_incident: mock.MagicMock
    ) -> None:
        # No feature flag enabled → has_access returns False → legacy path
        kwargs = self._make_send_alert_kwargs()
        self.handler.send_alert(**kwargs)

        mock_send_incident.assert_called_once_with(
            organization=kwargs["organization"],
            alert_context=kwargs["alert_context"],
            notification_context=kwargs["notification_context"],
            metric_issue_context=kwargs["metric_issue_context"],
            open_period_context=kwargs["open_period_context"],
            detector_serialized_response=get_detector_serializer(self.detector),
            notification_uuid=kwargs["notification_uuid"],
        )


class TestSlackMetricAlertHandlerInvokeRegistry(MetricAlertHandlerBase):
    """Tests for invoke_legacy_registry — verifies context extraction from GroupEvent and Activity."""

    def setUp(self) -> None:
        self.create_models()
        self.action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=1234567890,
            config={
                "target_identifier": "channel123",
                "target_display": "Channel 123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        self.handler = SlackMetricAlertHandler()

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.SlackMetricAlertHandler.send_alert"
    )
    @freeze_time("2021-01-01 00:00:00")
    def test_invoke_legacy_registry(self, mock_send_alert: mock.MagicMock) -> None:
        notification_uuid = str(uuid.uuid4())

        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=notification_uuid,
            workflow_id=self.workflow.id,
        )

        self.handler.invoke_legacy_registry(invocation)

        assert mock_send_alert.call_count == 1
        (
            notification_context,
            alert_context,
            metric_issue_context,
            open_period_context,
            organization,
            notification_uuid,
        ) = self.unpack_kwargs(mock_send_alert)

        self.assert_notification_context(
            notification_context,
            integration_id=1234567890,
            target_identifier="channel123",
            target_display="Channel 123",
            sentry_app_config=None,
            sentry_app_id=None,
        )

        self.assert_alert_context(
            alert_context,
            name=self.detector.name,
            action_identifier_id=self.detector.id,
            threshold_type=AlertRuleThresholdType.ABOVE,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=None,
            alert_threshold=self.evidence_data.conditions[0]["comparison"],
        )

        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.open_period.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CRITICAL,
            metric_value=123.45,
            group=self.group_event.group,
            title=self.group_event.group.title,
            subscription=self.subscription,
        )

        self.assert_open_period_context(
            open_period_context,
            id=self.open_period.id,
            date_started=self.group_event.group.first_seen,
            date_closed=None,
        )

        assert organization == self.detector.linked_project.organization
        assert isinstance(notification_uuid, str)

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.SlackMetricAlertHandler.send_alert"
    )
    @freeze_time("2021-01-01 00:00:00")
    def test_invoke_legacy_registry_with_activity(self, mock_send_alert: mock.MagicMock) -> None:
        self.action.update(data={"notes": "Check the runbook"})
        activity = Activity(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=asdict(self.evidence_data),
        )
        activity.save()

        event_data_with_activity = WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=self.group,
        )

        invocation = ActionInvocation(
            event_data=event_data_with_activity,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

        self.handler.invoke_legacy_registry(invocation)

        assert mock_send_alert.call_count == 1
        (
            notification_context,
            alert_context,
            metric_issue_context,
            open_period_context,
            organization,
            notification_uuid,
        ) = self.unpack_kwargs(mock_send_alert)

        self.assert_notification_context(
            notification_context,
            integration_id=1234567890,
            target_identifier="channel123",
            target_display="Channel 123",
            sentry_app_config=None,
            sentry_app_id=None,
            notes="Check the runbook",
        )

        notification_data = metric_alert_notification_data_factory(
            IssueNotificationContext(invocation), chart_url=None
        )
        assert notification_data.notes == "Check the runbook"
        assert notification_data.new_status == IncidentStatus.CLOSED.value

        self.assert_alert_context(
            alert_context,
            name=self.detector.name,
            action_identifier_id=self.detector.id,
            threshold_type=AlertRuleThresholdType.BELOW,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=None,
            alert_threshold=self.evidence_data.conditions[2]["comparison"],
        )

        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.open_period.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CLOSED,
            metric_value=123.45,
            group=self.group,
            title=self.group.title,
            subscription=self.subscription,
        )

        self.assert_open_period_context(
            open_period_context,
            id=self.open_period.id,
            date_started=self.group.first_seen,
            date_closed=None,
        )

        assert organization == self.detector.linked_project.organization
        assert isinstance(notification_uuid, str)
