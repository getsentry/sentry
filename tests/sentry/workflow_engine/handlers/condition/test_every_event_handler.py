from sentry.eventstream.base import GroupState
from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestEveryEventCondition(ConditionTestCase):
    condition = Condition.EVERY_EVENT
    rule_cls = EveryEventCondition
    payload = {"id": EveryEventCondition.id}

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test(self):
        job = WorkflowJob(
            {
                "event": self.group_event,
                "group_state": GroupState(
                    {
                        "id": 1,
                        "is_regression": False,
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
