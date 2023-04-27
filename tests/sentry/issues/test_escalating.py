from datetime import datetime, timedelta
from typing import List, Optional
from unittest.mock import patch
from uuid import uuid4

from sentry.eventstore.models import Event
from sentry.issues.escalating import (
    GroupsCountResponse,
    _start_and_end_dates,
    get_group_daily_count,
    is_escalating,
    query_groups_past_counts,
)
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.models import Group
from sentry.models.group import GroupStatus
from sentry.models.groupinbox import GroupInbox
from sentry.testutils import TestCase
from sentry.testutils.factories import Factories
from sentry.types.group import GroupSubStatus
from sentry.utils.cache import cache
from sentry.utils.snuba import to_start_of_hour


class BaseGroupCounts(TestCase):  # type: ignore[misc]
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


class HistoricGroupCounts(BaseGroupCounts):
    def setUp(self) -> None:
        super().setUp()

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


class DailyGroupCountsEscalating(BaseGroupCounts):
    def save_mock_escalating_group_forecast(  # type: ignore[no-untyped-def]
        self, group: Group, forecast_values=List[int], date_added=datetime
    ) -> None:
        """Save mock data for escalating group forecast in nodestore"""
        escalating_forecast = EscalatingGroupForecast(
            project_id=group.project.id,
            group_id=group.id,
            forecast=forecast_values,
            date_added=date_added,
        )
        escalating_forecast.save()

    def test_is_escalating_issue(self) -> None:
        """Test when an archived until escalating issue starts escalating"""
        with self.feature("organizations:escalating-issues"):
            # The group has 6 events today
            for i in range(7, 1, -1):
                event = self._load_event_for_group(minutes_ago=i)
                group_escalating = event.group
            group_escalating.status = GroupStatus.IGNORED
            group_escalating.substatus = GroupSubStatus.UNTIL_ESCALATING
            group_escalating.save()

            # The escalating forecast for today is 5
            forecast_values = [5] + [6] * 13
            self.save_mock_escalating_group_forecast(
                group=group_escalating, forecast_values=forecast_values, date_added=datetime.now()
            )
            group_is_escalating = is_escalating(group_escalating)
            assert group_is_escalating
            assert group_escalating.substatus == GroupSubStatus.ESCALATING
            assert group_escalating.status == GroupStatus.UNRESOLVED
            assert GroupInbox.objects.filter(group=group_escalating).exists()

            # Test cache
            assert (
                cache.get(f"daily-group-count:{group_escalating.project.id}:{group_escalating.id}")
                == 6
            )

    def test_not_escalating_issue(self) -> None:
        """Test when an archived until escalating issue is not escalating"""
        with self.feature("organizations:escalating-issues"):
            # The group had 4 events yesterday
            one_day_ago_mins = 24 * 60
            for i in range(5, 1, -1):
                event = self._load_event_for_group(minutes_ago=one_day_ago_mins + i)

            # The group has 5 events today
            for i in range(6, 1, -1):
                event = self._load_event_for_group(fingerprint="group-escalating", minutes_ago=i)
                group = event.group
            group.status = GroupStatus.IGNORED
            group.substatus = GroupSubStatus.UNTIL_ESCALATING
            group.save()

            # The escalating forecast for today is 6 (since date_added was one day ago)
            forecast_values = [5] + [6] * 13
            self.save_mock_escalating_group_forecast(
                group=group,
                forecast_values=forecast_values,
                date_added=datetime.now() - timedelta(days=1),
            )
            group_is_escalating = is_escalating(group)
            assert not group_is_escalating
            assert group.substatus == GroupSubStatus.UNTIL_ESCALATING
            assert group.status == GroupStatus.IGNORED
            assert not GroupInbox.objects.filter(group=group).exists()

    def test_daily_count_query(self) -> None:
        """Test the daily count query only aggregates events from today"""
        # The group had 3 events two days ago
        two_days_ago_mins = 48 * 60
        for i in range(4, 1, -1):
            event = self._load_event_for_group(minutes_ago=two_days_ago_mins + i)

        # The group had 2 events yesterday
        # Tests that events are aggregated in the daily count query by date, not by 24 hr periods
        yesterday = datetime.now().date() - timedelta(days=1)
        yesterday_midnight = datetime.combine(yesterday, datetime.min.time())
        mins_since_yesterday_midnight = int(
            ((datetime.now() - yesterday_midnight).total_seconds()) / 60
        )
        for i in range(3, 1, -1):
            # Event occured i hours after yesterday midnight
            event = self._load_event_for_group(minutes_ago=mins_since_yesterday_midnight + i * 60)

        # The group has 1 event today
        for i in range(2, 1, -1):
            event = self._load_event_for_group(minutes_ago=i)
            group = event.group
        group.status = GroupStatus.IGNORED
        group.substatus = GroupSubStatus.UNTIL_ESCALATING
        group.save()

        assert get_group_daily_count(group.project.organization.id, group.project.id, group.id) == 1
