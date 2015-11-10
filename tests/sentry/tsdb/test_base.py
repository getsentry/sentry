from __future__ import absolute_import

import pytz

from datetime import datetime, timedelta

from sentry.testutils import TestCase
from sentry.tsdb.base import BaseTSDB, ONE_MINUTE, ONE_HOUR, ONE_DAY


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
