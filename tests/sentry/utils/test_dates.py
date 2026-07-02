import datetime

import pytest

from sentry.utils.dates import (
    date_to_utc_datetime,
    format_duration,
    parse_stats_period,
    parse_timestamp,
)


def test_parse_stats_period() -> None:
    assert parse_stats_period("3s") == datetime.timedelta(seconds=3)
    assert parse_stats_period("30m") == datetime.timedelta(minutes=30)
    assert parse_stats_period("1h") == datetime.timedelta(hours=1)
    assert parse_stats_period("20d") == datetime.timedelta(days=20)
    assert parse_stats_period("20f") is None
    assert parse_stats_period("-1s") is None
    assert parse_stats_period("4w") == datetime.timedelta(weeks=4)
    assert parse_stats_period("900000000000d") is datetime.timedelta.max


def test_date_to_utc_datetime() -> None:
    d = datetime.date(2024, 7, 5)
    dt = date_to_utc_datetime(d)
    assert dt == datetime.datetime(2024, 7, 5, tzinfo=datetime.UTC)


def test_parse_timestamp() -> None:
    assert parse_timestamp("2024-05-20T17:29:00+00:00") == datetime.datetime(
        2024, 5, 20, 17, 29, tzinfo=datetime.UTC
    )
    assert parse_timestamp("2024-05-20T17:29:00") == datetime.datetime(
        2024, 5, 20, 17, 29, tzinfo=datetime.UTC
    )


def test_parse_timestamp_error() -> None:
    with pytest.raises(ValueError):
        parse_timestamp("2024-05-20T17:29:00gu")


class TestFormatDuration:
    FLOOR_DURATION_CASES = [
        (0, "0 seconds"),
        (0.5, "30 seconds"),
        (1, "1 minute"),
        (59, "59 minutes"),
        (60, "1 hour"),
        (90, "1 hour"),
        (120, "2 hours"),
        (1439, "23 hours"),
        (1440, "1 day"),
        (1500, "1 day"),
        (2880, "2 days"),
    ]

    @pytest.mark.parametrize("minutes, expected", FLOOR_DURATION_CASES)
    def test_format_duration_floor(self, minutes: int | float, expected: str) -> None:
        assert format_duration(minutes) == expected

    EXACT_DURATION_CASES = [
        (0.5, "0 minutes"),
        (1, "1 minute"),
        (10, "10 minutes"),
        (60, "1 hour"),
        (90, "90 minutes"),
        (120, "2 hours"),
    ]

    @pytest.mark.parametrize("minutes, expected", EXACT_DURATION_CASES)
    def test_format_duration_exact(self, minutes: int, expected: str) -> None:
        assert format_duration(minutes, floor_to_largest_unit=False) == expected
