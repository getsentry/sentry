import logging

from celery.exceptions import SoftTimeLimitExceeded

from sentry.incidents.models.incident import TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_alert_rule_serializer,
    get_detailed_incident_serializer,
)
from sentry.notifications.notification_action.registry import metric_alert_handler_registry
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.workflow_engine.models import Action, Detector

logger = logging.getLogger(__name__)


@metric_alert_handler_registry.register(Action.Type.MSTEAMS)
class MSTeamsMetricAlertHandler(BaseMetricAlertHandler):
    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
        trigger_status: TriggerStatus,
        notification_uuid: str,
        organization: Organization,
        project: Project,
    ) -> None:

        from sentry.integrations.msteams.utils import send_incident_alert_notification

        detector = Detector.objects.get(id=alert_context.action_identifier_id)
        if not detector:
            raise ValueError("Detector not found")

        open_period = GroupOpenPeriod.objects.get(id=open_period_context.id)
        if not open_period:
            raise ValueError("Open period not found")

        alert_rule_serialized_response = None
        incident_serialized_response = None
        try:
            alert_rule_serialized_response = get_alert_rule_serializer(detector)
            incident_serialized_response = get_detailed_incident_serializer(open_period)
        except SoftTimeLimitExceeded:
            logger.exception(
                "notification_action.execute_via_metric_alert_handler.msteams.soft_time_limit_exceeded",
                extra={"action_id": alert_context.action_identifier_id},
            )

        send_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            organization=organization,
            notification_uuid=notification_uuid,
            alert_rule_serialized_response=alert_rule_serialized_response,
            incident_serialized_response=incident_serialized_response,
        )
