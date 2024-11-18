"""
This module contains functionality dedicated to detecting and mitigating
"system incidents". Specifically this system is destined to detect drops in
check-in ingestion volume, indicating that there is an upstream outage and we
can no logger reliably trust that miss and time-out detection is producing
appropriate results.
"""

from __future__ import annotations

import logging
import statistics
from collections import Counter
from collections.abc import Generator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from itertools import batched, chain

from django.conf import settings

from sentry import options
from sentry.utils import metrics, redis

logger = logging.getLogger("sentry")

# This key is used to record historical date about the volume of check-ins.
MONITOR_VOLUME_HISTORY = "sentry.monitors.volume_history:{ts}"

# This key is used to record the metric volume metric for the tick.
MONITOR_TICK_METRIC = "sentry.monitors.volume_metric:{ts}"

# This key is used to record the anomaly decision for a tick.
MONITOR_TICK_DECISION = "sentry.monitors.tick_decision:{ts}"

# Tracks the timestamp of the first clock tick of a system incident.
MONITR_LAST_SYSTEM_INCIDENT_TS = "sentry.monitors.last_system_incident_ts"

# When fetching historic volume data to make a decision whether we have lost
# data this value will determine how many historic volume data-points we fetch
# of the window of the MONITOR_VOLUME_RETENTION. It is important to consider
# the expected uniformity of the volume for different steps.
#
# For example, since we tend to have much larger volume of check-ins
# on-the-hour it may not make sense to look at each minute as a data point.
# This is why this is set to 1 day, since this should closely match the
# harmonics of how check-ins are sent (people like to check-in on the hour, but
# there are probably more check-ins at midnight, than at 3pm).
MONITOR_VOLUME_DECISION_STEP = timedelta(days=1)

# We record 30 days worth of historical data for each minute of check-ins.
MONITOR_VOLUME_RETENTION = timedelta(days=30)

# The _backfill_decisions function which is responsible for updating prior
# decisions to NORMAL or INCIDENT should never backfill more than this number
# of tick decisions. If it does, there is a problem somewhere. This cutoff is
# basically run-away prevention.
#
# We should absolutely never have anomalies longer than a full day.
BACKFILL_CUTOFF = 1440

# When running a decision backfill, how many decisions should we fetch at once
# from redis in batches.
BACKFILL_CHUNKS = 10


def update_check_in_volume(ts_list: Sequence[datetime]):
    """
    Increment counters for a list of check-in timestamps. Each timestamp will be
    trimmed to the minute and grouped appropriately
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    # Group timestamps down to the minute
    for reference_ts, count in Counter(_make_reference_ts(ts) for ts in ts_list).items():
        key = MONITOR_VOLUME_HISTORY.format(ts=reference_ts)

        pipeline = redis_client.pipeline()
        pipeline.incr(key, amount=count)
        pipeline.expire(key, MONITOR_VOLUME_RETENTION)
        pipeline.execute()


def process_clock_tick_for_system_incidents(tick: datetime) -> DecisionResult:
    """
    Encapsulates logic specific to determining if we are in a system incident
    during each clock tick.
    """
    record_clock_tick_volume_metric(tick)
    result = make_clock_tick_decision(tick)

    logger.info(
        "monitors.system_incidents.process_clock_tick",
        extra={"decision": result.decision, "transition": result.transition},
    )

    # Record metrics for each tick decision
    metrics.incr(
        "monitors.tasks.clock_tick.tick_decision",
        tags={"decision": result.decision},
        sample_rate=1.0,
    )
    if result.transition:
        metrics.incr(
            "monitors.tasks.clock_tick.tick_transition",
            tags={"transition": result.transition},
            sample_rate=1.0,
        )

    # When entering an incident record the starting tiemstamp of the incident
    if result.transition == AnomalyTransition.INCIDENT_STARTED:
        record_last_incidnet_ts(result.ts)

    # When exiting an incident prune check-in volume during that incident
    if result.transition == AnomalyTransition.INCIDENT_RECOVERED:
        if start := get_last_incident_ts():
            prune_incident_check_in_volume(start, result.ts)
        else:
            logger.error("monitors.system_incidents.recovered_without_start_ts")

    return result


def record_last_incidnet_ts(ts: datetime) -> None:
    """
    Records the timestamp of the most recent
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
    redis_client.set(MONITR_LAST_SYSTEM_INCIDENT_TS, int(ts.timestamp()))


