from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestEvaluateGroup(TestCase):
    def test(self):
        dc = self.create_data_condition(condition="gt", comparison=1.0, condition_result=True)
        d = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ANY)
        d.conditions.add(dc)

        assert d.evaluate(2) is True
        assert d.evaluate(1) is False

    def test_single_condition__type_all(self):
        dc = self.create_data_condition(condition="gt", comparison=1.0, condition_result=True)
        d = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ALL)
        d.conditions.add(dc)

        assert d.evaluate(2) is True
        assert d.evaluate(1) is False

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
        assert d.evaluate(6) is True

        # meets one condition
        assert d.evaluate(4) is True

        # meets no conditions
        assert d.evaluate(3) is False
        assert d.evaluate(1) is False

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

        assert d.evaluate(6) is True

        # meets one condition
        assert d.evaluate(4) is False

        # meets no conditions
        assert d.evaluate(3) is False
        assert d.evaluate(1) is False
