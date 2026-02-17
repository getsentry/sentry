import pytest
from jsonschema import ValidationError

from sentry.models.group import GroupStatus
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestIssueResolvedTriggerCondition(ConditionTestCase):
    condition = Condition.ISSUE_RESOLVED_TRIGGER

    def setUp(self) -> None:
        super().setUp()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group_event.group)
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

    def test_evaluate_value__resolved(self) -> None:
        self.group_event.group.status = GroupStatus.RESOLVED
        result = self.dc.evaluate_value(self.event_data)
        assert result is self.dc.get_condition_result()

    def test_evaluate_value__unresolved(self) -> None:
        self.group_event.group.status = GroupStatus.UNRESOLVED
        result = self.dc.evaluate_value(self.event_data)
        assert result is None

    def test_evaluate_value__ignored(self) -> None:
        self.group_event.group.status = GroupStatus.IGNORED
        result = self.dc.evaluate_value(self.event_data)
        assert result is None

    def test_json_schema(self) -> None:
        self.dc.comparison = False
        self.dc.save()

        self.dc.comparison = {"invalid": "object"}
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison = "invalid_string"
        with pytest.raises(ValidationError):
            self.dc.save()
