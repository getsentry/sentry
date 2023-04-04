from typing import Optional
from unittest.mock import patch
from uuid import uuid4

import pytest

from sentry.eventstore.models import Event
from sentry.issues.escalating import _start_and_end_dates, query_groups_past_counts
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
        project_id: Optional[int] = None,
        minutes_ago: int = 2,
        fingerprint: str = "foo-1",
    ) -> Event:
        """Creates a new event for a group. It creates one if missing.
        Use fingerprint to create different groups.
        """
        proj_id = project_id or self.project.id
        return Factories.store_event(
            project_id=proj_id,
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

    def test_query_multiple_projects(self) -> None:
        proj_x = Factories.create_project(self.project.organization)
        proj_y = Factories.create_project(self.project.organization)

        event1 = self._load_event_for_group(project_id=proj_x.id, minutes_ago=60)
        # This event has the same fingerprint as event1 but
        # should be different group IDs since they belong to different projects
        event_y_1 = self._load_event_for_group(project_id=proj_y.id, minutes_ago=180)
        assert event1.group_id != event_y_1.group_id

        event_y_2 = self._load_event_for_group(
            project_id=proj_y.id, fingerprint="group-1", minutes_ago=120
        )
        # Increases the count of group-1
        self._load_event_for_group(project_id=proj_y.id, fingerprint="group-1", minutes_ago=120)

        assert query_groups_past_counts(Group.objects.all()) == [
            {
                "count()": 1,
                "group_id": event1.group_id,
                "hourBucket": to_start_of_hour(event1.datetime),
                "project_id": proj_x.id,
            },
            {
                "count()": 1,
                "group_id": event_y_1.group_id,
                "hourBucket": to_start_of_hour(event_y_1.datetime),
                "project_id": proj_y.id,
            },
            {
                "count()": 2,
                "group_id": event_y_2.group_id,
                "hourBucket": to_start_of_hour(event_y_2.datetime),
                "project_id": proj_y.id,
            },
        ]

    def test_query_different_orgs(self) -> None:
        proj_a = Factories.create_project(self.project.organization)
        org_b = Factories.create_organization()
        proj_b = Factories.create_project(org_b)

        event1 = self._load_event_for_group(project_id=proj_a, minutes_ago=60)
        event_proj_org_b_1 = self._load_event_for_group(project_id=proj_b, minutes_ago=60)

        # Since proj_org_b is created
        assert query_groups_past_counts(Group.objects.all()) == [
            {
                "count()": 1,
                "group_id": event1.group_id,
                "hourBucket": to_start_of_hour(event1.datetime),
                "project_id": proj_a.id,
            },
            {
                "count()": 1,
                "group_id": event_proj_org_b_1.group_id,
                "hourBucket": to_start_of_hour(event_proj_org_b_1.datetime),
                "project_id": proj_b.id,
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
