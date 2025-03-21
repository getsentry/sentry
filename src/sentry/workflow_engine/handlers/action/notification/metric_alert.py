import uuid
from abc import ABC

import sentry_sdk

from sentry.eventstore.models import GroupEvent
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
)
from sentry.integrations.opsgenie.utils import (
    send_incident_alert_notification as send_opsgenie_incident_alert_notification,
)
from sentry.integrations.pagerduty.utils import (
    send_incident_alert_notification as send_pagerduty_incident_alert_notification,
)
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.organization import Organization
from sentry.utils.registry import Registry
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowJob


class BaseMetricAlertHandler(ABC):
    @classmethod
    def build_notification_context(cls, action: Action) -> NotificationContext:
        return NotificationContext.from_action_model(action)

    @classmethod
    def build_alert_context(cls, detector: Detector, occurrence: IssueOccurrence) -> AlertContext:
        return AlertContext.from_workflow_engine_models(detector, occurrence)

    @classmethod
    def build_metric_issue_context(cls, event: GroupEvent) -> MetricIssueContext:
        return MetricIssueContext.from_group_event(event)

    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        organization: Organization,
        notification_uuid: str,
    ) -> None:
        raise NotImplementedError

    def invoke_legacy_registry(
        cls,
        job: WorkflowJob,
        action: Action,
        detector: Detector,
    ) -> None:

        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.metric_alert.invoke_legacy_registry"
        ):
            event = job.event
            if not event.occurrence:
                raise ValueError("Event occurrence is required for alert context")

            notification_context = cls.build_notification_context(action)
            alert_context = cls.build_alert_context(detector, event.occurrence)
            metric_issue_context = cls.build_metric_issue_context(event)

            notification_uuid = str(uuid.uuid4())

            cls.send_alert(
                notification_context=notification_context,
                alert_context=alert_context,
                metric_issue_context=metric_issue_context,
                organization=detector.project.organization,
                notification_uuid=notification_uuid,
            )


metric_alert_handler_registry = Registry[BaseMetricAlertHandler](enable_reverse_lookup=False)


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
        send_pagerduty_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=organization,
            notification_uuid=notification_uuid,
        )


@metric_alert_handler_registry.register(Action.Type.OPSGENIE)
class OpsgenieMetricAlertHandler(BaseMetricAlertHandler):
    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        organization: Organization,
        notification_uuid: str,
    ) -> None:

        send_opsgenie_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=organization,
            notification_uuid=notification_uuid,
        )
