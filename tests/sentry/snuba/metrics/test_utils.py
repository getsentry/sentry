from datetime import datetime, timedelta, timezone

import pytest

from sentry.snuba.metrics.utils import get_intervals, get_num_intervals, to_intervals

MINUTE = 60
HOUR = 60 * MINUTE
DAY = 24 * HOUR

test_get_num_intervals_cases = [
    # uses granularity when interval not provided
    (
        "2000-01-01T10:33",
        "2000-01-01T11:09",
        3 * MINUTE,
        None,
        12,
        "uses 3 minute granularity, aligned start & end",
    ),
    (
        "2000-01-01T10:33",
        "2000-01-01T11:10",
        3 * MINUTE,
        None,
        13,
        "uses 3 minute granularity, aligned start",
    ),
    (
        "2000-01-01T10:40",
        "2000-01-01T11:10",
        3 * MINUTE,
        None,
        11,
        "uses 3 minute granularity, not aligned",
    ),
    (
        "2000-01-01T10:20",
        "2000-01-01T10:40",
        HOUR,
        None,
        1,
        "uses granularity, less than one hour, inside interval",
    ),
    (
        "2000-01-01T10:40",
        "2000-01-01T11:10",
        HOUR,
        None,
        2,
        "uses granularity, less than one hour, spans 2 intervals",
    ),
    # naive dates
    (
        "2000-01-01T10:20",
        "2000-01-01T10:40",
        HOUR,
        HOUR,
        1,
        "less than one hour, inside interval results in 0",
    ),
    (
        "2000-01-01T10:40",
        "2000-01-01T11:10",
        HOUR,
        HOUR,
        2,
        "less than one hour, spans 2 intervals",
    ),
    (
        "2000-01-01T10:00",
        "2000-01-01T11:59",
        HOUR,
        HOUR,
        2,
        "spanning 2 intervals of 1h",
    ),
    ("2000-01-01T10:20", "2000-01-01T11:40", HOUR, HOUR, 2, "two hour span, not full time"),
    ("2000-01-01T10:00", "2000-01-01T11:00", HOUR, HOUR, 1, "1 hour exactly aligned"),
    ("2000-01-01T10:00", "2000-01-01T12:00", HOUR, HOUR, 2, "2 hour exactly aligned"),
    (
        "2000-01-01T10:05",
        "2000-01-01T14:25",
        HOUR,
        2 * HOUR,
        3,
        "3 two hour intervals properly aligned",
    ),
    ("2000-01-01T09:05", "2000-01-01T13:25", HOUR, 2 * HOUR, 3, "2 two hour intervals not aligned"),
    (
        "2000-01-01T10:05",
        "2000-01-01T11:50",
        HOUR,
        2 * HOUR,
        1,
        "interval of less than 2 h properly aligned",
    ),
    (
        "2000-01-01T10:05",
        "2000-01-01T11:50",
        HOUR,
        2 * HOUR,
        1,
        "interval of less than 2 h spanning one interval",
    ),
    # dates with timezones
    (
        "2000-01-01T10:20+00:00",
        "2000-01-01T10:40+00:00",
        HOUR,
        HOUR,
        1,
        "TZ less than one hour, inside interval",
    ),
    (
        "2000-01-01T10:40+00:00",
        "2000-01-01T11:10+00:00",
        HOUR,
        HOUR,
        2,
        "TZ less than one hour, spans 2 intervals",
    ),
    (
        "2000-01-01T10:20+00:00",
        "2000-01-01T10:40-01:00",
        HOUR,
        HOUR,
        2,
        "TZ one hour span, not full time",
    ),
    # mixed timezones & naive dates
    (
        "2000-01-01T10:20+00:00",
        "2000-01-01T10:40",
        HOUR,
        HOUR,
        1,
        "mixed TZ less than one hour, inside interval",
    ),
    (
        "2000-01-01T10:40+00:00",
        "2000-01-01T11:10",
        HOUR,
        HOUR,
        2,
        "mixed TZ less than one hour, spans 2 intervals",
    ),
    (
        "2000-01-01T10:40+01:00",
        "2000-01-01T11:10",
        HOUR,
        HOUR,
        3,
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
        start=start_date, end=end_date, granularity=granularity, interval=interval
    )

    assert actual == expected, test_message


test_get_intervals_cases = [
    # naive dates
    (
        "2000-01-01T10:20",
        "2000-01-01T10:40",
        HOUR,
        HOUR,
        "less than one hour, inside interval",
        ["10:00:00 UTC"],
    ),
    (
        "2000-01-01T10:40",
        "2000-01-01T11:10",
        HOUR,
        HOUR,
        "less than one hour, spans 2 intervals",
        ["10:00:00 UTC", "11:00:00 UTC"],
    ),
    (
        "2000-01-01T10:20",
        "2000-01-01T11:40",
        HOUR,
        HOUR,
        "more than one hour span, not full time",
        ["10:00:00 UTC", "11:00:00 UTC"],
    ),
    (
        "2000-01-01T10:00",
        "2000-01-01T11:59",
        HOUR,
        HOUR,
        "interval spanning 2h ",
        ["10:00:00 UTC", "11:00:00 UTC"],
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
        "2 two hour intervals, spanning 3 intervals",
        ["10:00:00 UTC", "12:00:00 UTC", "14:00:00 UTC"],
    ),
    (
        "2000-01-01T09:05",
        "2000-01-01T13:25",
        HOUR,
        2 * HOUR,
        "2 two hour intervals not aligned",
        ["08:00:00 UTC", "10:00:00 UTC", "12:00:00 UTC"],
    ),
    # dates with timezones
    (
        "2000-01-01T10:20+00:00",
        "2000-01-01T10:40+00:00",
        HOUR,
        HOUR,
        "TZ less than one hour, inside interval",
        ["10:00:00 UTC"],
    ),
    # no interval
    (
        "2000-01-01T10:20",
        "2000-01-01T10:40",
        HOUR,
        None,
        "interval=None, less than one hour, inside interval",
        ["10:00:00 UTC"],
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
        ["10:00:00 UTC", "11:00:00 UTC"],
    ),
]


@pytest.mark.parametrize(
    "start,end,granularity,interval,test_message,expected",
    test_get_intervals_cases,
    ids=[x[4] for x in test_get_intervals_cases],
)
def test_get_intervals(start, end, granularity, interval, test_message, expected):
    start_date = datetime.fromisoformat(start)
    end_date = datetime.fromisoformat(end)

    intervals = get_intervals(
        start=start_date, end=end_date, granularity=granularity, interval=interval
    )
    # convert result to something easy to read
    actual = [_to_timestring(d) for d in intervals]
    assert actual == expected, test_message


def _to_timestring(d):
    return d.strftime("%H:%M:%S %Z")


test_to_intervals_cases = [
    (
        "2000-01-01T10:20",
        "2000-01-01T10:40",
        HOUR,
        "10:00:00 UTC",
        "11:00:00 UTC",
        1,
        "less than one hour, inside interval",
    ),
    (
        "2000-01-01T10:00",
        "2000-01-01T10:40",
        HOUR,
        "10:00:00 UTC",
        "11:00:00 UTC",
        1,
        "less than one hour, inside interval 2",
    ),
    (
        "2000-01-01T10:00",
        "2000-01-01T11:00",
        HOUR,
        "10:00:00 UTC",
        "11:00:00 UTC",
        1,
        "one hour perfectly aligned",
    ),
    (
        "2000-01-01T10:50",
        "2000-01-01T11:10",
        HOUR,
        "10:00:00 UTC",
        "12:00:00 UTC",
        2,
        "less than one hour, spanning 2 intervals",
    ),
    (
        "2000-01-01T10:01",
        "2000-01-01T11:10",
        2 * HOUR,
        "10:00:00 UTC",
        "12:00:00 UTC",
        1,
        "less than 2 hours unaligned",
    ),
    (
        "2000-01-01T11:01",
        "2000-01-01T13:10",
        2 * HOUR,
        "10:00:00 UTC",
        "14:00:00 UTC",
        2,
        "span two, two hour intervals",
    ),
]


@pytest.mark.parametrize(
    "start,end,interval,expected_start,expected_end, expected_num_intervals, test_message",
    test_to_intervals_cases,
    ids=[x[6] for x in test_to_intervals_cases],
)
def test_to_intervals(
    start, end, interval, expected_start, expected_end, expected_num_intervals, test_message
):
    start_date = datetime.fromisoformat(start)
    end_date = datetime.fromisoformat(end)

    actual_start, actual_end, actual_num_intervals = to_intervals(start_date, end_date, interval)

    assert expected_start == _to_timestring(actual_start), test_message
    assert expected_end == _to_timestring(actual_end), test_message
    assert expected_num_intervals == actual_num_intervals, test_message


def test_get_intervals_checks_valid_interval():
    """
    Checks that get_intervals verifies that granularity > 0
    """
    start = datetime(2021, 8, 25, 23, 59, tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    with pytest.raises(AssertionError):
        list(get_intervals(start=start, end=end, granularity=-3600))
