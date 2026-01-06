import uuid
from dataclasses import asdict
from unittest import mock

from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentStatus, TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.models.activity import Activity
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.metric_alert_registry import DiscordMetricAlertHandler
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_alert_rule_serializer,
    get_detailed_incident_serializer,
    get_detector_serializer,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, DetectorPriorityLevel, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)


class TestDiscordMetricAlertHandler(MetricAlertHandlerBase):
    def setUp(self) -> None:
        self.create_models()
        self.action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id=1234567890,
            config={
                "target_identifier": "channel123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

        self.handler = DiscordMetricAlertHandler()

    @mock.patch("sentry.integrations.discord.actions.metric_alert.send_incident_alert_notification")
    @freeze_time("2021-01-01 00:00:00")
    def test_send_alert(self, mock_send_incident_alert_notification: mock.MagicMock) -> None:
        notification_context = NotificationContext.from_action_model(self.action)
        assert self.group_event.occurrence is not None
        assert self.group_event.occurrence.priority is not None
        alert_context = AlertContext.from_workflow_engine_models(
            self.detector,
            self.evidence_data,
            self.group_event.group.status,
            DetectorPriorityLevel(self.group_event.occurrence.priority),
        )
        metric_issue_context = MetricIssueContext.from_group_event(
            self.group,
            self.evidence_data,
            DetectorPriorityLevel(self.group_event.occurrence.priority),
        )
        open_period_context = OpenPeriodContext.from_group(self.group)
        notification_uuid = str(uuid.uuid4())

        self.handler.send_alert(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            trigger_status=TriggerStatus.ACTIVE,
            project=self.detector.project,
            organization=self.detector.project.organization,
            notification_uuid=notification_uuid,
        )

        mock_send_incident_alert_notification.assert_called_once_with(
            organization=self.detector.project.organization,
            alert_context=alert_context,
            notification_context=notification_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            alert_rule_serialized_response=get_alert_rule_serializer(self.detector),
            incident_serialized_response=get_detailed_incident_serializer(self.open_period),
            detector_serialized_response=get_detector_serializer(self.detector),
            notification_uuid=notification_uuid,
        )

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.DiscordMetricAlertHandler.send_alert"
    )
    @freeze_time("2021-01-01 00:00:00")
    def test_invoke_legacy_registry(self, mock_send_alert: mock.MagicMock) -> None:
        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
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
            target_display=None,
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
        "sentry.notifications.notification_action.metric_alert_registry.DiscordMetricAlertHandler.send_alert"
    )
    @freeze_time("2021-01-01 00:00:00")
    def test_invoke_legacy_registry_with_activity(self, mock_send_alert: mock.MagicMock) -> None:
        # Create an Activity instance with evidence data and priority
        activity_data = asdict(self.evidence_data)

        activity = Activity(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=activity_data,
        )
        activity.save()

        # Create event data with Activity instead of GroupEvent
        event_data_with_activity = WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=self.group,
        )

        invocation = ActionInvocation(
            event_data=event_data_with_activity,
            action=self.action,
            detector=self.detector,
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

        # Verify that the same data is extracted from Activity.data as from GroupEvent.occurrence.evidence_data
        self.assert_notification_context(
            notification_context,
            integration_id=1234567890,
            target_identifier="channel123",
            target_display=None,
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
