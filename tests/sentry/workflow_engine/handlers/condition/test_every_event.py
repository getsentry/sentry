from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class EveryEventOperator(ConditionTestCase):
    condition = Condition.TRUTH
    rule_cls = EveryEventCondition
    payload = {"id": EveryEventCondition.id}

    def test(self):
        dc = self.create_data_condition(
            comparison=True,
            condition_result=True,
        )

        self.assert_passes(dc, self.event)

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.condition == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg
