from typing import int
from datetime import timedelta
from unittest.mock import patch

import pytest

from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.handlers.condition.event_frequency_query_handlers import (
    EventFrequencyQueryHandler,
    EventUniqueUserFrequencyQueryHandler,
    PercentSessionsQueryHandler,
)
from tests.sentry.workflow_engine.handlers.condition.test_base import EventFrequencyQueryTestBase
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class EventFrequencyQueryTest(EventFrequencyQueryTestBase):
    handler = EventFrequencyQueryHandler

    def test_batch_query(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
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
            groups=self.group_3,
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: 1}

    def test_batch_query_with_upsampling_enabled_counts_upsampled(self) -> None:
        # Create two sampled error events in a dedicated group
        event_a = self.store_event(
            data={
                "event_id": "d" * 32,
                "environment": self.environment.name,
                "timestamp": before_now(seconds=20).isoformat(),
                "fingerprint": ["upsampled-group"],
                "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
                "exception": {"values": [{"type": "ValueError", "value": "a"}]},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "e" * 32,
                "environment": self.environment.name,
                "timestamp": before_now(seconds=10).isoformat(),
                "fingerprint": ["upsampled-group"],
                "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
                "exception": {"values": [{"type": "ValueError", "value": "b"}]},
            },
            project_id=self.project.id,
        )

        groups = list(
            Group.objects.filter(id=event_a.group_id).values(
                "id", "type", "project_id", "project__organization_id"
            )
        )

        with self.options({"issues.client_error_sampling.project_allowlist": [self.project.id]}):
            batch_query = self.handler().batch_query(
                groups=groups,
                start=self.start,
                end=self.end,
                environment_id=self.environment.id,
            )
        # Expect 2 events upsampled by 5x => 10
        assert batch_query[event_a.group_id] == 10

    def test_batch_query_without_upsampling_counts_raw(self) -> None:
        # Same setup as above but without allowlist; expect raw count of 2
        event_a = self.store_event(
            data={
                "event_id": "f" * 32,
                "environment": self.environment.name,
                "timestamp": before_now(seconds=20).isoformat(),
                "fingerprint": ["upsampled-group-raw"],
                "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
                "exception": {"values": [{"type": "ValueError", "value": "a"}]},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "1" * 32,
                "environment": self.environment.name,
                "timestamp": before_now(seconds=10).isoformat(),
                "fingerprint": ["upsampled-group-raw"],
                "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
                "exception": {"values": [{"type": "ValueError", "value": "b"}]},
            },
            project_id=self.project.id,
        )

        groups = list(
            Group.objects.filter(id=event_a.group_id).values(
                "id", "type", "project_id", "project__organization_id"
            )
        )

        batch_query = self.handler().batch_query(
            groups=groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )
        assert batch_query[event_a.group_id] == 2

    def test_batch_query__tag_conditions__equal(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "region", "match": "eq", "value": "US"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 0,
        }

    def test_batch_query__tag_conditions__not_equal(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "region", "match": "ne", "value": "EU"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 1,
        }

    def test_batch_query__tag_conditions__starts_with(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "region", "match": "sw", "value": "U"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 0,
        }

    def test_batch_query__tag_conditions__not_starts_with(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "region", "match": "nsw", "value": "E"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 1,
        }

    def test_batch_query__tag_conditions__ends_with(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "region", "match": "ew", "value": "S"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 0,
        }

    def test_batch_query__tag_conditions__not_ends_with(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "region", "match": "new", "value": "U"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 1,
        }

    def test_batch_query__tag_conditions__contains(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.group_3,
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
            filters=[{"key": "biz", "match": "co", "value": "b"}],
        )
        assert batch_query == {self.event3.group_id: 1}

    def test_batch_query__tag_conditions__not_contains(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.group_3,
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
            filters=[{"key": "biz", "match": "nc", "value": "b"}],
        )
        assert batch_query == {self.event3.group_id: 0}

    def test_batch_query__tag_conditions__is_set(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "foo", "match": "is"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 1,
            self.perf_event.group_id: 1,
        }

    def test_batch_query__tag_conditions__is_not_set(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "foo", "match": "ns"}],
        )
        assert batch_query == {
            self.event.group_id: 0,
            self.event2.group_id: 0,
            self.perf_event.group_id: 0,
        }

    def test_batch_query__tag_conditions__is_in(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "region", "match": "in", "value": "US,EU"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 1,
            self.perf_event.group_id: 0,
        }

    def test_batch_query__tag_conditions__is_not_in(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "region", "match": "nin", "value": "US,EU"}],
        )
        assert batch_query == {
            self.event.group_id: 0,
            self.event2.group_id: 0,
            self.perf_event.group_id: 1,
        }

    def test_batch_query__tag_conditions__invalid(self) -> None:
        with pytest.raises(ValueError):
            self.handler().batch_query(
                groups=self.groups,
                start=self.start,
                end=self.end,
                environment_id=self.environment.id,
                filters=[{"key": "region", "match": "asdf", "value": "U"}],
            )

    def test_batch_query__attribute_conditions(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"attribute": "platform", "match": "eq", "value": "javascript"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 0,
        }

        batch_query = self.handler().batch_query(
            groups=self.group_3,
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
            filters=[{"attribute": "http.status_code", "match": "co", "value": "4"}],
        )

        assert batch_query == {self.event3.group_id: 1}

    def test_batch_query__error_attribute_only(self) -> None:
        # error.handled is only available for errors, not issue platform
        # perf event should not have any events that match the criteria
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"attribute": "error.handled", "match": "eq", "value": True}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 0,
        }

    def test_get_error_and_generic_group_ids(self) -> None:
        category_group_ids = self.handler().get_group_ids_by_category(self.groups)
        error_group_ids = category_group_ids[GroupCategory.ERROR]
        assert self.event.group_id in error_group_ids
        assert self.event2.group_id in error_group_ids
        assert self.perf_event.group_id in category_group_ids[GroupCategory.PERFORMANCE]


