from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.processors.data_condition_group import (
    ProcessedDataCondition,
    ProcessedDataConditionGroup,
    evaluate_data_conditions,
    get_data_conditions_for_group,
    get_slow_conditions_for_groups,
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

    def test_process_data_condition_group__exists__fails(self):
        data_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=data_condition_group, type=Condition.GREATER, comparison=5
        )

        expected_result = ProcessedDataConditionGroup(
            logic_result=False,
            condition_results=[],
        )
        expected_remaining_conditions: list[DataCondition] = []
        assert process_data_condition_group(data_condition_group, 1) == (
            expected_result,
            expected_remaining_conditions,
        )

    def test_process_data_condition_group__exists__passes(self):
        data_condition_group = self.create_data_condition_group()
        self.condition = self.create_data_condition(
            condition_group=data_condition_group,
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        expected_result = ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[
                ProcessedDataCondition(
                    logic_result=True,
                    condition=self.condition,
                    result=DetectorPriorityLevel.HIGH,
                )
            ],
        )
        assert process_data_condition_group(data_condition_group, 10) == (expected_result, [])


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


class TestEvaluateConditionGroupTypeAny(TestEvaluationConditionCase):
    def test_evaluate_data_conditions__passes_all(self):
        expected_result = ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[
                ProcessedDataCondition(
                    logic_result=True,
                    condition=self.data_condition,
                    result=DetectorPriorityLevel.HIGH,
                ),
                ProcessedDataCondition(
                    logic_result=True,
                    condition=self.data_condition_two,
                    result=DetectorPriorityLevel.LOW,
                ),
            ],
        )

        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(10),
            self.data_condition_group.logic_type,
        )

        assert result == expected_result

    def test_evaluate_data_conditions__passes_one(self):
        expected_result = ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[
                ProcessedDataCondition(
                    logic_result=True,
                    condition=self.data_condition_two,
                    result=DetectorPriorityLevel.LOW,
                )
            ],
        )

        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(4),
            self.data_condition_group.logic_type,
        )

        assert result == expected_result

    def test_evaluate_data_conditions__fails_all(self):
        expected_result = ProcessedDataConditionGroup(
            logic_result=False,
            condition_results=[],
        )

        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(1),
            self.data_condition_group.logic_type,
        )

        assert result == expected_result

    def test_evaluate_data_conditions__passes_without_conditions(self):
        result = evaluate_data_conditions([], self.data_condition_group.logic_type)
        expected_result = ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[],
        )

        assert result == expected_result


class TestEvaluateConditionGroupTypeAnyShortCircuit(TestEvaluationConditionCase):
    def setUp(self):
        super().setUp()
        self.data_condition_group.logic_type = DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def test_evaluate_data_conditions__passes_all(self):
        assert evaluate_data_conditions(
            self.get_conditions_to_evaluate(10), self.data_condition_group.logic_type
        ) == ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[
                ProcessedDataCondition(
                    logic_result=True,
                    condition=self.data_condition,
                    result=DetectorPriorityLevel.HIGH,
                )
            ],
        )

    def test_evaluate_data_conditions__passes_one(self):
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(4),
            self.data_condition_group.logic_type,
        )

        expected_result = ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[
                ProcessedDataCondition(
                    logic_result=True,
                    condition=self.data_condition_two,
                    result=DetectorPriorityLevel.LOW,
                )
            ],
        )
        assert result == expected_result

    def test_evaluate_data_conditions__fails_all(self):
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(1),
            self.data_condition_group.logic_type,
        )
        expected_result = ProcessedDataConditionGroup(
            logic_result=False,
            condition_results=[],
        )
        assert result == expected_result

    def test_evaluate_data_conditions__passes_without_conditions(self):
        expected_result = ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[],
        )
        result = evaluate_data_conditions([], self.data_condition_group.logic_type)
        assert result == expected_result


class TestEvaluateConditionGroupTypeAll(TestEvaluationConditionCase):
    def setUp(self):
        super().setUp()
        self.data_condition_group.logic_type = DataConditionGroup.Type.ALL

    def test_evaluate_data_conditions__passes_all(self):
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(10), self.data_condition_group.logic_type
        )

        expected_result = ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[
                ProcessedDataCondition(
                    logic_result=True,
                    condition=self.data_condition,
                    result=DetectorPriorityLevel.HIGH,
                ),
                ProcessedDataCondition(
                    logic_result=True,
                    condition=self.data_condition_two,
                    result=DetectorPriorityLevel.LOW,
                ),
            ],
        )
        assert result == expected_result

    def test_evaluate_data_conditions__passes_one(self):
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(4), self.data_condition_group.logic_type
        )
        expected_result = ProcessedDataConditionGroup(
            logic_result=False,
            condition_results=[],
        )
        assert result == expected_result

    def test_evaluate_data_conditions__fails_all(self):
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(1), self.data_condition_group.logic_type
        )

        expected_result = ProcessedDataConditionGroup(
            logic_result=False,
            condition_results=[],
        )
        assert result == expected_result

    def test_evaluate_data_conditions__passes_without_conditions(self):
        result = evaluate_data_conditions([], self.data_condition_group.logic_type)
        expected_result = ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[],
        )
        assert result == expected_result


