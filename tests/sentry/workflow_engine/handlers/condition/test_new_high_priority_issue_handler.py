import pytest
from jsonschema import ValidationError

from sentry.eventstream.base import GroupState
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestNewHighPriorityIssueCondition(ConditionTestCase):
    condition = Condition.NEW_HIGH_PRIORITY_ISSUE

    def setUp(self) -> None:
        super().setUp()
        self.event_data = WorkflowEventData(
            event=self.group_event,
            group=self.group_event.group,
            group_state=GroupState(
                {
                    "id": 1,
                    "is_regression": True,
                    "is_new": True,
                    "is_new_group_environment": True,
                }
            ),
            workflow_env=self.environment,
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

    def test_json_schema(self) -> None:
        dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

        dc.comparison = False
        dc.save()

        dc.comparison = {"time": "asdf"}
        with pytest.raises(ValidationError):
            dc.save()

        dc.comparison = "hello"
        with pytest.raises(ValidationError):
            dc.save()

    def test_applies_correctly(self) -> None:
        assert self.event_data.group_state

        # This will only pass for new issues
        self.group_event.group.update(priority=PriorityLevel.HIGH)
        self.event_data.group_state["is_new_group_environment"] = True
        self.assert_passes(self.dc, self.event_data)

        # These will never pass
        self.event_data.group_state["is_new_group_environment"] = False
        self.assert_does_not_pass(self.dc, self.event_data)

        self.group_event.group.update(priority=PriorityLevel.MEDIUM)
        self.assert_does_not_pass(self.dc, self.event_data)

        self.group_event.group.update(priority=PriorityLevel.LOW)
        self.assert_does_not_pass(self.dc, self.event_data)
