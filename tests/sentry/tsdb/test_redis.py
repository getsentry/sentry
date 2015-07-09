import pytz

from datetime import datetime

from sentry.testutils import TestCase
from sentry.tsdb.base import TSDBModel, ONE_MINUTE, ONE_HOUR, ONE_DAY
from sentry.tsdb.redis import RedisTSDB


class RedisTSDBTest(TestCase):
    def setUp(self):
        self.db = RedisTSDB(hosts={
            0: {'db': 9}
        }, rollups=(
            # time in seconds, samples to keep
            (10, 30),  # 5 minutes at 10 seconds
            (ONE_MINUTE, 120),  # 2 hours at 1 minute
            (ONE_HOUR, 24),  # 1 days at 1 hour
            (ONE_DAY, 30),  # 30 days at 1 day
        ), vnodes=64)
        self.db.conn.flushdb()

    def test_make_key(self):
        result = self.db.make_key(TSDBModel.project, 1368889980, 1)
        assert result == 'ts:1:1368889980:1'

        result = self.db.make_key(TSDBModel.project, 1368889980, 'foo')
        assert result == 'ts:1:1368889980:33'

    def test_get_model_key(self):
        result = self.db.get_model_key(1)
        assert result == 1

        result = self.db.get_model_key('foo')
        assert result == 'bf4e529197e56a48ae2737505b9736e4'

    def test_simple(self):
        timestamp = datetime(2013, 5, 18, 15, 13, 58, tzinfo=pytz.UTC)
        start = timestamp
        self.db.incr(TSDBModel.project, 1, timestamp)

        timestamp = datetime(2013, 5, 18, 16, 13, 58, tzinfo=pytz.UTC)
        self.db.incr(TSDBModel.project, 1, timestamp, count=3)

        timestamp = datetime(2013, 5, 18, 17, 13, 58, tzinfo=pytz.UTC)
        self.db.incr(TSDBModel.project, 1, timestamp)

        timestamp = datetime(2013, 5, 18, 18, 13, 58, tzinfo=pytz.UTC)
        end = timestamp
        self.db.incr_multi([
            (TSDBModel.project, 1),
            (TSDBModel.project, 2),
        ], timestamp, count=4)

        results = self.db.get_range(TSDBModel.project, [1], start, end)
        assert results == {
            1: [(1368889200, 1), (1368892800, 3), (1368896400, 1), (1368900000, 4)],
        }
        results = self.db.get_range(TSDBModel.project, [2], start, end)
        assert results == {
            2: [(1368889200, 0), (1368892800, 0), (1368896400, 0), (1368900000, 4)],
        }

        results = self.db.get_sums(TSDBModel.project, [1, 2], start, end)
        assert results == {
            1: 9,
            2: 4,
        }
