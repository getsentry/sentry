from datetime import UTC, datetime, timedelta

import pytest
from django.utils import timezone

from sentry.conf.types.taskworker import crontab
from sentry.taskworker.scheduler.schedules import CrontabSchedule, TimedeltaSchedule
from sentry.testutils.helpers.datetime import freeze_time


def test_timedeltaschedule_invalid() -> None:
    with pytest.raises(ValueError):
        TimedeltaSchedule(timedelta(microseconds=5))

    with pytest.raises(ValueError):
        TimedeltaSchedule(timedelta(seconds=-1))


@freeze_time("2025-01-24 14:25:00")
def test_timedeltaschedule_is_due() -> None:
    now = timezone.now()
    schedule = TimedeltaSchedule(timedelta(minutes=5))

    assert not schedule.is_due(now)

    four_min_ago = now - timedelta(minutes=4, seconds=59)
    assert not schedule.is_due(four_min_ago)

    five_min_ago = now - timedelta(minutes=5)
    assert schedule.is_due(five_min_ago)

    six_min_ago = now - timedelta(minutes=6)
    assert schedule.is_due(six_min_ago)


@freeze_time("2025-01-24 14:25:00")
def test_timedeltaschedule_remaining_seconds() -> None:
    now = timezone.now()
    delta = timedelta(minutes=5)
    schedule = TimedeltaSchedule(delta)

    assert schedule.remaining_seconds(None) == 0
    assert schedule.remaining_seconds(now) == 300

    four_min_ago = now - timedelta(minutes=4, seconds=59)
    assert schedule.remaining_seconds(four_min_ago) == 1

    five_min_ago = now - timedelta(minutes=5)
    assert schedule.remaining_seconds(five_min_ago) == 0

    ten_min_ago = now - timedelta(minutes=10)
    assert schedule.remaining_seconds(ten_min_ago) == 0


def test_crontabschedule_invalid() -> None:
    with pytest.raises(ValueError):
        CrontabSchedule("test", crontab(hour="99"))

    with pytest.raises(ValueError):
        CrontabSchedule("test", crontab(hour="25"))

    with pytest.raises(ValueError):
        CrontabSchedule("test", crontab(day_of_week="25"))


def test_crontabschedule_is_due() -> None:
    schedule = CrontabSchedule("test", crontab(minute="*/5"))

    with freeze_time("2025-01-24 14:25:00"):
        now = timezone.now()
        assert schedule.is_due(None)
        assert not schedule.is_due(now)

    # last run was 14:20, current time is 14:22 = not due
    with freeze_time("2025-01-24 14:22:00"):
        two_twenty = timezone.now() - timedelta(minutes=2)
        assert not schedule.is_due(two_twenty)

    # last run was 14:20, current time is 14:25 = due
    with freeze_time("2025-01-24 14:25:00"):
        two_twenty = timezone.now() - timedelta(minutes=5)
        assert schedule.is_due(two_twenty)

    # last run was 14:15, current time is 14:25 = due as we missed an interval
    with freeze_time("2025-01-24 14:25:00"):
        two_fifteen = timezone.now() - timedelta(minutes=10)
        assert schedule.is_due(two_fifteen)

    # last run was 14:26 (the future) current time is 14:25 = not due
    with freeze_time("2025-01-24 14:25:00"):
        future = timezone.now() + timedelta(minutes=1)
        assert not schedule.is_due(future)


def test_crontabschedule_remaining_seconds() -> None:
    schedule = CrontabSchedule("test", crontab(minute="*/5"))

    assert schedule.remaining_seconds(None) == 0

    # last run was late (14:21), next spawn is at 14:25
    with freeze_time("2025-01-24 14:25:00"):
        four_min_ago = timezone.now() - timedelta(minutes=4)
        assert schedule.remaining_seconds(four_min_ago) == 0

    # last run was 5 min ago, right on schedule
    with freeze_time("2025-01-24 14:25:00"):
        five_min_ago = timezone.now() - timedelta(minutes=5)
        assert schedule.remaining_seconds(five_min_ago) == 0

    # last run was mere seconds ago. 5 min remaining
    with freeze_time("2025-01-24 14:25:10"):
        five_min_ago = timezone.now()
        assert schedule.remaining_seconds(five_min_ago) == 300

    # Later in the minute. crontabs only have minute precision.
    with freeze_time("2025-01-24 14:25:59"):
        five_min_ago = timezone.now()
        assert schedule.remaining_seconds(five_min_ago) == 300

    # It isn't time yet, as we're mid interval
    with freeze_time("2025-01-24 14:23:10"):
        three_min_ago = timezone.now() - timedelta(minutes=3)
        assert schedule.remaining_seconds(three_min_ago) == 120

    # 14:19 was 1 min late, we missed a beat but we're currently on time.
    with freeze_time("2025-01-24 14:25:10"):
        six_min_ago = timezone.now() - timedelta(minutes=6)
        assert schedule.remaining_seconds(six_min_ago) == 0

    # We have missed a few intervals, try to get back on schedule for the next beat
    with freeze_time("2025-01-24 14:23:00"):
        twenty_two_min_ago = timezone.now() - timedelta(minutes=22)
        assert schedule.remaining_seconds(twenty_two_min_ago) == 120

    # We have encountered a value from the future.
    # Our clock could be wrong, or we competing with another scheduler.
    # Advance to the next tick 14:30.
    with freeze_time("2025-01-24 14:24:00"):
        future_two = timezone.now() + timedelta(minutes=2)
        assert schedule.remaining_seconds(future_two) == 360


@freeze_time("2025-01-24 14:25:00")
def test_crontabschedule_runtime_after() -> None:
    schedule = CrontabSchedule("test", crontab(minute="*/15"))

    now = timezone.now()
    assert schedule.runtime_after(now) == datetime(2025, 1, 24, 14, 30, 0, tzinfo=UTC)

    last_run = datetime(2025, 1, 24, 14, 29, 15, tzinfo=UTC)
    assert schedule.runtime_after(last_run) == datetime(2025, 1, 24, 14, 30, 0, tzinfo=UTC)

    last_run = datetime(2025, 1, 24, 14, 38, 23, tzinfo=UTC)
    assert schedule.runtime_after(last_run) == datetime(2025, 1, 24, 14, 45, 0, tzinfo=UTC)

    schedule = CrontabSchedule("test", crontab(minute="1", hour="*/6"))
    last_run = datetime(2025, 1, 24, 14, 29, 15, tzinfo=UTC)
    assert schedule.runtime_after(last_run) == datetime(2025, 1, 24, 18, 1, 0, tzinfo=UTC)

    schedule = CrontabSchedule("test", crontab(minute="*/1"))
    now = timezone.now()
    assert schedule.runtime_after(now) == datetime(2025, 1, 24, 14, 26, 0, tzinfo=UTC)