class EventUniqueUserFrequencyQueryTest(EventFrequencyQueryTestBase):
    handler = EventUniqueUserFrequencyQueryHandler

    def test_batch_query_user(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
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
            groups=self.group_3,
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: 1}

    def test_batch_query_user__tag_conditions(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"key": "region", "match": "eq", "value": "US"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 0,
        }

        batch_query = self.handler().batch_query(
            groups=self.group_3,
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
            filters=[{"key": "biz", "match": "co", "value": "b"}],
        )
        assert batch_query == {self.event3.group_id: 1}

    def test_batch_query__attribute_conditions(self) -> None:
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"attribute": "platform", "match": "eq", "value": "javascript"}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 0,
        }

        batch_query = self.handler().batch_query(
            groups=self.group_3,
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
            filters=[{"attribute": "http.status_code", "match": "co", "value": "4"}],
        )

        assert batch_query == {self.event3.group_id: 1}

    def test_batch_query__error_attribute_only(self) -> None:
        # error.handled is only available for errors, not issue platform
        # perf event should not have any events that match the criteria
        batch_query = self.handler().batch_query(
            groups=self.groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
            filters=[{"attribute": "error.unhandled", "match": "eq", "value": False}],
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 0,
            self.perf_event.group_id: 0,
        }


class PercentSessionsQueryTest(BaseEventFrequencyPercentTest, EventFrequencyQueryTestBase):
    handler = PercentSessionsQueryHandler

    @patch(
        "sentry.workflow_engine.handlers.condition.event_frequency_query_handlers.MIN_SESSIONS_TO_FIRE",
        1,
    )
    def test_batch_query_percent(self) -> None:
        self._make_sessions(60, self.environment2.name, received=self.end.timestamp())
        self._make_sessions(60, self.environment.name, received=self.end.timestamp())

        batch_query = self.handler().batch_query(
            groups=self.groups,
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
            groups=self.group_3,
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: percent_of_sessions}

    def test_batch_query_percent_decimal(self) -> None:
        self._make_sessions(600, self.environment.name)

        assert self.event.group_id
        groups = list(
            Group.objects.filter(id=self.event.group_id).values(
                "id", "type", "project_id", "project__organization_id"
            )
        )

        self.start = before_now(hours=1)
        self.end = self.start + timedelta(hours=1)

        batch_query = self.handler().batch_query(
            groups=groups,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )
        assert round(batch_query[self.event.group_id], 4) == 0.17

    @patch(
        "sentry.workflow_engine.handlers.condition.event_frequency_query_handlers.MIN_SESSIONS_TO_FIRE",
        100,
    )
    def test_batch_query_percent_no_avg_sessions_in_interval(self) -> None:
        self._make_sessions(60, self.environment2.name)
        self._make_sessions(60, self.environment.name)
        batch_query = self.handler().batch_query(
            groups=self.groups,
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
            groups=self.group_3,
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: percent}
