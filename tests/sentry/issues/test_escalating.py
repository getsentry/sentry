from typing import Tuple

import pytest

from sentry.eventstore.models import Event
from sentry.issues.escalating import query_groups_past_counts
from sentry.models import Group
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
from sentry.utils.snuba import SnubaError, to_start_of_hour


class HistoricGroupCounts(TestCase):  # type: ignore
    def setUp(self) -> None:
        super().setUp()

    def _load_event(self) -> Tuple[Event, str]:
        timestamp = before_now(minutes=1)
        data = load_data("python", timestamp=timestamp)
        event = self.store_event(data, project_id=self.project.id)
        return event, timestamp

    def test_query(self) -> None:
        event, timestamp = self._load_event()
        assert query_groups_past_counts(Group.objects.all()) == [
            {
                "group_id": event.group_id,
                "hourBucket": to_start_of_hour(timestamp),
                "project_id": event.project_id,
            }
        ]

    def test_query_no_groups(self) -> None:
        with pytest.raises(SnubaError):
            assert query_groups_past_counts([]) == []
