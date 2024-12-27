from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from sentry.grouping.types import ErrorGroupType
from sentry.issues.escalating_group_forecast import ONE_EVENT_FORECAST, EscalatingGroupForecast
from sentry.issues.grouptype import PerformanceP95EndpointRegressionGroupType
from sentry.models.group import Group, GroupStatus
from sentry.tasks.weekly_escalating_forecast import run_escalating_forecast
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.types.group import GroupSubStatus
from tests.sentry.issues.test_utils import get_mock_groups_past_counts_response


class TestWeeklyEscalatingForecast(APITestCase, SnubaTestCase):
    def create_archived_until_escalating_groups(
        self, num_groups: int, group_type: int = ErrorGroupType.type_id
    ) -> list[Group]:
        group_list = []
        project_1 = self.project
        for i in range(num_groups):
            group = self.create_group(project=project_1, type=group_type)
            group.status = GroupStatus.IGNORED
            group.substatus = GroupSubStatus.UNTIL_ESCALATING
            group.save()
            group_list.append(group)
        return group_list

    @patch("sentry.issues.forecasts.generate_and_save_missing_forecasts.delay")
    @patch("sentry.issues.escalating.query_groups_past_counts")
    def test_empty_escalating_forecast(
        self,
        mock_query_groups_past_counts: MagicMock,
        mock_generate_and_save_missing_forecasts: MagicMock,
    ) -> None:
        """
        Test that when fetch is called and the issue has no forecast, the forecast for one
        event/hr is returned, and the forecast is regenerated.
        """
        with self.tasks():
            group_list = self.create_archived_until_escalating_groups(num_groups=1)

            mock_query_groups_past_counts.return_value = {}

            run_escalating_forecast()
            group = group_list[0]
            fetched_forecast = EscalatingGroupForecast.fetch(group.project.id, group.id)
            assert fetched_forecast and fetched_forecast.forecast == ONE_EVENT_FORECAST
        assert mock_generate_and_save_missing_forecasts.call_count == 1

    @patch("sentry.issues.forecasts.generate_and_save_missing_forecasts.delay")
    @patch("sentry.issues.escalating.query_groups_past_counts")
    def test_empty_sd_escalating_forecast(
        self,
        mock_query_groups_past_counts: MagicMock,
        mock_generate_and_save_missing_forecasts: MagicMock,
    ) -> None:
        """
        Test that when fetch is called and the issue does not have esalation detection enabled, the forecast is None.
        """
        with self.tasks():
            group_list = self.create_archived_until_escalating_groups(
                num_groups=1, group_type=PerformanceP95EndpointRegressionGroupType.type_id
            )

            mock_query_groups_past_counts.return_value = {}

            run_escalating_forecast()
            group = group_list[0]
            fetched_forecast = EscalatingGroupForecast.fetch(group.project.id, group.id)
            assert fetched_forecast is None
        assert mock_generate_and_save_missing_forecasts.call_count == 0

    @patch("sentry.analytics.record")
    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_single_group_escalating_forecast(
        self,
        mock_query_groups_past_counts: MagicMock,
        record_mock: MagicMock,
    ) -> None:
        with self.tasks():
            group_list = self.create_archived_until_escalating_groups(num_groups=1)

            mock_query_groups_past_counts.return_value = get_mock_groups_past_counts_response(
                num_days=7, num_hours=1, groups=group_list
            )

            run_escalating_forecast()
            approximate_date_added = datetime.now(timezone.utc)
            fetched_forecast = EscalatingGroupForecast.fetch(
                group_list[0].project.id, group_list[0].id
            )
            assert fetched_forecast is not None
            assert fetched_forecast.project_id == group_list[0].project.id
            assert fetched_forecast.group_id == group_list[0].id
            assert fetched_forecast.forecast == [100] * 14
            assert fetched_forecast.date_added.replace(
                second=0, microsecond=0
            ) == approximate_date_added.replace(second=0, microsecond=0)
            assert fetched_forecast.date_added < approximate_date_added
            record_mock.assert_called_with("issue_forecasts.saved", num_groups=1)

    @patch("sentry.analytics.record")
    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_single_sd_group_escalating_forecast(
        self,
        mock_query_groups_past_counts: MagicMock,
        record_mock: MagicMock,
    ) -> None:
        with self.tasks():
            group_list = self.create_archived_until_escalating_groups(
                num_groups=1, group_type=PerformanceP95EndpointRegressionGroupType.type_id
            )

            mock_query_groups_past_counts.return_value = get_mock_groups_past_counts_response(
                num_days=7, num_hours=1, groups=group_list
            )

            run_escalating_forecast()

            fetched_forecast = EscalatingGroupForecast.fetch(
                group_list[0].project.id, group_list[0].id
            )

            assert fetched_forecast is None
            self.assertNotIn("issue_forecasts.saved", record_mock.call_args)

    @patch("sentry.analytics.record")
    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_multiple_groups_escalating_forecast(
        self,
        mock_query_groups_past_counts: MagicMock,
        record_mock: MagicMock,
    ) -> None:
        with self.tasks():
            group_list = self.create_archived_until_escalating_groups(num_groups=3)

            mock_query_groups_past_counts.return_value = get_mock_groups_past_counts_response(
                num_days=7, num_hours=23, groups=group_list
            )

            run_escalating_forecast()
            approximate_date_added = datetime.now(timezone.utc)
            for i in range(len(group_list)):
                fetched_forecast = EscalatingGroupForecast.fetch(
                    group_list[i].project.id, group_list[i].id
                )
                assert fetched_forecast is not None
                assert fetched_forecast.project_id == group_list[i].project.id
                assert fetched_forecast.group_id == group_list[i].id
                assert fetched_forecast.forecast == [100] * 14
                assert fetched_forecast.date_added.replace(
                    second=0, microsecond=0
                ) == approximate_date_added.replace(second=0, microsecond=0)
                assert fetched_forecast.date_added < approximate_date_added
                record_mock.assert_called_with("issue_forecasts.saved", num_groups=3)

    @patch("sentry.analytics.record")
    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_multiple_sd_groups_escalating_forecast(
        self,
        mock_query_groups_past_counts: MagicMock,
        record_mock: MagicMock,
    ) -> None:
        with self.tasks():
            group_list = self.create_archived_until_escalating_groups(
                num_groups=3, group_type=PerformanceP95EndpointRegressionGroupType.type_id
            )

            mock_query_groups_past_counts.return_value = get_mock_groups_past_counts_response(
                num_days=7, num_hours=23, groups=group_list
            )

            run_escalating_forecast()
            for i in range(len(group_list)):
                fetched_forecast = EscalatingGroupForecast.fetch(
                    group_list[i].project.id, group_list[i].id
                )
                assert fetched_forecast is None

                self.assertNotIn("issue_forecasts.saved", record_mock.call_args)

    @patch("sentry.analytics.record")
    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_update_group_escalating_forecast(
        self,
        mock_query_groups_past_counts: MagicMock,
        record_mock: MagicMock,
    ) -> None:
        with self.tasks():
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
            record_mock.assert_called_with("issue_forecasts.saved", num_groups=1)

    @patch("sentry.analytics.record")
    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_update_sd_group_escalating_forecast(
        self,
        mock_query_groups_past_counts: MagicMock,
        record_mock: MagicMock,
    ) -> None:
        with self.tasks():
            group_list = self.create_archived_until_escalating_groups(
                num_groups=1, group_type=PerformanceP95EndpointRegressionGroupType.type_id
            )

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
            assert first_fetched_forecast is None
            assert second_fetched_forecast is None

            self.assertNotIn("issue_forecasts.saved", record_mock.call_args)
