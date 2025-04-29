import uuid
from unittest import mock

from sentry.incidents.models.incident import IncidentStatus, TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.metric_alert_registry import EmailMetricAlertHandler
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_alert_rule_serializer,
    get_detailed_incident_serializer,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import Action
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)


class TestEmailMetricAlertHandler(MetricAlertHandlerBase):
    def setUp(self):
        self.create_models()
        self.action = self.create_action(
            type=Action.Type.EMAIL,
            integration_id=None,
            config={
                "target_identifier": str(self.user.id),
                "target_type": ActionTarget.USER,
            },
        )

        self.handler = EmailMetricAlertHandler()

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.handlers.email_metric_alert_handler.email_users"
    )
    @freeze_time("2021-01-01 00:00:00")
    def test_send_alert(self, mock_email_users):
        notification_context = NotificationContext.from_action_model(self.action)
        assert self.group_event.occurrence is not None
        alert_context = AlertContext.from_workflow_engine_models(
            self.detector, self.group_event.occurrence
        )
        metric_issue_context = MetricIssueContext.from_group_event(self.group_event)
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

        mock_email_users.assert_called_once_with(
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            alert_context=alert_context,
            alert_rule_serialized_response=get_alert_rule_serializer(self.detector),
            incident_serialized_response=get_detailed_incident_serializer(self.open_period),
            trigger_status=TriggerStatus.ACTIVE,
            targets=[(self.user.id, self.user.email)],
            project=self.detector.project,
            notification_uuid=notification_uuid,
        )

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.EmailMetricAlertHandler.send_alert"
    )
    @freeze_time("2021-01-01 00:00:00")
    def test_invoke_legacy_registry(self, mock_send_alert):
        self.handler.invoke_legacy_registry(self.event_data, self.action, self.detector)

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
            target_identifier=str(self.user.id),
            target_display=None,
            target_type=ActionTarget.USER,
            sentry_app_config=None,
            sentry_app_id=None,
        )

        self.assert_alert_context(
            alert_context,
            name=self.detector.name,
            action_identifier_id=self.detector.id,
            threshold_type=None,
            detection_type=None,
            comparison_delta=None,
            # TODO(iamrajjoshi): change this once we have the evidence_data contract
            alert_threshold=1.0,
        )

        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.open_period.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CRITICAL,
            metric_value=123.45,
            group=self.group_event.group,
            title=self.group_event.group.title,
        )

        self.assert_open_period_context(
            open_period_context,
            id=self.open_period.id,
            date_started=self.group_event.group.first_seen,
            date_closed=None,
        )

        assert organization == self.detector.project.organization
        assert isinstance(notification_uuid, str)
