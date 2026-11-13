from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType, ScheduleType
from sentry.cadence.schedule import (
    CronSchedule,
    IntervalSchedule,
    InvalidSchedule,
    Schedule,
    advance,
    cron,
    every,
    min_gap,
    missed_between,
    next_time_after,
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
    [
        "*/30 * * * *",
        "0 10 * * *",
        "0 9 * * 1-5",
        "0 0 1 * *",
        "0 0 1 1 *",
        # Rare enough that 2000 times would pass datetime's year 9999 limit.
        "0 0 29 2 *",
    ],
)
def test_cron_schedule_accepts_valid(expression: str) -> None:
    assert cron(expression).expression == expression


def test_leap_day_schedule() -> None:
    schedule = cron("0 0 29 2 *")

    assert schedule.next_after(NOW) == datetime(2028, 2, 29, tzinfo=UTC)
    assert min_gap(schedule) == timedelta(weeks=1)


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
        # Mostly hourly, but two times 10 minutes apart once a day.
        "0,10 9 * * *",
    ],
)
def test_cron_schedule_rejects_invalid(expression: str) -> None:
    with pytest.raises(InvalidSchedule):
        cron(expression)


def test_cron_schedule_rejects_unknown_timezone() -> None:
    with pytest.raises(InvalidSchedule):
        cron("0 10 * * *", "Mars/Olympus_Mons")


def test_cron_spacing_is_checked_in_real_time() -> None:
    # 75 minutes apart on the clock, but 15 minutes apart when New York's clocks go forward
    # (01:45 EST to 03:00 EDT).
    assert cron("0,45 1,3 * * *").expression == "0,45 1,3 * * *"
    with pytest.raises(InvalidSchedule):
        cron("0,45 1,3 * * *", "America/New_York")


@pytest.mark.parametrize(
    ("schedule", "expected"),
    [
        (every(timedelta(hours=3)), timedelta(hours=3)),
        (cron("0 * * * *"), timedelta(hours=1)),
        (cron("0 9 * * *"), timedelta(days=1)),
        # Only 24 hours apart during the week, and longer over the weekend.
        (cron("0 9 * * 1-5", "America/New_York"), timedelta(days=1)),
        # 45 minutes apart once a day.
        (cron("0,45 9 * * *"), timedelta(minutes=45)),
        # Capped at a week.
        (cron("0 0 1 * *"), timedelta(weeks=1)),
    ],
)
def test_min_gap(schedule: Schedule, expected: timedelta) -> None:
    assert min_gap(schedule) == expected


def test_min_gap_measures_daylight_saving_changes() -> None:
    # 9:00 every day is 23 hours after the previous 9:00 when the clocks go forward.
    assert min_gap(cron("0 9 * * *", "America/New_York")) == timedelta(hours=23)


# New York's clocks go back at 02:00 EDT on 2024-11-03, so 01:00-02:00 happens twice: as EDT
# (05:00-06:00 UTC), then as EST (06:00-07:00 UTC).
FALL_BACK_FIRST_HOUR = datetime(2024, 11, 3, 5, 0, tzinfo=UTC)
FALL_BACK_SECOND_HOUR = datetime(2024, 11, 3, 6, 0, tzinfo=UTC)
# 01:30 EST the next day.
FALL_BACK_NEXT_DAY_0130 = datetime(2024, 11, 4, 6, 30, tzinfo=UTC)


@pytest.mark.parametrize(
    ("after", "expected"),
    [
        # 01:30 fires at its first occurrence, 01:30 EDT...
        (
            FALL_BACK_FIRST_HOUR + timedelta(minutes=10),
            FALL_BACK_FIRST_HOUR + timedelta(minutes=30),
        ),
        # ...and not again at 01:30 EST, even from within the second 01:00-02:00.
        (FALL_BACK_FIRST_HOUR + timedelta(minutes=40), FALL_BACK_NEXT_DAY_0130),
        (FALL_BACK_SECOND_HOUR + timedelta(minutes=10), FALL_BACK_NEXT_DAY_0130),
        (FALL_BACK_SECOND_HOUR + timedelta(minutes=40), FALL_BACK_NEXT_DAY_0130),
    ],
)
def test_cron_runs_a_repeated_time_once(after: datetime, expected: datetime) -> None:
    schedule = cron("30 1 * * *", "America/New_York")

    assert schedule.next_after(after) == expected


def test_cron_next_time_is_always_later_across_clock_changes() -> None:
    expressions = ["30 1 * * *", "0 1 * * *", "30 2 * * *", "45 1,3 * * *", "0,30 * * * *"]
    schedules = [cron(expression, "America/New_York") for expression in expressions]
    # Every 5 minutes across both 2024 clock change days, with half a day either side.
    afters = [
        start + timedelta(minutes=minute)
        for start in (datetime(2024, 3, 9, 12, tzinfo=UTC), datetime(2024, 11, 2, 12, tzinfo=UTC))
        for minute in range(0, 48 * 60, 5)
    ]

    assert [
        (schedule.expression, after)
        for schedule in schedules
        for after in afters
        if schedule.next_after(after) <= after
    ] == []


def test_cron_runs_a_skipped_time_when_clocks_go_forward() -> None:
    # New York's clocks go forward at 02:00 EST on 2024-03-10, so 02:30 doesn't happen.
    schedule = cron("30 2 * * *", "America/New_York")

    assert schedule.next_after(datetime(2024, 3, 10, 6, 0, tzinfo=UTC)) == datetime(
        2024, 3, 10, 7, 0, tzinfo=UTC
    )


