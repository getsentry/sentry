from datetime import UTC, date, datetime, timedelta
from time import strptime
from typing import TypedDict

from django.db import router, transaction

from sentry.escalation_policies.models.escalation_policy import EscalationPolicy
from sentry.escalation_policies.models.escalation_policy_state import (
    EscalationPolicyState,
    EscalationPolicyStateType,
)
from sentry.escalation_policies.models.rotation_schedule import (
    RotationSchedule,
    RotationScheduleLayer,
    ScheduleLayerRestriction,
    rotation_schedule_layer_rotation_type_to_days,
)
from sentry.models.group import Group


class RotationPeriod(TypedDict):
    start_time: datetime
    end_time: datetime
    user_id: int | None


strptime_format = "%H:%M"


def clock_time_on_this_day(date: date, clock_time_str: str) -> datetime:
    if clock_time_str == "24:00":
        clock_time_str = "00:00"
        date = date + timedelta(days=1)
    time = strptime(clock_time_str, strptime_format)
    return datetime.combine(date, datetime(*time[:6]).time(), tzinfo=UTC)


# Accepts a list like [["08:00", "10:00"]] and returns rotation periods mapping to non-overlapping periods
# e.g. [["00:00", "08:00"], ["10:00", "23:59"]
def invert_daily_layer_restrictions(
    date: date,
    layer_restrictions: ScheduleLayerRestriction,
) -> list[RotationPeriod]:
    day = date.strftime("%a")  # assumes locale="en_US"
    restrictions = layer_restrictions.get(day, [])
    if len(restrictions) == 0:
        return []

    restricted_times = [
        [clock_time_on_this_day(date, restriction[0]), clock_time_on_this_day(date, restriction[1])]
        for restriction in restrictions
    ]
    current_time_on_this_day = clock_time_on_this_day(date, "00:00")
    inverted_periods = []
    restricted_times_idx = 0
    while restricted_times_idx < len(restricted_times):
        if current_time_on_this_day < restricted_times[restricted_times_idx][0]:
            inverted_periods.append(
                [current_time_on_this_day, restricted_times[restricted_times_idx][0]]
            )
            current_time_on_this_day = restricted_times[restricted_times_idx][1]
        else:
            current_time_on_this_day = restricted_times[restricted_times_idx][1]
        restricted_times_idx += 1

    next_day = clock_time_on_this_day(date + timedelta(days=1), "00:00")
    if current_time_on_this_day < next_day:
        inverted_periods.append([current_time_on_this_day, next_day])
    return [
        RotationPeriod(
            start_time=period[0],
            end_time=period[1],
            user_id=None,
        )
        for period in inverted_periods
    ]


def apply_layer_restrictions(
    layer_rotation_period: RotationPeriod, layer_restrictions: ScheduleLayerRestriction
) -> list[RotationPeriod]:
    date = layer_rotation_period["start_time"].date()
    rotation_periods = [layer_rotation_period]
    while date <= layer_rotation_period["end_time"].date():
        restricted_periods = invert_daily_layer_restrictions(date, layer_restrictions)
        for restricted_period in restricted_periods:
            rotation_periods = coalesce_rotation_period(rotation_periods, restricted_period)
        date += timedelta(days=1)
    return rotation_periods


# Accept a list of RotationPeriods and a new rotation period. Returns a list of RotationPeriods
# that has coalesced the new period by overwriting the existing list
# Performance for this could be improved from O(n^2) to O(n) by accepting a second list to coalesce
def coalesce_rotation_period(
    periods: list[RotationPeriod], new_period: RotationPeriod
) -> list[RotationPeriod]:
    if len(periods) == 0:
        return [new_period]
    coalesced_periods = []
    period_idx = 0

    # Prepend case
    if new_period["end_time"] < periods[0]["start_time"] and new_period["user_id"] is not None:
        return [new_period] + periods

    # Append case
    if new_period["start_time"] > periods[-1]["end_time"] and new_period["user_id"] is not None:
        return periods + [new_period]

    # Overlap case

    # Add all non-overlapping existing periods
    while period_idx < len(periods) and periods[period_idx]["end_time"] <= new_period["start_time"]:
        coalesced_periods.append(periods[period_idx])
        period_idx += 1

    # Do we have an overlap?
    if period_idx < len(periods) and new_period["start_time"] < periods[period_idx]["end_time"]:
        # Split the current period
        current_period = periods[period_idx]
        if current_period["start_time"] < new_period["start_time"]:
            coalesced_periods.append(
                RotationPeriod(
                    start_time=current_period["start_time"],
                    end_time=new_period["start_time"],
                    user_id=current_period["user_id"],
                ),
            )
        # Don't put in actual periods for unassigned time
        if new_period["user_id"] is not None:
            coalesced_periods.append(
                RotationPeriod(
                    start_time=new_period["start_time"],
                    end_time=new_period["end_time"],
                    user_id=new_period["user_id"],
                )
            )
        if new_period["end_time"] < current_period["end_time"]:
            coalesced_periods.append(
                RotationPeriod(
                    start_time=new_period["end_time"],
                    end_time=current_period["end_time"],
                    user_id=current_period["user_id"],
                )
            )
        period_idx += 1

    while period_idx < len(periods):
        coalesced_periods.append(periods[period_idx])
        period_idx += 1

    return coalesced_periods


