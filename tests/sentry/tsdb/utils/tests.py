import pytz

from datetime import datetime

from sentry.testutils import TestCase
from sentry.tsdb.utils import Rollup

normalize_to_epoch = Rollup.normalize_to_epoch
timestamp = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.UTC)


class NormalizeToEpochTest(TestCase):
    def test_simple(self):
        result = normalize_to_epoch(timestamp, 60)
        assert result == 22814833
