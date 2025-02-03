import pytest

from sentry.rules.conditions.event_frequency import (
    ComparisonType,
    EventUniqueUserFrequencyCondition,
)
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.handlers.condition.event_frequency_handlers import (
    EventFrequencyCountHandler,
)
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_base import EventFrequencyQueryTestBase
from tests.sentry.workflow_engine.handlers.condition.test_event_frequency_handlers import (
    TestEventFrequencyCountCondition,
    TestEventFrequencyPercentCondition,
)

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class TestEventUniqueUserFrequencyCountCondition(TestEventFrequencyCountCondition):
    condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT
    payload = {
        "interval": "1h",
        "id": EventUniqueUserFrequencyCondition.id,
        "value": 1000,
        "comparisonType": ComparisonType.COUNT,
    }


class TestEventUniqueUserFrequencyPercentCondition(TestEventFrequencyPercentCondition):
    condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT
    payload = {
        "interval": "1h",
        "id": EventUniqueUserFrequencyCondition.id,
        "value": 1000,
        "comparisonType": ComparisonType.PERCENT,
        "comparisonInterval": "1d",
    }


class EventUniqueUserFrequencyQueryTest(EventFrequencyQueryTestBase):
    handler = EventFrequencyCountHandler

    def test_batch_query_user(self):
        batch_query = self.handler().batch_query(
            group_ids={self.event.group_id, self.event2.group_id, self.perf_event.group_id},
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 1,
            self.perf_event.group_id: 1,
        }

        batch_query = self.handler().batch_query(
            group_ids={self.event3.group_id},
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: 1}
