from sentry.eventstream.base import GroupState
from sentry.rules.conditions.existing_high_priority_issue import ExistingHighPriorityIssueCondition
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestReappearedEventCondition(ConditionTestCase):
    condition = Condition.REAPPEARED_EVENT
    rule_cls = ReappearedEventCondition
    payload = {"id": ReappearedEventCondition.id}

    def test(self):
        job = WorkflowJob(
            {
                "event": self.group_event,
                "has_reappeared": True,
            }
        )
        dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

        self.assert_passes(dc, job)

        job["has_reappeared"] = False
        self.assert_does_not_pass(dc, job)

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg


class TestRegressionEventCondition(ConditionTestCase):
    condition = Condition.REGRESSION_EVENT
    rule_cls = RegressionEventCondition
    payload = {"id": RegressionEventCondition.id}

    def test(self):
        job = WorkflowJob(
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
            }
        )
        dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

        self.assert_passes(dc, job)

        job["group_state"]["is_regression"] = False
        self.assert_does_not_pass(dc, job)

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg


class TestExistingHighPriorityIssueCondition(ConditionTestCase):
    condition = Condition.EXISTING_HIGH_PRIORITY_ISSUE
    rule_cls = ExistingHighPriorityIssueCondition
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

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg
