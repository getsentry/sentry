from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestEvaluateGroup(TestCase):
    def test(self):
        dc = self.create_data_condition(
            condition="gt", comparison=1.0, condition_result=DetectorPriorityLevel.HIGH
        )
        d = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ALL)
        d.conditions.add(dc)

        assert d.evaluate(2) == DetectorPriorityLevel.HIGH
        assert d.evaluate(1) is None
