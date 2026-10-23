from sentry.models.group import Group
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.condition.issue_priority_equals import (
    IssuePriorityCondition,
)
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import ActionFilterPreviewPlan
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestIssuePriorityCondition(ConditionTestCase):
    condition = Condition.ISSUE_PRIORITY_EQUALS

    def setUp(self) -> None:
        super().setUp()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group_event.group)

    def test_simple(self) -> None:
        data_condition_warning = self.create_data_condition(
            type=self.condition,
            comparison=PriorityLevel.MEDIUM,
            condition_result=True,
        )
        data_condition_critical = self.create_data_condition(
            type=self.condition,
            comparison=PriorityLevel.HIGH,
            condition_result=True,
        )

        self.group.update(priority=PriorityLevel.MEDIUM)
        self.assert_passes(data_condition_warning, self.event_data)
        self.assert_does_not_pass(data_condition_critical, self.event_data)

        self.group.update(priority=PriorityLevel.HIGH)
        self.assert_passes(data_condition_critical, self.event_data)
        self.assert_does_not_pass(data_condition_warning, self.event_data)

    def test_string_comparison(self) -> None:
        # Tolerate invalid string comparisons until cleanup (ISWF-3433).
        # Bypass pre_save schema enforcement to simulate existing bad data.
        dc = self.create_data_condition(
            type=self.condition,
            comparison=PriorityLevel.MEDIUM,
            condition_result=True,
        )
        DataCondition.objects.filter(id=dc.id).update(comparison="medium")
        dc.refresh_from_db()

        self.group.update(priority=PriorityLevel.MEDIUM)
        self.assert_passes(dc, self.event_data)

        self.group.update(priority=PriorityLevel.HIGH)
        self.assert_does_not_pass(dc, self.event_data)

        DataCondition.objects.filter(id=dc.id).update(comparison="not-a-priority")
        dc.refresh_from_db()
        self.assert_does_not_pass(dc, self.event_data)

    def test_preview_behavior_accepts_legacy_string_comparison(self) -> None:
        self.group.update(priority=PriorityLevel.HIGH)
        other_group = self.create_group(project=self.project, priority=PriorityLevel.LOW)
        plan = ActionFilterPreviewPlan(DataConditionGroup.Type.ALL)

        IssuePriorityCondition.preview_behavior.filter_preview(plan, "high")

        matching_group_ids = set(
            Group.objects.filter(id__in=[self.group.id, other_group.id])
            .filter(*plan.group_filters)
            .values_list("id", flat=True)
        )
        assert matching_group_ids == {self.group.id}
