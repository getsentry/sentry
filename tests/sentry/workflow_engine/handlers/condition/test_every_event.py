from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestEveryEventCondition(ConditionTestCase):
    payload = {"id": EveryEventCondition.id}

    def test_dual_write(self):
        # we will create the object but not write to the db
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == Condition.EVERY_EVENT
        assert dc.comparison is True
        assert dc.condition_result is True