def get_last_incident_ts() -> datetime | None:
    """
    Retrieves the timestamp of the last system incident
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
    value = _int_or_none(redis_client.get(MONITR_LAST_SYSTEM_INCIDENT_TS))
    return datetime.fromtimestamp(value, UTC) if value else None


def prune_incident_check_in_volume(start: datetime, end: datetime) -> None:
    """
    After recovering from a system incident the volume data must be discarded
    to avoid skewing future computations. Note that the start time is inclusive
    and the end time is exclusive.
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    # Length of the incident in minutes
    length = int((end - start).total_seconds()) // 60

    # XXX(epurkhiser): Because we make clock tick decisions at the timestamp of
    # the clock ticking, we are storing the decision at the tick timestamp
    # AFTER the tick timestamp where the volume and metric values are stored.
    #
    # Adjust for this by moving the start back a minute.
    start = start - timedelta(minutes=1)
    dates = (start + timedelta(minutes=offset) for offset in range(length))

    # Batch deletes
    for timestamp_batch in batched(dates, 30):
        pipeline = redis_client.pipeline()
        for ts in timestamp_batch:
            pipeline.delete(MONITOR_VOLUME_HISTORY.format(ts=_make_reference_ts(ts)))
        pipeline.execute()


def record_clock_tick_volume_metric(tick: datetime) -> None:
    """
    Look at the historic volume of check-ins for this tick over the last
    MONITOR_VOLUME_RETENTION period and record a "tick metric". The specific
    metric we are recording is percentage deviation from the mean historic
    volume for each minute.

    This metric will be used when making a decision to determine if a
    particular tick is in an incident state or operating normally.

    NOTE that this records a metric for the tick timestamp that we just ticked
    over. So when ticking at 12:01 the metric is recorded for 12:00.
    """
    if not options.get("crons.tick_volume_anomaly_detection"):
        return

    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    # The clock has just ticked to the next minute. Look at the previous minute
    # volume across the last with the values
    past_ts = tick - timedelta(minutes=1)
    start_ts = past_ts - MONITOR_VOLUME_RETENTION

    # Generate previous timestamps to fetch. The first past_ts timestamp is
    # also included in this query
    historic_timestamps: list[datetime] = [past_ts]
    historic_ts = past_ts

    while historic_ts > start_ts:
        historic_ts = historic_ts - MONITOR_VOLUME_DECISION_STEP
        historic_timestamps.append(historic_ts)

    # Bulk fetch volume counts
    volumes = redis_client.mget(
        MONITOR_VOLUME_HISTORY.format(ts=_make_reference_ts(ts)) for ts in historic_timestamps
    )

    past_minute_volume = _int_or_none(volumes.pop(0))
    historic_volume: list[int] = [int(v) for v in volumes if v is not None]

    # Can't make any decisions if we didn't have data for the past minute
    if past_minute_volume is None:
        return

    # We need AT LEAST two data points to calculate standard deviation
    if len(historic_volume) < 2:
        return

    # Record some statistics about the past_minute_volume volume in comparison
    # to the historic_volume data

    historic_mean = statistics.mean(historic_volume)
    historic_stdev = statistics.stdev(historic_volume)

    historic_stdev_pct = (historic_stdev / historic_mean) * 100

    # Calculate the z-score of our past minutes volume in comparison to the
    # historic volume data. The z-score is measured in terms of standard
    # deviations from the mean
    if historic_stdev != 0.0:
        z_score = (past_minute_volume - historic_mean) / historic_stdev
    else:
        z_score = 0.0

    # Percentage deviation from the mean for our past minutes volume
    pct_deviation = (past_minute_volume - historic_mean) / historic_mean * 100

    metrics.gauge(
        "monitors.task.clock_tick.historic_volume_stdev_pct",
        historic_stdev_pct,
        sample_rate=1.0,
    )
    metrics.gauge("monitors.task.volume_history.count", len(historic_volume), sample_rate=1.0)
    metrics.gauge("monitors.task.volume_history.z_score", z_score, sample_rate=1.0)
    metrics.gauge("monitors.task.volume_history.pct_deviation", pct_deviation, sample_rate=1.0)

    logger.info(
        "monitors.system_incidents.volume_history",
        extra={
            "reference_datetime": str(tick),
            "evaluation_minute": past_ts.strftime("%H:%M"),
            "history_count": len(historic_volume),
            "z_score": z_score,
            "pct_deviation": pct_deviation,
            "historic_mean": historic_mean,
            "historic_stdev": historic_stdev,
        },
    )

    key = MONITOR_TICK_METRIC.format(ts=_make_reference_ts(past_ts))
    redis_client.set(key, pct_deviation)
    redis_client.expire(key, MONITOR_VOLUME_RETENTION)


