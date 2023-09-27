from datetime import datetime

from django.utils import timezone

from sentry.monitors.schedule import get_next_schedule, get_prev_schedule
from sentry.monitors.types import CrontabSchedule, IntervalSchedule


def test_get_next_schedule():
    ts = datetime(2019, 1, 1, 5, 30, 0, tzinfo=timezone.utc)

    # 00 * * * *: 5:30 -> 6:00
    expect = ts.replace(hour=6, minute=0)
    assert get_next_schedule(ts, CrontabSchedule("0 * * * *")) == expect

    # 30 * * * *: 5:30 -> 6:30
    expect = ts.replace(hour=6, minute=30)
    assert get_next_schedule(ts, CrontabSchedule("30 * * * *")) == expect

    # 2 hour interval: 5:30 -> 7:30
    expect = ts.replace(hour=7, minute=30)
    assert get_next_schedule(ts, IntervalSchedule(interval=2, unit="hour")) == expect

    # 2 hour interval: 5:42 -> 7:42
    interval_ts = ts.replace(hour=5, minute=42)
    expect = ts.replace(hour=7, minute=42)
    assert get_next_schedule(interval_ts, IntervalSchedule(interval=2, unit="hour")) == expect


def test_get_prev_schedule():
    start_ts = datetime(2019, 1, 1, 3, 30, 0, tzinfo=timezone.utc)
    ts = datetime(2019, 1, 1, 5, 35, 0, tzinfo=timezone.utc)

    # 00 * * * *: 5:35 -> 5:00
    expect = ts.replace(hour=5, minute=0)
    assert get_prev_schedule(start_ts, ts, CrontabSchedule("0 * * * *")) == expect

    # 30 * * * *: 5:35 -> 5:30
    expect = ts.replace(hour=5, minute=30)
    assert get_prev_schedule(start_ts, ts, CrontabSchedule("30 * * * *")) == expect

    # 2 hour interval: (start = 3:30) 5:35 -> 5:30
    expect = ts.replace(hour=5, minute=30)
    assert get_prev_schedule(start_ts, ts, IntervalSchedule(interval=2, unit="hour")) == expect
