import datetime

from sentry.utils.dates import date_to_utc_datetime, parse_stats_period


def test_parse_stats_period():
    assert parse_stats_period("3s") == datetime.timedelta(seconds=3)
    assert parse_stats_period("30m") == datetime.timedelta(minutes=30)
    assert parse_stats_period("1h") == datetime.timedelta(hours=1)
    assert parse_stats_period("20d") == datetime.timedelta(days=20)
    assert parse_stats_period("20f") is None
    assert parse_stats_period("-1s") is None
    assert parse_stats_period("4w") == datetime.timedelta(weeks=4)
    assert parse_stats_period("900000000000d") is datetime.timedelta.max


def test_date_to_utc_datetime():
    d = datetime.date(2024, 7, 5)
    dt = date_to_utc_datetime(d)
    assert dt == datetime.datetime(2024, 7, 5, tzinfo=datetime.UTC)
