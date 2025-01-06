from sentry.eventstream.base import GroupState
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.workflow import Workflow
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


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

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg

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
