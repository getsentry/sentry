from datetime import datetime

import freezegun
import pytest

from sentry.snuba.metrics import MetricsQuery, get_date_range
from sentry.snuba.metrics.query_builder import get_date_range_new
from sentry.snuba.metrics.utils import get_intervals, get_intervals_old, get_num_intervals

MINUTE = 60
HOUR = 60 * MINUTE
DAY = 24 * HOUR

test_get_num_intervals_cases = [
    # uses granularity when interval not provided
    (
        "2000-01-01T10:20",
        "2000-01-01T10:40",
        HOUR,
        None,
        0,
        "uses granularity, less than one hour, inside interval",
    ),
    (
        "2000-01-01T10:40",
        "2000-01-01T11:10",
        HOUR,
        None,
        1,
        "uses granularity, less than one hour, spans 2 intervals",
    ),
    # naive dates
    (
        "2000-01-01T10:20",
        "2000-01-01T10:40",
        HOUR,
        HOUR,
        0,
        "less than one hour, inside interval results in 0",
    ),
    (
        "2000-01-01T10:40",
        "2000-01-01T11:10",
        HOUR,
        HOUR,
        1,
        "less than one hour, spans 2 intervals",
    ),
    (
        "2000-01-01T10:00",
        "2000-01-01T11:59",
        HOUR,
        HOUR,
        1,
        "anything not fully spanning 2 hours gets truncated to 1h",
    ),
    ("2000-01-01T10:20", "2000-01-01T11:40", HOUR, HOUR, 1, "one hour span, not full time"),
    ("2000-01-01T10:00", "2000-01-01T11:00", HOUR, HOUR, 1, "1 hour exactly aligned"),
    ("2000-01-01T10:00", "2000-01-01T12:00", HOUR, HOUR, 2, "2 hour exactly aligned"),
    (
        "2000-01-01T10:05",
        "2000-01-01T14:25",
        HOUR,
        2 * HOUR,
        2,
        "2 two hour intervals properly aligned",
    ),
    ("2000-01-01T09:05", "2000-01-01T13:25", HOUR, 2 * HOUR, 2, "2 two hour intervals not aligned"),
    (
        "2000-01-01T10:05",
        "2000-01-01T11:50",
        HOUR,
        2 * HOUR,
        0,
        "interval of less than 2 h properly aligned",
    ),
    (
        "2000-01-01T10:05",
        "2000-01-01T11:50",
        HOUR,
        2 * HOUR,
        0,
        "interval of less than 2 h spanning two intervals",
    ),
    # dates with timezones
    (
        "2000-01-01T10:20+00:00",
        "2000-01-01T10:40+00:00",
        HOUR,
        HOUR,
        0,
        "TZ less than one hour, inside interval",
    ),
    (
        "2000-01-01T10:40+00:00",
        "2000-01-01T11:10+00:00",
        HOUR,
        HOUR,
        1,
        "TZ less than one hour, spans 2 intervals",
    ),
    (
        "2000-01-01T10:20+00:00",
        "2000-01-01T10:40-01:00",
        HOUR,
        HOUR,
        1,
        "TZ two hour span, not full time",
    ),
    # mixed timezones & naive dates
    (
        "2000-01-01T10:20+00:00",
        "2000-01-01T10:40",
        HOUR,
        HOUR,
        0,
        "mixed TZ less than one hour, inside interval",
    ),
    (
        "2000-01-01T10:40+00:00",
        "2000-01-01T11:10",
        HOUR,
        HOUR,
        1,
        "mixed TZ less than one hour, spans 2 intervals",
    ),
    (
        "2000-01-01T10:40+01:00",
        "2000-01-01T11:10",
        HOUR,
        HOUR,
        2,
        "mixed TZ less than two hours, spans 2 intervals",
    ),
]


@pytest.mark.parametrize(
    "start,end,granularity,interval,expected,test_message",
    test_get_num_intervals_cases,
    ids=[x[5] for x in test_get_num_intervals_cases],
)
def test_get_num_intervals(start, end, granularity, interval, expected, test_message):
    if start is not None:
        start_date = datetime.fromisoformat(start)
    else:
        start_date = None

    end_date = datetime.fromisoformat(end)

    actual = get_num_intervals(
        end=end_date, start=start_date, granularity=granularity, interval=interval
    )

    assert actual == expected, test_message


@pytest.mark.parametrize(
    "start,end,granularity,interval,expected,test_message",
    test_get_num_intervals_cases,
    ids=[x[5] for x in test_get_num_intervals_cases],
)
def test_get_num_intervals_compatible_with_calculate_intervals_len(
    start, end, granularity, interval, expected, test_message
):
    if start is not None:
        start_date = datetime.fromisoformat(start)
    else:
        start_date = None

    end_date = datetime.fromisoformat(end)

    num_intervals = get_num_intervals(
        end=end_date, start=start_date, granularity=granularity, interval=interval
    )
    interval_len = MetricsQuery.calculate_intervals_len(
        start=start_date, end=end_date, granularity=granularity, interval=interval
    )

    assert num_intervals == interval_len


