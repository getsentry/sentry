from sentry.rules.filters.issue_occurrences import IssueOccurrencesFilter
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestIssueOccurrencesCondition(ConditionTestCase):
    condition = Condition.ISSUE_OCCURRENCES
    rule_cls = IssueOccurrencesFilter
    payload = {
        "id": IssueOccurrencesFilter.id,
        "value": "10",
    }

    def setUp(self):
        super().setUp()
        self.group.times_seen_pending = 0
        self.job = WorkflowJob(
            {
                "event": self.group_event,
            }
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "value": "10",
            },
            condition_result=True,
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "value": "10",
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_compares_correctly(self):
        self.group.update(times_seen=11)
        self.assert_passes(self.dc, self.job)

        self.group.update(times_seen=10)
        self.assert_passes(self.dc, self.job)

        self.group.update(times_seen=8)
        self.assert_does_not_pass(self.dc, self.job)

    def test_uses_pending(self):
        self.group.update(times_seen=8)
        self.assert_does_not_pass(self.dc, self.job)

        self.group.times_seen_pending = 3
        self.assert_passes(self.dc, self.job)

    def test_fails_on_bad_data(self):
        self.dc.update(comparison={"value": "bad data"})
        self.group.update(times_seen=10)
        self.assert_does_not_pass(self.dc, self.job)
