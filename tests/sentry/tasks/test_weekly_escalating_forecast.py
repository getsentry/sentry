from datetime import datetime
from typing import List
from unittest.mock import MagicMock, patch

import pytz

from sentry.issues.escalating_group_forecast import (
    DEFAULT_MINIMUM_CEILING_FORECAST,
    EscalatingGroupForecast,
)
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.tasks.weekly_escalating_forecast import run_escalating_forecast
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.types.group import GroupSubStatus
from tests.sentry.issues.test_utils import get_mock_groups_past_counts_response


class TestWeeklyEscalatingForecast(APITestCase, SnubaTestCase):  # type: ignore
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

    @patch("sentry.issues.escalating.query_groups_past_counts")
    def test_empty_escalating_forecast(self, mock_query_groups_past_counts: MagicMock) -> None:
        group_list = self.create_archived_until_escalating_groups(num_groups=1)

        mock_query_groups_past_counts.return_value = {}

        run_escalating_forecast()
        fetched_forecast = EscalatingGroupForecast.fetch(group_list[0].project.id, group_list[0].id)
        assert fetched_forecast is not None
        assert fetched_forecast.project_id == group_list[0].project.id
        assert fetched_forecast.group_id == group_list[0].id
        assert fetched_forecast.forecast == DEFAULT_MINIMUM_CEILING_FORECAST

    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_single_group_escalating_forecast(
        self, mock_query_groups_past_counts: MagicMock
    ) -> None:
        group_list = self.create_archived_until_escalating_groups(num_groups=1)

        mock_query_groups_past_counts.return_value = get_mock_groups_past_counts_response(
            num_days=7, num_hours=1, groups=group_list
        )

        run_escalating_forecast()
        approximate_date_added = datetime.now(pytz.utc)
        fetched_forecast = EscalatingGroupForecast.fetch(group_list[0].project.id, group_list[0].id)
        assert fetched_forecast is not None
        assert fetched_forecast.project_id == group_list[0].project.id
        assert fetched_forecast.group_id == group_list[0].id
        assert fetched_forecast.forecast == DEFAULT_MINIMUM_CEILING_FORECAST
        assert fetched_forecast.date_added.replace(
            second=0, microsecond=0
        ) == approximate_date_added.replace(second=0, microsecond=0)
        assert fetched_forecast.date_added < approximate_date_added

    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_multiple_groups_escalating_forecast(
        self, mock_query_groups_past_counts: MagicMock
    ) -> None:
        group_list = self.create_archived_until_escalating_groups(num_groups=3)

        mock_query_groups_past_counts.return_value = get_mock_groups_past_counts_response(
            num_days=7, num_hours=23, groups=group_list
        )

        run_escalating_forecast()
        approximate_date_added = datetime.now(pytz.utc)
        for i in range(len(group_list)):
            fetched_forecast = EscalatingGroupForecast.fetch(
                group_list[i].project.id, group_list[i].id
            )
            assert fetched_forecast is not None
            assert fetched_forecast.project_id == group_list[i].project.id
            assert fetched_forecast.group_id == group_list[i].id
            assert fetched_forecast.forecast == DEFAULT_MINIMUM_CEILING_FORECAST
            assert fetched_forecast.date_added.replace(
                second=0, microsecond=0
            ) == approximate_date_added.replace(second=0, microsecond=0)
            assert fetched_forecast.date_added < approximate_date_added

    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_update_group_escalating_forecast(
        self, mock_query_groups_past_counts: MagicMock
    ) -> None:
        group_list = self.create_archived_until_escalating_groups(num_groups=1)

        mock_query_groups_past_counts.return_value = get_mock_groups_past_counts_response(
            num_days=7, num_hours=2, groups=group_list
        )

        run_escalating_forecast()
        first_fetched_forecast = EscalatingGroupForecast.fetch(
            group_list[0].project.id, group_list[0].id
        )

        # Assert update when this is run twice
        run_escalating_forecast()
        second_fetched_forecast = EscalatingGroupForecast.fetch(
            group_list[0].project.id, group_list[0].id
        )
        assert first_fetched_forecast is not None
        assert second_fetched_forecast is not None
        assert first_fetched_forecast.date_added < second_fetched_forecast.date_added