# Iterator for a schedule layer that spits out rotation periods during the time period
class ScheduleLayerRotationPeriodIterator:
    def __init__(self, schedule_layer):
        self.schedule_layer = schedule_layer
        self.user_ids = (
            schedule_layer.user_orders.order_by("order").values_list("user_id", flat=True).all()
        )
        self.current_time = clock_time_on_this_day(
            self.schedule_layer.start_date,
            self.schedule_layer.handoff_time,
        )
        schedule_layer.start_date
        self.current_user_index = 0
        self.buffer = []

    def __iter__(self):
        return self

    def __next__(self):
        if len(self.buffer) > 0:
            return self.buffer.pop(0)
        end_time = clock_time_on_this_day(
            (
                self.current_time
                + timedelta(
                    days=rotation_schedule_layer_rotation_type_to_days[
                        self.schedule_layer.rotation_type
                    ]
                )
            ).date(),
            self.schedule_layer.handoff_time,
        )
        self.buffer = apply_layer_restrictions(
            {
                "start_time": self.current_time,
                "end_time": end_time,
                "user_id": self.user_ids[self.current_user_index % len(self.user_ids)],
            },
            self.schedule_layer.schedule_layer_restrictions,
        )
        self.current_time = end_time
        self.current_user_index += 1

        return self.buffer.pop(0)

    # skip the iterator to the first period containing the passed time
    # This overrides current iterator state.
    def fast_forward_to(self, time) -> None:
        while True:
            period = next(self)
            if period["end_time"] > time:
                self.buffer = [period] + self.buffer
                return


def coalesce_schedule_layers(
    schedule_layers: list[RotationScheduleLayer], start_time: datetime, end_time: datetime
) -> list[RotationPeriod]:
    """
    This function takes a valid list of schedule layers and coalesces them into a single schedule layer.
    """
    schedule_layers = list(schedule_layers)
    schedule_layers.sort(key=lambda layer: layer.precedence)
    schedule: list[RotationPeriod] = []
    for layer in schedule_layers:
        period_iterator = ScheduleLayerRotationPeriodIterator(layer)
        period_iterator.fast_forward_to(start_time)
        while True:
            period = next(period_iterator)
            schedule = coalesce_rotation_period(schedule, period)
            if period["start_time"] > end_time:
                break
    return schedule


# Take a rotation schedule and a time and return the user ID for the oncall user
def determine_schedule_oncall(
    schedule: RotationSchedule, time: datetime | None = None
) -> int | None:
    if time is None:
        time = datetime.now(UTC)
    rotation_periods = coalesce_schedule_layers(schedule.layers.all(), time, time)

    if len(rotation_periods) == 0:
        return None

    return rotation_periods[0]["user_id"]


def trigger_escalation_policy(policy: EscalationPolicy, group: Group) -> EscalationPolicyState:
    from sentry.tasks.escalation_check import escalation_check

    with transaction.atomic(router.db_for_write(EscalationPolicy)):
        state = EscalationPolicyState.objects.create(
            escalation_policy=policy,
            state=EscalationPolicyStateType.UNACKNOWLEDGED,
            run_step_n=0,
            run_step_at=datetime.now(UTC),
            group=group,
        )
        transaction.on_commit(
            lambda: escalation_check.apply_async(kwargs=dict(escalation_policy_state_id=state.id)),
            using=router.db_for_write(EscalationPolicyState),
        )
    return state


# TODO: cleanup any outstanding scheduled jobs for this policy state
def alter_escalation_policy_state(
    policy_state: EscalationPolicyState, new_state: EscalationPolicyStateType
) -> EscalationPolicyState:
    policy_state.state = new_state
    policy_state.save()
    return policy_state
