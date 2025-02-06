from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.processors.data_condition_group import (
    evaluate_data_conditions,
    get_data_conditions_for_group,
    process_data_condition_group,
)
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestGetDataConditionsForGroup(TestCase):
    def test_get_data_conditions_for_group(self):
        assert get_data_conditions_for_group(0) == []

    def test_get_data_conditions_for_group__exists(self):
        data_condition_group = self.create_data_condition_group()
        data_condition = self.create_data_condition(condition_group=data_condition_group)
        assert get_data_conditions_for_group(data_condition_group.id) == [data_condition]


class TestProcessDataConditionGroup(TestCase):
    def test_process_data_condition_group(self):
        with mock.patch(
            "sentry.workflow_engine.processors.data_condition_group.logger"
        ) as mock_logger:
            assert process_data_condition_group(1, 1) == ((False, []), [])
            assert mock_logger.exception.call_args[0][0] == "DataConditionGroup does not exist"

    def test_process_data_condition_group__exists__fails(self):
        data_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=data_condition_group, type=Condition.GREATER, comparison=5
        )

        assert process_data_condition_group(data_condition_group.id, 1) == ((False, []), [])

    def test_process_data_condition_group__exists__passes(self):
        data_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=data_condition_group,
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        assert process_data_condition_group(data_condition_group.id, 10) == (
            (True, [DetectorPriorityLevel.HIGH]),
            [],
        )


class TestEvaluationConditionCase(TestCase):
    def setUp(self):
        self.data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY
        )

        self.data_condition = self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.data_condition_group,
        )

        self.data_condition_two = self.create_data_condition(
            type=Condition.GREATER,
            comparison=3,
            condition_result=DetectorPriorityLevel.LOW,
            condition_group=self.data_condition_group,
        )

        self.conditions = [self.data_condition, self.data_condition_two]

    def get_conditions_to_evaluate(self, value: int) -> list[tuple[DataCondition, int]]:
        return [(condition, value) for condition in self.conditions]


# TODO - @saponifi3d - refactor these tests to use pytest.mark.paramaterize
class TestEvaluateConditionGroupTypeAny(TestEvaluationConditionCase):
    def test_evaluate_data_conditions__passes_all(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(10),
            self.data_condition_group.logic_type,
        ) == (
            True,
            [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW],
        )

    def test_evaluate_data_conditions__passes_one(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(4),
            self.data_condition_group.logic_type,
        ) == (True, [DetectorPriorityLevel.LOW])

    def test_evaluate_data_conditions__fails_all(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(1), self.data_condition_group.logic_type
        ) == (False, [])

    def test_evaluate_data_conditions__passes_without_conditions(self):
        assert evaluate_data_conditions([], self.data_condition_group.logic_type) == (
            True,
            [],
        )


class TestEvaluateConditionGroupTypeAnyShortCircuit(TestEvaluationConditionCase):
    def setUp(self):
        super().setUp()
        self.data_condition_group.logic_type = DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def test_evaluate_data_conditions__passes_all(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(10), self.data_condition_group.logic_type
        ) == (True, [DetectorPriorityLevel.HIGH])

    def test_evaluate_data_conditions__passes_one(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(4),
            self.data_condition_group.logic_type,
        ) == (True, [DetectorPriorityLevel.LOW])

    def test_evaluate_data_conditions__fails_all(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(1),
            self.data_condition_group.logic_type,
        ) == (False, [])

    def test_evaluate_data_conditions__passes_without_conditions(self):
        assert evaluate_data_conditions([], self.data_condition_group.logic_type) == (True, [])


class TestEvaluateConditionGroupTypeAll(TestEvaluationConditionCase):
    def setUp(self):
        super().setUp()
        self.data_condition_group.logic_type = DataConditionGroup.Type.ALL

    def test_evaluate_data_conditions__passes_all(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(10), self.data_condition_group.logic_type
        ) == (
            True,
            [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW],
        )

    def test_evaluate_data_conditions__passes_one(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(4), self.data_condition_group.logic_type
        ) == (False, [])

    def test_evaluate_data_conditions__fails_all(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(1), self.data_condition_group.logic_type
        ) == (False, [])

    def test_evaluate_data_conditions__passes_without_conditions(self):
        assert evaluate_data_conditions([], self.data_condition_group.logic_type) == (
            True,
            [],
        )


class TestEvaluateConditionGroupTypeNone(TestEvaluationConditionCase):
    def setUp(self):
        super().setUp()
        self.data_condition_group.logic_type = DataConditionGroup.Type.NONE

    def test_evaluate_data_conditions__all_conditions_pass__fails(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(10), self.data_condition_group.logic_type
        ) == (False, [])

    def test_evaluate_data_conditions__one_condition_pass__fails(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(4), self.data_condition_group.logic_type
        ) == (False, [])

    def test_evaluate_data_conditions__no_conditions_pass__passes(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(1), self.data_condition_group.logic_type
        ) == (True, [])


class TestEvaluateConditionGroupWithSlowConditions(TestCase):
    def setUp(self):
        self.data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )

        self.data_condition = self.create_data_condition(
            comparison=5,
            type=Condition.GREATER,
            condition_result=True,
            condition_group=self.data_condition_group,
        )

        self.slow_condition = self.create_data_condition(
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1d", "value": 7},
            condition_result=True,
            condition_group=self.data_condition_group,
        )

    def test_basic_remaining_conditions(self):
        (logic_result, condition_results), remaining_conditions = process_data_condition_group(
            self.data_condition_group.id,
            10,
            True,
        )

        assert logic_result is True
        assert condition_results == [True]
        assert remaining_conditions == [self.slow_condition]

    def test_execute_slow_conditions(self):
        logic_result, condition_results, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            [10],
            False,
        )

        assert logic_result is True
        assert condition_results == [True]
        assert remaining_conditions == []

    def test_short_circuit_with_all(self):
        (logic_result, condition_results), remaining_conditions = process_data_condition_group(
            self.data_condition_group.id,
            1,
            True,
        )

        assert logic_result is False
        assert condition_results == []
        assert remaining_conditions == []

    def test_short_circuit_with_any(self):
        self.data_condition_group.update(logic_type=DataConditionGroup.Type.ANY)
        (logic_result, condition_results), remaining_conditions = process_data_condition_group(
            self.data_condition_group.id,
            10,
            True,
        )

        assert logic_result is True
        assert condition_results == [True]
        assert remaining_conditions == []
