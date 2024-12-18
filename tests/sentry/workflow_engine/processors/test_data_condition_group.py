from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.data_condition_group import (
    evaluate_condition_group,
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
            assert process_data_condition_group(1, 1) == (False, [])
            assert mock_logger.exception.call_args[0][0] == "DataConditionGroup does not exist"

    def test_process_data_condition_group__exists__fails(self):
        data_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=data_condition_group, type=Condition.GREATER, comparison=5
        )

        assert process_data_condition_group(data_condition_group.id, 1) == (False, [])

    def test_process_data_condition_group__exists__passes(self):
        data_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=data_condition_group,
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        assert process_data_condition_group(data_condition_group.id, 10) == (
            True,
            [DetectorPriorityLevel.HIGH],
        )


class TestEvaluateConditionGroupTypeAny(TestCase):
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

    def test_evaluate_condition_group__passes_all(self):
        assert evaluate_condition_group(
            self.data_condition_group,
            10,
        ) == (
            True,
            [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW],
        )

    def test_evaluate_condition_group__passes_one(self):
        assert evaluate_condition_group(
            self.data_condition_group,
            4,
        ) == (
            True,
            [DetectorPriorityLevel.LOW],
        )

    def test_evaluate_condition_group__fails_all(self):
        assert evaluate_condition_group(
            self.data_condition_group,
            1,
        ) == (
            False,
            [],
        )

    def test_evaluate_condition_group__passes_without_conditions(self):
        data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY
        )
        assert evaluate_condition_group(data_condition_group, 10) == (
            True,
            [],
        )


class TestEvaluateConditionGroupTypeAnyShortCircuit(TestCase):
    def setUp(self):
        self.data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        )

        self.data_condition = self.create_data_condition(
            comparison=5,
            type=Condition.GREATER,
            condition_result=True,
            condition_group=self.data_condition_group,
        )

        self.data_condition_two = self.create_data_condition(
            comparison=3,
            type=Condition.GREATER,
            condition_result=True,
            condition_group=self.data_condition_group,
        )

        self.conditions = [self.data_condition, self.data_condition_two]

    def test_evaluate_condition_group__passes_all(self):
        assert evaluate_condition_group(self.data_condition_group, 10) == (
            True,
            [True],
        )

    def test_evaluate_condition_group__passes_one(self):
        assert evaluate_condition_group(self.data_condition_group, 4) == (
            True,
            [True],
        )

    def test_evaluate_condition_group__fails_all(self):
        assert evaluate_condition_group(
            self.data_condition_group,
            1,
        ) == (
            False,
            [],
        )

    def test_evaluate_condition_group__passes_without_conditions(self):
        data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        )
        assert evaluate_condition_group(data_condition_group, 10) == (
            True,
            [],
        )


class TestEvaluateConditionGroupTypeAll(TestCase):
    def setUp(self):
        self.data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )

        self.data_condition = self.create_data_condition(
            comparison=5,
            type=Condition.GREATER,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.data_condition_group,
        )

        self.data_condition_two = self.create_data_condition(
            comparison=3,
            type=Condition.GREATER,
            condition_result=DetectorPriorityLevel.LOW,
            condition_group=self.data_condition_group,
        )

        self.conditions = [self.data_condition, self.data_condition_two]

    def test_evaluate_condition_group__passes_all(self):
        assert evaluate_condition_group(self.data_condition_group, 10) == (
            True,
            [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW],
        )

    def test_evaluate_condition_group__passes_one(self):
        assert evaluate_condition_group(self.data_condition_group, 4) == (
            False,
            [],
        )

    def test_evaluate_condition_group__fails_all(self):
        assert evaluate_condition_group(self.data_condition_group, 1) == (
            False,
            [],
        )

    def test_evaluate_condition_group__passes_without_conditions(self):
        data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )
        assert evaluate_condition_group(data_condition_group, 10) == (
            True,
            [],
        )


class TestEvaluateConditionGroupTypeNone(TestCase):
    def setUp(self):
        self.data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.NONE
        )

        self.data_condition = self.create_data_condition(
            comparison=5,
            type=Condition.GREATER,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.data_condition_group,
        )

        self.data_condition_two = self.create_data_condition(
            comparison=3,
            type=Condition.GREATER,
            condition_result=DetectorPriorityLevel.LOW,
            condition_group=self.data_condition_group,
        )

        self.conditions = [self.data_condition, self.data_condition_two]

    def test_evaluate_condition_group__all_conditions_pass__fails(self):
        assert evaluate_condition_group(self.data_condition_group, 10) == (
            False,
            [],
        )

    def test_evaluate_condition_group__one_condition_pass__fails(self):
        assert evaluate_condition_group(self.data_condition_group, 4) == (
            False,
            [],
        )

    def test_evaluate_condition_group__no_conditions_pass__passes(self):
        assert evaluate_condition_group(self.data_condition_group, 1) == (
            True,
            [],
        )
