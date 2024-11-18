import itertools
from collections.abc import Sequence
from datetime import datetime, timedelta
from unittest import mock

from django.conf import settings
from django.utils import timezone

from sentry.monitors.system_incidents import (
    MONITOR_TICK_METRIC,
    MONITOR_VOLUME_DECISION_STEP,
    MONITOR_VOLUME_HISTORY,
    MONITOR_VOLUME_RETENTION,
    AnomalyTransition,
    TickAnomalyDecision,
    _make_reference_ts,
    get_clock_tick_decision,
    get_clock_tick_volume_metric,
    make_clock_tick_decision,
    prune_incident_check_in_volume,
    record_clock_tick_volume_metric,
    update_check_in_volume,
)
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import redis

redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)


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


def fill_historic_metrics(start: datetime, metrics: Sequence[float | None]):
    """
    Creates historic metrics starting from the `start` datetime backfilling the
    `metrics`, popping from the end of the list until all metrics have been
    recorded.

    Returns the timestamp the metrics begin at
    """
    values: dict[str | bytes, float] = {}
    for index, metric in enumerate(metrics):
        ts = _make_reference_ts(start + timedelta(minutes=index))
        key = MONITOR_TICK_METRIC.format(ts=ts)
        if metric:
            values[key] = metric

    redis_client.mset(values)


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
        return MONITOR_VOLUME_HISTORY.format(ts=int(ts.timestamp()))

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
def test_record_clock_tick_volume_metric_simple(metrics, logger):
    tick = timezone.now().replace(second=0, microsecond=0)

    # This is the timestamp we're looking at just before the tick
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

    record_clock_tick_volume_metric(tick)

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
    assert get_clock_tick_volume_metric(past_ts) == 1.3513513513513442