# TEST CASES for test_get_intervals
test_get_intervals_cases = [
    # naive dates
    ("2000-01-01T10:20", "2000-01-01T10:40", HOUR, HOUR, "less than one hour, inside interval", []),
    (
        "2000-01-01T10:40",
        "2000-01-01T11:10",
        HOUR,
        HOUR,
        "less than one hour, spans 2 intervals",
        ["10:00:00 UTC"],
    ),
    (
        "2000-01-01T10:20",
        "2000-01-01T11:40",
        HOUR,
        HOUR,
        "more than one hour span, not full time",
        ["10:00:00 UTC"],
    ),
    (
        "2000-01-01T10:00",
        "2000-01-01T11:59",
        HOUR,
        HOUR,
        "anything not fully spanning 2 hours gets truncated to 1h",
        ["10:00:00 UTC"],
    ),
    (
        "2000-01-01T10:00",
        "2000-01-01T12:00",
        HOUR,
        HOUR,
        "2 hour exactly aligned",
        ["10:00:00 UTC", "11:00:00 UTC"],
    ),
    (
        "2000-01-01T10:05",
        "2000-01-01T14:25",
        HOUR,
        2 * HOUR,
        "2 two hour intervals properly aligned",
        ["10:00:00 UTC", "12:00:00 UTC"],
    ),
    (
        "2000-01-01T09:05",
        "2000-01-01T13:25",
        HOUR,
        2 * HOUR,
        "2 two hour intervals not aligned",
        ["08:00:00 UTC", "10:00:00 UTC"],
    ),
    # dates with timezones
    (
        "2000-01-01T10:20+00:00",
        "2000-01-01T10:40+00:00",
        HOUR,
        HOUR,
        "TZ less than one hour, inside interval",
        [],
    ),
    # no interval
    (
        "2000-01-01T10:20",
        "2000-01-01T10:40",
        HOUR,
        None,
        "interval=None, less than one hour, inside interval",
        [],
    ),
    (
        "2000-01-01T10:00",
        "2000-01-01T12:00",
        HOUR,
        None,
        "interval=None, 2 hour exactly aligned",
        ["10:00:00 UTC", "11:00:00 UTC"],
    ),
    (
        "2000-01-01T10:20",
        "2000-01-01T11:40",
        HOUR,
        None,
        "interval=None, two hour span, not full time",
        ["10:00:00 UTC"],
    ),
]


@pytest.mark.parametrize(
    "start,end,granularity,interval,test_message,expected",
    test_get_intervals_cases,
    ids=[x[4] for x in test_get_intervals_cases],
)
def test_get_intervals(start, end, granularity, interval, test_message, expected):
    if start is not None:
        start_date = datetime.fromisoformat(start)
    else:
        start_date = None

    end_date = datetime.fromisoformat(end)

    intervals = get_intervals(
        start=start_date, end=end_date, granularity=granularity, interval=interval
    )
    # convert result to something easy to read
    actual = [_to_timestring(d) for d in intervals]
    assert actual == expected, test_message


@pytest.mark.parametrize(
    "start,end,granularity,interval,test_message,expected",
    test_get_intervals_cases,
    ids=[x[4] for x in test_get_intervals_cases],
)
def test_compare_get_intervals_implementations(
    start, end, granularity, interval, test_message, expected
):
    if start is not None:
        start_date = datetime.fromisoformat(start)
    else:
        start_date = None

    end_date = datetime.fromisoformat(end)
    new_intervals = get_intervals(
        start=start_date, end=end_date, granularity=granularity, interval=interval
    )
    old_intervals = get_intervals_old(
        start=start_date, end=end_date, granularity=granularity, interval=interval
    )

    new_intervals = [_to_timestring(d) for d in new_intervals]
    old_intervals = [_to_timestring(d) for d in old_intervals]

    assert new_intervals == old_intervals, test_message


@pytest.mark.parametrize(
    "now",
    [
        "2022-10-01 00:00:00",
        "2022-10-01 09:00:00",
        "2022-10-01 10:00:00",
        "2022-10-01 09:20:00",
        "2022-10-01 09:40:00",
    ],
)
@pytest.mark.parametrize("interval", [None, "1h", "2h"])
@pytest.mark.parametrize(
    "parameters",
    [
        {"timeframe": "14h"},
        {"timeframe": "60m"},
        {"timeframe": "91d"},
        {"timeframeStart": "14d", "timeframeEnd": "7d"},
    ],
)
def test_compare_get_date_range_implementations(now, interval, parameters):
    if interval is not None:
        parameters["interval"] = interval
    with freezegun.freeze_time(now):
        start_new, end_new, interval_new = get_date_range_new(parameters)
        start_old, end_old, interval_old = get_date_range(parameters)

        new_vals = _to_datetimestring(start_new), _to_datetimestring(end_new), interval_new
        old_vals = _to_datetimestring(start_old), _to_datetimestring(end_old), interval_old
        assert old_vals == new_vals


def _to_datetimestring(d):
    return d.strftime("%H:%M:%S %Z %m-%d ")


def _to_timestring(d):
    return d.strftime("%H:%M:%S %Z")
