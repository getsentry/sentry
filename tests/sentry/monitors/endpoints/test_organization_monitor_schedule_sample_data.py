from __future__ import annotations

from datetime import datetime
from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class SampleScheduleDataTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitors-schedule-sample-data"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @patch("django.utils.timezone.now")
    def test_simple_crontab(self, mock_now):
        mock_now.return_value = datetime(2023, 10, 26, 12, 32)

        expected_ticks = [
            datetime(2023, 10, 26, 13, 00),
            datetime(2023, 10, 26, 14, 00),
            datetime(2023, 10, 26, 15, 00),
            datetime(2023, 10, 26, 16, 00),
            datetime(2023, 10, 26, 17, 00),
        ]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"numTicks": 5, "scheduleType": "crontab", "cronSchedule": "0 * * * *"},
        )
        assert response.data == expected_ticks

    @patch("django.utils.timezone.now")
    def test_simple_interval(self, mock_now):
        mock_now.return_value = datetime(2023, 10, 26, 12, 32)

        expected_ticks = [
            datetime(2023, 10, 26, 12, 00),
            datetime(2023, 10, 26, 13, 00),
            datetime(2023, 10, 26, 14, 00),
            datetime(2023, 10, 26, 15, 00),
            datetime(2023, 10, 26, 16, 00),
        ]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "numTicks": 5,
                "scheduleType": "interval",
                "frequency": "hour",
                "interval": 1,
            },
        )
        assert response.data == expected_ticks

    def test_missing_params(self):
        # No params
        self.get_error_response(
            self.organization.slug,
            qs_params={},
            status_code=400,
        )

        # Missing num ticks
        self.get_error_response(
            self.organization.slug,
            qs_params={"scheduleType": "crontab", "cronSchedule": "0 * * * *"},
            status_code=400,
        )

        # Missing schedule info
        self.get_error_response(
            self.organization.slug,
            qs_params={"scheduleType": "interval", "cronSchedule": "0 * * * *"},
            status_code=400,
        )
        self.get_error_response(
            self.organization.slug,
            qs_params={"scheduleType": "crontab"},
            status_code=400,
        )
