from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
)
from sentry.integrations.pagerduty.utils import send_incident_alert_notification
from sentry.models.organization import Organization
from sentry.notifications.notification_action.metric_alert_registry import (
    metric_alert_handler_registry,
)
from sentry.notifications.notification_action.metric_alert_registry.base import (
    BaseMetricAlertHandler,
)
from sentry.workflow_engine.models import Action


@metric_alert_handler_registry.register(Action.Type.PAGERDUTY)
class PagerDutyMetricAlertHandler(BaseMetricAlertHandler):
    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        organization: Organization,
        notification_uuid: str,
    ) -> None:
        send_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=organization,
            notification_uuid=notification_uuid,
        )
