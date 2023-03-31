from uuid import uuid4

import pytest

from sentry.eventstore.models import Event
from sentry.issues.escalating import query_groups_past_counts
from sentry.models import Group
from sentry.testutils import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba import SnubaError, to_start_of_hour


class HistoricGroupCounts(TestCase):  # type: ignore
    def setUp(self) -> None:
        super().setUp()

    def _load_event_for_group(
        self,
        minutes_ago: int = 2,
        fingerprint: str = "foo-1",
    ) -> Event:
        """Creates a new event for a group. It creates one if missing.
        Use fingerprint to create different groups.
        """
        return Factories.store_event(
            project_id=self.project.id,
            data={
                "event_id": uuid4().hex,
                "message": "some message",
                "timestamp": before_now(minutes=minutes_ago).timestamp(),
                "fingerprint": [fingerprint],
            },
        )

    def test_query_single_group(self) -> None:
        event = self._load_event_for_group()
        assert query_groups_past_counts(Group.objects.all()) == [
            {
                "group_id": event.group_id,
                "hourBucket": to_start_of_hour(event.datetime),
                "project_id": event.project_id,
            }
        ]

    def test_query_multiple_groups(self) -> None:
        event1 = self._load_event_for_group(fingerprint="group-1")
        event2 = self._load_event_for_group(fingerprint="group-2", minutes_ago=65)

        assert query_groups_past_counts(Group.objects.all()) == [
            {
                "group_id": event1.group_id,
                "hourBucket": to_start_of_hour(event1.datetime),
                "project_id": event1.project_id,
            },
            {
                "group_id": event2.group_id,
                "hourBucket": to_start_of_hour(event2.datetime),
                "project_id": event2.project_id,
            },
        ]

    def test_query_no_groups(self) -> None:
        with pytest.raises(SnubaError):
            assert query_groups_past_counts([]) == []
