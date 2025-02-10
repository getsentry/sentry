from unittest.mock import patch

import pytest

from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.handlers.condition.slow_condition_query_handlers import (
    EventFrequencyQueryHandler,
    EventUniqueUserFrequencyQueryHandler,
    PercentSessionsQueryHandler,
)
from tests.sentry.workflow_engine.handlers.condition.test_base import EventFrequencyQueryTestBase
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class EventFrequencyQueryTest(EventFrequencyQueryTestBase):
    handler = EventFrequencyQueryHandler

    def test_batch_query(self):
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

    def test_get_error_and_generic_group_ids(self):
        groups = Group.objects.filter(
            id__in=[self.event.group_id, self.event2.group_id, self.perf_event.group_id]
        ).values("id", "type", "project_id", "project__organization_id")
        category_group_ids = self.handler().get_group_ids_by_category(groups)
        error_group_ids = category_group_ids[GroupCategory.ERROR]
        assert self.event.group_id in error_group_ids
        assert self.event2.group_id in error_group_ids
        assert self.perf_event.group_id in category_group_ids[GroupCategory.PERFORMANCE]


class EventUniqueUserFrequencyQueryTest(EventFrequencyQueryTestBase):
    handler = EventUniqueUserFrequencyQueryHandler

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


class PercentSessionsQueryTest(BaseEventFrequencyPercentTest, EventFrequencyQueryTestBase):
    handler = PercentSessionsQueryHandler

    @patch(
        "sentry.workflow_engine.handlers.condition.slow_condition_query_handlers.MIN_SESSIONS_TO_FIRE",
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
        )
        assert batch_query == {self.event3.group_id: percent_of_sessions}

    @patch(
        "sentry.workflow_engine.handlers.condition.slow_condition_query_handlers.MIN_SESSIONS_TO_FIRE",
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
        )
        assert batch_query == {self.event3.group_id: percent}
