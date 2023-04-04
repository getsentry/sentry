import random
from datetime import datetime, timedelta
from typing import Any, Dict, List
from unittest.mock import patch

from sentry.models.group import Group, GroupStatus
from sentry.models.groupforecast import GroupForecast
from sentry.models.groupsnooze import GroupSnooze
from sentry.tasks.weekly_escalating_forecast import run_escalating_forecast
from sentry.testutils.cases import APITestCase, SnubaTestCase


class TestWeeklyEscalatingForecast(APITestCase, SnubaTestCase):
    def get_mock_response(
        self, num_days: int, num_hours: int, groups: List[Group]
    ) -> Dict[str, Any]:
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

    def create_groups(self, num_groups: int) -> List[Group]:
        group_list = []
        for i in range(num_groups):
            group = self.create_group()
            group.status = GroupStatus.IGNORED
            group.save()
            group_list.append(group)
        return group_list

    def snooze_groups(self, groups: List[Group]) -> None:
        for group in groups:
            group_snooze = GroupSnooze.objects.create(
                group=group,
                user_count=10,
                until=datetime.now() + timedelta(days=1),
                count=10,
                state={"times_seen": 0},
                until_escalating=True,
            )
            group_snooze.save()

    @patch("sentry.tasks.weekly_escalating_forecast.query_groups_past_counts")
    def test_single_group_escalating_forecast(self, mock_query_groups_past_counts):
        group_list = self.create_groups(1)

        self.snooze_groups(group_list)

        mock_query_groups_past_counts.return_value = self.get_mock_response(7, 1, group_list)

        run_escalating_forecast()
        group_forecast = GroupForecast.objects.all()
        assert len(group_forecast) == 1
        assert group_forecast[0].group == group_list[0]

    @patch("sentry.tasks.weekly_escalating_forecast.query_groups_past_counts")
    def test_multiple_groups_escalating_forecast(self, mock_query_groups_past_counts):
        group_list = self.create_groups(3)
        self.snooze_groups(group_list)

        mock_query_groups_past_counts.return_value = self.get_mock_response(7, 23, group_list)

        run_escalating_forecast()
        group_forecast = GroupForecast.objects.all()
        assert len(group_forecast) == 3
        for i in range(len(group_forecast)):
            assert group_forecast[i].group in group_list

    @patch("sentry.tasks.weekly_escalating_forecast.query_groups_past_counts")
    def test_ignored_groups_escalating_forecast(self, mock_query_groups_past_counts):
        group_list = self.create_groups(3)
        # The first group is just ignored, not archived
        self.snooze_groups(group_list[1:])

        mock_query_groups_past_counts.return_value = self.get_mock_response(7, 1, group_list[1:])

        run_escalating_forecast()
        group_forecast = GroupForecast.objects.all()
        assert len(group_forecast) == 2
        for i in range(len(group_forecast)):
            assert group_forecast[i].group in group_list[1:]

    @patch("sentry.tasks.weekly_escalating_forecast.query_groups_past_counts")
    def test_no_duped_groups_escalating_forecast(self, mock_query_groups_past_counts):
        group_list = self.create_groups(3)
        self.snooze_groups(group_list)

        mock_query_groups_past_counts.return_value = self.get_mock_response(7, 2, group_list)

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
