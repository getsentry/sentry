from sentry.eventstream.base import GroupState
from sentry.rules.conditions.existing_high_priority_issue import ExistingHighPriorityIssueCondition
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition
from sentry.rules.conditions.new_high_priority_issue import NewHighPriorityIssueCondition
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.workflow import Workflow
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


class TestFirstSeenEventCondition(ConditionTestCase):
    condition = Condition.FIRST_SEEN_EVENT
    rule_cls = FirstSeenEventCondition
    payload = {"id": FirstSeenEventCondition.id}

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
                "workflow": Workflow(environment_id=None),
            }
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

    def test(self):
        self.assert_passes(self.dc, self.job)

        self.job["group_state"]["is_new"] = False
        self.assert_does_not_pass(self.dc, self.job)

    def test_with_environment(self):
        self.job["workflow"] = Workflow(environment_id=1)

        self.assert_passes(self.dc, self.job)

        self.job["group_state"]["is_new"] = False
        self.job["group_state"]["is_new_group_environment"] = True
        self.assert_passes(self.dc, self.job)

        self.job["group_state"]["is_new"] = True
        self.job["group_state"]["is_new_group_environment"] = False
        self.assert_does_not_pass(self.dc, self.job)

        self.job["group_state"]["is_new"] = False
        self.job["group_state"]["is_new_group_environment"] = False
        self.assert_does_not_pass(self.dc, self.job)

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg


class TestNewHighPriorityIssueCondition(ConditionTestCase):
    condition = Condition.NEW_HIGH_PRIORITY_ISSUE
    rule_cls = NewHighPriorityIssueCondition
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

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg
