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
from collections.abc import Sequence
from datetime import datetime, timedelta

from django.conf import settings

from sentry import options
from sentry.monitors.types import TickVolumeAnomolyResult
from sentry.utils import metrics, redis

logger = logging.getLogger("sentry")

# This key is used to record historical date about the volume of check-ins.
MONITOR_VOLUME_HISTORY = "sentry.monitors.volume_history:{}"

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


def update_check_in_volume(ts_list: Sequence[datetime]):
    """
    Increment counters for a list of check-in timestamps. Each timestamp will be
    trimmed to the minute and grouped appropriately
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    # Group timestamps down to the minute
    for reference_ts, count in Counter(_make_reference_ts(ts) for ts in ts_list).items():
        key = MONITOR_VOLUME_HISTORY.format(reference_ts)

        pipeline = redis_client.pipeline()
        pipeline.incr(key, amount=count)
        pipeline.expire(key, MONITOR_VOLUME_RETENTION)
        pipeline.execute()


def evaluate_tick_decision(tick: datetime) -> TickVolumeAnomolyResult:
    """
    When the clock is ticking, we may decide this tick is invalid and should
    result in unknown misses and marking all in-progress check-ins as having an
    unknown result.

    We do this by looking at the historic volume of check-ins for the
    particular minute boundary we just crossed.

    XXX(epurkhiser): This is currently in development and no decision is made
    to mark unknowns, instead we are only recording metrics for each clock tick
    """
    if not options.get("crons.tick_volume_anomaly_detection"):
        # Detection not enabled. All ticks are considered normal
        return TickVolumeAnomolyResult.NORMAL

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
        MONITOR_VOLUME_HISTORY.format(_make_reference_ts(ts)) for ts in historic_timestamps
    )

    past_minute_volume = _int_or_none(volumes.pop(0))
    historic_volume: list[int] = [int(v) for v in volumes if v is not None]

    # Can't make any decisions if we didn't have data for the past minute
    if past_minute_volume is None:
        return TickVolumeAnomolyResult.NORMAL

    # We need AT LEAST two data points to calculate standard deviation
    if len(historic_volume) < 2:
        return TickVolumeAnomolyResult.NORMAL

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
    pct_deviation = (abs(past_minute_volume - historic_mean) / historic_mean) * 100

    metrics.gauge(
        "monitors.task.clock_tick.historic_volume_stdev_pct",
        historic_stdev_pct,
        sample_rate=1.0,
    )
    metrics.gauge("monitors.task.volume_history.count", len(historic_volume), sample_rate=1.0)
    metrics.gauge("monitors.task.volume_history.z_score", z_score, sample_rate=1.0)
    metrics.gauge("monitors.task.volume_history.pct_deviation", pct_deviation, sample_rate=1.0)

    # XXX(epurkhiser): We're not actually making any decisions with this data
    # just yet.
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

    # XXX(epurkhiser): No decision is made yet, all ticks are normal
    return TickVolumeAnomolyResult.NORMAL


def safe_evaluate_tick_decision(tick: datetime) -> TickVolumeAnomolyResult:
    try:
        return evaluate_tick_decision(tick)
    except Exception:
        logging.exception("monitors.system_incidents.evaluate_tick_decision_failed")

    # If there are any problems evaluating the tick volume, fallback to
    # reporting the tick as NORMAL.
    return TickVolumeAnomolyResult.NORMAL


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
