import itertools
from collections.abc import Sequence
from datetime import datetime, timedelta
from unittest import mock

from django.conf import settings
from django.utils import timezone

from sentry.monitors.system_incidents import (
    MONITOR_VOLUME_DECISION_STEP,
    MONITOR_VOLUME_HISTORY,
    MONITOR_VOLUME_RETENTION,
    evaluate_tick_decision,
    update_check_in_volume,
)
from sentry.testutils.helpers.options import override_options
from sentry.utils import redis


def fill_historic_volume(
    start: datetime, length: timedelta, step: timedelta, counts: Sequence[int]
):
    """
    Creates a volume history starting at the `start` and going back `length`,
    where each bucket is spaced by `step`s apart.

    `count` Is a list of counts for each step. This value is a list that will
    be cycled through, it must be a division of the number of steps between the
    start and length.
    """
    aligned_start = start.replace(second=0, microsecond=0)

    # The length of counts should be divisible into the number of steps
    steps = length // step
    assert steps % len(counts) == 0

    counts_cycle = itertools.cycle(counts)
    ts = aligned_start
    end = aligned_start - length

    ts_list = []
    while ts >= end:
        count = next(counts_cycle)
        ts_list.extend([ts] * count)
        ts = ts - step

    update_check_in_volume(ts_list)


def test_update_check_in_volume():
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    now = timezone.now().replace(second=5)
    items = [
        now,
        now + timedelta(seconds=10),
        now + timedelta(seconds=30),
        now + timedelta(minutes=1),
        now + timedelta(minutes=3),
    ]
    update_check_in_volume(items)

    def make_key(offset: timedelta) -> str:
        ts = now.replace(second=0, microsecond=0) + offset
        return MONITOR_VOLUME_HISTORY.format(int(ts.timestamp()))

    minute_0 = redis_client.get(make_key(timedelta()))
    minute_1 = redis_client.get(make_key(timedelta(minutes=1)))
    minute_2 = redis_client.get(make_key(timedelta(minutes=2)))
    minute_3 = redis_client.get(make_key(timedelta(minutes=3)))

    assert minute_0 == "3"
    assert minute_1 == "1"
    assert minute_2 is None
    assert minute_3 == "1"


@mock.patch("sentry.monitors.system_incidents.logger")
@mock.patch("sentry.monitors.system_incidents.metrics")
@override_options({"crons.tick_volume_anomaly_detection": True})
def test_evaluate_tick_decision_simple(metrics, logger):
    tick = timezone.now().replace(second=0, microsecond=0)

    # This is the timestamp we're looking at just after the tick
    past_ts = tick - timedelta(minutes=1)

    # Fill histroic volume data for earlier minutes.
    fill_historic_volume(
        start=past_ts - MONITOR_VOLUME_DECISION_STEP,
        length=MONITOR_VOLUME_RETENTION,
        step=MONITOR_VOLUME_DECISION_STEP,
        counts=[170, 150, 130, 210, 154],
    )

    # Record a volume of 200 for the timestamp we are considerng
    update_check_in_volume([past_ts] * 165)

    evaluate_tick_decision(tick)

    logger.info.assert_called_with(
        "monitors.system_incidents.volume_history",
        extra={
            "reference_datetime": str(tick),
            "evaluation_minute": past_ts.strftime("%H:%M"),
            "history_count": 30,
            "z_score": 0.08064694302168258,
            "pct_deviation": 1.3513513513513442,
            "historic_mean": 162.8,
            "historic_stdev": 27.279397303484902,
        },
    )

    metrics.gauge.assert_any_call(
        "monitors.task.volume_history.count",
        30,
        sample_rate=1.0,
    )
    metrics.gauge.assert_any_call(
        "monitors.task.volume_history.z_score",
        0.08064694302168258,
        sample_rate=1.0,
    )
    metrics.gauge.assert_any_call(
        "monitors.task.volume_history.pct_deviation",
        1.3513513513513442,
        sample_rate=1.0,
    )


