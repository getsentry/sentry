import uuid
from abc import ABC

import sentry_sdk

from sentry.eventstore.models import GroupEvent
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
)
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.organization import Organization
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowEventData


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
        job: WorkflowEventData,
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
