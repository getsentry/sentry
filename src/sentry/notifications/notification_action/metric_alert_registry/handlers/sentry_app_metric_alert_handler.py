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
    get_incident_serializer,
)
from sentry.notifications.notification_action.registry import metric_alert_handler_registry
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.rules.actions.notify_event_service import send_incident_alert_notification
from sentry.workflow_engine.models import Action


@metric_alert_handler_registry.register(Action.Type.SENTRY_APP)
class SentryAppMetricAlertHandler(BaseMetricAlertHandler):
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
        open_period = GroupOpenPeriod.objects.get(id=open_period_context.id)
        if not open_period:
            raise ValueError("Open period not found")

        incident_serialized_response = get_incident_serializer(open_period)

        send_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            incident_serialized_response=incident_serialized_response,
            organization=organization,
            notification_uuid=notification_uuid,
        )
