import pytest
from jsonschema import ValidationError

from sentry.models.group import Group
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestIssueOccurrencesCondition(ConditionTestCase):
    condition = Condition.ISSUE_OCCURRENCES

    def setUp(self) -> None:
        super().setUp()
        self.group.times_seen_pending = 0
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "value": 10,
            },
            condition_result=True,
        )

    def test_json_schema(self) -> None:
        self.dc.comparison.update({"value": 2000})
        self.dc.save()

        self.dc.comparison.update({"value": -1})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"value": "2000"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"hello": "there"})
        with pytest.raises(ValidationError):
            self.dc.save()

    def test_compares_correctly(self) -> None:
        self.group.update(times_seen=11)
        self.assert_passes(self.dc, self.event_data)

        self.group.update(times_seen=10)
        self.assert_passes(self.dc, self.event_data)

        self.group.update(times_seen=8)
        self.assert_does_not_pass(self.dc, self.event_data)

    def test_uses_pending(self) -> None:
        self.group.update(times_seen=8)
        self.assert_does_not_pass(self.dc, self.event_data)

    def test_handles_missing_pending(self) -> None:
        delattr(self.group, "_times_seen_pending")
        self.group.update(times_seen=9)
        self.assert_does_not_pass(self.dc, self.event_data)

    def test_fails_on_bad_data(self) -> None:
        self.dc.update(comparison={"value": "bad data"})
        self.group.update(times_seen=10)
        self.assert_does_not_pass(self.dc, self.event_data)

    def test_buffer_values(self) -> None:
        with mock_redis_buffer() as buffer:
            self.assert_does_not_pass(self.dc, self.event_data)
            buffer.incr(Group, {"times_seen": 15}, filters={"id": self.event_data.group.id})
            self.assert_passes(self.dc, self.event_data)
