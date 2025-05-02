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
from sentry.notifications.notification_action.metric_alert_registry import (
    PagerDutyMetricAlertHandler,
)
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.workflow_engine.models import Action
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)


@apply_feature_flag_on_cls("organizations:issue-open-periods")
class TestPagerDutyMetricAlertHandler(MetricAlertHandlerBase):
    def setUp(self):
        self.create_models()
        self.action = self.create_action(
            type=Action.Type.PAGERDUTY,
            integration_id=1234567890,
            config={"target_identifier": "service123", "target_type": ActionTarget.SPECIFIC},
            data={"priority": "default"},
        )

        self.handler = PagerDutyMetricAlertHandler()

    @mock.patch("sentry.integrations.pagerduty.utils.send_incident_alert_notification")
    def test_send_alert(self, mock_send_incident_alert_notification):
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

        mock_send_incident_alert_notification.assert_called_once_with(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=self.detector.project.organization,
            notification_uuid=notification_uuid,
        )

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.PagerDutyMetricAlertHandler.send_alert"
    )
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

        assert organization == self.detector.project.organization
        assert isinstance(notification_uuid, str)

        self.assert_notification_context(
            notification_context,
            integration_id=1234567890,
            target_identifier="service123",
            target_display=None,
            sentry_app_config={"priority": "default"},
            sentry_app_id=None,
        )

        self.assert_alert_context(
            alert_context,
            name=self.detector.name,
            action_identifier_id=self.detector.id,
            threshold_type=None,
            detection_type=None,
            comparison_delta=None,
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