def get_clock_tick_volume_metric(tick: datetime) -> float | None:
    """
    Retrieve the volume metric for a specific clock tick.
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    if value := redis_client.get(MONITOR_TICK_METRIC.format(ts=_make_reference_ts(tick))):
        return float(value)
    else:
        return None


class TickAnomalyDecision(StrEnum):
    """
    This enum represents the system incident anomaly decision made for a
    clock-tick. Tick transitions are represented by the AnomalyTransition.
    """

    NORMAL = "normal"
    """
    The tick is within expected volume levels and does not show any
    abnormalities. The system is working as normal.
    """

    ABNORMAL = "abnormal"
    """
    The volume metrics have indicated that we've seen an abnormal number of
    check-ins for this tick. We may be entering an INCIDENT state.

    All abnormal tick decisions will be contiguous, and will resolve into
    either NORMAL or INCIDENT.
    """

    INCIDENT = "incident"
    """
    The volume metrics have indicated that we are in a system incident, this
    means we are not processing as many check-ins as we typically do.

    Once in an incident we will transition into RECOVERING once we've detected
    enough normal volume metrics.
    """

    RECOVERING = "recovering"
    """
    We are transitioning out of an incident. Volume metrics must remain below
    abnormal levels in order for RECOVERING to transition into NORMAL.

    All recovering tick decisions will be contiguous, and will resolve into
    either NORMAL or back into INCIDENT.
    """

    def is_pending(self) -> bool:
        """
        Returns True when the decision is ABNORMAL or RECOVERING, indicating
        that we are currently pending resolution of this decision.
        """
        return self in [TickAnomalyDecision.ABNORMAL, TickAnomalyDecision.RECOVERING]

    def is_incident(self) -> bool:
        return self == TickAnomalyDecision.INCIDENT

    @classmethod
    def from_str(cls, st: str) -> TickAnomalyDecision:
        return cls[st.upper()]


class AnomalyTransition(StrEnum):
    ABNORMALITY_STARTED = "abnormality_started"
    """
    An abnormality has been detected during normal operations. We may
    transition into a complete system incident, or the abnormality may recover
    to normal.
    """

    ABNORMALITY_RECOVERED = "abnormality_recovered"
    """
    An abnormality has recovered back to a normal status.
    """

    INCIDENT_STARTED = "incident_started"
    """
    A system incident has been detected based on the historic check-in volume.
    We are no longer able to reliably know that we are receving all check-ins.
    """

    INCIDENT_RECOVERING = "incident_recovering"
    """
    An incident has begun to recover. After this transition we will either
    re-enter the incident va INCIDENT_STARTED or fully recover via
    INCIDENT_RECOVERED.
    """

    INCIDENT_RECOVERY_FAILED = "incident_recovery_failed"
    """
    An incident failed to recover and has re-entered the incident state.
    """

    INCIDENT_RECOVERED = "incident_recovered"
    """
    An incident has recovered back to normal.
    """


@dataclass
class DecisionResult:
    ts: datetime
    """
    The associated timestamp of the decision. Typically this will be the clock
    tick when the decision was made. However for a incident start and end
    transitions this will be the back-dated timestamp of when the state began.

    INCIDENT_STARTED   -> Tick when the incident truly starts
    INCIDENT_RECOVERED -> Tick when the incident truly recovered
    """

    decision: TickAnomalyDecision
    """
    The recorded decision made for the clock tick
    """

    transition: AnomalyTransition | None = None
    """
    Reflects the transition status when making a tick decision results in a
    state transition. None if the decision has not changed.
    """


class Metric(StrEnum):
    """
    A metric is similar to a tick decision, however it represents a decision
    made on the volume metric. The metric we current consider is percent mean
    deviation from historic volumes.
    """

    NORMAL = "normal"
    """
    The metric is below the abnormal threshold.
    """

    ABNORMAL = "abnormal"
    """
    The metric has surpassed the normal threshold but is still below the
    incident threshold.
    """

    INCIDENT = "incident"
    """
    The metric has surpassed the incident threshold
    """

    @staticmethod
    def from_value(value: float | str | None) -> Metric:
        """
        Determine an individual decision for the percentage deviation metric of a
        clock tick. This only considers metrics that are negative, indicating
        there's been a drop in check-in volume.
        """
        # examples: -5% anomaly and -25% incident
        anomaly_threshold = options.get("crons.system_incidents.pct_deviation_anomaly_threshold")
        incident_threshold = options.get("crons.system_incidents.pct_deviation_incident_threshold")

        # If we do not have a metric for this tick we must assume things are
        # operating normally
        if value is None:
            return Metric.NORMAL

        pct_deviation = float(value)

        if pct_deviation <= incident_threshold:
            return Metric.INCIDENT
        if pct_deviation <= anomaly_threshold:
            return Metric.ABNORMAL
        return Metric.NORMAL


def make_clock_tick_decision(tick: datetime) -> DecisionResult:
    """
    Given a clock tick timestamp determine based on the historic tick volume
    metrics, and historic tick anomaly decisions, a DecisionResult.

    This function will update previous decisions for earlier ticks detected as
    ABNORMAL or RECOVERING to either NORMAL or INCIDENT.

    The state transitions for tick decisions are as follows

         ┌───D────────────────────────────┐
    ┌────▼─┐   ┌────────┐   ┌────────┐   ┌┴─────────┐
    │NORMAL├─A─►ABNORMAL├┬F─►INCIDENT├─C─►RECOVERING│
    │      ◄─B─│        ││  │        ◄─E─┤          │
    └────┬─┘   └────────┘│  └────────┘   └──────────┘
         └───────────────┘

    A: ABNORMALITY_STARTED
    B: ABNORMALITY_RECOVERED
    C: INCIDENT_RECOVERING
    D: INCIDENT_RECOVERED
    E: INCIDENT_RECOVERY_FAILED
    F: INCIDENT_STARTED
    """
    # Alias TickAnomalyDecision to improve code readability
    Decision = TickAnomalyDecision

    if not options.get("crons.tick_volume_anomaly_detection"):
        return DecisionResult(tick, Decision.NORMAL)

    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    tick_decision_window = options.get("crons.system_incidents.tick_decision_window")

    # The clock has just ticked to the next minute. Look at the previous tick
    # and decision metrics.
    past_ts = tick - timedelta(minutes=1)

    past_window_ts_keys = [
        _make_reference_ts(past_ts - timedelta(minutes=delta))
        for delta in range(0, tick_decision_window)
    ]

    # Fetch histories for metrics and the last decision together. Window
    # timestamps are reversed so the oldest metric is last.
    pipeline = redis_client.pipeline()
    for key in chain(
        (MONITOR_TICK_METRIC.format(ts=ts) for ts in reversed(past_window_ts_keys)),
        (MONITOR_TICK_DECISION.format(ts=ts) for ts in [past_window_ts_keys[0]]),
    ):
        pipeline.get(key)
    values = pipeline.execute()

    # Tick metrics are the first tick_decision_window values
    tick_metrics = [Metric.from_value(value) for value in values[:-1]]
    last_metric = tick_metrics[-1]

    # The last decision is the last value fetched
    if values[-1] is not None:
        last_decision = Decision.from_str(values[-1])
    else:
        # By default the previous decision is used. If there was no previous
        # decision we can only assume things are operating normally
        last_decision = Decision.NORMAL

    def make_decision(
        decision: TickAnomalyDecision,
        transition: AnomalyTransition | None = None,
        ts: datetime | None = None,
    ) -> DecisionResult:
        decision_key = MONITOR_TICK_DECISION.format(ts=_make_reference_ts(tick))
        pipeline = redis_client.pipeline()
        pipeline.set(decision_key, decision)
        pipeline.expire(decision_key, MONITOR_VOLUME_RETENTION)
        pipeline.execute()

        logger.info(
            "monitors.system_incidents.decision",
            extra={
                "reference_datetime": str(tick),
                "decision": decision,
                "transition": transition,
            },
        )

        return DecisionResult(ts or tick, decision, transition)

    def metrics_match(metric: Metric) -> Generator[bool]:
        return (d == metric for d in tick_metrics)

    # A: NORMAL -> ABNORMAL
    #
    # If we've detected an anomaly and we're not already in an incident,
    # anomalous state, or recovering, mark this tick as anomalous.
    if last_decision == Decision.NORMAL and last_metric == Metric.ABNORMAL:
        return make_decision(Decision.ABNORMAL, AnomalyTransition.ABNORMALITY_STARTED)

    # B: ABNORMAL -> NORMAL
    #
    # If the previous result was anomalous check and if we have recovered and can
    # backfill these decisions as normal
    if last_decision == Decision.ABNORMAL and all(metrics_match(Metric.NORMAL)):
        _backfill_decisions(past_ts, Decision.NORMAL, Decision.ABNORMAL)
        return make_decision(Decision.NORMAL, AnomalyTransition.ABNORMALITY_RECOVERED)

    # C: INCIDENT -> RECOVERING
    #
    # If we are actively in an incident and the most recent metric value has
    # recovered to normal we can de-escalate the incident to abnormal.
    if last_decision == Decision.INCIDENT and last_metric == Metric.NORMAL:
        return make_decision(Decision.RECOVERING, AnomalyTransition.INCIDENT_RECOVERING)

    # D: RECOVERING -> NORMAL
    #
    # If the previous result was recovering, check if we have recovered and can
    # backfill these decisions as normal.
    if last_decision == Decision.RECOVERING and all(metrics_match(Metric.NORMAL)):
        ts = _backfill_decisions(past_ts, Decision.NORMAL, Decision.RECOVERING)
        return make_decision(Decision.NORMAL, AnomalyTransition.INCIDENT_RECOVERED, ts)

    # E: RECOVERING -> INCIDENT
    #
    # If an incident had begun recovering but we've detected a non-normal
    # metric, backfill all recovery decisions to an incident decision.
    if last_decision == Decision.RECOVERING and last_metric != Metric.NORMAL:
        _backfill_decisions(past_ts, Decision.INCIDENT, Decision.RECOVERING)
        return make_decision(Decision.INCIDENT, AnomalyTransition.INCIDENT_RECOVERY_FAILED)

    # F: [NORMAL, ABNORMAL] -> INCIDENT
    #
    # If we're not already in an incident and the most recent metric value is
    # an incident, mark this tick as an incident and backfill all abnormal
    # decisions to an incident decision.
    if last_decision != Decision.INCIDENT and last_metric == Metric.INCIDENT:
        ts = _backfill_decisions(past_ts, Decision.INCIDENT, Decision.ABNORMAL)
        return make_decision(Decision.INCIDENT, AnomalyTransition.INCIDENT_STARTED, ts)

    # NORMAL     -> NORMAL
    # ABNORMAL   -> ABNORMAL
    # INCIDENT   -> INCIDENT
    # RECOVERING -> RECOVERING
    #
    # No decision transition. Use the previous decision
    return make_decision(last_decision)


def get_clock_tick_decision(tick: datetime) -> TickAnomalyDecision | None:
    """
    Retrieve the TickAnomalyDecision for a specific clock tick.
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    if value := redis_client.get(MONITOR_TICK_DECISION.format(ts=_make_reference_ts(tick))):
        return TickAnomalyDecision.from_str(value)
    else:
        return None


