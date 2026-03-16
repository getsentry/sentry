import pytest
from jsonschema import ValidationError

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestIssueTypeCondition(ConditionTestCase):
    condition = Condition.ISSUE_TYPE

    def setUp(self) -> None:
        super().setUp()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group_event.group)
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "value": ErrorGroupType.slug,
                "include": True,
            },
            condition_result=True,
        )

    def test_json_schema(self) -> None:
        self.dc.comparison = {"value": 8001, "include": True}
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison = {"value": "asdf", "include": True}
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison = {"include": True}
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison = {"hello": "there", "include": True}
        with pytest.raises(ValidationError):
            self.dc.save()

        with pytest.raises(ValidationError):
            self.dc.comparison = {"value": ErrorGroupType.slug, "include": "true"}
            self.dc.save()

    def test_fail_on_invalid_data(self) -> None:
        data_cases = [
            {"value": None},
            {},
            {"value": 1},
            {"value": "ERROR"},
            {"value": "invalid_slug"},
        ]

        for data_case in data_cases:
            self.dc.update(comparison=data_case)
            self.assert_does_not_pass(self.dc, self.event_data)

    def test_include(self) -> None:
        assert self.event.group is not None
        group_event = self.event.for_group(self.group)

        # Error event will pass when we include ErrorGroupType
        self.dc.update(comparison={"value": ErrorGroupType.slug, "include": True})
        self.assert_passes(self.dc, WorkflowEventData(event=self.event, group=self.group))
        self.assert_passes(self.dc, WorkflowEventData(event=group_event, group=self.group))

        # Error event will not pass when we include MetricIssue
        self.dc.update(comparison={"value": MetricIssue.slug, "include": True})
        self.assert_does_not_pass(self.dc, WorkflowEventData(event=self.event, group=self.group))
        self.assert_does_not_pass(self.dc, WorkflowEventData(event=group_event, group=self.group))

    def test_exclude(self) -> None:
        assert self.event.group is not None
        group_event = self.event.for_group(self.group)

        self.dc.update(comparison={"value": ErrorGroupType.slug, "include": False})
        # Error event will not pass when we exclude ErrorGroupType
        self.assert_does_not_pass(self.dc, WorkflowEventData(event=self.event, group=self.group))
        self.assert_does_not_pass(self.dc, WorkflowEventData(event=group_event, group=self.group))

        self.dc.update(comparison={"value": MetricIssue.slug, "include": False})
        # Error event will pass when we exclude MetricIssue
        self.assert_passes(self.dc, WorkflowEventData(event=self.event, group=self.group))
        self.assert_passes(self.dc, WorkflowEventData(event=group_event, group=self.group))
