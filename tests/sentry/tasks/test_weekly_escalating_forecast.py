import random
from datetime import datetime, timedelta
from typing import List
from unittest.mock import patch

from sentry.issues.escalating import GroupsCountResponse
from sentry.models.group import Group, GroupStatus, GroupSubStatus
from sentry.models.groupforecast import GroupForecast
from sentry.models.project import Project
from sentry.tasks.weekly_escalating_forecast import run_escalating_forecast
from sentry.testutils.cases import APITestCase, SnubaTestCase


class TestWeeklyEscalatingForecast(APITestCase, SnubaTestCase):
    def get_mock_groups_past_counts_response(
        self, num_days: int, num_hours: int, groups: List[Group]
    ) -> GroupsCountResponse:
        """
        Returns a mocked response of type `GroupsCountResponse` from `query_groups_past_counts`.
        Creates event count data for each group in `groups` for `num_days`, for `num_hours`.

        `groups`: The groups that data will be generated for
        `num_days`: The number of days that data will be generated for
        `num_hours`: The number of hours per day that data will be generated for
        """
        data = []
        now = datetime.now()

        for group in groups:
            for day in range(num_days, 0, -1):
                time = now - timedelta(days=day)

                for hour in range(num_hours, 0, -1):
                    hourly_time = time - timedelta(hours=hour)
                    data.append(
                        {
                            "group_id": group.id,
                            "hourBucket": hourly_time.strftime("%Y-%m-%dT%H:%M:%S%f") + "+00:00",
                            "count()": random.randint(1, 10),
                        }
                    )
        return data

    def create_archived_until_escalating_groups(self, num_groups: int) -> List[Group]:
        group_list = []
        project_1 = Project.objects.get(id=1)
        for i in range(num_groups):
            group = self.create_group(project=project_1)
            group.status = GroupStatus.IGNORED
            group.substatus = GroupSubStatus.UNTIL_ESCALATING
            group.save()
            group_list.append(group)
        return group_list

    @patch("sentry.tasks.weekly_escalating_forecast.query_groups_past_counts")
    def test_single_group_escalating_forecast(self, mock_query_groups_past_counts):
        group_list = self.create_archived_until_escalating_groups(num_groups=1)

        mock_query_groups_past_counts.return_value = self.get_mock_groups_past_counts_response(
            num_days=7, num_hours=1, groups=group_list
        )

        run_escalating_forecast()
        group_forecast = GroupForecast.objects.all()
        assert len(group_forecast) == 1
        assert group_forecast[0].group == group_list[0]

    @patch("sentry.tasks.weekly_escalating_forecast.query_groups_past_counts")
    def test_multiple_groups_escalating_forecast(self, mock_query_groups_past_counts):
        group_list = self.create_archived_until_escalating_groups(num_groups=3)

        mock_query_groups_past_counts.return_value = self.get_mock_groups_past_counts_response(
            num_days=7, num_hours=23, groups=group_list
        )

        run_escalating_forecast()
        group_forecast = GroupForecast.objects.all()
        assert len(group_forecast) == 3
        for i in range(len(group_forecast)):
            assert group_forecast[i].group in group_list

    @patch("sentry.tasks.weekly_escalating_forecast.query_groups_past_counts")
    def test_no_duped_groups_escalating_forecast(self, mock_query_groups_past_counts):
        group_list = self.create_archived_until_escalating_groups(num_groups=3)

        mock_query_groups_past_counts.return_value = self.get_mock_groups_past_counts_response(
            num_days=7, num_hours=2, groups=group_list
        )

        run_escalating_forecast()
        group_forecast = GroupForecast.objects.all()
        assert len(group_forecast) == 3
        for i in range(len(group_forecast)):
            assert group_forecast[i].group in group_list

        # Assert no duplicates when this is run twice
        run_escalating_forecast()
        group_forecast = GroupForecast.objects.all()
        assert len(group_forecast) == 3
        for i in range(len(group_forecast)):
            assert group_forecast[i].group in group_list
