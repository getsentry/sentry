from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestEvaluateGroup(TestCase):
    def test(self):
        dc = self.create_data_condition(condition="gt", comparison=1.0, condition_result=True)
        d = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ANY)
        d.conditions.add(dc)

        assert d.evaluate_conditions(2) == (True, [True])
        assert d.evaluate_conditions(1) == (False, [])

    def test_single_condition__type_all(self):
        dc = self.create_data_condition(condition="gt", comparison=1.0, condition_result=True)
        d = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ALL)
        d.conditions.add(dc)

        assert d.evaluate_conditions(2) == (True, [True])
        assert d.evaluate_conditions(1) == (False, [])

    def test_multiple_conditions(self):
        dc1 = self.create_data_condition(
            condition="gt", comparison=5.0, condition_result=DetectorPriorityLevel.HIGH
        )
        dc2 = self.create_data_condition(
            condition="gt", comparison=3.0, condition_result=DetectorPriorityLevel.LOW
        )
        d = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ANY)
        d.conditions.add(dc1)
        d.conditions.add(dc2)

        # meets all conditions, but only returns the first one because it's an ANY condition
        assert d.evaluate_conditions(6) == (True, [DetectorPriorityLevel.HIGH])

        # meets one condition
        assert d.evaluate_conditions(4) == (True, [DetectorPriorityLevel.LOW])

        # meets no conditions
        assert d.evaluate_conditions(3) == (False, [])
        assert d.evaluate_conditions(1) == (False, [])

    def test_multiple_conditions__type_all(self):
        dc1 = self.create_data_condition(
            condition="gt", comparison=5.0, condition_result=DetectorPriorityLevel.HIGH
        )
        dc2 = self.create_data_condition(
            condition="gt", comparison=3.0, condition_result=DetectorPriorityLevel.LOW
        )
        d = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ALL)
        d.conditions.add(dc1)
        d.conditions.add(dc2)

        # meets all conditions
        assert d.evaluate_conditions(6) == (
            True,
            [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW],
        )

        # meets one condition
        is_condition_met, condition_results = d.evaluate_conditions(4)
        assert is_condition_met is False
        assert condition_results == []

        # meets no conditions
        is_condition_met, condition_results = d.evaluate_conditions(3)
        assert is_condition_met is False
        assert condition_results == []

        is_condition_met, condition_results = d.evaluate_conditions(1)
        assert is_condition_met is False
        assert condition_results == []
