from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestEvaluateGroup(TestCase):
    def test(self):
        dc = self.create_data_condition(condition="gt", comparison=1.0, condition_result=True)
        d = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ANY)
        d.conditions.add(dc)

        group_is_valid, result = d.evaluate(2)
        assert group_is_valid is True
        assert result is True

        group_is_valid, result = d.evaluate(1)
        assert group_is_valid is False
        assert result is None

    def test__type_all(self):
        dc = self.create_data_condition(condition="gt", comparison=1.0, condition_result=True)
        d = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ALL)
        d.conditions.add(dc)

        group_is_valid, results = d.evaluate(2)
        assert group_is_valid is True
        assert results == [True]

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

        # meets all conditions
        group_is_valid, results = d.evaluate(6)
        assert group_is_valid is True
        assert results == DetectorPriorityLevel.HIGH

        # meets one condition
        group_is_valid, results = d.evaluate(4)
        assert group_is_valid is True
        assert results == DetectorPriorityLevel.LOW

        # meets no conditions
        group_is_valid, results = d.evaluate(3)
        assert group_is_valid is False
        assert results is None

        group_is_valid, results = d.evaluate(1)
        assert group_is_valid is False
        assert results is None

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

        group_is_valid, results = d.evaluate(6)
        assert group_is_valid is True
        assert results == [DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW]

        # meets one condition
        group_is_valid, results = d.evaluate(4)
        assert group_is_valid is False
        assert results == [DetectorPriorityLevel.LOW]

        # meets no conditions
        group_is_valid, results = d.evaluate(3)
        assert group_is_valid is False
        assert results == []

        group_is_valid, results = d.evaluate(1)
        assert group_is_valid is False
        assert results == []