@mock.patch("sentry.monitors.system_incidents.logger")
@mock.patch("sentry.monitors.system_incidents.metrics")
@override_options({"crons.tick_volume_anomaly_detection": True})
def test_evaluate_tick_decision_volume_drop(metrics, logger):
    tick = timezone.now().replace(second=0, microsecond=0)

    # This is the timestamp we're looking at just after the tick
    past_ts = tick - timedelta(minutes=1)

    # Fill histroic volume data for earlier minutes.
    fill_historic_volume(
        start=past_ts - MONITOR_VOLUME_DECISION_STEP,
        length=MONITOR_VOLUME_RETENTION,
        step=MONITOR_VOLUME_DECISION_STEP,
        counts=[13_000, 12_000, 12_500, 12_400, 12_600],
    )

    # Record a volume much lower than what we had been recording previously
    update_check_in_volume([past_ts] * 6_000)

    evaluate_tick_decision(tick)

    # Note that the pct_deviation and z_score are extremes
    logger.info.assert_called_with(
        "monitors.system_incidents.volume_history",
        extra={
            "reference_datetime": str(tick),
            "evaluation_minute": past_ts.strftime("%H:%M"),
            "history_count": 30,
            "z_score": -19.816869917656856,
            "pct_deviation": 52.0,
            "historic_mean": 12500,
            "historic_stdev": 328.0033641543204,
        },
    )

    metrics.gauge.assert_any_call(
        "monitors.task.volume_history.count",
        30,
        sample_rate=1.0,
    )
    metrics.gauge.assert_any_call(
        "monitors.task.volume_history.z_score",
        -19.816869917656856,
        sample_rate=1.0,
    )
    metrics.gauge.assert_any_call(
        "monitors.task.volume_history.pct_deviation",
        52.0,
        sample_rate=1.0,
    )


@mock.patch("sentry.monitors.system_incidents.logger")
@mock.patch("sentry.monitors.system_incidents.metrics")
@override_options({"crons.tick_volume_anomaly_detection": True})
def test_evaluate_tick_decision_low_history(metrics, logger):
    tick = timezone.now().replace(second=0, microsecond=0)

    # This is the timestamp we're looking at just after the tick
    past_ts = tick - timedelta(minutes=1)

    # Only add one historic value (and the current value being evaluated)
    update_check_in_volume([past_ts - MONITOR_VOLUME_DECISION_STEP] * 900)
    update_check_in_volume([past_ts] * 900)

    evaluate_tick_decision(tick)

    # We should do nothing because there was not enough daata to make any
    # calculation
    assert not logger.info.called
    assert not metrics.gauge.called


@mock.patch("sentry.monitors.system_incidents.logger")
@mock.patch("sentry.monitors.system_incidents.metrics")
@override_options({"crons.tick_volume_anomaly_detection": True})
def test_evaluate_tick_decision_uniform(metrics, logger):
    tick = timezone.now().replace(second=0, microsecond=0)

    # This is the timestamp we're looking at just after the tick
    past_ts = tick - timedelta(minutes=1)

    # Fill with a uniform history (all values the same). This will give us a
    # standard deviation of 0. In this case the z-value needs to be computed
    # differently.
    fill_historic_volume(
        start=past_ts - MONITOR_VOLUME_DECISION_STEP,
        length=MONITOR_VOLUME_RETENTION,
        step=MONITOR_VOLUME_DECISION_STEP,
        counts=[1000],
    )
    update_check_in_volume([past_ts] * 1000)

    evaluate_tick_decision(tick)

    logger.info.assert_called_with(
        "monitors.system_incidents.volume_history",
        extra={
            "reference_datetime": str(tick),
            "evaluation_minute": past_ts.strftime("%H:%M"),
            "history_count": 30,
            "z_score": 0.0,
            "pct_deviation": 0.0,
            "historic_mean": 1000,
            "historic_stdev": 0.0,
        },
    )

    metrics.gauge.assert_any_call(
        "monitors.task.volume_history.count",
        30,
        sample_rate=1.0,
    )
    metrics.gauge.assert_any_call(
        "monitors.task.volume_history.z_score",
        0.0,
        sample_rate=1.0,
    )
    metrics.gauge.assert_any_call(
        "monitors.task.volume_history.pct_deviation",
        0.0,
        sample_rate=1.0,
    )
