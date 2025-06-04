from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.processors.data_condition import split_conditions_by_speed


class SplitConditionsBySpeedTest(TestCase):
    def setUp(self):
        self.slow_config = {
            "interval": "1d",
            "value": 7,
        }

    def test_simple(self):
        conditions = [
            self.create_data_condition(type=Condition.EQUAL),  # fast
            self.create_data_condition(type=Condition.EQUAL),  # fast
            self.create_data_condition(
                type=Condition.EVENT_FREQUENCY_COUNT, comparison=self.slow_config
            ),  # slow
        ]

        fast_conditions, slow_conditions = split_conditions_by_speed(conditions)

        assert fast_conditions == [conditions[0], conditions[1]]
        assert slow_conditions == [conditions[2]]

    def test_only_fast_conditions(self):
        conditions = [
            self.create_data_condition(type=Condition.EQUAL),  # fast
            self.create_data_condition(type=Condition.EQUAL),  # fast
        ]

        fast_conditions, slow_conditions = split_conditions_by_speed(conditions)

        assert fast_conditions == [conditions[0], conditions[1]]
        assert slow_conditions == []

    def test_only_slow_conditions(self):
        conditions = [
            self.create_data_condition(
                type=Condition.EVENT_FREQUENCY_COUNT, comparison=self.slow_config
            ),  # slow
            self.create_data_condition(
                type=Condition.EVENT_FREQUENCY_COUNT, comparison=self.slow_config
            ),  # slow
        ]

        fast_conditions, slow_conditions = split_conditions_by_speed(conditions)

        assert slow_conditions == [conditions[0], conditions[1]]
        assert fast_conditions == []

    def test_no_conditions(self):
        conditions: list[DataCondition] = []
        fast_conditions, slow_conditions = split_conditions_by_speed(conditions)
        assert fast_conditions == []
        assert slow_conditions == []
