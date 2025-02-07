import pytest
from jsonschema import ValidationError

from sentry.eventstream.base import GroupState
from sentry.rules.conditions.existing_high_priority_issue import ExistingHighPriorityIssueCondition
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestExistingHighPriorityIssueCondition(ConditionTestCase):
    condition = Condition.EXISTING_HIGH_PRIORITY_ISSUE
    payload = {"id": ExistingHighPriorityIssueCondition.id}

    def setUp(self):
        super().setUp()
        self.job = WorkflowJob(
            {
                "event": self.group_event,
                "group_state": GroupState(
                    {
                        "id": 1,
                        "is_regression": True,
                        "is_new": False,
                        "is_new_group_environment": False,
                    }
                ),
                "has_reappeared": True,
                "has_escalated": True,
            }
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )
        self.group_event.group.priority = PriorityLevel.HIGH

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_json_schema(self):
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

    def test(self):
        self.assert_passes(self.dc, self.job)

    def test_group_state_is_new(self):
        self.job["group_state"]["is_new"] = True
        self.assert_does_not_pass(self.dc, self.job)

    def test_is_escalating(self):
        self.job["has_reappeared"] = False
        self.job["has_escalated"] = True
        self.assert_passes(self.dc, self.job)

        self.job["has_reappeared"] = True
        self.job["has_escalated"] = False
        self.assert_passes(self.dc, self.job)

        self.job["has_reappeared"] = False
        self.job["has_escalated"] = False
        self.assert_does_not_pass(self.dc, self.job)

    def test_priority(self):
        self.group_event.group.priority = PriorityLevel.LOW
        self.assert_does_not_pass(self.dc, self.job)

        self.group_event.group.priority = PriorityLevel.MEDIUM
        self.assert_does_not_pass(self.dc, self.job)
