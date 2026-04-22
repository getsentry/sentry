from functools import cached_property

from sentry.incidents.grouptype import MetricIssueEvidenceData
from sentry.incidents.models.incident import TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.services.eventstore.models import GroupEvent
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import ActionInvocation, DetectorPriorityLevel


class IssueNotificationContext:
    def __init__(self, invocation: ActionInvocation) -> None:
        self._invocation = invocation

    @staticmethod
    def _extract_from_group_event(
        event: GroupEvent,
    ) -> tuple[MetricIssueEvidenceData, DetectorPriorityLevel]:
        """
        Extract evidence data and priority from a GroupEvent
        """

        if event.occurrence is None:
            raise ValueError("Event occurrence is required for alert context")

        if event.occurrence.priority is None:
            raise ValueError("Event occurrence priority is required for alert context")

        evidence_data = MetricIssueEvidenceData(**event.occurrence.evidence_data)
        priority = DetectorPriorityLevel(event.occurrence.priority)
        return evidence_data, priority

    @staticmethod
    def _extract_from_activity(
        event: Activity,
    ) -> tuple[MetricIssueEvidenceData, DetectorPriorityLevel]:
        """
        Extract evidence data and priority from an Activity event
        """

        if event.type != ActivityType.SET_RESOLVED.value:
            raise ValueError(
                "Activity type must be SET_RESOLVED to invoke metric alert legacy registry"
            )

        if event.data is None or not event.data:
            raise ValueError("Activity data is required for alert context")

        evidence_data_dict = dict(event.data)
        priority = DetectorPriorityLevel.OK
        evidence_data = MetricIssueEvidenceData(**evidence_data_dict)

        return evidence_data, priority

    @cached_property
    def evidence_data_and_priority(self) -> tuple[MetricIssueEvidenceData, DetectorPriorityLevel]:
        if isinstance(self._invocation.event_data.event, GroupEvent):
            return self._extract_from_group_event(self._invocation.event_data.event)
        elif isinstance(self._invocation.event_data.event, Activity):
            return self._extract_from_activity(self._invocation.event_data.event)
        else:
            raise ValueError(
                "WorkflowEventData.event must be a GroupEvent or Activity to invoke metric alert legacy registry"
            )

    @cached_property
    def group(self) -> Group:
        return self._invocation.event_data.group

    @cached_property
    def trigger_status(self) -> TriggerStatus:
        group_status = self._invocation.event_data.group.status
        if group_status == GroupStatus.RESOLVED or group_status == GroupStatus.IGNORED:
            return TriggerStatus.RESOLVED
        return TriggerStatus.ACTIVE

    @cached_property
    def notification_context(self) -> NotificationContext:
        return NotificationContext.from_action_model(self._invocation.action)

    @cached_property
    def alert_context(self) -> AlertContext:
        evidence_data, priority = self.evidence_data_and_priority

        return AlertContext.from_workflow_engine_models(
            detector=self._invocation.detector,
            evidence_data=evidence_data,
            group_status=self.group.status,
            detector_priority_level=priority,
        )

    @cached_property
    def metric_issue_context(self) -> MetricIssueContext:
        evidence_data, priority = self.evidence_data_and_priority
        return MetricIssueContext.from_group_event(
            group=self.group,
            evidence_data=evidence_data,
            detector_priority_level=priority,
        )

    @cached_property
    def open_period_context(self) -> OpenPeriodContext:
        return OpenPeriodContext.from_group(self.group)

    @cached_property
    def organization(self) -> Organization:
        return self._invocation.detector.project.organization

    @cached_property
    def open_period(self) -> GroupOpenPeriod:
        return GroupOpenPeriod.objects.get(id=self.metric_issue_context.open_period_identifier)

    @cached_property
    def notification_uuid(self) -> str:
        return self._invocation.notification_uuid

    @cached_property
    def action_type(self) -> str:
        return self._invocation.action.type

    @cached_property
    def detector(self) -> Detector:
        return self._invocation.detector
