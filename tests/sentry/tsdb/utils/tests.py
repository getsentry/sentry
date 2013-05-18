import pytz

from datetime import datetime

from sentry.testutils import TestCase
from sentry.tsdb.utils import Granularity

normalize_to_epoch = Granularity.normalize_to_epoch
timestamp = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.UTC)


class NormalizeToEpochTest(TestCase):
    def test_all_time(self):
        result = normalize_to_epoch(Granularity.ALL_TIME, timestamp)
        assert result == 0

    def test_seconds(self):
        result = normalize_to_epoch(Granularity.SECONDS, timestamp)
        assert result == 1368890038

    def test_minutes(self):
        result = normalize_to_epoch(Granularity.MINUTES, timestamp)
        assert result == 1368889980

    def test_hours(self):
        result = normalize_to_epoch(Granularity.HOURS, timestamp)
        assert result == 1368889200

    def test_days(self):
        result = normalize_to_epoch(Granularity.DAYS, timestamp)
        assert result == 1368835200

    def test_weeks(self):
        result = normalize_to_epoch(Granularity.WEEKS, timestamp)
        assert result == 1368403200

    def test_months(self):
        result = normalize_to_epoch(Granularity.MONTHS, timestamp)
        assert result == 1367366400

    def test_years(self):
        result = normalize_to_epoch(Granularity.YEARS, timestamp)
        assert result == 1356998400
