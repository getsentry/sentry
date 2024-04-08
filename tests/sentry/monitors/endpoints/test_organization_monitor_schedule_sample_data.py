from __future__ import annotations

import zoneinfo
from datetime import datetime

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


class SampleScheduleDataTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitors-schedule-sample-data"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @freeze_time("2023-10-26T12:32:25Z")
    def test_simple_crontab(self):

        expected_ticks = [
            int(datetime(2023, 10, 26, 13, 00).timestamp()),
            int(datetime(2023, 10, 26, 14, 00).timestamp()),
            int(datetime(2023, 10, 26, 15, 00).timestamp()),
            int(datetime(2023, 10, 26, 16, 00).timestamp()),
            int(datetime(2023, 10, 26, 17, 00).timestamp()),
        ]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"num_ticks": 5, "schedule_type": "crontab", "schedule": "0 * * * *"},
        )
        assert response.data == expected_ticks

    @freeze_time("2023-10-26T12:32:25Z")
    def test_crontab_with_timezone(self):
        tz = "US/Pacific"
        zone = zoneinfo.ZoneInfo(tz)

        expected_ticks = [
            int(datetime(2023, 10, 27, 00, 00, tzinfo=zone).timestamp()),
            int(datetime(2023, 10, 28, 00, 00, tzinfo=zone).timestamp()),
            int(datetime(2023, 10, 29, 00, 00, tzinfo=zone).timestamp()),
            int(datetime(2023, 10, 30, 00, 00, tzinfo=zone).timestamp()),
            int(datetime(2023, 10, 31, 00, 00, tzinfo=zone).timestamp()),
        ]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "num_ticks": 5,
                "schedule_type": "crontab",
                "schedule": "0 0 * * *",
                "timezone": tz,
            },
        )
        assert response.data == expected_ticks

    @freeze_time("2023-10-26T12:32:25Z")
    def test_simple_interval(self):
        expected_ticks = [
            int(datetime(2023, 10, 26, 12, 00).timestamp()),
            int(datetime(2023, 10, 26, 13, 00).timestamp()),
            int(datetime(2023, 10, 26, 14, 00).timestamp()),
            int(datetime(2023, 10, 26, 15, 00).timestamp()),
            int(datetime(2023, 10, 26, 16, 00).timestamp()),
        ]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "num_ticks": 5,
                "schedule_type": "interval",
                "schedule": [1, "hour"],
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
            qs_params={"schedule_type": "crontab", "schedule": "0 * * * *"},
            status_code=400,
        )

        # Invalid schedule info
        self.get_error_response(
            self.organization.slug,
            qs_params={"schedule_type": "interval", "schedule": "* * * * *"},
            status_code=400,
        )
        self.get_error_response(
            self.organization.slug,
            qs_params={"schedule_type": "crontab"},
            status_code=400,
        )

    def test_bad_params(self):
        # Invalid crontab schedule
        self.get_error_response(
            self.organization.slug,
            qs_params={"num_ticks": 5, "schedule_type": "crontab", "schedule": "0 * * *"},
            status_code=400,
        )

        # Invalid interval unit
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "numTicks": 5,
                "scheduleType": "interval",
                "intervalUnit": "second",
                "intervalFrequency": "1",
            },
            status_code=400,
        )

        # Invalid interval frequency
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "numTicks": 5,
                "scheduleType": "interval",
                "intervalUnit": "month",
                "intervalFrequency": "-1",
            },
            status_code=400,
        )
