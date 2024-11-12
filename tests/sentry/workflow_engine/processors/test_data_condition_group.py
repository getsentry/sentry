from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.processors.data_condition_group import (
    evaluate_condition_group,
    get_data_condition_group,
    get_data_conditions_for_group,
    process_data_condition_group,
)
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestGetDataConditionGroup(TestCase):
    def test_get_data_condition_group(self):
        assert get_data_condition_group(1) is None

    def test_get_data_condition_group__exists(self):
        data_condition_group = self.create_data_condition_group()
        assert get_data_condition_group(data_condition_group.id) == data_condition_group


class TestGetDataConditionsForGroup(TestCase):
    def test_get_data_conditions_for_group(self):
        assert get_data_conditions_for_group(0) == []

    def test_get_data_conditions_for_group__exists(self):
        data_condition_group = self.create_data_condition_group()
        data_condition = self.create_data_condition(condition_group=data_condition_group)
        assert get_data_conditions_for_group(data_condition_group.id) == [data_condition]


class TestProcessDataConditionGroup(TestCase):
    def test_process_data_condition_group(self):
        assert process_data_condition_group(1, 1) == (False, [])

    def test_process_data_condition_group__exists(self):
        data_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=data_condition_group, condition="gt", comparison="5"
        )
        assert process_data_condition_group(data_condition_group.id, 1) == (False, [])

    def test_process_data_condition_group__exists__passes(self):
        data_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=data_condition_group,
            condition="gt",
            comparison="5",
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
            condition="gt",
            comparison="5",
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.data_condition_group,
        )

        self.data_condition_two = self.create_data_condition(
            condition="gt",
            comparison="3",
            condition_result=DetectorPriorityLevel.LOW,
            condition_group=self.data_condition_group,
        )

        self.conditions = [self.data_condition, self.data_condition_two]

    def test_evaluate_condition_group__passes_all__fetches_conditions(self):
        assert evaluate_condition_group(self.data_condition_group, 10) == (
            True,
            [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW],
        )

    def test_evaluate_condition_group__passes_all(self):
        assert evaluate_condition_group(
            self.data_condition_group, 10, conditions=self.conditions
        ) == (
            True,
            [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW],
        )

    def test_evaluate_condition_group__passes_one(self):
        assert evaluate_condition_group(
            self.data_condition_group, 4, conditions=self.conditions
        ) == (
            True,
            [DetectorPriorityLevel.LOW],
        )

    def test_evaluate_condition_group__fails_all(self):
        assert evaluate_condition_group(
            self.data_condition_group,
            1,
            conditions=self.conditions,
        ) == (
            False,
            [],
        )

    def test_evaluate_conditon_group__passes_without_conditions(self):
        assert evaluate_condition_group(self.data_condition_group, 10, conditions=[]) == (
            True,
            [],
        )


class TestEvaluateConditionGroupTypeAll(TestCase):
    def setUp(self):
        self.data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )

        self.data_condition = self.create_data_condition(
            condition="gt",
            comparison="5",
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.data_condition_group,
        )

        self.data_condition_two = self.create_data_condition(
            condition="gt",
            comparison="3",
            condition_result=DetectorPriorityLevel.LOW,
            condition_group=self.data_condition_group,
        )

        self.conditions = [self.data_condition, self.data_condition_two]

    def test_evaluate_condition_group__passes_all__fetches_conditions(self):
        assert evaluate_condition_group(self.data_condition_group, 10) == (
            True,
            [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW],
        )

    def test_evaluate_condition_group__passes_all(self):
        assert evaluate_condition_group(
            self.data_condition_group, 10, conditions=self.conditions
        ) == (
            True,
            [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW],
        )

    def test_evaluate_condition_group__passes_one(self):
        assert evaluate_condition_group(
            self.data_condition_group, 4, conditions=self.conditions
        ) == (
            False,
            [],
        )

    def test_evaluate_condition_group__fails_all(self):
        assert evaluate_condition_group(
            self.data_condition_group, 1, conditions=self.conditions
        ) == (
            False,
            [],
        )

    def test_evaluate_conditon_group__passes_without_conditions(self):
        assert evaluate_condition_group(self.data_condition_group, 10, conditions=[]) == (
            True,
            [],
        )


class TestEvaluateConditionGroupTypeNone(TestCase):
    def setUp(self):
        self.data_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.NONE
        )

        self.data_condition = self.create_data_condition(
            condition="gt",
            comparison="5",
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.data_condition_group,
        )

        self.data_condition_two = self.create_data_condition(
            condition="gt",
            comparison="3",
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
