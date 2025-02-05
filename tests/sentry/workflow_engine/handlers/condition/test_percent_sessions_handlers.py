from unittest.mock import patch

import pytest

from sentry.rules.conditions.event_frequency import ComparisonType, EventFrequencyPercentCondition
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.handlers.condition.percent_sessions_handlers import (
    PercentSessionsConditionHandler,
)
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_base import EventFrequencyQueryTestBase
from tests.sentry.workflow_engine.handlers.condition.test_event_frequency_handlers import (
    TestEventFrequencyCountCondition,
    TestEventFrequencyPercentCondition,
)
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class TestPercentSessionsCountCondition(TestEventFrequencyCountCondition):
    condition = Condition.PERCENT_SESSIONS_COUNT
    payload = {
        "interval": "1h",
        "id": EventFrequencyPercentCondition.id,
        "value": 17.2,
        "comparisonType": ComparisonType.COUNT,
    }


class TestPercentSessionsPercentCondition(TestEventFrequencyPercentCondition):
    condition = Condition.PERCENT_SESSIONS_PERCENT
    payload = {
        "interval": "1h",
        "id": EventFrequencyPercentCondition.id,
        "value": 17.2,
        "comparisonType": ComparisonType.PERCENT,
        "comparisonInterval": "1d",
    }


class PercentSessionsQueryTest(BaseEventFrequencyPercentTest, EventFrequencyQueryTestBase):
    handler = PercentSessionsConditionHandler

    @patch(
        "sentry.workflow_engine.handlers.condition.percent_sessions_handlers.MIN_SESSIONS_TO_FIRE",
        1,
    )
    def test_batch_query_percent(self):
        self._make_sessions(60, self.environment2.name)
        self._make_sessions(60, self.environment.name)
        group_ids = {self.event.group_id, self.event2.group_id, self.perf_event.group_id}
        for group_id in group_ids:
            assert group_id

        batch_query = self.handler().batch_query(
            group_ids=group_ids,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            interval="5m",
        )
        percent_of_sessions = 20
        assert batch_query == {
            self.event.group_id: percent_of_sessions,
            self.event2.group_id: percent_of_sessions,
            self.perf_event.group_id: 0,
        }

        assert self.event3.group_id
        batch_query = self.handler().batch_query(
            group_ids={self.event3.group_id},
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
            interval="5m",
        )
        assert batch_query == {self.event3.group_id: percent_of_sessions}

    @patch(
        "sentry.workflow_engine.handlers.condition.percent_sessions_handlers.MIN_SESSIONS_TO_FIRE",
        100,
    )
    def test_batch_query_percent_no_avg_sessions_in_interval(self):
        self._make_sessions(60, self.environment2.name)
        self._make_sessions(60, self.environment.name)
        group_ids = {self.event.group_id, self.event2.group_id, self.perf_event.group_id}
        for group_id in group_ids:
            assert group_id

        batch_query = self.handler().batch_query(
            group_ids=group_ids,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            interval="5m",
        )
        percent = 0
        assert batch_query == {
            self.event.group_id: percent,
            self.event2.group_id: percent,
            self.perf_event.group_id: percent,
        }

        assert self.event3.group_id
        batch_query = self.handler().batch_query(
            group_ids={self.event3.group_id},
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
            interval="5m",
        )
        assert batch_query == {self.event3.group_id: percent}
