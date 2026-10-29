from datetime import UTC, datetime, timedelta

import pytest

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType, ScheduleType
from sentry.cadence.schedule import (
    IntervalSchedule,
    InvalidSchedule,
    advance,
    every,
    next_run_after,
    reschedule_for_new_interval,
    schedule_of,
)

NOW = datetime(2024, 3, 9, 12, 0, tzinfo=UTC)


def test_every_builds_interval_schedule() -> None:
    schedule = every(timedelta(hours=2))
    assert schedule == IntervalSchedule(timedelta(hours=2))
    assert schedule.interval_seconds == 7200
    assert schedule.schedule_type == ScheduleType.INTERVAL


def test_interval_schedule_accepts_bounds() -> None:
    assert every(timedelta(minutes=30)).interval == timedelta(minutes=30)
    assert every(timedelta(weeks=1)).interval == timedelta(weeks=1)


@pytest.mark.parametrize(
    "interval",
    [
        timedelta(minutes=29, seconds=59),
        timedelta(weeks=1, seconds=1),
        timedelta(hours=1, microseconds=1),
        timedelta(0),
        timedelta(hours=-1),
    ],
)
def test_interval_schedule_rejects_invalid(interval: timedelta) -> None:
    with pytest.raises(InvalidSchedule):
        every(interval)


def interval_trigger(interval: timedelta) -> ScheduledTrigger:
    return ScheduledTrigger(
        trigger_type=ScheduledTriggerType.TRIAGE,
        schedule_type=ScheduleType.INTERVAL,
        interval_seconds=int(interval.total_seconds()),
    )


def cron_trigger(expression: str, tz: str = "UTC") -> ScheduledTrigger:
    return ScheduledTrigger(
        trigger_type=ScheduledTriggerType.TRIAGE,
        schedule_type=ScheduleType.CRON,
        cron_expression=expression,
        timezone=tz,
    )


def test_schedule_of_interval_trigger() -> None:
    assert schedule_of(interval_trigger(timedelta(hours=2))) == every(timedelta(hours=2))


def test_schedule_of_cron_trigger_not_supported_yet() -> None:
    with pytest.raises(NotImplementedError):
        schedule_of(cron_trigger("0 * * * *"))


def test_next_run_after_interval() -> None:
    trigger = interval_trigger(timedelta(hours=2))
    assert next_run_after(trigger, NOW) == NOW + timedelta(hours=2)


def test_next_run_after_cron() -> None:
    trigger = cron_trigger("30 * * * *")
    assert next_run_after(trigger, NOW) == datetime(2024, 3, 9, 12, 30, tzinfo=UTC)


def test_next_run_after_cron_uses_timezone() -> None:
    # 09:00 in New York is 14:00 UTC before the March 10 DST change.
    trigger = cron_trigger("0 9 * * *", tz="America/New_York")
    assert next_run_after(trigger, NOW) == datetime(2024, 3, 9, 14, 0, tzinfo=UTC)
    # And 13:00 UTC after it.
    assert next_run_after(trigger, datetime(2024, 3, 10, 15, 0, tzinfo=UTC)) == datetime(
        2024, 3, 11, 13, 0, tzinfo=UTC
    )


def test_advance_interval_on_time() -> None:
    trigger = interval_trigger(timedelta(hours=1))
    assert advance(trigger, NOW, NOW) == NOW + timedelta(hours=1)


def test_advance_interval_keeps_cadence_when_late() -> None:
    trigger = interval_trigger(timedelta(hours=1))
    late = NOW + timedelta(minutes=5)
    assert advance(trigger, NOW, late) == NOW + timedelta(hours=1)


def test_advance_interval_skips_missed_runs() -> None:
    trigger = interval_trigger(timedelta(hours=1))
    much_later = NOW + timedelta(hours=3, minutes=10)
    assert advance(trigger, NOW, much_later) == NOW + timedelta(hours=4)


def test_advance_interval_exactly_on_a_missed_boundary() -> None:
    trigger = interval_trigger(timedelta(hours=1))
    assert advance(trigger, NOW, NOW + timedelta(hours=2)) == NOW + timedelta(hours=3)


def test_advance_cron_skips_missed_runs() -> None:
    trigger = cron_trigger("0 * * * *")
    much_later = NOW + timedelta(hours=3, minutes=10)
    assert advance(trigger, NOW, much_later) == NOW + timedelta(hours=4)


def test_reschedule_keeps_next_run_within_new_interval() -> None:
    current = NOW + timedelta(minutes=5)
    assert reschedule_for_new_interval(current, timedelta(minutes=30), NOW) == current


def test_reschedule_pulls_in_next_run_beyond_new_interval() -> None:
    current = NOW + timedelta(minutes=59)
    assert reschedule_for_new_interval(current, timedelta(minutes=30), NOW) == NOW + timedelta(
        minutes=30
    )


def test_reschedule_jitter_only_applies_to_new_runs() -> None:
    jitter = timedelta(seconds=42)
    kept = NOW + timedelta(minutes=5)
    assert reschedule_for_new_interval(kept, timedelta(minutes=30), NOW, jitter) == kept
    pulled_in = NOW + timedelta(minutes=59)
    assert reschedule_for_new_interval(
        pulled_in, timedelta(minutes=30), NOW, jitter
    ) == NOW + timedelta(minutes=30, seconds=42)


def test_reschedule_without_next_run() -> None:
    assert reschedule_for_new_interval(None, timedelta(hours=1), NOW) == NOW + timedelta(hours=1)
