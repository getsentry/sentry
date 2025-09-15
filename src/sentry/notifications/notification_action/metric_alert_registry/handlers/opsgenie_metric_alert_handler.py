import logging

from sentry.incidents.models.incident import TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.opsgenie.utils import send_incident_alert_notification
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.notification_action.registry import metric_alert_handler_registry
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.workflow_engine.models import Action

logger = logging.getLogger(__name__)


@metric_alert_handler_registry.register(Action.Type.OPSGENIE)
class OpsgenieMetricAlertHandler(BaseMetricAlertHandler):
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

        logger.info(
            "notification_action.execute_via_metric_alert_handler.opsgenie",
            extra={
                "action_id": alert_context.action_identifier_id,
            },
        )

        send_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=organization,
            notification_uuid=notification_uuid,
        )
