import pytest
from jsonschema import ValidationError

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.grouptype import GroupCategory
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
                "value": 1,
            },
            condition_result=True,
        )

    def test_json_schema(self) -> None:
        self.dc.comparison.update({"value": 8001})
        self.dc.save()

        self.dc.comparison.update({"value": "asdf"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison = {}
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"hello": "there"})
        with pytest.raises(ValidationError):
            self.dc.save()

    def test_valid_input_values__success(self) -> None:
        self.dc.update(comparison={"value": 1})
        self.assert_passes(self.dc, self.event_data)
        self.dc.update(comparison={"value": str(ErrorGroupType.type_id)})
        self.assert_passes(self.dc, self.event_data)
        self.dc.update(comparison={"value": ErrorGroupType.type_id})
        self.assert_passes(self.dc, self.event_data)

    def test_valid_input_values__failure(self) -> None:
        self.dc.update(comparison={"value": MetricIssue.type_id})
        self.assert_does_not_pass(self.dc, self.event_data)

    def test_fail_on_invalid_data(self) -> None:
        data_cases = [
            {"value": None},
            {},
            {"value": GroupCategory.ERROR.name},
            {"value": "ERROR"},
            {"value": "error"},
        ]

        for data_case in data_cases:
            self.dc.update(comparison=data_case)
            self.assert_does_not_pass(self.dc, self.event_data)

    def test_group_event(self) -> None:
        assert self.event.group is not None
        group_event = self.event.for_group(self.group)

        self.dc.update(comparison={"value": ErrorGroupType.type_id})
        self.assert_passes(self.dc, WorkflowEventData(event=self.event, group=self.group))
        self.assert_passes(self.dc, WorkflowEventData(event=group_event, group=self.group))
