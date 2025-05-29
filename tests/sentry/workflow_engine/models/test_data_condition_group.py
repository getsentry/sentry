from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_condition_group import (
    DataConditionGroup,
    batch_get_slow_conditions,
)


class TestBatchGetSlowConditions(TestCase):
    def setUp(self):
        super().setUp()
        self.dcg = self.create_data_condition_group()

    def create_slow_condition(self, condition_group: DataConditionGroup) -> DataCondition:
        return self.create_data_condition(
            condition_group=condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1d",
                "value": 7,
            },
        )

    def test_batch_get_slow_conditions(self) -> None:
        condition = self.create_slow_condition(self.dcg)
        assert batch_get_slow_conditions([self.dcg]) == {self.dcg.id: [condition]}

    def test_batch_get_slow_conditions__no_slow_conditions(self) -> None:
        self.create_data_condition(condition_group=self.dcg, type=Condition.EQUAL)
        assert batch_get_slow_conditions([self.dcg]) == {self.dcg.id: []}

    def test_multiple_dcgs(self) -> None:
        dcg2 = self.create_data_condition_group()
        condition1 = self.create_slow_condition(self.dcg)
        condition2 = self.create_slow_condition(dcg2)
        self.create_data_condition(condition_group=self.dcg, type=Condition.EQUAL)
        condition4 = self.create_slow_condition(dcg2)
        assert batch_get_slow_conditions([self.dcg, dcg2]) == {
            self.dcg.id: [condition1],
            dcg2.id: [condition2, condition4],
        }
