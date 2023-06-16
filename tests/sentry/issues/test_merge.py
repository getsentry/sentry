from datetime import datetime, timedelta
from typing import Any, List
from unittest.mock import Mock, patch

import pytest
import rest_framework

from sentry.issues.escalating import GroupsCountResponse, parse_groups_past_counts
from sentry.issues.escalating_group_forecast import (
    DEFAULT_MINIMUM_CEILING_FORECAST,
    EscalatingGroupForecast,
)
from sentry.issues.escalating_issues_alg import GroupCount, generate_issue_forecast
from sentry.issues.forecasts import save_forecast_per_group
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.issues.merge import handle_merge
from sentry.models import Activity, Group, GroupInboxReason, GroupStatus, add_group_to_inbox
from sentry.tasks.merge import merge_groups
from sentry.testutils import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


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
    @patch("sentry.tasks.merge.query_groups_past_counts")
    def test_handle_merge_recomputes_forecast(
        self, mock_query_past_counts: Mock, merge_groups: Any
    ) -> None:
        """
        Test that if the primary group is until_escalating, then the forecast is recomputed based
        on the merged issue and the other forecasts are deleted.
        """
        primary_group = self.create_group()
        primary_group.status = GroupStatus.IGNORED
        primary_group.substatus = GroupSubStatus.UNTIL_ESCALATING
        primary_group.save()
        groups = self.groups
        groups.append(primary_group)

        now = datetime.now()
        mock_past_counts = self.mock_get_query_past_counts(groups, now)
        group_counts = parse_groups_past_counts(mock_past_counts)
        save_forecast_per_group(groups, group_counts)

        mock_query_past_counts.return_value = mock_past_counts
        handle_merge(groups, self.project_lookup, self.user)

        primary_group_forecast = EscalatingGroupForecast.fetch(
            primary_group.project.id, primary_group.id
        ).forecast
        expected_primary_group_forecast = self.get_expected_primary_group_forecast(
            start_time=now, num_groups=len(groups)
        )
        assert expected_primary_group_forecast == primary_group_forecast

        for group in groups[:-1]:  # exclude the primary issue
            # assert that the escalating group forecast is the default (ie. not gotten from nodestore)
            assert (
                EscalatingGroupForecast.fetch(group.project.id, group.id).forecast
                == DEFAULT_MINIMUM_CEILING_FORECAST
            )

    @with_feature("organizations:escalating-issues-v2")
    @patch("sentry.tasks.merge.merge_groups.delay", wraps=merge_groups)  # call immediately
    @patch("sentry.tasks.merge.query_groups_past_counts")
    def test_handle_merge_deletes_forecast(
        self, mock_query_past_counts: Mock, merge_groups: Any
    ) -> None:
        """
        Test that if the primary issue is not until_escalating, then all forecasts are deleted.
        """
        primary_group = self.create_group()
        groups = self.groups
        mock_past_counts = self.mock_get_query_past_counts(groups, datetime.now())
        group_counts = parse_groups_past_counts(mock_past_counts)
        save_forecast_per_group(groups, group_counts)

        mock_query_past_counts.return_value = mock_past_counts
        groups.append(primary_group)
        handle_merge(groups, self.project_lookup, self.user)

        for group in groups:
            # assert that the escalating group forecast is the default (ie. not gotten from nodestore)
            assert (
                EscalatingGroupForecast.fetch(group.project.id, group.id).forecast
                == DEFAULT_MINIMUM_CEILING_FORECAST
            )
