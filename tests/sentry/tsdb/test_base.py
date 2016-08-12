from __future__ import absolute_import, division

import mock
import pytz

from datetime import datetime, timedelta

from sentry.testutils import TestCase
from sentry.tsdb.base import BaseTSDB, ONE_MINUTE, ONE_HOUR, ONE_DAY
from sentry.utils.dates import to_timestamp


class BaseTSDBTest(TestCase):
    def setUp(self):
        self.tsdb = BaseTSDB(rollups=(
            # time in seconds, samples to keep
            (10, 30),  # 5 minutes at 10 seconds
            (ONE_MINUTE, 120),  # 2 hours at 1 minute
            (ONE_HOUR, 24),  # 1 days at 1 hour
            (ONE_DAY, 30),  # 30 days at 1 day
        ))

    def test_normalize_to_epoch(self):
        timestamp = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.UTC)
        normalize_to_epoch = self.tsdb.normalize_to_epoch

        result = normalize_to_epoch(timestamp, 60)
        assert result == 1368889980
        result = normalize_to_epoch(timestamp + timedelta(seconds=20), 60)
        assert result == 1368890040
        result = normalize_to_epoch(timestamp + timedelta(seconds=30), 60)
        assert result == 1368890040
        result = normalize_to_epoch(timestamp + timedelta(seconds=70), 60)
        assert result == 1368890100

    def test_rollup(self):
        pre_results = {
            1: [(1368889980, 5), (1368890040, 10), (1368893640, 7)],
        }
        post_results = self.tsdb.rollup(pre_results, 3600)
        assert len(post_results) == 1
        assert post_results[1] == [
            [1368889200, 15], [1368892800, 7]
        ]

    def test_calculate_expiry(self):
        timestamp = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.UTC)
        result = self.tsdb.calculate_expiry(10, 30, timestamp)
        assert result == 1368890330

    @mock.patch('django.utils.timezone.now')
    def test_get_optimal_rollup_series_aligned_intervals(self, now):
        now.return_value = datetime(2016, 8, 1, tzinfo=pytz.utc)

        start = now() - timedelta(seconds=30)
        assert self.tsdb.get_optimal_rollup_series(start) == (
            10,
            [to_timestamp(start + timedelta(seconds=10) * i) for i in xrange(4)],
        )

        start = now() - timedelta(minutes=30)
        assert self.tsdb.get_optimal_rollup_series(start) == (
            ONE_MINUTE,
            [to_timestamp(start + timedelta(minutes=1) * i) for i in xrange(31)],
        )

        start = now() - timedelta(hours=5)
        assert self.tsdb.get_optimal_rollup_series(start) == (
            ONE_HOUR,
            [to_timestamp(start + timedelta(hours=1) * i) for i in xrange(6)],
        )

        start = now() - timedelta(days=7)
        assert self.tsdb.get_optimal_rollup_series(start) == (
            ONE_DAY,
            [to_timestamp(start + timedelta(hours=24) * i) for i in xrange(8)],
        )

    @mock.patch('django.utils.timezone.now')
    def test_get_optimal_rollup_series_offset_intervals(self, now):
        # This test is a funny one (notice it doesn't return a range that
        # includes the start position.) This occurs because the algorithm for
        # determining the series to be returned will attempt to return the same
        # duration of time as represented by the start and end timestamps, but
        # doesn't necessarily return data *from that specific interval* (the
        # end timestamp is always included.)

        now.return_value = datetime(2016, 8, 1, 0, 0, 15, tzinfo=pytz.utc)
        start = now() - timedelta(seconds=19)
        assert self.tsdb.get_optimal_rollup_series(start, rollup=10) == (
            10,
            [
                to_timestamp(datetime(2016, 8, 1, 0, 0, 0, tzinfo=pytz.utc)),
                to_timestamp(datetime(2016, 8, 1, 0, 0, 10, tzinfo=pytz.utc)),
            ]
        )

        now.return_value = datetime(2016, 8, 1, 0, 0, 30, tzinfo=pytz.utc)
        start = now() - timedelta(seconds=ONE_MINUTE - 1)
        assert self.tsdb.get_optimal_rollup_series(start, rollup=ONE_MINUTE) == (
            ONE_MINUTE,
            [to_timestamp(datetime(2016, 8, 1, 0, 0, 0, tzinfo=pytz.utc))]
        )

        now.return_value = datetime(2016, 8, 1, 12, tzinfo=pytz.utc)
        start = now() - timedelta(seconds=ONE_DAY - 1)
        assert self.tsdb.get_optimal_rollup_series(start, rollup=ONE_DAY) == (
            ONE_DAY,
            [to_timestamp(datetime(2016, 8, 1, 0, tzinfo=pytz.utc))]
        )
