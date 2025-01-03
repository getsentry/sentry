from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from unittest import mock
from unittest.mock import patch
from uuid import uuid4

import pytest

from sentry.eventstore.models import Event
from sentry.issues.escalating import (
    GroupsCountResponse,
    _start_and_end_dates,
    get_group_hourly_count,
    is_escalating,
    query_groups_past_counts,
)
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.grouptype import GroupCategory, ProfileFileIOGroupType
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInbox
from sentry.sentry_metrics.client.snuba import build_mri
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.cases import BaseMetricsTestCase, PerformanceIssueTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.group import GroupSubStatus
from sentry.utils.cache import cache
from sentry.utils.snuba import to_start_of_hour
from tests.sentry.issues.test_utils import SearchIssueTestMixin

pytestmark = pytest.mark.sentry_metrics

TIME_YESTERDAY = (datetime.now() - timedelta(hours=24)).replace(hour=6)


class BaseGroupCounts(BaseMetricsTestCase, TestCase):
    def _create_events_for_group(
        self,
        project_id: int | None = None,
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
        data: dict[str, Any] = {"message": "some message", "fingerprint": [group]}

        assert count >= 1
        for _ in range(count):
            data["timestamp"] = (
                datetime_reset_zero - timedelta(hours=hours_ago, minutes=min_ago)
            ).timestamp()
            data["event_id"] = uuid4().hex
            # assert_no_errors is necessary because of SDK and server time differences due to freeze gun
            last_event = self.store_event(data=data, project_id=proj_id, assert_no_errors=False)

            self.store_metric(
                org_id=last_event.project.organization_id,
                project_id=last_event.project.id,
                mri=build_mri("event_ingested", "c", UseCaseID.ESCALATING_ISSUES, None),
                value=1,
                tags={"group": str(last_event.group_id)},
                timestamp=data["timestamp"],
            )

        return last_event


class HistoricGroupCounts(
    BaseGroupCounts,
    PerformanceIssueTestCase,
    SearchIssueTestMixin,
):
    """Test that querying Snuba for the hourly counts for groups works as expected."""

    def _create_hourly_bucket(self, count: int, event: Event) -> GroupsCountResponse:
        """It simplifies writing the expected data structures"""
        assert event.group_id is not None
        return {
            "count()": count,
            "group_id": event.group_id,
            "hourBucket": str(to_start_of_hour(event.datetime)),
            "project_id": event.project_id,
        }

    def test_query_single_group(self) -> None:
        event = self._create_events_for_group()
        assert query_groups_past_counts(Group.objects.all()) == [
            self._create_hourly_bucket(1, event)
        ]

    @freeze_time(TIME_YESTERDAY)
    def test_query_different_group_categories(self) -> None:
        from django.utils import timezone

        timestamp = timezone.now() - timedelta(minutes=1)
        # This builds an error group and a profiling group
        profile_error_event, _, profile_issue_occurrence = self.store_search_issue(
            project_id=self.project.id,
            user_id=0,
            fingerprints=[f"{ProfileFileIOGroupType.type_id}-group1"],
            insert_time=timestamp,
        )
        self.store_metric(
            org_id=profile_error_event.project.organization_id,
            project_id=profile_error_event.project.id,
            mri=build_mri("event_ingested", "c", UseCaseID.ESCALATING_ISSUES, None),
            value=1,
            tags={"group": str(profile_error_event.group_id)},
            timestamp=profile_error_event.data["timestamp"],
        )

        assert profile_error_event.group is not None
        assert profile_issue_occurrence is not None
        assert len(Group.objects.all()) == 2

        perf_event = self.create_performance_issue()
        error_event = self._create_events_for_group()
        assert perf_event.group is not None
        assert error_event.group is not None

        # store_search_issue created two groups
        assert len(Group.objects.all()) == 4
        assert profile_error_event.group.issue_category == GroupCategory.ERROR
        assert error_event.group.issue_category == GroupCategory.ERROR
        assert profile_issue_occurrence.group.issue_category == GroupCategory.PERFORMANCE
        assert perf_event.group.issue_category == GroupCategory.PERFORMANCE

        profile_issue_occurrence_bucket = {
            "count()": 1,
            "group_id": profile_issue_occurrence.group.id,
            "hourBucket": to_start_of_hour(profile_issue_occurrence.group.first_seen),
            "project_id": self.project.id,
        }

        # Error groups will show up at the beginning of the list even if they
        # were created later
        assert query_groups_past_counts(Group.objects.all()) == [
            self._create_hourly_bucket(1, profile_error_event),
            self._create_hourly_bucket(1, error_event),
            profile_issue_occurrence_bucket,
            self._create_hourly_bucket(1, perf_event),
        ]

    # This forces to test the iteration over the Snuba data
    @mock.patch("sentry.issues.escalating.ELEMENTS_PER_SNUBA_PAGE", new=4)
    def test_pagination(self) -> None:
        events = []
        for i in range(20):
            event = self._create_events_for_group(count=1, hours_ago=2, group=f"group-{i}")
            events.append(event)

        assert query_groups_past_counts(Group.objects.all()) == [
            self._create_hourly_bucket(1, event) for event in events
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
        with (
            patch("sentry.issues.escalating._query_with_pagination") as query_mock,
            patch("sentry.issues.escalating.ELEMENTS_PER_SNUBA_PAGE", new=3),
            patch("sentry.issues.escalating.BUCKETS_PER_GROUP", new=2),
        ):
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

        event1 = self._create_events_for_group(project_id=proj_a.id, hours_ago=1)
        event_proj_org_b_1 = self._create_events_for_group(project_id=proj_b.id, hours_ago=1)

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
    def save_mock_escalating_group_forecast(
        self, group: Group, forecast_values: list[int], date_added: datetime
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

    @freeze_time(TIME_YESTERDAY)
    def test_is_escalating_issue(self) -> None:
        """Test when an archived until escalating issue starts escalating"""
        # The group had 6 events in the last hour
        event = self._create_events_for_group(count=6)
        assert event.group is not None
        archived_group = event.group
        self.archive_until_escalating(archived_group)

        # The escalating forecast for today is 5, thus, it should escalate
        forecast_values = [5] + [6] * 13
        self.save_mock_escalating_group_forecast(
            group=archived_group, forecast_values=forecast_values, date_added=datetime.now()
        )
        assert is_escalating(archived_group) == (True, 5)

        # Test cache
        assert cache.get(f"hourly-group-count:{archived_group.project.id}:{archived_group.id}") == 6

    @freeze_time(TIME_YESTERDAY)
    def test_not_escalating_issue(self) -> None:
        """Test when an archived until escalating issue is not escalating"""
        # Group 1 had 4 events yesterday
        self._create_events_for_group(count=4, hours_ago=24)
        # Group 2 had 5 events today
        event = self._create_events_for_group(count=5, group="group-escalating")
        assert event.group is not None
        group = event.group
        self.archive_until_escalating(group)

        # The escalating forecast for today is 6 (since date_added was one day ago)
        forecast_values = [5] + [6] * 13
        self.save_mock_escalating_group_forecast(
            group=group,
            forecast_values=forecast_values,
            date_added=datetime.now() - timedelta(days=1),
        )
        assert is_escalating(group) == (False, None)
        assert group.substatus == GroupSubStatus.UNTIL_ESCALATING
        assert group.status == GroupStatus.IGNORED
        assert not GroupInbox.objects.filter(group=group).exists()

    @freeze_time(TIME_YESTERDAY.replace(minute=12, second=40, microsecond=0))
    def test_hourly_count_query(self) -> None:
        """Test the hourly count query only aggregates events from within the current hour"""
        self._create_events_for_group(count=2, hours_ago=1)  # An hour ago -> It will not count
        group = self._create_events_for_group(count=1).group  # This hour -> It will count
        assert group is not None

        # Events are aggregated in the hourly count query by date rather than the last 24hrs
        assert get_group_hourly_count(group) == 1

    @freeze_time(TIME_YESTERDAY)
    def test_is_forecast_out_of_range(self) -> None:
        """
        Test that when an archived until escalating issue does not have a forecast that is in range,
        the last forecast is used as a fallback and an error is reported
        """
        with patch("sentry.issues.escalating_group_forecast.logger") as logger:
            event = self._create_events_for_group(count=2)
            assert event.group is not None
            archived_group = event.group
            self.archive_until_escalating(archived_group)

            # The escalating forecast was added 15 days ago, and thus is out of the 14 day range
            forecast_values = [10] * 13 + [1]
            self.save_mock_escalating_group_forecast(
                group=archived_group,
                forecast_values=forecast_values,
                date_added=datetime.now() - timedelta(15),
            )
            assert is_escalating(archived_group) == (True, 1)
            logger.error.assert_called_once()

    @freeze_time(TIME_YESTERDAY)
    def test_is_escalating_two_weeks(self) -> None:
        """
        Test when an archived until escalating issue starts escalating after exactly 2 weeks.
        This can happen when the previous nodestore forecast hasn't expired yet.
        """
        # The group had 6 events in the last hour
        event = self._create_events_for_group(count=6)
        assert event.group is not None
        archived_group = event.group
        self.archive_until_escalating(archived_group)

        # The escalating forecast for today is 5, thus, it should escalate
        forecast_values = [5] * 14
        self.save_mock_escalating_group_forecast(
            group=archived_group,
            forecast_values=forecast_values,
            date_added=TIME_YESTERDAY - timedelta(days=14),
        )
        assert is_escalating(archived_group) == (True, 5)

        # Test cache
        assert cache.get(f"hourly-group-count:{archived_group.project.id}:{archived_group.id}") == 6
