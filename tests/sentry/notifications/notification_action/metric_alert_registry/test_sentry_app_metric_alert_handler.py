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
from sentry.notifications.notification_action.metric_alert_registry.handlers.sentry_app_metric_alert_handler import (
    SentryAppMetricAlertHandler,
)
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_incident_serializer,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, DetectorPriorityLevel, WorkflowEventData
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)


class TestSentryAppMetricAlertHandler(MetricAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
        )
        self.action = self.create_action(
            type=Action.Type.SENTRY_APP,
            integration_id=None,
            config={
                "target_identifier": str(self.sentry_app.id),
                "target_type": ActionTarget.SENTRY_APP.value,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            },
        )

        self.handler = SentryAppMetricAlertHandler()

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.handlers.sentry_app_metric_alert_handler.send_incident_alert_notification"
    )
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
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=self.detector.project.organization,
            notification_uuid=notification_uuid,
            incident_serialized_response=get_incident_serializer(self.open_period),
        )

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.SentryAppMetricAlertHandler.send_alert"
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
            integration_id=None,
            target_identifier=None,
            target_display=None,
            sentry_app_config=None,
            sentry_app_id=str(self.sentry_app.id),
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
            title=self.group_event.group.title,
            metric_value=123.45,
            group=self.group_event.group,
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
        "sentry.notifications.notification_action.metric_alert_registry.handlers.sentry_app_metric_alert_handler.SentryAppMetricAlertHandler.send_alert"
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
            integration_id=None,
            target_identifier=None,
            target_display=None,
            sentry_app_config=None,
            sentry_app_id=str(self.sentry_app.id),
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
