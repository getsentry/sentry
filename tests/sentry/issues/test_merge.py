from datetime import datetime, timedelta
from typing import Any, List
from unittest.mock import patch

import pytest
import rest_framework

from sentry.issues.escalating import GroupsCountResponse
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.escalating_issues_alg import GroupCount, generate_issue_forecast
from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.issues.merge import handle_merge
from sentry.models import Activity, Group, GroupInboxReason, GroupStatus, add_group_to_inbox
from sentry.tasks.merge import merge_groups
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType


class HandleIssueMergeTest(TestCase):
    def setUp(self) -> None:
        self.groups = []
        self.project_lookup = {self.project.id: self.project}
        for _ in range(5):
            group = self.create_group()
            add_group_to_inbox(group, GroupInboxReason.NEW)
            self.groups.append(group)

    def mock_get_query_past_counts(
        self, groups: List[Group], start_time: datetime, count: int = 200, num_days=8
    ) -> List[GroupsCountResponse]:
        """
        Return a mock past counts query response with count events per day for the past num_days.
        """
        mock_past_counts = []
        for group in groups:
            for i in range(num_days, -1, -1):
                past_count: GroupsCountResponse = {
                    "project_id": self.project.id,
                    "group_id": group.id,
                    "hourBucket": (start_time - timedelta(i)).strftime("%Y-%m-%dT%H:%M:%S%f%z")
                    + "+00:00",
                    "count()": count,
                }
                mock_past_counts.append(past_count)
        return mock_past_counts

    def get_expected_primary_group_forecast(
        self, start_time: datetime, num_groups: int, count: int = 200, num_days=8
    ) -> List[int]:
        """
        Return the expected primary group forecast, given the number of merged groups, event count,
        and number of days.
        """
        intervals = []
        data = []
        for i in range(num_days, -1, -1):
            intervals.append(
                (start_time - timedelta(i)).strftime("%Y-%m-%dT%H:%M:%S%f%z") + "+00:00"
            )
            data.append(count * num_groups)
        merged_past_counts: GroupCount = {"intervals": intervals, "data": data}
        primary_group_forecast = generate_issue_forecast(merged_past_counts, start_time)
        return [forecast["forecasted_value"] for forecast in primary_group_forecast]

    @patch("sentry.tasks.merge.merge_groups.delay")
    def test_handle_merge(self, merge_groups: Any) -> None:
        Activity.objects.all().delete()
        merge = handle_merge(self.groups, self.project_lookup, self.user)

        statuses = Group.objects.filter(id__in=[g.id for g in self.groups]).values_list("status")
        statuses = [status[0] for status in statuses]
        assert statuses.count(GroupStatus.PENDING_MERGE) == 4
        assert merge_groups.called

        primary_group = self.groups[-1]
        assert Activity.objects.filter(type=ActivityType.MERGE.value, group=primary_group)
        assert merge["parent"] == str(primary_group.id)
        assert len(merge["children"]) == 4

    def test_handle_merge_performance_issues(self) -> None:
        group = Group.objects.create(
            project=self.project, type=PerformanceNPlusOneGroupType.type_id
        )
        add_group_to_inbox(group, GroupInboxReason.NEW)
        self.groups.append(group)

        with pytest.raises(rest_framework.exceptions.ValidationError) as e:
            handle_merge(self.groups, self.project_lookup, self.user)
            assert e.match("Only error issues can be merged.")

    @with_feature("organizations:escalating-issues-v2")
    @patch("sentry.tasks.merge.merge_groups.delay", wraps=merge_groups)  # call immediately
    def test_handle_merge_deletes_forecast(self, merge_groups: Any) -> None:
        """
        Test that if the primary issue is not until_escalating, then all forecasts are deleted.
        """
        Activity.objects.all().delete()
        project = list(self.project_lookup.values())[0]
        for i in range(10, 60):
            i_str = str(i)
            event_primary = self.store_event(
                data={
                    "event_id": i_str * 16,
                    "timestamp": iso_format(before_now(seconds=1)),
                    "fingerprint": ["group-1"],
                    "tags": {"foo": "bar"},
                    "environment": self.environment.name,
                },
                project_id=project.id,
            )

        for i in range(60, 90):
            i_str = str(i)
            event_child = self.store_event(
                data={
                    "event_id": i_str * 16,
                    "timestamp": iso_format(before_now(seconds=1)),
                    "fingerprint": ["group-2"],
                    "tags": {"foo": "bar"},
                    "environment": self.environment.name,
                },
                project_id=project.id,
            )

        primary = event_primary.group
        child = event_child.group

        if primary and child:
            generate_and_save_forecasts([primary, child])
            for group in [primary, child]:
                assert EscalatingGroupForecast.fetch(group.project.id, group.id) is not None

            handle_merge([primary, child], self.project_lookup, self.user)

            for group in [primary, child]:
                assert EscalatingGroupForecast.fetch(group.project.id, group.id) is None
