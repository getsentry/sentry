import logging

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.incident import IncidentSerializerResponse
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
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

logger = logging.getLogger(__name__)


def _add_action_to_triggers(
    incident_serialized_response: IncidentSerializerResponse, action_id: int
) -> None:
    """
    The serialized triggers only list actions from alerts connected to the metric monitor.
    An alert that runs on all issues in a project isn't connected to the monitor, so without
    this the Sentry App would never receive its own action's settings.
    """
    action = Action.objects.filter(id=action_id).first()
    if action is None:
        return

    serialized_action = serialize(action, None, WorkflowEngineActionSerializer())
    for trigger in incident_serialized_response["alertRule"]["triggers"]:
        trigger_actions = trigger.setdefault("actions", [])
        if any(a["id"] == serialized_action["id"] for a in trigger_actions):
            continue
        trigger_actions.append({**serialized_action, "alertRuleTriggerId": trigger["id"]})


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
        _add_action_to_triggers(incident_serialized_response, notification_context.id)

        logger.info(
            "notification_action.execute_via_metric_alert_handler.sentry_app",
            extra={
                "action_id": alert_context.action_identifier_id,
            },
        )

        send_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            incident_serialized_response=incident_serialized_response,
            organization=organization,
            project_id=project.id,
            notification_uuid=notification_uuid,
        )
