from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sentry.monitors.schedule import get_next_schedule, get_prev_schedule
from sentry.monitors.types import CrontabSchedule, IntervalSchedule


def t(hour: int, minute: int):
    return datetime(2019, 1, 1, hour, minute, 0, tzinfo=timezone.utc)


def test_get_next_schedule():
    # 00 * * * *: 5:30 -> 6:00
    assert get_next_schedule(t(5, 30), CrontabSchedule("0 * * * *")) == t(6, 00)

    # 30 * * * *: 5:29 -> 5:30
    assert get_next_schedule(t(5, 29), CrontabSchedule("30 * * * *")) == t(5, 30)

    # 2 hour interval: 5:30 -> 7:30
    assert get_next_schedule(t(5, 30), IntervalSchedule(interval=2, unit="hour")) == t(7, 30)

    # 2 hour interval: 5:42 -> 7:42
    assert get_next_schedule(t(5, 42), IntervalSchedule(interval=2, unit="hour")) == t(7, 42)


def test_get_next_schedule_cron_dst():
    # Minute rollover during DST start
    assert get_next_schedule(
        datetime(2024, 11, 3, 1, 59, 0, tzinfo=ZoneInfo("America/New_York")),
        CrontabSchedule("* * * * *"),
    ) == datetime(2024, 11, 3, 1, 0, 0, tzinfo=ZoneInfo("America/New_York"))

    # Minute rollover during DST end
    assert get_next_schedule(
        datetime(2024, 3, 10, 1, 59, 0, tzinfo=ZoneInfo("America/New_York")),
        CrontabSchedule("* * * * *"),
    ) == datetime(2024, 3, 10, 3, 0, 0, tzinfo=ZoneInfo("America/New_York"))


def test_get_next_schedule_cron_dst_bugs():
    """
    XXX(epurkhiser): This is covered by the cronsim library tests, but since
    it's somewhat important for us let's add our own coverage of the DST
    transition.
    """
    # DST beginning with a daily schedule
    #
    # TODO: This incorrectly computes 13:00 instead of 12:00 for the 3rd.
    assert get_next_schedule(
        datetime(2024, 11, 2, 12, 0, 0, tzinfo=ZoneInfo("America/New_York")),
        CrontabSchedule("0 12 * * *"),
    ) == datetime(2024, 11, 3, 12, 0, 0, tzinfo=ZoneInfo("America/New_York"))

    # DST ending with a daily schedule
    #
    # TODO: This incorrectly computes 11:00 instead of 12:00 for the 10th.
    assert get_next_schedule(
        datetime(2024, 3, 9, 12, 0, 0, tzinfo=ZoneInfo("America/New_York")),
        CrontabSchedule("0 12 * * *"),
    ) == datetime(2024, 3, 10, 12, 0, 0, tzinfo=ZoneInfo("America/New_York"))


def test_get_prev_schedule():
    start_ts = datetime(2019, 1, 1, 1, 30, 0, tzinfo=timezone.utc)

    # 00 * * * *: 5:35 -> 5:00
    assert get_prev_schedule(start_ts, t(5, 35), CrontabSchedule("0 * * * *")) == t(5, 00)

    # 30 * * * *: 5:30 -> 4:30
    assert get_prev_schedule(start_ts, t(5, 30), CrontabSchedule("30 * * * *")) == t(4, 30)

    # 2 hour interval: (start = 1:30) 5:30 -> 3:30
    assert get_prev_schedule(start_ts, t(5, 30), IntervalSchedule(2, "hour")) == t(3, 30)

    # 2 hour interval: (start = 1:30) 5:35 -> 5:30
    assert get_prev_schedule(start_ts, t(5, 35), IntervalSchedule(2, "hour")) == t(5, 30)
