from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.processors.data_condition_group import (
    evaluate_data_conditions,
    get_data_conditions_for_group,
    get_slow_conditions_for_groups,
    process_data_condition_group,
)
from sentry.workflow_engine.processors.evaluations import DataConditionEvaluation
from sentry.workflow_engine.types import ConditionError, DetectorPriorityLevel


class TestGetDataConditionsForGroup(TestCase):
    def test_get_data_conditions_for_group(self) -> None:
        assert get_data_conditions_for_group(0) == []

    def test_get_data_conditions_for_group__exists(self) -> None:
        data_condition_group = self.create_data_condition_group()
        data_condition = self.create_data_condition(condition_group=data_condition_group)
        assert get_data_conditions_for_group(data_condition_group.id) == [data_condition]


class TestEvaluationConditionCase(TestCase):
    def setUp(self) -> None:
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
    def test_evaluate_data_conditions__passes_all(self) -> None:
        input_value = 10

        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(input_value),
            self.data_condition_group.logic_type,
        )

        assert result.triggered is True
        assert result.data["condition_evaluations"] == [
            DataConditionEvaluation(
                data=input_value,
                condition=self.data_condition,
                result=DetectorPriorityLevel.HIGH,
                triggered=True,
            ),
            DataConditionEvaluation(
                data=input_value,
                condition=self.data_condition_two,
                result=DetectorPriorityLevel.LOW,
                triggered=True,
            ),
        ]

    def test_evaluate_data_conditions__passes_one(self) -> None:
        input_value = 4

        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(input_value),
            self.data_condition_group.logic_type,
        )

        assert result.triggered is True
        assert result.data["condition_evaluations"] == [
            DataConditionEvaluation(
                condition=self.data_condition_two,
                result=DetectorPriorityLevel.LOW,
                triggered=True,
                data=input_value,
            )
        ]

    def test_evaluate_data_conditions__fails_all(self) -> None:
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(1),
            self.data_condition_group.logic_type,
        )

        assert result.triggered is False
        assert result.data["condition_evaluations"] == []

    def test_evaluate_data_conditions__passes_without_conditions(self) -> None:
        result = evaluate_data_conditions([], self.data_condition_group.logic_type)

        assert result.triggered is True
        assert result.data["condition_evaluations"] == []


class TestEvaluateConditionGroupTypeAnyShortCircuit(TestEvaluationConditionCase):
    def setUp(self) -> None:
        super().setUp()
        self.data_condition_group.logic_type = DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def test_evaluate_data_conditions__passes_all(self) -> None:
        input_value = 10

        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(input_value), self.data_condition_group.logic_type
        )

        assert result.triggered is True
        assert result.data["condition_evaluations"] == [
            DataConditionEvaluation(
                condition=self.data_condition,
                result=DetectorPriorityLevel.HIGH,
                triggered=True,
                data=input_value,
            )
        ]

    def test_evaluate_data_conditions__passes_one(self) -> None:
        input_value = 4
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(input_value),
            self.data_condition_group.logic_type,
        )

        assert result.triggered is True
        assert result.data["condition_evaluations"] == [
            DataConditionEvaluation(
                condition=self.data_condition_two,
                result=DetectorPriorityLevel.LOW,
                triggered=True,
                data=input_value,
            )
        ]

    def test_evaluate_data_conditions__fails_all(self) -> None:
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(1),
            self.data_condition_group.logic_type,
        )
        assert result.triggered is False
        assert result.data["condition_evaluations"] == []

    def test_evaluate_data_conditions__passes_without_conditions(self) -> None:
        result = evaluate_data_conditions([], self.data_condition_group.logic_type)
        assert result.triggered is True
        assert result.data["condition_evaluations"] == []


class TestEvaluateConditionGroupTypeAll(TestEvaluationConditionCase):
    def setUp(self) -> None:
        super().setUp()
        self.data_condition_group.logic_type = DataConditionGroup.Type.ALL

    def test_evaluate_data_conditions__passes_all(self) -> None:
        input_value = 10

        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(input_value), self.data_condition_group.logic_type
        )

        assert result.triggered is True
        assert result.data["condition_evaluations"] == [
            DataConditionEvaluation(
                condition=self.data_condition,
                result=DetectorPriorityLevel.HIGH,
                triggered=True,
                data=input_value,
            ),
            DataConditionEvaluation(
                condition=self.data_condition_two,
                result=DetectorPriorityLevel.LOW,
                triggered=True,
                data=input_value,
            ),
        ]

    def test_evaluate_data_conditions__passes_one(self) -> None:
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(4), self.data_condition_group.logic_type
        )
        assert result.triggered is False
        assert result.data["condition_evaluations"] == []

    def test_evaluate_data_conditions__fails_all(self) -> None:
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(1),
            self.data_condition_group.logic_type,
        )
        assert result.triggered is False
        assert result.data["condition_evaluations"] == []

    def test_evaluate_data_conditions__passes_without_conditions(self) -> None:
        result = evaluate_data_conditions([], self.data_condition_group.logic_type)
        assert result.triggered is True
        assert result.data["condition_evaluations"] == []


