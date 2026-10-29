from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType, ScheduleType
from sentry.cadence.schedule import (
    CronSchedule,
    IntervalSchedule,
    InvalidSchedule,
    advance,
    cron,
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


def test_cron_builds_cron_schedule() -> None:
    schedule = cron("0 10 * * *")
    assert schedule == CronSchedule("0 10 * * *", "UTC")
    assert schedule.schedule_type == ScheduleType.CRON


@pytest.mark.parametrize(
    "expression",
    ["*/30 * * * *", "0 10 * * *", "0 9 * * 1-5", "0 0 1 * *", "0 0 1 1 *"],
)
def test_cron_schedule_accepts_valid(expression: str) -> None:
    assert cron(expression).expression == expression


@pytest.mark.parametrize(
    "expression",
    [
        "",
        "bad",
        "61 * * * *",
        "0 10 * * * *",
        "0 0 30 2 *",
        # Too frequent.
        "* * * * *",
        "*/15 * * * *",
        # Mostly hourly, but two runs 10 minutes apart once a day.
        "0,10 9 * * *",
    ],
)
def test_cron_schedule_rejects_invalid(expression: str) -> None:
    with pytest.raises(InvalidSchedule):
        cron(expression)


def test_cron_schedule_rejects_unknown_timezone() -> None:
    with pytest.raises(InvalidSchedule):
        cron("0 10 * * *", "Mars/Olympus_Mons")


def test_cron_schedule_next_after_uses_timezone() -> None:
    # 09:00 in New York is 14:00 UTC before the March 10 DST change, 13:00 UTC after.
    schedule = cron("0 9 * * *", "America/New_York")
    assert schedule.next_after(NOW) == datetime(2024, 3, 9, 14, 0, tzinfo=UTC)
    assert schedule.next_after(datetime(2024, 3, 10, 15, 0, tzinfo=UTC)) == datetime(
        2024, 3, 11, 13, 0, tzinfo=UTC
    )


def interval_trigger(interval: timedelta) -> ScheduledTrigger:
    return ScheduledTrigger(
        trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
        schedule_type=ScheduleType.INTERVAL,
        interval_seconds=int(interval.total_seconds()),
    )


def cron_trigger(expression: str, tz: str = "UTC") -> ScheduledTrigger:
    return ScheduledTrigger(
        trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
        schedule_type=ScheduleType.CRON,
        cron_expression=expression,
        timezone=tz,
    )


def test_schedule_of_interval_trigger() -> None:
    assert schedule_of(interval_trigger(timedelta(hours=2))) == every(timedelta(hours=2))


def test_schedule_of_cron_trigger() -> None:
    assert schedule_of(cron_trigger("0 9 * * *", tz="America/New_York")) == cron(
        "0 9 * * *", "America/New_York"
    )


def test_stored_schedules_are_not_validated_again() -> None:
    with patch("sentry.cadence.schedule._cron_error", return_value=None) as cron_error:
        assert schedule_of(cron_trigger("0 9 * * *")) == CronSchedule("0 9 * * *")
        advance(cron_trigger("0 * * * *"), NOW, NOW)
    # Only the CronSchedule built for comparison above was validated.
    cron_error.assert_called_once_with("0 9 * * *", "UTC")

    # A stored schedule that today's rules would reject still loads.
    stored = schedule_of(interval_trigger(timedelta(minutes=5)))
    assert isinstance(stored, IntervalSchedule)
    assert stored.interval == timedelta(minutes=5)


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