class TestEvaluateConditionGroupTypeNone(TestEvaluationConditionCase):
    def setUp(self):
        super().setUp()
        self.data_condition_group.logic_type = DataConditionGroup.Type.NONE

    def test_evaluate_data_conditions__all_conditions_pass__fails(self):
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(10), self.data_condition_group.logic_type
        )

        expected_result = ProcessedDataConditionGroup(
            logic_result=False,
            condition_results=[],
        )
        assert result == expected_result

    def test_evaluate_data_conditions__one_condition_pass__fails(self):
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(4), self.data_condition_group.logic_type
        )
        expected_result = ProcessedDataConditionGroup(
            logic_result=False,
            condition_results=[],
        )
        assert result == expected_result

    def test_evaluate_data_conditions__no_conditions_pass__passes(self):
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(1), self.data_condition_group.logic_type
        )
        expected_result = ProcessedDataConditionGroup(
            logic_result=True,
            condition_results=[],
        )

        assert result == expected_result


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
        expected_condition_result = ProcessedDataCondition(
            logic_result=True, condition=self.data_condition, result=True
        )

        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            10,
            True,
        )

        assert group_evaluation.logic_result is True
        assert (
            group_evaluation.condition_results[0].condition.id
            == expected_condition_result.condition.id
        )
        assert remaining_conditions == [self.slow_condition]

    def test_basic_only_slow_conditions(self):
        self.data_condition.delete()
        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            10,
            True,
        )

        assert group_evaluation.logic_result is False
        assert group_evaluation.condition_results == []
        assert remaining_conditions == [self.slow_condition]

    def test_execute_slow_conditions(self):
        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            [10],
            False,
        )

        assert group_evaluation.logic_result is True
        assert group_evaluation.condition_results == [
            ProcessedDataCondition(logic_result=True, condition=self.slow_condition, result=True)
        ]
        assert remaining_conditions == []

    def test_short_circuit_with_all(self):
        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            1,
            True,
        )

        assert group_evaluation.logic_result is False
        assert group_evaluation.condition_results == []
        assert remaining_conditions == []

    def test_short_circuit_with_any(self):
        self.data_condition_group.update(logic_type=DataConditionGroup.Type.ANY)
        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            10,
            True,
        )

        assert group_evaluation.logic_result is True
        assert group_evaluation.condition_results == [
            ProcessedDataCondition(logic_result=True, condition=self.data_condition, result=True)
        ]
        assert remaining_conditions == []


class TestGetSlowConditionsForGroups(TestCase):
    def setUp(self):
        super().setUp()
        self.dcg: DataConditionGroup = self.create_data_condition_group()

    def create_slow_condition(self, condition_group: DataConditionGroup) -> DataCondition:
        return self.create_data_condition(
            condition_group=condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1d",
                "value": 7,
            },
        )

    def test_get_slow_conditions_for_groups_basic(self) -> None:
        condition = self.create_slow_condition(self.dcg)
        assert get_slow_conditions_for_groups([self.dcg.id]) == {self.dcg.id: [condition]}

    def test_get_slow_conditions_for_groups__no_slow_conditions(self) -> None:
        self.create_data_condition(condition_group=self.dcg, type=Condition.EQUAL)
        assert get_slow_conditions_for_groups([self.dcg.id]) == {self.dcg.id: []}

    def test_multiple_dcgs(self) -> None:
        dcg2 = self.create_data_condition_group()
        condition1 = self.create_slow_condition(self.dcg)
        condition2 = self.create_slow_condition(dcg2)
        self.create_data_condition(condition_group=self.dcg, type=Condition.EQUAL)
        condition4 = self.create_slow_condition(dcg2)
        dcg3 = self.create_data_condition_group()
        condition5 = self.create_slow_condition(dcg3)
        assert get_slow_conditions_for_groups([self.dcg.id, dcg2.id]) == {
            self.dcg.id: [condition1],
            dcg2.id: [condition2, condition4],
        }
        assert get_slow_conditions_for_groups([self.dcg.id, dcg2.id, dcg3.id]) == {
            self.dcg.id: [condition1],
            dcg2.id: [condition2, condition4],
            dcg3.id: [condition5],
        }
