from datetime import datetime, timedelta
from typing import Optional
from unittest.mock import patch
from uuid import uuid4

from sentry.eventstore.models import Event
from sentry.issues.escalating import (
    GroupsCountResponse,
    _start_and_end_dates,
    query_groups_past_counts,
)
from sentry.models import Group
from sentry.testutils import TestCase
from sentry.testutils.factories import Factories
from sentry.utils.snuba import to_start_of_hour


class HistoricGroupCounts(TestCase):  # type: ignore
    def setUp(self) -> None:
        super().setUp()

    def _load_event_for_group(
        self,
        project_id: Optional[int] = None,
        minutes_ago: int = 1,
        fingerprint: str = "foo-1",
    ) -> Event:
        """Creates a new event for a group. It creates one if missing.
        Use fingerprint to create different groups.
        An event will be counted within an hour bucket depending on how many full 60 minutes it contains
        """
        proj_id = project_id or self.project.id
        # This time becomes a starting point from which to create other datetimes in the past
        datetime_reset_zero = datetime.now().replace(minute=0, second=0, microsecond=0)
        return Factories.store_event(
            project_id=proj_id,
            data={
                "event_id": uuid4().hex,
                "message": "some message",
                "timestamp": (datetime_reset_zero - timedelta(minutes=minutes_ago)).timestamp(),
                "fingerprint": [fingerprint],
            },
        )

    def _count_bucket(self, count: int, event: Event) -> GroupsCountResponse:
        """It simplifies writing the expected data structures"""
        return {
            "count()": count,
            "group_id": event.group_id,
            "hourBucket": to_start_of_hour(event.datetime),
            "project_id": event.project_id,
        }

    def test_query_single_group(self) -> None:
        event = self._load_event_for_group()
        assert query_groups_past_counts(Group.objects.all()) == [self._count_bucket(1, event)]

    def test_pagination(self) -> None:
        event1 = self._load_event_for_group(fingerprint="group-1", minutes_ago=1)
        # Increases the count of event1
        self._load_event_for_group(fingerprint="group-1", minutes_ago=59)
        # one event in its own hour and two in another
        event2 = self._load_event_for_group(fingerprint="group-2", minutes_ago=61)
        event3 = self._load_event_for_group(fingerprint="group-2", minutes_ago=60)
        # Increases the count of event3
        self._load_event_for_group(fingerprint="group-2", minutes_ago=59)

        # This forces to test the iteration over the Snuba data
        with patch("sentry.issues.escalating.ELEMENTS_PER_SNUBA_PAGE", new=2):
            assert query_groups_past_counts(Group.objects.all()) == [
                self._count_bucket(2, event1),
                self._count_bucket(1, event2),
                self._count_bucket(2, event3),
            ]

    def test_query_optimization(self) -> None:
        px = Factories.create_project(self.project.organization)
        py = Factories.create_project(self.project.organization)
        pz = Factories.create_project(self.project.organization)

        # Two different groups for proj x, one group for proj y and two groups for proj z
        self._load_event_for_group(project_id=px.id)
        self._load_event_for_group(project_id=px.id, fingerprint="group-b")
        self._load_event_for_group(project_id=py.id)
        self._load_event_for_group(project_id=pz.id)
        self._load_event_for_group(project_id=pz.id, fingerprint="group-b")

        groups = Group.objects.all()
        assert len(groups) == 5

        # Force pagination to only three elements per page
        # Once we get to Python 3.10+ the formating of this multiple with statement will not be an eye sore
        with patch("sentry.issues.escalating._query_with_pagination") as query_mock, patch(
            "sentry.issues.escalating.ELEMENTS_PER_SNUBA_PAGE", new=3
        ), patch("sentry.issues.escalating.BUCKETS_PER_GROUP", new=2):
            query_groups_past_counts(groups)
            # Proj X will expect potentially 4 elements because it has two groups, thus, no other
            # project will be called with it.
            # Proj Y and Z will be grouped together
            assert query_mock.call_count == 2

    def test_query_multiple_projects(self) -> None:
        proj_x = Factories.create_project(self.project.organization)
        proj_y = Factories.create_project(self.project.organization)

        event1 = self._load_event_for_group(project_id=proj_x.id)
        # This event has the same fingerprint as event1 but
        # should be different group IDs since they belong to different projects
        event_y_1 = self._load_event_for_group(project_id=proj_y.id, minutes_ago=61)
        assert event1.group_id != event_y_1.group_id

        event_y_2 = self._load_event_for_group(project_id=proj_y.id, fingerprint="group-1")
        # Increases the count of group-1
        self._load_event_for_group(project_id=proj_y.id, fingerprint="group-1")

        assert query_groups_past_counts(Group.objects.all()) == [
            self._count_bucket(1, event1),
            self._count_bucket(1, event_y_1),
            self._count_bucket(2, event_y_2),
        ]

    def test_query_different_orgs(self) -> None:
        proj_a = Factories.create_project(self.project.organization)
        org_b = Factories.create_organization()
        proj_b = Factories.create_project(org_b)

        event1 = self._load_event_for_group(project_id=proj_a, minutes_ago=60)
        event_proj_org_b_1 = self._load_event_for_group(project_id=proj_b, minutes_ago=60)

        # Since proj_org_b is created
        assert query_groups_past_counts(Group.objects.all()) == [
            self._count_bucket(1, event1),
            self._count_bucket(1, event_proj_org_b_1),
        ]

    def test_query_no_groups(self) -> None:
        assert query_groups_past_counts([]) == []


def test_datetime_number_of_hours() -> None:
    start, end = _start_and_end_dates(5)
    assert (end - start).seconds / 3600 == 5


def test_datetime_number_of_days() -> None:
    start, end = _start_and_end_dates()
    assert (end - start).days == 7
