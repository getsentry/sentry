import itertools
import operator
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TypedDict

from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType
from sentry.workflow_engine.types import DetectorPriorityLevel

PRIORITY_NAMES = {
    DetectorPriorityLevel.MEDIUM: "medium",
    DetectorPriorityLevel.HIGH: "high",
}

COMPARISON_OPERATORS: dict[str, Callable[[float, float], bool]] = {
    "gt": operator.gt,
    "gte": operator.ge,
    "lt": operator.lt,
    "lte": operator.le,
}


@dataclass(frozen=True)
class ThresholdCondition:
    type: str
    comparison: float
    priority: DetectorPriorityLevel


@dataclass(frozen=True)
class AnomalyBand:
    expected_values: Sequence[float]
    tolerance: float
    direction: AnomalyDetectionThresholdType


class OpenPeriodActivity(TypedDict):
    id: str
    type: str
    value: str | None
    dateCreated: str
    eventId: None


class OpenPeriod(TypedDict):
    id: str
    groupId: str
    shortId: str
    start: str
    end: str | None
    isOpen: bool
    activities: list[OpenPeriodActivity]


@dataclass(frozen=True)
class OpenPeriodIdentity:
    first_open_period_id: int
    group_id: str
    short_id: str


def is_condition_met(condition: ThresholdCondition, value: float) -> bool:
    compare = COMPARISON_OPERATORS[condition.type]

    return compare(value, condition.comparison)


def evaluate_threshold_priority(
    conditions: Sequence[ThresholdCondition], value: float, current_priority: DetectorPriorityLevel
) -> DetectorPriorityLevel:
    met_priorities = [
        condition.priority for condition in conditions if is_condition_met(condition, value)
    ]

    return max(met_priorities, default=current_priority)


def evaluate_threshold_priorities(
    conditions: Sequence[ThresholdCondition], values: Sequence[float]
) -> list[DetectorPriorityLevel]:
    priorities = itertools.accumulate(
        values,
        lambda priority, value: evaluate_threshold_priority(conditions, value, priority),
        initial=DetectorPriorityLevel.OK,
    )

    return list(priorities)[1:]


def get_percent_of_comparison(value: float, comparison_value: float) -> float:
    if comparison_value == 0:
        return 100 if value == 0 else float("inf")

    return value / comparison_value * 100


def evaluate_percent_priorities(
    conditions: Sequence[ThresholdCondition],
    values: Sequence[float],
    comparison_values: Sequence[float],
) -> list[DetectorPriorityLevel]:
    percents_of_comparison = [
        get_percent_of_comparison(value, comparison_value)
        for value, comparison_value in zip(values, comparison_values)
    ]

    return evaluate_threshold_priorities(conditions, percents_of_comparison)


def is_anomalous(value: float, expected_value: float, band: AnomalyBand) -> bool:
    is_above = value > expected_value + band.tolerance

    is_below = value < expected_value - band.tolerance

    if band.direction == AnomalyDetectionThresholdType.ABOVE:
        return is_above

    if band.direction == AnomalyDetectionThresholdType.BELOW:
        return is_below

    return is_above or is_below


def evaluate_anomaly_priorities(
    band: AnomalyBand, values: Sequence[float]
) -> list[DetectorPriorityLevel]:
    return [
        DetectorPriorityLevel.HIGH
        if is_anomalous(value, expected_value, band)
        else DetectorPriorityLevel.OK
        for value, expected_value in zip(values, band.expected_values)
    ]


def format_timestamp(timestamp_ms: int) -> str:
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def group_consecutive_alerting_buckets(
    priorities: Sequence[DetectorPriorityLevel],
) -> Iterator[list[tuple[int, DetectorPriorityLevel]]]:
    indexed_priorities = enumerate(priorities)

    for is_alerting, run in itertools.groupby(
        indexed_priorities, key=lambda item: item[1] > DetectorPriorityLevel.OK
    ):
        if is_alerting:
            yield list(run)


def build_activities(
    alerting_run: Sequence[tuple[int, DetectorPriorityLevel]],
    update_times_ms: Sequence[int],
    first_activity_id: int,
    is_closed: bool,
) -> list[OpenPeriodActivity]:
    priority_changes = [
        (index, priority)
        for position, (index, priority) in enumerate(alerting_run)
        if position == 0 or alerting_run[position - 1][1] != priority
    ]

    activities: list[OpenPeriodActivity] = [
        {
            "id": str(first_activity_id + position),
            "type": "opened" if position == 0 else "status_change",
            "value": PRIORITY_NAMES[priority],
            "dateCreated": format_timestamp(update_times_ms[index]),
            "eventId": None,
        }
        for position, (index, priority) in enumerate(priority_changes)
    ]

    if not is_closed:
        return activities

    closing_index = alerting_run[-1][0] + 1

    closed_activity: OpenPeriodActivity = {
        "id": str(first_activity_id + len(activities)),
        "type": "closed",
        "value": None,
        "dateCreated": format_timestamp(update_times_ms[closing_index]),
        "eventId": None,
    }

    return [*activities, closed_activity]


def build_open_periods(
    priorities: Sequence[DetectorPriorityLevel],
    bucket_starts_ms: Sequence[int],
    interval_seconds: int,
    identity: OpenPeriodIdentity,
) -> list[OpenPeriod]:
    """
    Open periods as the Slack chart receives them. A bucket is evaluated when it ends, which
    is when activities are recorded. The open periods endpoint is called with a bucket size,
    so it moves `start` and `end` back by one interval and leaves activities alone.
    """
    interval_ms = interval_seconds * 1000

    update_times_ms = [bucket_start_ms + interval_ms for bucket_start_ms in bucket_starts_ms]

    alerting_runs = list(group_consecutive_alerting_buckets(priorities))

    open_periods: list[OpenPeriod] = []

    for position, alerting_run in enumerate(alerting_runs):
        opening_index = alerting_run[0][0]

        closing_index = alerting_run[-1][0] + 1

        is_closed = closing_index < len(priorities)

        open_period_id = identity.first_open_period_id + position

        activities = build_activities(
            alerting_run,
            update_times_ms,
            first_activity_id=open_period_id * 10,
            is_closed=is_closed,
        )

        end = format_timestamp(update_times_ms[closing_index] - interval_ms) if is_closed else None

        open_periods.append(
            {
                "id": str(open_period_id),
                "groupId": identity.group_id,
                "shortId": identity.short_id,
                "start": format_timestamp(update_times_ms[opening_index] - interval_ms),
                "end": end,
                "isOpen": not is_closed,
                "activities": activities,
            }
        )

    return open_periods
