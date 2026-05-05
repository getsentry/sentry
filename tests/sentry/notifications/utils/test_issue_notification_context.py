import uuid
from dataclasses import asdict

import pytest

from sentry.db.models import NodeData
from sentry.incidents.grouptype import MetricIssueEvidenceData
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentStatus, TriggerStatus
from sentry.incidents.typings.metric_detector import MetricIssueContext, OpenPeriodContext
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, DetectorPriorityLevel, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

pytestmark = [requires_snuba]


class TestIssueNotificationContext(MetricAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id=1234567890,
            config={"target_identifier": "channel456", "target_type": ActionTarget.SPECIFIC},
            data={"tags": "environment,user,my_tag"},
        )

    def _make_context(
        self,
        group_event: GroupEvent | None = None,
        event_data: WorkflowEventData | None = None,
    ) -> IssueNotificationContext:
        ed = event_data or self.event_data
        if group_event is not None:
            ed = WorkflowEventData(
                event=group_event,
                workflow_env=self.workflow.environment,
                group=group_event.group,
            )
        invocation = ActionInvocation(
            event_data=ed,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
        )
        return IssueNotificationContext(invocation)

    def test_notification_context(self) -> None:
        ctx = self._make_context()
        notification_context = ctx.notification_context

        assert notification_context.target_identifier == "channel456"
        assert notification_context.integration_id == 1234567890
        assert notification_context.sentry_app_config is None

    def test_alert_context(self) -> None:
        ctx = self._make_context()
        alert_context = ctx.alert_context

        assert alert_context.name == self.detector.name
        assert alert_context.action_identifier_id == self.detector.id
        assert alert_context.threshold_type == AlertRuleThresholdType.ABOVE
        assert alert_context.comparison_delta is None

    def test_alert_context_anomaly_detection(self) -> None:
        _, _, anomaly_group_event = self.create_group_event(
            occurrence=self.create_issue_occurrence(
                priority=PriorityLevel.HIGH.value,
                level="error",
                evidence_data=asdict(self.anomaly_detection_evidence_data),
            ),
        )

        ctx = self._make_context(group_event=anomaly_group_event)
        alert_context = ctx.alert_context

        assert alert_context.name == self.detector.name
        assert alert_context.action_identifier_id == self.detector.id
        assert alert_context.threshold_type == AnomalyDetectionThresholdType.ABOVE_AND_BELOW
        assert alert_context.comparison_delta is None
        assert alert_context.alert_threshold == 0
        assert alert_context.resolve_threshold == 0

    def test_evidence_data_and_priority_from_group_event(self) -> None:
        ctx = self._make_context()
        evidence_data, priority = ctx.evidence_data_and_priority

        assert isinstance(evidence_data, MetricIssueEvidenceData)
        assert evidence_data.detector_id == self.detector.id
        assert evidence_data.value == self.evidence_data.value
        assert priority == DetectorPriorityLevel.HIGH

    def test_evidence_data_and_priority_from_activity(self) -> None:
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=asdict(self.evidence_data),
        )
        event_data = WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=self.group,
        )

        ctx = self._make_context(event_data=event_data)
        evidence_data, priority = ctx.evidence_data_and_priority

        assert isinstance(evidence_data, MetricIssueEvidenceData)
        assert evidence_data.detector_id == self.detector.id
        assert priority == DetectorPriorityLevel.OK

    def test_evidence_data_and_priority_missing_occurrence(self) -> None:
        event_data = WorkflowEventData(
            event=GroupEvent(self.project.id, "test", self.group, NodeData("test-id")),
            group=self.group,
        )

        ctx = self._make_context(event_data=event_data)

        with pytest.raises(ValueError, match="Event occurrence is required"):
            ctx.evidence_data_and_priority

    def test_evidence_data_and_priority_activity_missing_data(self) -> None:
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=None,
        )
        event_data = WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=self.group,
        )

        ctx = self._make_context(event_data=event_data)

        with pytest.raises(ValueError, match="Activity data is required"):
            ctx.evidence_data_and_priority

    def test_group(self) -> None:
        ctx = self._make_context()
        assert ctx.group == self.group

    def test_trigger_status_active(self) -> None:
        ctx = self._make_context()
        assert ctx.trigger_status == TriggerStatus.ACTIVE

    def test_trigger_status_resolved(self) -> None:
        self.group.status = GroupStatus.RESOLVED
        self.group.save()

        ctx = self._make_context()
        assert ctx.trigger_status == TriggerStatus.RESOLVED

    def test_trigger_status_ignored(self) -> None:
        self.group.status = GroupStatus.IGNORED
        self.group.save()

        ctx = self._make_context()
        assert ctx.trigger_status == TriggerStatus.RESOLVED

    def test_metric_issue_context(self) -> None:
        ctx = self._make_context()
        metric_issue_context = ctx.metric_issue_context

        assert isinstance(metric_issue_context, MetricIssueContext)
        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.open_period.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CRITICAL,
            metric_value=self.evidence_data.value,
            title=self.group_event.group.title,
            group=self.group_event.group,
            subscription=self.subscription,
        )

    def test_open_period_context(self) -> None:
        ctx = self._make_context()
        open_period_context = ctx.open_period_context

        assert isinstance(open_period_context, OpenPeriodContext)
        self.assert_open_period_context(
            open_period_context,
            id=self.open_period.id,
            date_started=self.open_period.date_started,
            date_closed=None,
        )

    def test_organization(self) -> None:
        ctx = self._make_context()
        assert ctx.organization == self.detector.project.organization

    def test_open_period(self) -> None:
        ctx = self._make_context()
        assert ctx.open_period == self.open_period
