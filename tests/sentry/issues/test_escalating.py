from unittest.mock import patch
from uuid import uuid4

import pytest

from sentry.eventstore.models import Event
from sentry.issues.escalating import query_groups_past_counts, _start_and_end_dates
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
                # XXX: Let's create a method that help us control which hour this will fall under
                # XXX: Write tests for this
                "timestamp": before_now(minutes=minutes_ago).timestamp(),
                "fingerprint": [fingerprint],
            },
        )

    def test_query_single_group(self) -> None:
        # XXX: Adjust test to handle events within current hour
        event = self._load_event_for_group(minutes_ago=60)
        assert query_groups_past_counts(Group.objects.all()) == [
            {
                "count()": 1,
                "group_id": event.group_id,
                "hourBucket": to_start_of_hour(event.datetime),
                "project_id": event.project_id,
            }
        ]

    def test_query_multiple_groups_same_project(self) -> None:
        # XXX: Adjust test to handle events within current hour
        event1 = self._load_event_for_group(fingerprint="group-1", minutes_ago=60)
        group_1_id = event1.group_id
        # one event in its own hour and two in another
        event2 = self._load_event_for_group(fingerprint="group-2", minutes_ago=120)
        group_2_id = event2.group_id
        event3 = self._load_event_for_group(fingerprint="group-2", minutes_ago=60)
        self._load_event_for_group(fingerprint="group-2", minutes_ago=60)

        # This forces to test the iteration over the Snuba data
        with patch("sentry.issues.escalating.QUERY_LIMIT", new=2):
            assert query_groups_past_counts(Group.objects.all()) == [
                {
                    "count()": 1,
                    "group_id": group_1_id,
                    "hourBucket": to_start_of_hour(event1.datetime),
                    "project_id": self.project.id,
                },
                {
                    "count()": 1,
                    "group_id": group_2_id,
                    "hourBucket": to_start_of_hour(event2.datetime),
                    "project_id": self.project.id,
                },
                {
                    "count()": 2,
                    "group_id": group_2_id,
                    "hourBucket": to_start_of_hour(event3.datetime),
                    "project_id": self.project.id,
                },
            ]

    def test_query_no_groups(self) -> None:
        with pytest.raises(SnubaError):
            assert query_groups_past_counts([]) == []


def test_datetime_number_of_hours():
    start, end = _start_and_end_dates(5)
    assert (end - start).seconds / 3600 == 5


def test_datetime_number_of_days():
    start, end = _start_and_end_dates()
    assert (end - start).days == 7
