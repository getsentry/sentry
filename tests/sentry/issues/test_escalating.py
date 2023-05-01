from datetime import datetime, timedelta
from typing import List, Optional
from unittest.mock import MagicMock, patch
from uuid import uuid4

from freezegun import freeze_time

from sentry.eventstore.models import Event
from sentry.issues.escalating import (
    GroupsCountResponse,
    _start_and_end_dates,
    get_group_hourly_count,
    is_escalating,
    query_groups_past_counts,
)
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.models import Group
from sentry.models.group import GroupStatus
from sentry.models.groupinbox import GroupInbox
from sentry.testutils import TestCase
from sentry.types.group import GroupSubStatus
from sentry.utils.cache import cache
from sentry.utils.snuba import to_start_of_hour

TIME_YESTERDAY = (datetime.now() - timedelta(hours=24)).replace(hour=6)


class BaseGroupCounts(TestCase):  # type: ignore[misc]
    def _create_events_for_group(
        self,
        project_id: Optional[int] = None,
        count: int = 1,
        hours_ago: int = 0,
        min_ago: int = 0,
        group: str = "foo-1",
    ) -> Event:
        """Creates one or many events for a group.
        If the group does not exist create one.
        An event will be counted within an hour bucket depending on how many hours ago.
        """
        proj_id = project_id or self.project.id
        # This time becomes a starting point from which to create other datetimes in the past
        datetime_reset_zero = datetime.now().replace(minute=0, second=0, microsecond=0)
        data = {"message": "some message", "fingerprint": [group]}

        last_event = None
        for _ in range(count):
            data["timestamp"] = (datetime_reset_zero - timedelta(hours=hours_ago, minutes=min_ago)).timestamp()  # type: ignore[assignment]
            data["event_id"] = uuid4().hex
            # assert_no_errors is necessary because of SDK and server time differences due to freeze gun
            last_event = self.store_event(data=data, project_id=proj_id, assert_no_errors=False)
        return last_event


