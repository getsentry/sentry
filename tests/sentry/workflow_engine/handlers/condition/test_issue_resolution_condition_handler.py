from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestIssueResolutionChangeCondition(ConditionTestCase):
    condition = Condition.ISSUE_RESOLUTION_CHANGE

    def setUp(self):
        super().setUp()
        self.job = WorkflowJob(
            {
                "event": self.group_event,
            }
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison=1,
            condition_result=True,
        )

    def test_evaluate_value(self):
        self.group_event.group.status = 1
        result = self.dc.evaluate_value(self.job)
        assert result is self.dc.get_condition_result()

    def test_evaluate_value__not_matching_comparison(self):
        self.group_event.group.status = 2
        result = self.dc.evaluate_value(self.job)
        assert result is None