def test_advance_cron_within_a_repeated_hour_moves_forward() -> None:
    # A tick in the second 01:00-02:00 must not move the trigger back to the first 01:30.
    trigger = cron_trigger("30 1 * * *", tz="America/New_York")
    scheduled_for = FALL_BACK_FIRST_HOUR + timedelta(minutes=30)
    now = FALL_BACK_SECOND_HOUR + timedelta(minutes=10)

    assert advance(trigger, scheduled_for, now) == FALL_BACK_NEXT_DAY_0130


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


def cron_trigger(
    expression: str, tz: str = "UTC", *, min_gap_seconds: int = 1800
) -> ScheduledTrigger:
    return ScheduledTrigger(
        trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
        schedule_type=ScheduleType.CRON,
        cron_expression=expression,
        timezone=tz,
        min_gap_seconds=min_gap_seconds,
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


def test_next_time_after_interval() -> None:
    trigger = interval_trigger(timedelta(hours=2))
    assert next_time_after(trigger, NOW) == NOW + timedelta(hours=2)


def test_next_time_after_cron() -> None:
    trigger = cron_trigger("30 * * * *")
    assert next_time_after(trigger, NOW) == datetime(2024, 3, 9, 12, 30, tzinfo=UTC)


def test_next_time_after_cron_uses_timezone() -> None:
    # 09:00 in New York is 14:00 UTC before the March 10 DST change.
    trigger = cron_trigger("0 9 * * *", tz="America/New_York")
    assert next_time_after(trigger, NOW) == datetime(2024, 3, 9, 14, 0, tzinfo=UTC)
    # And 13:00 UTC after it.
    assert next_time_after(trigger, datetime(2024, 3, 10, 15, 0, tzinfo=UTC)) == datetime(
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


def test_reschedule_keeps_next_time_within_new_interval() -> None:
    current = NOW + timedelta(minutes=5)
    assert reschedule_for_new_interval(current, timedelta(minutes=30), NOW) == current


@pytest.mark.parametrize("hours, expected", [(1, 0), (2, 1), (4, 3), (10000, 9999)])
def test_missed_interval_count_is_exact(hours: int, expected: int) -> None:
    assert missed_between(
        interval_trigger(timedelta(hours=1)), NOW, NOW + timedelta(hours=hours)
    ) == (expected, False)


@pytest.mark.parametrize("hours, expected", [(1, 0), (2, 1), (4, 3)])
def test_missed_cron_count_excludes_both_endpoints(hours: int, expected: int) -> None:
    assert missed_between(cron_trigger("0 * * * *"), NOW, NOW + timedelta(hours=hours)) == (
        expected,
        False,
    )


@pytest.mark.parametrize("seconds", [0, 1])
def test_missed_cron_count_avoids_iteration_within_the_minimum_gap(seconds: int) -> None:
    trigger = cron_trigger("0 * * * *", min_gap_seconds=3600)

    with patch("sentry.cadence.schedule.CronSim") as cron_sim:
        assert missed_between(
            trigger, NOW + timedelta(seconds=seconds), NOW + timedelta(hours=1)
        ) == (0, False)

    cron_sim.assert_not_called()


def test_missed_cron_count_counts_just_beyond_the_minimum_gap() -> None:
    trigger = cron_trigger("0 * * * *", min_gap_seconds=3600)

    assert missed_between(trigger, NOW - timedelta(seconds=1), NOW + timedelta(hours=1)) == (
        1,
        False,
    )


def test_missed_cron_count_fast_path_uses_real_time_across_dst() -> None:
    trigger = cron_trigger("0 9 * * *", tz="America/New_York", min_gap_seconds=23 * 3600)

    with patch("sentry.cadence.schedule.CronSim") as cron_sim:
        assert missed_between(
            trigger,
            datetime(2024, 3, 9, 14, 0, tzinfo=UTC),
            datetime(2024, 3, 10, 13, 0, tzinfo=UTC),
        ) == (0, False)

    cron_sim.assert_not_called()


def test_missed_cron_count_is_bounded_without_changing_the_next_time() -> None:
    trigger = cron_trigger("0 * * * *")
    with patch("sentry.cadence.schedule.MAX_MISSED_CRON_FIRINGS", 3):
        assert missed_between(trigger, NOW, NOW + timedelta(hours=4)) == (3, False)
        next_scheduled_for = advance(trigger, NOW, NOW + timedelta(hours=10))
        assert next_scheduled_for == NOW + timedelta(hours=11)
        assert missed_between(trigger, NOW, next_scheduled_for) == (3, True)


def test_missed_cron_count_does_not_count_the_repeated_dst_hour_twice() -> None:
    assert missed_between(
        cron_trigger("30 1 * * *", tz="America/New_York"),
        datetime(2024, 11, 2, 5, 30, tzinfo=UTC),
        datetime(2024, 11, 5, 6, 30, tzinfo=UTC),
    ) == (2, False)


def test_missed_cron_count_includes_the_shifted_spring_dst_firing() -> None:
    assert missed_between(
        cron_trigger("30 2 * * *", tz="America/New_York"),
        datetime(2024, 3, 9, 7, 30, tzinfo=UTC),
        datetime(2024, 3, 12, 6, 30, tzinfo=UTC),
    ) == (2, False)


def test_reschedule_pulls_in_next_time_beyond_new_interval() -> None:
    current = NOW + timedelta(minutes=59)
    assert reschedule_for_new_interval(current, timedelta(minutes=30), NOW) == NOW + timedelta(
        minutes=30
    )


def test_reschedule_without_next_time() -> None:
    assert reschedule_for_new_interval(None, timedelta(hours=1), NOW) == NOW + timedelta(hours=1)