class HistoricGroupCounts(BaseGroupCounts):  # type: ignore[misc]
    def setUp(self) -> None:
        super().setUp()

    def _create_hourly_bucket(self, count: int, event: Event) -> GroupsCountResponse:
        """It simplifies writing the expected data structures"""
        return {
            "count()": count,
            "group_id": event.group_id,
            "hourBucket": to_start_of_hour(event.datetime),
            "project_id": event.project_id,
        }

    def test_query_single_group(self) -> None:
        event = self._create_events_for_group()
        assert query_groups_past_counts(Group.objects.all()) == [
            self._create_hourly_bucket(1, event)
        ]

    def test_pagination(self) -> None:
        group1_bucket1_event = self._create_events_for_group(count=2, hours_ago=1, group="group-1")
        group2_bucket1_event = self._create_events_for_group(count=1, hours_ago=2, group="group-2")
        group2_bucket2_event = self._create_events_for_group(count=2, hours_ago=1, group="group-2")

        # This forces to test the iteration over the Snuba data
        with patch("sentry.issues.escalating.ELEMENTS_PER_SNUBA_PAGE", new=2):
            assert query_groups_past_counts(Group.objects.all()) == [
                self._create_hourly_bucket(2, group1_bucket1_event),
                self._create_hourly_bucket(1, group2_bucket1_event),
                self._create_hourly_bucket(2, group2_bucket2_event),
            ]

    def test_query_optimization(self) -> None:
        px = self.create_project(organization=self.project.organization)
        py = self.create_project(organization=self.project.organization)
        pz = self.create_project(organization=self.project.organization)

        # Two different groups for proj x, one group for proj y and two groups for proj z
        self._create_events_for_group(project_id=px.id)
        self._create_events_for_group(project_id=px.id, group="group-b")
        self._create_events_for_group(project_id=py.id)
        self._create_events_for_group(project_id=pz.id)
        self._create_events_for_group(project_id=pz.id, group="group-b")

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
        proj_x = self.create_project(organization=self.project.organization)
        proj_y = self.create_project(organization=self.project.organization)

        event1 = self._create_events_for_group(project_id=proj_x.id)
        # This event has the same fingerprint as event1 but
        # should be different group IDs since they belong to different projects
        event_y_1 = self._create_events_for_group(project_id=proj_y.id, hours_ago=1)
        assert event1.group_id != event_y_1.group_id

        event_y_2 = self._create_events_for_group(project_id=proj_y.id, group="group-1")
        # Increases the count of group-1
        self._create_events_for_group(project_id=proj_y.id, group="group-1")

        assert query_groups_past_counts(Group.objects.all()) == [
            self._create_hourly_bucket(1, event1),
            self._create_hourly_bucket(1, event_y_1),
            self._create_hourly_bucket(2, event_y_2),
        ]

    def test_query_different_orgs(self) -> None:
        proj_a = self.create_project(organization=self.project.organization)
        org_b = self.create_organization()
        proj_b = self.create_project(organization=org_b)

        event1 = self._create_events_for_group(project_id=proj_a, hours_ago=1)
        event_proj_org_b_1 = self._create_events_for_group(project_id=proj_b, hours_ago=1)

        # Since proj_org_b is created
        assert query_groups_past_counts(Group.objects.all()) == [
            self._create_hourly_bucket(1, event1),
            self._create_hourly_bucket(1, event_proj_org_b_1),
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
    def setUp(self) -> None:
        super().setUp()

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

    def archive_until_escalating(self, group: Group) -> None:
        group.status = GroupStatus.IGNORED
        group.substatus = GroupSubStatus.UNTIL_ESCALATING
        group.save()

    def assert_is_escalating(self, group: Group) -> None:
        assert group.substatus == GroupSubStatus.ESCALATING
        assert group.status == GroupStatus.UNRESOLVED
        assert GroupInbox.objects.filter(group=group).exists()

    @freeze_time(TIME_YESTERDAY)
    @patch("sentry.analytics.record")
    def test_is_escalating_issue(self, record_mock: MagicMock) -> None:
        """Test when an archived until escalating issue starts escalating"""
        with self.feature("organizations:escalating-issues"):
            # The group had 6 events today
            event = self._create_events_for_group(count=6)
            group_escalating = event.group
            self.archive_until_escalating(group_escalating)

            # The escalating forecast for today is 5
            forecast_values = [5] + [6] * 13
            self.save_mock_escalating_group_forecast(
                group=group_escalating, forecast_values=forecast_values, date_added=datetime.now()
            )
            group_is_escalating = is_escalating(group_escalating)
            assert group_is_escalating
            record_mock.assert_called_with(
                "issue.escalating",
                organization_id=group_escalating.project.organization.id,
                project_id=group_escalating.project.id,
                group_id=group_escalating.id,
            )
            self.assert_is_escalating(group_escalating)

            # Test cache
            assert (
                cache.get(f"daily-group-count:{group_escalating.project.id}:{group_escalating.id}")
                == 6
            )

    @freeze_time(TIME_YESTERDAY)
    def test_not_escalating_issue(self) -> None:
        """Test when an archived until escalating issue is not escalating"""
        with self.feature("organizations:escalating-issues"):
            # Group 1 had 4 events yesterday
            self._create_events_for_group(count=4, hours_ago=24)
            # Group 2 had 5 events today
            event = self._create_events_for_group(count=5, group="group-escalating")
            group = event.group
            self.archive_until_escalating(group)

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

    @freeze_time(TIME_YESTERDAY.replace(minute=12, second=40, microsecond=0))
    def test_hourly_count_query(self) -> None:
        """Test the hourly count query only aggregates events from within the current hour"""
        self._create_events_for_group(count=2, hours_ago=1)  # An hour ago -> It will not count
        self._create_events_for_group(count=1)  # This hour -> It will count

        group = Group.objects.all()[0]

        # Events are aggregated in the daily count query by date rather than the last 24hrs
        assert get_group_hourly_count(group) == 1

        # It will not count because it has been cached for 60 seconds
        self._create_events_for_group(count=5)

        assert get_group_hourly_count(group) == 1
