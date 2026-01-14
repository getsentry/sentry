from __future__ import annotations

import zoneinfo
from datetime import UTC, datetime, timedelta

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


class SampleScheduleWindowTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitors-schedule-sample-window"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    @freeze_time("2023-10-26T12:32:25Z")
    def test_simple_crontab(self) -> None:
        # failure=2, recovery=3 => total=5, padding=3, open=15, num_ticks=26
        failure_threshold = 2
        recovery_threshold = 3

        # date.now() rounded to the start of the hour
        expected_start = int(datetime(2023, 10, 26, 13, 0, tzinfo=UTC).timestamp())
        # end is expected_start + 25 hours (26 ticks - 1)
        expected_end = expected_start + int(timedelta(hours=25).total_seconds())

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "schedule": "0 * * * *",  # every hour
                "failure_issue_threshold": failure_threshold,
                "recovery_threshold": recovery_threshold,
            },
        )
        assert response.data == {"start": expected_start, "end": expected_end}

    @freeze_time("2023-10-26T12:32:25Z")
    def test_crontab_with_timezone(self) -> None:
        # failure=2, recovery=3 => total=5, padding=3, open=15, num_ticks=26
        failure_threshold = 2
        recovery_threshold = 3

        tz = "US/Pacific"
        zone = zoneinfo.ZoneInfo(tz)

        # date.now() rounded to the start of the hour
        expected_start = int(datetime(2023, 10, 27, 0, 0, tzinfo=zone).timestamp())
        # end is expected_start + 25 days (26 ticks - 1)
        expected_end = int(
            (datetime(2023, 10, 27, 0, 0, tzinfo=zone) + timedelta(days=25)).timestamp()
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "schedule": "0 0 * * *",  # daily at midnight
                "timezone": tz,
                "failure_issue_threshold": failure_threshold,
                "recovery_threshold": recovery_threshold,
            },
        )
        assert response.data == {"start": expected_start, "end": expected_end}

    @freeze_time("2023-10-26T12:32:25Z")
    def test_simple_interval(self) -> None:
        # failure=4, recovery=5 => total=9, padding=5, open=27, num_ticks=46
        failure_threshold = 4
        recovery_threshold = 5

        # date.now() rounded to the start of the hour
        expected_start = int(datetime(2023, 10, 26, 12, 0, tzinfo=UTC).timestamp())
        # end is expected_start + 45 hours (46 ticks - 1)
        expected_end = expected_start + int(timedelta(hours=45).total_seconds())

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "interval",
                "schedule": [1, "hour"],  # every hour
                "failure_issue_threshold": failure_threshold,
                "recovery_threshold": recovery_threshold,
            },
        )
        assert response.data == {"start": expected_start, "end": expected_end}

    def test_missing_params(self) -> None:
        # No params
        self.get_error_response(
            self.organization.slug,
            qs_params={},
            status_code=400,
        )

        # Missing schedule info
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
            },
            status_code=400,
        )
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
            },
            status_code=400,
        )

    def test_bad_params(self) -> None:
        # Invalid crontab schedule
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "schedule": "0 * * *",
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
            },
            status_code=400,
        )

        # Invalid interval unit
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "interval",
                "schedule": [1, "second"],
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
            },
            status_code=400,
        )

        # Invalid interval frequency
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "interval",
                "schedule": [-1, "month"],
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
            },
            status_code=400,
        )

        # Invalid thresholds
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "schedule": "0 * * * *",
                "failure_issue_threshold": -1,
                "recovery_threshold": 3,
            },
            status_code=400,
        )