@dataclass
class BackfillItem:
    key: str
    ts: datetime


def _make_backfill(start: datetime, until_not: TickAnomalyDecision) -> Generator[BackfillItem]:
    """
    Yields keys and associated timestamps from the `start` tick until the value
    of the key is not a `until_not` tick decision.
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    for chunked_offsets in batched(range(0, BACKFILL_CUTOFF), BACKFILL_CHUNKS):
        pipeline = redis_client.pipeline()

        keys: list[str] = []
        timestamps: list[datetime] = []
        for offset in chunked_offsets:
            ts = start - timedelta(minutes=offset)
            key = MONITOR_TICK_DECISION.format(ts=_make_reference_ts(ts))
            pipeline.get(key)
            keys.append(key)
            timestamps.append(ts)

        for key, ts, value in zip(keys, timestamps, pipeline.execute()):
            # Edge case, we found a hole gap in decisions
            if value is None:
                return

            # Exit the backfill once we no longer see the `until_not` decision
            prev_decision = TickAnomalyDecision.from_str(value)
            if prev_decision != until_not:
                return

            yield BackfillItem(key, ts)

    # If we've iterated through the entire BACKFILL_CUTOFF we have a
    # "decision runaway" and should report this as an error
    logger.error("sentry.system_incidents.decision_backfill_runaway")


def _backfill_decisions(
    start: datetime,
    decision: TickAnomalyDecision,
    until_not: TickAnomalyDecision,
) -> datetime | None:
    """
    Update historic tick decisions from `start` to `decision` until we no
    longer see the `until_not` decision.

    If a backfill occurred, returns the timestamp just before
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    pipeline = redis_client.pipeline()
    backfill_items = list(_make_backfill(start, until_not))

    for item in backfill_items:
        pipeline.set(item.key, decision.value)
    pipeline.execute()

    # Return the timestamp just before we reached until_not. Note
    # backfill_items is in reverse chronological order here.
    if backfill_items:
        return backfill_items[-1].ts

    # In the case that we didn't backfill anything return None
    return None


def _make_reference_ts(ts: datetime):
    """
    Produce a timestamp number with the seconds and microsecond removed
    """
    return int(ts.replace(second=0, microsecond=0).timestamp())


def _int_or_none(s: str | None) -> int | None:
    if s is None:
        return None
    else:
        return int(s)
