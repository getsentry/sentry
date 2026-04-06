from __future__ import annotations

import uuid
from dataclasses import asdict
from typing import Any
from unittest import mock
from unittest.mock import patch

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
    get_alert_rule_serializer,
    get_detailed_incident_serializer,
    get_detector_serializer,
)
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
            project=self.detector.project,
            organization=self.detector.project.organization,
            notification_uuid=str(uuid.uuid4()),
        )

    @override_options({"notifications.platform-rollout.internal-testing": {"metric-alert": 1.0}})
    @with_feature("organizations:notification-platform.internal-testing")
    @patch("sentry.integrations.slack.integration.SlackSdkClient")
    @freeze_time("2021-01-01 00:00:00")
    def test_send_alert_via_np_sends_to_slack_channel(
        self, mock_slack_client: mock.MagicMock
    ) -> None:
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
        blocks = call_kwargs["blocks"]
        assert len(blocks) >= 1
        assert blocks[0]["type"] == "section"
        assert blocks[0]["text"]["type"] == "mrkdwn"

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
            alert_rule_serialized_response=get_alert_rule_serializer(self.detector),
            incident_serialized_response=get_detailed_incident_serializer(self.open_period),
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

        assert organization == self.detector.project.organization
        assert isinstance(notification_uuid, str)

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.SlackMetricAlertHandler.send_alert"
    )
    @freeze_time("2021-01-01 00:00:00")
    def test_invoke_legacy_registry_with_activity(self, mock_send_alert: mock.MagicMock) -> None:
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

        assert organization == self.detector.project.organization
        assert isinstance(notification_uuid, str)
