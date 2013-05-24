import pytz

from datetime import datetime

from sentry.testutils import TestCase
from sentry.tsdb.utils import Rollup

normalize_to_epoch = Rollup.normalize_to_epoch
get_min_timestamp = Rollup.get_min_timestamp
timestamp = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.UTC)


class NormalizeToEpochTest(TestCase):
    def test_all_time(self):
        result = normalize_to_epoch(Rollup.ALL_TIME, timestamp)
        assert result == 0

    def test_seconds(self):
        result = normalize_to_epoch(Rollup.SECONDS, timestamp)
        assert result == 1368890038

    def test_minutes(self):
        result = normalize_to_epoch(Rollup.MINUTES, timestamp)
        assert result == 1368889980

    def test_hours(self):
        result = normalize_to_epoch(Rollup.HOURS, timestamp)
        assert result == 1368889200

    def test_days(self):
        result = normalize_to_epoch(Rollup.DAYS, timestamp)
        assert result == 1368835200

    def test_weeks(self):
        result = normalize_to_epoch(Rollup.WEEKS, timestamp)
        assert result == 1368403200

    def test_months(self):
        result = normalize_to_epoch(Rollup.MONTHS, timestamp)
        assert result == 1367366400

    def test_years(self):
        result = normalize_to_epoch(Rollup.YEARS, timestamp)
        assert result == 1356998400


class GetMinTimestampTest(TestCase):
    def test_all_time(self):
        result = get_min_timestamp(Rollup.ALL_TIME, timestamp)
        assert result is None

    def test_seconds(self):
        result = get_min_timestamp(Rollup.SECONDS, timestamp)
        assert result == 1368889978

    def test_minutes(self):
        result = get_min_timestamp(Rollup.MINUTES, timestamp)
        assert result == 1368886380

    def test_hours(self):
        result = get_min_timestamp(Rollup.HOURS, timestamp)
        assert result == 1368802800

    def test_days(self):
        result = get_min_timestamp(Rollup.DAYS, timestamp)
        assert result == 1366243200

    def test_weeks(self):
        result = get_min_timestamp(Rollup.WEEKS, timestamp)
        assert result == 1368403200

    def test_months(self):
        result = get_min_timestamp(Rollup.MONTHS, timestamp)
        assert result == 1367366400

    def test_years(self):
        result = get_min_timestamp(Rollup.YEARS, timestamp)
        assert result is None
