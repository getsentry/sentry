from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.slack.utils.notifications import send_incident_alert_notification
from sentry.models.organization import Organization
from sentry.notifications.notification_action.registry import metric_alert_handler_registry
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.workflow_engine.models import Action


@metric_alert_handler_registry.register(Action.Type.SLACK)
class SlackMetricAlertHandler(BaseMetricAlertHandler):
    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
        organization: Organization,
        notification_uuid: str,
    ) -> None:

        send_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            organization=organization,
            notification_uuid=notification_uuid,
            # TODO(iamrajjoshi): Add responses here once we make a decision on how to handle them
            alert_rule_serialized_response=None,
            incident_serialized_response=None,
        )
