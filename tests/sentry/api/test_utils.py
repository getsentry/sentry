import datetime

from django.utils import timezone
from freezegun import freeze_time

from sentry.api.utils import (
    get_date_range_from_params,
    get_date_range_rollup_from_params,
    InvalidParams,
    MAX_STATS_PERIOD,
)
from sentry.testutils import TestCase


class GetDateRangeFromParamsTest(TestCase):
    def test_stats_period(self):
        start, end = get_date_range_from_params({"statsPeriod": "14h"})
        assert end - datetime.timedelta(hours=14) == start

        start, end = get_date_range_from_params({"statsPeriod": "14d"})
        assert end - datetime.timedelta(days=14) == start

        start, end = get_date_range_from_params({"statsPeriod": "60m"})
        assert end - datetime.timedelta(minutes=60) == start

        start, end = get_date_range_from_params({"statsPeriod": "3600s"})
        assert end - datetime.timedelta(seconds=3600) == start

        start, end = get_date_range_from_params({"statsPeriod": "91d"})
        assert end - datetime.timedelta(days=91) == start

    def test_date_range(self):
        start, end = get_date_range_from_params({"start": "2018-11-01", "end": "2018-11-07"})

        assert start == datetime.datetime(2018, 11, 1, tzinfo=timezone.utc)
        assert end == datetime.datetime(2018, 11, 7, tzinfo=timezone.utc)

    @freeze_time("2018-12-11 03:21:34")
    def test_no_params(self):
        start, end = get_date_range_from_params({})
        assert start == timezone.now() - MAX_STATS_PERIOD
        assert end == timezone.now()

        start, end = get_date_range_from_params({}, optional=True)
        assert start is None
        assert end is None

    @freeze_time("2018-12-11 03:21:34")
    def test_relative_date_range(self):
        start, end = get_date_range_from_params({"statsPeriodStart": "14d", "statsPeriodEnd": "7d"})

        assert start == datetime.datetime(2018, 11, 27, 3, 21, 34, tzinfo=timezone.utc)
        assert end == datetime.datetime(2018, 12, 4, 3, 21, 34, tzinfo=timezone.utc)

    @freeze_time("2018-12-11 03:21:34")
    def test_relative_date_range_incomplete(self):

        with self.assertRaises(InvalidParams):
            start, end = get_date_range_from_params({"statsPeriodStart": "14d"})


class GetDateRangeRollupFromParamsTest(TestCase):
    def test_intervals(self):
        # defaults to 1h
        start, end, interval = get_date_range_rollup_from_params({})
        assert interval == 3600

        # rounds up to a multiple of the minimum
        start, end, interval = get_date_range_rollup_from_params(
            {"statsPeriod": "14h", "interval": "8m"}, minimum_interval="5m"
        )
        assert interval == 600

    @freeze_time("2018-12-11 03:21:34")
    def test_round_range(self):
        start, end, interval = get_date_range_rollup_from_params(
            {"statsPeriod": "2d"}, round_range=True
        )
        assert start == datetime.datetime(2018, 12, 9, 4, tzinfo=timezone.utc)
        assert end == datetime.datetime(2018, 12, 11, 4, tzinfo=timezone.utc)

        start, end, interval = get_date_range_rollup_from_params(
            {"statsPeriod": "2d", "interval": "1d"}, round_range=True
        )
        assert start == datetime.datetime(2018, 12, 10, tzinfo=timezone.utc)
        assert end == datetime.datetime(2018, 12, 12, tzinfo=timezone.utc)

    def test_invalid_interval(self):
        with self.assertRaises(InvalidParams):
            start, end, interval = get_date_range_rollup_from_params({"interval": "0d"})
        with self.assertRaises(InvalidParams):
            # defaults stats period is 90d
            start, end, interval = get_date_range_rollup_from_params(
                {"interval": "1d"}, max_points=80
            )

    def test_round_exact(self):
        start, end, interval = get_date_range_rollup_from_params(
            {"start": "2021-01-12T04:06:16", "end": "2021-01-17T08:26:13", "interval": "1d"},
            round_range=True,
        )
        assert start == datetime.datetime(2021, 1, 12, tzinfo=timezone.utc)
        assert end == datetime.datetime(2021, 1, 18, tzinfo=timezone.utc)
