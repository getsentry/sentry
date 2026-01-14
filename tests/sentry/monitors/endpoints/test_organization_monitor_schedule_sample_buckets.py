from __future__ import annotations

from datetime import UTC, datetime

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


class SampleScheduleBucketsTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitors-schedule-sample-buckets"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    @freeze_time("2023-10-26T12:32:25Z")
    def test_simple_crontab_resolution_matches_bucket_interval(self) -> None:
        start = int(datetime(2023, 10, 26, 13, 0, tzinfo=UTC).timestamp())
        # 26 ticks at 1-hour intervals => window duration is 25 hours
        # (inclusive)
        end = start + 25 * 3600

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "schedule": "0 * * * *",  # every hour
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
                # First tick after 12:00Z (rounded hour) is 13:00Z
                "start": start,
                "end": end,
                "interval": 3600,
            },
        )

        buckets = response.data

        assert len(buckets) == 26

        # Check that timestamps increment by the schedule interval
        for i in range(26):
            assert buckets[i][0] == start + i * 3600

        # First 3 padding ticks are OK
        for i in range(0, 3):
            assert buckets[i][1] == {"ok": 1}

        # Next 2 are sub-failure errors (failure threshold)
        for i in range(3, 5):
            assert buckets[i][1] == {"sub_failure_error": 1}

        # Next 15 are ERROR (open period)
        for i in range(5, 20):
            assert buckets[i][1] == {"error": 1}

        # Next 3 are sub-recovery OKs (recovery threshold)
        for i in range(20, 23):
            assert buckets[i][1] == {"sub_recovery_ok": 1}

        # Next 3 padding ticks are OK
        for i in range(23, 26):
            assert buckets[i][1] == {"ok": 1}

    @freeze_time("2023-10-26T12:32:25Z")
    def test_simple_interval_resolution_matches_bucket_interval(self) -> None:
        start = int(datetime(2023, 10, 26, 12, 0, tzinfo=UTC).timestamp())
        interval = 3600
        end = start + 25 * interval

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "interval",
                "schedule": [1, "hour"],  # every hour
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
                "start": start,
                "end": end,
                "interval": interval,
            },
        )

        buckets = response.data
        assert len(buckets) == 26

        # Check that timestamps increment by the schedule interval
        for i in range(26):
            assert buckets[i][0] == start + i * interval

        for i in range(0, 3):
            assert buckets[i][1] == {"ok": 1}
        for i in range(3, 5):
            assert buckets[i][1] == {"sub_failure_error": 1}
        for i in range(5, 20):
            assert buckets[i][1] == {"error": 1}
        for i in range(20, 23):
            assert buckets[i][1] == {"sub_recovery_ok": 1}
        for i in range(23, 26):
            assert buckets[i][1] == {"ok": 1}

    @freeze_time("2023-10-26T12:32:25Z")
    def test_interval_schedule_coarser_buckets_aggregate_ticks(self) -> None:
        start = int(datetime(2023, 10, 26, 12, 0, tzinfo=UTC).timestamp())
        # 26 ticks at 1-hour intervals => window duration is 25 hours
        # (inclusive)
        end = start + 25 * 3600
        bucket_interval = 60 * 60 * 2  # 2 hours

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "interval",
                "schedule": [1, "hour"],  # every hour
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
                "start": start,
                "end": end,
                "interval": bucket_interval,
            },
        )

        buckets = response.data

        # 26 scheduled ticks at 1-hour intervals => window duration is 25 hours
        # At 2-hour buckets that is (25 // 2) + 1 buckets inclusive.
        assert len(buckets) == 13

        expected_bucket_stats = [
            {"ok": 2},
            {"ok": 1, "sub_failure_error": 1},
            {"sub_failure_error": 1, "error": 1},
            {"error": 2},
            {"error": 2},
            {"error": 2},
            {"error": 2},
            {"error": 2},
            {"error": 2},
            {"error": 2},
            {"sub_recovery_ok": 2},
            {"sub_recovery_ok": 1, "ok": 1},
            {"ok": 2},
        ]

        for i, bucket in enumerate(buckets):
            assert bucket[0] == start + i * bucket_interval
            assert bucket[1] == expected_bucket_stats[i]

    @freeze_time("2023-10-26T12:32:25Z")
    def test_fill_buckets_returns_exact_bucket_count(self) -> None:
        start = int(datetime(2023, 10, 26, 12, 0, tzinfo=UTC).timestamp())
        interval = 3600
        num_buckets = 20
        end = start + (num_buckets - 1) * interval

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "interval",
                "schedule": [1, "hour"],
                # Use smaller thresholds so a shorter window can still generate
                # a complete sample status sequence.
                "failure_issue_threshold": 1,
                "recovery_threshold": 1,
                "start": start,
                "end": end,
                "interval": interval,
            },
        )

        buckets = response.data
        assert len(buckets) == num_buckets
        for i in range(num_buckets):
            assert buckets[i][0] == start + i * interval
            # Every bucket should have exactly one synthetic status
            assert sum(buckets[i][1].values()) == 1

    def test_missing_params(self) -> None:
        start = int(datetime(2023, 10, 26, 12, 0, tzinfo=UTC).timestamp())
        end = start + 3600
        interval = 3600

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
                "start": start,
                "end": end,
                "interval": interval,
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
            },
            status_code=400,
        )
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "start": start,
                "end": end,
                "interval": interval,
                "schedule_type": "crontab",
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
            },
            status_code=400,
        )
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "start": start,
                "end": end,
                "interval": interval,
                "schedule": "0 * * * *",
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
            },
            status_code=400,
        )

        # Missing bucket params
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "schedule": "0 * * * *",
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
                "end": end,
                "interval": interval,
            },
            status_code=400,
        )
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "schedule": "0 * * * *",
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
                "start": start,
                "end": end,
            },
            status_code=400,
        )
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "schedule": "0 * * * *",
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
                "start": start,
                "interval": interval,
            },
            status_code=400,
        )

    def test_bad_params(self) -> None:
        start = 1
        end = start + 3600
        interval = 3600

        # Invalid crontab schedule
        self.get_error_response(
            self.organization.slug,
            qs_params={
                "schedule_type": "crontab",
                "schedule": "0 * * *",
                "failure_issue_threshold": 2,
                "recovery_threshold": 3,
                "start": start,
                "end": end,
                "interval": interval,
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
                "start": start,
                "end": end,
                "interval": interval,
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
                "start": start,
                "end": end,
                "interval": interval,
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
                "start": start,
                "end": end,
                "interval": interval,
            },
            status_code=400,
        )
