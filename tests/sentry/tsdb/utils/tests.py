import pytz

from datetime import datetime, timedelta

from sentry.testutils import TestCase
from sentry.tsdb.utils import Rollup

normalize_to_epoch = Rollup.normalize_to_epoch
timestamp = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.UTC)


class NormalizeToEpochTest(TestCase):
    def test_simple(self):
        result = normalize_to_epoch(timestamp, 60)
        assert result == 1368889980
        result = normalize_to_epoch(timestamp + timedelta(seconds=20), 60)
        assert result == 1368890040
        result = normalize_to_epoch(timestamp + timedelta(seconds=30), 60)
        assert result == 1368890040
        result = normalize_to_epoch(timestamp + timedelta(seconds=70), 60)
        assert result == 1368890100
