import pytest
from jsonschema import ValidationError

from sentry.eventstream.base import GroupState
from sentry.rules.conditions.new_high_priority_issue import NewHighPriorityIssueCondition
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.workflow import Workflow
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestNewHighPriorityIssueCondition(ConditionTestCase):
    condition = Condition.NEW_HIGH_PRIORITY_ISSUE
    payload = {"id": NewHighPriorityIssueCondition.id}

    def setUp(self):
        super().setUp()
        self.job = WorkflowJob(
            {
                "event": self.group_event,
                "group_state": GroupState(
                    {
                        "id": 1,
                        "is_regression": True,
                        "is_new": True,
                        "is_new_group_environment": True,
                    }
                ),
                "workflow": Workflow(environment_id=1),
            }
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

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

    def test_with_high_priority_alerts(self):
        self.project.flags.has_high_priority_alerts = True
        self.project.save()

        # This will only pass for new issues
        self.group_event.group.update(priority=PriorityLevel.HIGH)
        self.job["group_state"]["is_new_group_environment"] = True
        self.assert_passes(self.dc, self.job)

        # These will never pass
        self.job["group_state"]["is_new_group_environment"] = False
        self.assert_does_not_pass(self.dc, self.job)

        self.group_event.group.update(priority=PriorityLevel.MEDIUM)
        self.assert_does_not_pass(self.dc, self.job)

        self.group_event.group.update(priority=PriorityLevel.LOW)
        self.assert_does_not_pass(self.dc, self.job)

    def test_without_high_priority_alerts(self):
        self.project.flags.has_high_priority_alerts = False
        self.project.save()

        self.group_event.group.update(priority=PriorityLevel.HIGH)
        self.job["group_state"]["is_new_group_environment"] = True
        self.assert_passes(self.dc, self.job)
        self.job["group_state"]["is_new_group_environment"] = False
        self.assert_does_not_pass(self.dc, self.job)

        self.group_event.group.update(priority=PriorityLevel.MEDIUM)
        self.job["group_state"]["is_new_group_environment"] = True
        self.assert_passes(self.dc, self.job)
        self.job["group_state"]["is_new_group_environment"] = False
        self.assert_does_not_pass(self.dc, self.job)

        self.group_event.group.update(priority=PriorityLevel.LOW)
        self.job["group_state"]["is_new_group_environment"] = True
        self.assert_passes(self.dc, self.job)
        self.job["group_state"]["is_new_group_environment"] = False
        self.assert_does_not_pass(self.dc, self.job)
