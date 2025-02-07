from sentry.rules.conditions.every_event import EveryEventCondition
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestFirstSeenEventCondition(ConditionTestCase):
    payload = {"id": EveryEventCondition.id}

    def test_dual_write(self):
        # skip translating every event condition
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc is None