class TestEvaluateConditionGroupTypeNone(TestEvaluationConditionCase):
    def setUp(self) -> None:
        super().setUp()
        self.data_condition_group.logic_type = DataConditionGroup.Type.NONE

    def test_evaluate_data_conditions__all_conditions_pass__fails(self) -> None:
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(10),
            self.data_condition_group.logic_type,
        )

        assert result.triggered is False
        assert result.data["condition_evaluations"] == []

    def test_evaluate_data_conditions__one_condition_pass__fails(self) -> None:
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(4), self.data_condition_group.logic_type
        )

        assert result.triggered is False

    def test_evaluate_data_conditions__no_conditions_pass__passes(self) -> None:
        result = evaluate_data_conditions(
            self.get_conditions_to_evaluate(1),
            self.data_condition_group.logic_type,
        )

        assert result.triggered is True
        assert result.data["condition_evaluations"] == []

    def test_evaluate_data_conditions__error_with_no_pass__tainted_true(self) -> None:
        error = ConditionError(msg="test error")
        with (
            mock.patch.object(
                self.data_condition,
                "evaluate_value",
                return_value=DataConditionEvaluation(
                    condition=self.data_condition,
                    result=None,
                    triggered=False,
                    error=None,
                    data="error",
                ),
            ),
            mock.patch.object(
                self.data_condition_two,
                "evaluate_value",
                return_value=DataConditionEvaluation(
                    condition=self.data_condition_two,
                    result=None,
                    triggered=False,
                    error=error,
                    data="error",
                ),
            ),
        ):
            result = evaluate_data_conditions(
                self.get_conditions_to_evaluate(10),
                self.data_condition_group.logic_type,
            )

        assert result.triggered is True
        assert result.error == error
        assert result.data["condition_evaluations"] == []


class TestEvaluateConditionGroupWithSlowConditions(TestCase):
    def setUp(self) -> None:
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

    def test_basic_remaining_conditions(self) -> None:
        input_value = 10

        expected_condition_result = DataConditionEvaluation(
            condition=self.data_condition,
            result=True,
            triggered=True,
            data=input_value,
        )

        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            input_value,
        )

        condition_evaluations = group_evaluation.data["condition_evaluations"]
        assert group_evaluation.triggered is True
        assert isinstance(condition_evaluations[0], DataConditionEvaluation)
        assert condition_evaluations[0].condition.id == expected_condition_result.condition.id
        assert remaining_conditions == [self.slow_condition]

    def test_basic_only_slow_conditions(self) -> None:
        self.data_condition.delete()
        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            10,
        )

        assert group_evaluation.triggered is False
        assert group_evaluation.data["condition_evaluations"] == []
        assert remaining_conditions == [self.slow_condition]

    def test_short_circuit_with_all(self) -> None:
        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            1,
        )

        assert group_evaluation.triggered is False
        assert group_evaluation.data["condition_evaluations"] == []
        assert remaining_conditions == []

    def test_short_circuit_with_any(self) -> None:
        input_value = 10
        self.data_condition_group.update(logic_type=DataConditionGroup.Type.ANY)
        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            input_value,
        )

        assert group_evaluation.triggered is True
        assert group_evaluation.data["condition_evaluations"] == [
            DataConditionEvaluation(
                condition=self.data_condition,
                result=True,
                triggered=True,
                data=input_value,
            )
        ]
        assert remaining_conditions == []

    def test_short_circuit_with_none(self) -> None:
        # A NONE group is conclusively not triggered once a fast condition
        # matches, so the pending slow condition should not be evaluated.
        self.data_condition_group.update(logic_type=DataConditionGroup.Type.NONE)
        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            10,
        )

        assert group_evaluation.triggered is False
        assert group_evaluation.data["condition_evaluations"] == []
        assert remaining_conditions == []

    def test_no_short_circuit_with_none(self) -> None:
        # A NONE group is not yet conclusive when no fast condition matches, so
        # the slow condition must still be evaluated before deciding the group.
        self.data_condition_group.update(logic_type=DataConditionGroup.Type.NONE)
        group_evaluation, remaining_conditions = process_data_condition_group(
            self.data_condition_group,
            1,
        )

        assert group_evaluation.triggered is True
        assert group_evaluation.data["condition_evaluations"] == []
        assert remaining_conditions == [self.slow_condition]


class TestGetSlowConditionsForGroups(TestCase):
    def setUp(self) -> None:
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