@mock.patch("sentry.monitors.system_incidents.logger")
@mock.patch("sentry.monitors.system_incidents.metrics")
@override_options({"crons.tick_volume_anomaly_detection": True})
def test_record_clock_tick_volume_metric_volume_drop(metrics, logger):
    tick = timezone.now().replace(second=0, microsecond=0)

    # This is the timestamp we're looking at just before the tick
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

    record_clock_tick_volume_metric(tick)

    # Note that the pct_deviation and z_score are extremes
    logger.info.assert_called_with(
        "monitors.system_incidents.volume_history",
        extra={
            "reference_datetime": str(tick),
            "evaluation_minute": past_ts.strftime("%H:%M"),
            "history_count": 30,
            "z_score": -19.816869917656856,
            "pct_deviation": -52.0,
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
        -52.0,
        sample_rate=1.0,
    )
    assert get_clock_tick_volume_metric(past_ts) == -52.0


@mock.patch("sentry.monitors.system_incidents.logger")
@mock.patch("sentry.monitors.system_incidents.metrics")
@override_options({"crons.tick_volume_anomaly_detection": True})
def test_record_clock_tick_volume_metric_low_history(metrics, logger):
    tick = timezone.now().replace(second=0, microsecond=0)

    # This is the timestamp we're looking at just before the tick
    past_ts = tick - timedelta(minutes=1)

    # Only add one historic value (and the current value being evaluated)
    update_check_in_volume([past_ts - MONITOR_VOLUME_DECISION_STEP] * 900)
    update_check_in_volume([past_ts] * 900)

    record_clock_tick_volume_metric(tick)

    # We should do nothing because there was not enough daata to make any
    # calculation
    assert not logger.info.called
    assert not metrics.gauge.called
    assert get_clock_tick_volume_metric(past_ts) is None


@mock.patch("sentry.monitors.system_incidents.logger")
@mock.patch("sentry.monitors.system_incidents.metrics")
@override_options({"crons.tick_volume_anomaly_detection": True})
def test_record_clock_tick_volume_metric_uniform(metrics, logger):
    tick = timezone.now().replace(second=0, microsecond=0)

    # This is the timestamp we're looking at just before the tick
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

    record_clock_tick_volume_metric(tick)

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
    assert get_clock_tick_volume_metric(past_ts) == 0.0


@override_options({"crons.tick_volume_anomaly_detection": True})
def test_prune_incident_check_in_volume():
    now = timezone.now().replace(second=0, microsecond=0)

    # Fill in some historic volume data
    for offset in range(10):
        update_check_in_volume([now + timedelta(minutes=offset)] * (offset + 1))

    # Remove data in the middle
    prune_incident_check_in_volume(
        now + timedelta(minutes=2),
        now + timedelta(minutes=6),
    )

    def make_key(offset: timedelta) -> str:
        ts = now.replace(second=0, microsecond=0) + offset
        return MONITOR_VOLUME_HISTORY.format(ts=int(ts.timestamp()))

    volumes = [redis_client.get(make_key(timedelta(minutes=offset))) for offset in range(10)]

    # Ensure we removed the correct keys. remmeber,
    # prune_incident_check_in_volume recieves the timestamp of the incident
    # tick decisions, but the volume data is recorded in the timestamp before
    assert volumes == ["1", None, None, None, None, "6", "7", "8", "9", "10"]


@django_db_all
@override_options(
    {
        "crons.tick_volume_anomaly_detection": True,
        "crons.system_incidents.tick_decision_window": 5,
        "crons.system_incidents.pct_deviation_anomaly_threshold": -5,
        "crons.system_incidents.pct_deviation_incident_threshold": -25,
    }
)
def test_tick_decision_anomaly_recovery():
    start = timezone.now().replace(minute=0, second=0, microsecond=0)

    test_metrics = [
        # fmt: off
        # Operating as normal
        1.0, 4.0, 3.0, 2.0, 2.0, -3.0,
        # Anomaly detected
        -6.0, -7.0,
        # Anomaly recovers to normal
        -4.0, -3.0, -3.0, -4.0, -1.0
        # fmt: on
    ]

    ts = start
    fill_historic_metrics(ts, test_metrics)

    # First 6 ticks are operating as normal
    for _ in range(0, 6):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.NORMAL
        assert result.transition is None
        assert result.ts == ts

    # Transition into anomalous state (-6)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.ABNORMAL
        assert result.transition == AnomalyTransition.ABNORMALITY_STARTED
        assert result.ts == ts

    # Next 5 ticks (-7, -4, -3, -3, -4) stay in abnormal state
    for _ in range(0, 5):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.ABNORMAL
        assert result.transition is None
        assert result.ts == ts

    # Next tick recovers the abnormality after 5 ticks under the abnormality threshold
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.NORMAL
        assert result.transition == AnomalyTransition.ABNORMALITY_RECOVERED
        assert result.ts == ts

    # The last 6 ABNORMAL ticks transitioned to NORMAL
    for i in range(1, 7):
        assert get_clock_tick_decision(ts - timedelta(minutes=i)) == TickAnomalyDecision.NORMAL


@django_db_all
@override_options(
    {
        "crons.tick_volume_anomaly_detection": True,
        "crons.system_incidents.tick_decision_window": 5,
        "crons.system_incidents.pct_deviation_anomaly_threshold": -5,
        "crons.system_incidents.pct_deviation_incident_threshold": -25,
    }
)
def test_tick_decisions_simple_incident():
    """
    Tests incident detection for an incident that immediately starts and
    immediately stops.
    """
    start = timezone.now().replace(minute=0, second=0, microsecond=0)

    test_metrics = [
        # fmt: off
        # Operating as normal
        1.0, 4.0, 3.0, 2.0, 2.0, -3.0,
        # Incident starts immediately
        -35.0, -80.0, -100.0, -50.0,
        # Incident quickly recovers
        -3.0, -2.0, -4.0, -1.0, -4.0
        # fmt: on
    ]

    ts = start
    fill_historic_metrics(ts, test_metrics)

    # First 6 ticks are operating as normal
    for _ in range(0, 6):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.NORMAL
        assert result.transition is None
        assert result.ts == ts

    # Transition into incident (-35)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.INCIDENT
        assert result.transition == AnomalyTransition.INCIDENT_STARTED
        assert result.ts == ts

    # Incident continues (-80, -100, -50)
    for _ in range(0, 3):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.INCIDENT
        assert result.transition is None
        assert result.ts == ts

    # Incident begins recovery (-3)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.RECOVERING
        assert result.transition == AnomalyTransition.INCIDENT_RECOVERING
        assert result.ts == ts

    # Incident continues recovery (-2, -4, -1)
    for _ in range(0, 3):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.RECOVERING
        assert result.transition is None
        assert result.ts == ts

    # Incident recovers
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.NORMAL
        assert result.transition == AnomalyTransition.INCIDENT_RECOVERED
        # True recovery was 4 ticks ago
        assert result.ts == ts - timedelta(minutes=4)

    # The last 4 RECOVERING ticks transitioned to NORMAL
    for i in range(1, 5):
        assert get_clock_tick_decision(ts - timedelta(minutes=i)) == TickAnomalyDecision.NORMAL


@django_db_all
@override_options(
    {
        "crons.tick_volume_anomaly_detection": True,
        "crons.system_incidents.tick_decision_window": 5,
        "crons.system_incidents.pct_deviation_anomaly_threshold": -5,
        "crons.system_incidents.pct_deviation_incident_threshold": -25,
    }
)
def test_tick_decisions_variable_incident():
    """
    Tests an incident that slowly starts and slowly recovers.
    """
    start = timezone.now().replace(minute=0, second=0, microsecond=0)

    test_metrics = [
        # fmt: off
        # Operating as normal
        1.0, 4.0, 3.0, 2.0, 2.0, -3.0,
        # Anomaly detected
        -6.0, -7.0,
        # Metrics below anomaly threshold, but not recovered
        -4.0, -3.0,
        # Metrics above anomaly threshold again, but not at incident threshold
        -10.0,
        # Incident threshold reached
        -30.0, -40.0, -38.0, -42.0, -25.0, -20.0, -10.0,
        # Incident recovering
        -4.0, -3.0,
        # Metrics above anomaly threshold, recovery failed
        -6.0,
        # Metrics back below anomaly threshold, begin recovering again
        -2.0, -1.0,
        # Metrics above incident threshold, recovery failed
        -30.0,
        # Metrics below anomaly threshold, incident will recover
        -3.0, -2.0, -4.0, -4.0, -3.0,
        # fmt: on
    ]

    ts = start
    fill_historic_metrics(ts, test_metrics)

    # First 6 ticks are operating as normal
    for _ in range(0, 6):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.NORMAL
        assert result.transition is None
        assert result.ts == ts

    # Transition into anomalous state (-6)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.ABNORMAL
        assert result.transition == AnomalyTransition.ABNORMALITY_STARTED
        assert result.ts == ts

    # Next 4 ticks (-7, -4, -3, -10) stay in anomaly
    for _ in range(0, 4):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.ABNORMAL
        assert result.transition is None
        assert result.ts == ts

    # Incident starts (-30)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.INCIDENT
        assert result.transition == AnomalyTransition.INCIDENT_STARTED
        # True incident start was 5 ticks ago
        assert result.ts == ts - timedelta(minutes=5)

    # The last 5 ABNORMAL ticks transitioned to INCIDENT
    for i in range(1, 6):
        assert get_clock_tick_decision(ts - timedelta(minutes=i)) == TickAnomalyDecision.INCIDENT

    # Incident continues (-40, -38, -42, -25, -20, -10)
    for _ in range(0, 6):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.INCIDENT
        assert result.transition is None
        assert result.ts == ts

    # Incident begins recovering (-4)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.RECOVERING
        assert result.transition == AnomalyTransition.INCIDENT_RECOVERING
        assert result.ts == ts

    # Incident continues to recover (-3)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.RECOVERING
        assert result.transition is None
        assert result.ts == ts

    # Incident has anomalous tick again (-6), not fully recovered
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.INCIDENT
        assert result.transition == AnomalyTransition.INCIDENT_RECOVERY_FAILED
        assert result.ts == ts

    # The last 2 RECOVERING ticks transitioned back to incident
    for i in range(1, 3):
        assert get_clock_tick_decision(ts - timedelta(minutes=i)) == TickAnomalyDecision.INCIDENT

    # Incident begins recovering again (-2)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.RECOVERING
        assert result.transition == AnomalyTransition.INCIDENT_RECOVERING
        assert result.ts == ts

    # Incident continues to recover (-1)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.RECOVERING
        assert result.transition is None
        assert result.ts == ts

    # Incident has incident tick again (-30), not fully recovered
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.INCIDENT
        assert result.transition == AnomalyTransition.INCIDENT_RECOVERY_FAILED
        assert result.ts == ts

    # The last 2 RECOVERING ticks transitioned back to incident
    for i in range(1, 3):
        assert get_clock_tick_decision(ts - timedelta(minutes=i)) == TickAnomalyDecision.INCIDENT

    # Incident begins recovering again (-3)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.RECOVERING
        assert result.transition == AnomalyTransition.INCIDENT_RECOVERING
        assert result.ts == ts

    # Incident continues to recover for the next 3 normal ticks (-2, -4, -4)
    for _ in range(0, 3):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.RECOVERING
        assert result.transition is None
        assert result.ts == ts

    # Incident recovers at the final 5th tick (-3)
    for _ in range(0, 1):
        result = make_clock_tick_decision(ts := ts + timedelta(minutes=1))
        assert result.decision == TickAnomalyDecision.NORMAL
        assert result.transition == AnomalyTransition.INCIDENT_RECOVERED
        # True incident recovery was 4 ticks ago
        assert result.ts == ts - timedelta(minutes=4)

    # The last 4 RECOVERING ticks transitioned to NORMAL
    for i in range(1, 5):
        assert get_clock_tick_decision(ts - timedelta(minutes=i)) == TickAnomalyDecision.NORMAL

    # The final tick decision history looks like this
    decision_history = [
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.INCIDENT,
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.NORMAL,
        TickAnomalyDecision.NORMAL,
    ]

    ts = start + timedelta(minutes=1)
    for i, expected in enumerate(decision_history):
        decision = get_clock_tick_decision(ts + timedelta(minutes=i))
        assert decision == expected
