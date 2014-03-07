import pytz

from datetime import datetime, timedelta

from sentry.testutils import TestCase
from sentry.tsdb.backend import RedisTSDB


class RedisTSDBTest(TestCase):
    def setUp(self):
        self.db = RedisTSDB(hosts={
            0: {'db': 9}
        })
        self.db.conn.flushdb()

    def test_normalize_to_epoch(self):
        timestamp = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.UTC)
        normalize_to_epoch = self.db.normalize_to_epoch

        result = normalize_to_epoch(timestamp, 60)
        assert result == 1368889980
        result = normalize_to_epoch(timestamp + timedelta(seconds=20), 60)
        assert result == 1368890040
        result = normalize_to_epoch(timestamp + timedelta(seconds=30), 60)
        assert result == 1368890040
        result = normalize_to_epoch(timestamp + timedelta(seconds=70), 60)
        assert result == 1368890100
