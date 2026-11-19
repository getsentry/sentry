import math
from collections.abc import Callable
from datetime import datetime, timedelta

import pytest

from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, Metric, SeriesKey, Signal
from sentry.anomaly_detection.correlation.shared_dependencies import learn
from sentry.anomaly_detection.evaluation import quality
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.novelty import Novelty, mask_dim
from sentry.anomaly_detection.evaluation.rate_shifts import RateShiftTracker
from sentry.anomaly_detection.evaluation.series import Series, samples_key

T0 = datetime(2024, 11, 4, 8)
MINUTE = timedelta(minutes=1)
FLAPPY = SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.P95_DURATION, "/flappy")
QUIET = SeriesKey(1, "prod", Signal.OUTBOUND_DB, Metric.P95_DURATION, "db")
RATE = SeriesKey(1, "prod", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)
FAILED_RATE = SeriesKey(1, "prod", Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST)


def excursion(key: SeriesKey, start: datetime, ratio: float) -> ChangeEvent:
    return ChangeEvent(
        key,
        ChangeType.SLOWDOWN,
        start,
        ratio * 10,
        10,
        0.9,
        detected_at=start,
        peak_ratio=ratio,
        open_ratio=ratio,
    )


def observe_window(novelty: Novelty, key: SeriesKey, start: datetime, end: datetime) -> None:
    for offset in range((end - start) // MINUTE):
        novelty.observe(key, start + offset * MINUTE)


def test_quiet_series_stays_sensitive_after_days_of_history() -> None:
    novelty = Novelty()
    t = T0 + timedelta(days=4)
    observe_window(novelty, QUIET, T0, t)
    event = excursion(QUIET, t, 1.5)

    verdict = novelty.judge(event, 1.5, t)

    assert verdict.unusual
    assert verdict.similar == 0
    assert verdict.history_days == 4.0
    assert verdict.return_days == pytest.approx(12.0)
    # With a 0.25/day base rate and two prior days, the posterior shape is 1/2.
    assert verdict.p_normal == pytest.approx(math.erfc(math.sqrt(6 / 3)))


def test_limited_history_does_not_absorb_an_excursion_on_the_mean_alone() -> None:
    novelty = Novelty()
    observe_window(novelty, QUIET, T0, T0 + timedelta(hours=14))
    novelty.record(excursion(QUIET, T0 + timedelta(hours=10), 21.0))
    t = T0 + timedelta(hours=14)
    event = excursion(QUIET, t, 14.5)

    verdict = novelty.judge(event, 14.5, t)

    assert verdict.similar == 1
    assert verdict.return_days < 3.0
    assert verdict.p_normal < 0.8
    assert verdict.unusual


def test_repeated_flares_become_routine_but_a_larger_one_is_rare() -> None:
    novelty = Novelty()
    observe_window(novelty, FLAPPY, T0, T0 + timedelta(days=4))
    verdicts = []
    for i in range(30):
        start = T0 + timedelta(minutes=144 * i)
        event = excursion(FLAPPY, start, 9.0)
        verdicts.append(novelty.judge(event, 9.0, start))
        event.ended_at = start + 5 * MINUTE
        novelty.record(event)

    assert verdicts[0].unusual
    assert all(not verdict.unusual for verdict in verdicts[3:])

    t = T0 + timedelta(days=3)
    flare = excursion(FLAPPY, t, 9.0)
    novelty.record(flare)
    routine = novelty.judge(flare, 9.0, t)
    assert not routine.unusual
    assert routine.similar == 30  # The candidate cannot count itself as history.

    flare.peak_ratio = 60.0
    rare = novelty.judge(flare, 60.0, t + 5 * MINUTE)
    assert rare.unusual
    assert rare.similar == 0

    next_flare = excursion(FLAPPY, t + 60 * MINUTE, 60.0)
    assert novelty.judge(next_flare, 60.0, next_flare.start).similar == 1


def test_peers_contribute_to_the_prior_but_flapping_peers_are_capped() -> None:
    novelty = Novelty()
    observe_window(novelty, FLAPPY, T0, T0 + timedelta(days=3))
    observe_window(novelty, QUIET, T0, T0 + timedelta(days=3))
    for i in range(30):
        start = T0 + timedelta(minutes=144 * i)
        novelty.record(excursion(FLAPPY, start, 9.0))
        novelty.record(excursion(QUIET, start, 9.0))
    t = T0 + timedelta(days=3)
    newcomer = SeriesKey(2, "prod", Signal.ENDPOINTS, Metric.P95_DURATION, "/new")
    event = excursion(newcomer, t, 9.0)

    pooled = novelty.judge(event, 9.0, t)
    cold = Novelty().judge(event, 9.0, t)

    assert pooled.history_days == cold.history_days == 0.0
    assert pooled.pooled_rate == pytest.approx((6 + cold.pooled_rate) / 4)
    assert pooled.return_days < cold.return_days


def test_routine_size_can_become_unusual_by_duration() -> None:
    novelty = Novelty()
    observe_window(novelty, FLAPPY, T0, T0 + timedelta(days=4))
    for i in range(30):
        start = T0 + timedelta(minutes=144 * i)
        event = excursion(FLAPPY, start, 9.0)
        novelty.record(event)
        event.ended_at = start + 5 * MINUTE

    t = T0 + timedelta(days=3)
    flare = excursion(FLAPPY, t, 9.0)
    novelty.record(flare)

    assert not novelty.judge(flare, 9.0, t).unusual
    short = novelty.judge_duration(flare, 5, t + 5 * MINUTE)
    assert not short.unusual
    assert short.similar == 30

    long = novelty.judge_duration(flare, 60, t + 60 * MINUTE)
    assert long.unusual
    assert long.similar == 0
    assert long.as_dict()["lasting_min"] == 60
    assert "lasting 60m+" in long.text()


def test_prune_preserves_horizon_boundary_and_exposure() -> None:
    novelty = Novelty()
    boundary = T0 + timedelta(days=1)
    end = boundary + timedelta(days=14)
    observe_window(novelty, FLAPPY, T0, end)
    observe_window(novelty, QUIET, T0, end)
    novelty.record(excursion(FLAPPY, boundary - MINUTE, 20.0))
    retained = excursion(FLAPPY, boundary, 9.0)
    novelty.record(retained)
    novelty.record(excursion(QUIET, T0, 9.0))
    t = boundary + timedelta(days=14)
    event = excursion(FLAPPY, t, 9.0)
    before = novelty.judge(event, 9.0, t)
    assert before.similar == 1
    assert before.history_days == 14.0

    novelty.prune(t)

    assert set(novelty.history) == {FLAPPY}
    assert [record.event for record in novelty.history[FLAPPY]] == [retained]
    assert novelty.judge(event, 9.0, t) == before
    quiet = excursion(QUIET, t, 9.0)
    assert novelty.judge(quiet, 9.0, t).history_days == 14.0


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("worker-755cd44b5d-l78k5", "worker-*"),
        ("/runs/3f2a9c1e-1b2c-4d5e-8f90-123456789abc/", "/runs/*/"),
        ("blob/deadbeefcafe1234", "blob/*"),
        ("api.example.com", "api.example.com"),
    ],
)
def test_mask_dim_for_correlation_labels(value: str, expected: str) -> None:
    assert mask_dim(value) == expected


def rates(error_count: Callable[[int], float], *, minutes: int = 300) -> dict[SeriesKey, Series]:
    errors: Series = {T0 + i * MINUTE: error_count(i) for i in range(minutes)}
    return {
        SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT): dict.fromkeys(errors, 10_000.0),
        SeriesKey(1, "prod", Signal.ERRORS, Metric.COUNT): errors,
        RATE: {ts: value / 10_000 if value is not None else None for ts, value in errors.items()},
    }


@pytest.mark.parametrize("spike_height", [0, 200])
def test_quiet_data_and_short_spikes_do_not_open_change_points(spike_height: int) -> None:
    series = rates(lambda i: 20 + i % 5 + (spike_height if 170 <= i < 180 else 0))
    detector = RateShiftTracker(series, Baseline({}))

    assert not [action for t in series[RATE] for action in detector.step(t)]


def test_sustained_step_opens_then_closes_on_recovery() -> None:
    series = rates(lambda i: 20 + i % 5 + (12 if 170 <= i < 240 else 0))
    detector = RateShiftTracker(series, Baseline({}))

    [(opened_action, opened), (closed_action, closed)] = [
        action for t in series[RATE] for action in detector.step(t)
    ]

    assert opened_action == "open"
    assert closed_action == "close"
    assert closed is opened
    assert opened.change_type == ChangeType.CHANGE_POINT
    assert opened.start == T0 + 170 * MINUTE
    assert 1.4 < opened.open_ratio < 1.7
    assert closed.ended_at == T0 + 255 * MINUTE
    assert closed.evidence[-1] == "recovered"


def test_error_rate_step_from_zero_uses_an_event_count_floor() -> None:
    series = rates(lambda i: 3.0 if i >= 170 else 0.0, minutes=240)
    detector = RateShiftTracker(series, Baseline({}))

    [event] = [
        event for t in series[RATE] for action, event in detector.step(t) if action == "open"
    ]

    assert 2.5 < event.open_ratio <= 4.0  # Three extra errors against the one-event floor.


def test_long_spike_does_not_open_a_duplicate_change_point() -> None:
    series = rates(lambda i: 20 + i % 5 + (40 if i >= 170 else 0), minutes=400)
    detector = RateShiftTracker(series, Baseline({}))
    spike = ChangeEvent(RATE, ChangeType.SPIKE, T0 + 170 * MINUTE, 60.0, 20.0, 0.9)

    for i in range(170):
        assert detector.step(T0 + i * MINUTE) == []
    for i in range(170, 400):
        t = T0 + i * MINUTE
        detector.note_spike(spike, t)
        assert detector.step(t) == []

    assert len(detector.spike_minutes[RATE]) == 150


@pytest.mark.parametrize(("sample_failures", "opens"), [(2.0, False), (6.0, True)])
def test_failed_request_steps_require_sampled_excess(sample_failures: float, opens: bool) -> None:
    counts: Series = {T0 + i * MINUTE: 20.0 if i < 170 else 60.0 for i in range(240)}
    series: dict[SeriesKey, Series] = {
        SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT): dict.fromkeys(counts, 10_000.0),
        SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT_SAMPLE): dict.fromkeys(counts, 1_000.0),
        SeriesKey(1, "prod", Signal.FAILED_REQUESTS, Metric.COUNT): counts,
        SeriesKey(1, "prod", Signal.FAILED_REQUESTS, Metric.COUNT_SAMPLE): {
            t: 2.0 if i < 170 else sample_failures for i, t in enumerate(counts)
        },
        FAILED_RATE: dict.fromkeys(counts, None),
    }
    detector = RateShiftTracker(series, Baseline({}))

    actions = [action for t in counts for action, _ in detector.step(t)]

    assert ("open" in actions) == opens


def test_quality_flags_zero_p95_at_the_inclusive_thresholds() -> None:
    series: dict[SeriesKey, Series] = {
        FLAPPY: {T0 + i * MINUTE: 0.0 if i < 15 else 120.0 for i in range(30)},
        samples_key(FLAPPY): {T0 + i * MINUTE: 20.0 for i in range(30)},
    }

    issues = quality.check(series)

    assert set(issues) == {FLAPPY}
    issue = issues[FLAPPY]
    assert issue is not None
    assert "0ms in 50% of minutes despite ~20 sampled spans/min" in issue


@pytest.mark.parametrize(
    ("minute_count", "sample_count", "zeros", "assessment"),
    [(29, 20.0, 29, {}), (30, 19.0, 30, {}), (30, None, 30, {}), (30, 20.0, 14, {FLAPPY: None})],
)
def test_quality_leaves_healthy_or_insufficiently_sampled_series_alone(
    minute_count: int,
    sample_count: float | None,
    zeros: int,
    assessment: dict[SeriesKey, str | None],
) -> None:
    series: dict[SeriesKey, Series] = {
        FLAPPY: {T0 + i * MINUTE: 0.0 if i < zeros else 120.0 for i in range(minute_count)},
        samples_key(FLAPPY): {T0 + i * MINUTE: sample_count for i in range(minute_count)},
    }

    assert quality.check(series) == assessment


def test_gaps_do_not_count_as_quiet_history_or_excursion_duration() -> None:
    novelty = Novelty()
    later = T0 + timedelta(hours=2)
    observe_window(novelty, FLAPPY, T0, T0 + 5 * MINUTE)
    observed = excursion(FLAPPY, T0, 4.0)
    observed.ended_at = T0 + timedelta(hours=1)
    novelty.record(observed)
    candidate = excursion(FLAPPY, later, 4.0)

    verdict = novelty.judge_duration(candidate, 60, later)

    assert verdict.history_days == pytest.approx(5 / 1440)
    assert verdict.similar == 0


def test_shared_learning_uses_joint_coverage_not_unobserved_history() -> None:
    replica = SeriesKey(2, QUIET.env, QUIET.signal, QUIET.metric, QUIET.dim_value)
    novelty = Novelty()
    end = T0 + timedelta(hours=5)
    observe_window(novelty, QUIET, T0, end)
    observe_window(novelty, replica, T0 - timedelta(days=13), end)
    for offset in range(3):
        onset = T0 + timedelta(hours=offset)
        novelty.record(excursion(QUIET, onset, 10.0))
        novelty.record(excursion(replica, onset, 10.0))

    dependencies = learn(novelty.history, end, coverage=novelty.coverage)

    assert dependencies.get(QUIET, replica) is None


def test_shared_learning_does_not_depend_on_project_order() -> None:
    replica = SeriesKey(2, QUIET.env, QUIET.signal, QUIET.metric, QUIET.dim_value)
    end = T0 + timedelta(days=14)
    dense = [T0 + timedelta(hours=hour, minutes=phase) for hour in range(336) for phase in (10, 16)]
    sparse = [T0 + timedelta(hours=hour, minutes=13) for hour in range(10)]
    same_onsets = [T0 + timedelta(hours=hour, minutes=40) for hour in range(22)]

    for dense_key, sparse_key in ((QUIET, replica), (replica, QUIET)):
        novelty = Novelty()
        observe_window(novelty, dense_key, T0, end)
        observe_window(novelty, sparse_key, T0, end)
        for key, starts in ((dense_key, dense), (sparse_key, sparse)):
            for onset in [*starts, *same_onsets]:
                novelty.record(excursion(key, onset, 10.0))

        assert learn(novelty.history, end, coverage=novelty.coverage).get(QUIET, replica) is None


def test_shared_learning_counts_staggered_cross_metric_incidents_once() -> None:
    replica = SeriesKey(2, QUIET.env, QUIET.signal, QUIET.metric, QUIET.dim_value)
    rate = SeriesKey(
        QUIET.project_id, QUIET.env, QUIET.signal, Metric.FAILED_PER_REQUEST, QUIET.dim_value
    )
    replica_rate = SeriesKey(
        replica.project_id, replica.env, replica.signal, rate.metric, replica.dim_value
    )
    end = T0 + timedelta(days=14)
    starts = [T0 + timedelta(hours=hour, minutes=phase) for hour, phase in ((1, 10), (4, 30))]
    observed = {T0 + timedelta(hours=hour): (1 << 60) - 1 for hour in range(336)}
    history: dict[SeriesKey, list[ChangeEvent]] = {}
    for key in (QUIET, replica, rate, replica_rate):
        history[key] = []
        for start in starts:
            onset = start + (MINUTE if key.metric == rate.metric else timedelta())
            event = excursion(key, onset, 10.0)
            event.ended_at = start + 3 * MINUTE
            history[key].append(event)
    coverage = dict.fromkeys(history, observed)

    assert learn(history, end, coverage=coverage).get(QUIET, replica) is None

    # A nearby start after the preceding excursion ends is a distinct incident.
    for key in (rate, replica_rate):
        history[key].append(excursion(key, starts[-1] + 3 * MINUTE, 10.0))

    pair = learn(history, end, coverage=coverage).get(QUIET, replica)
    assert pair is not None
    assert (pair.co, pair.n_a, pair.n_b) == (3, 3, 3)


def test_shared_learning_uses_joint_phase_opportunities_across_hour_boundary() -> None:
    replica = SeriesKey(2, QUIET.env, QUIET.signal, QUIET.metric, QUIET.dim_value)
    end = T0 + timedelta(days=14)
    mostly_observed = ((1 << 59) - 1) & ~1  # Minutes 1–58, not the incident phases.
    sparse = {T0 + timedelta(hours=hour): mostly_observed for hour in range(336)}
    dense = {hour: (1 << 60) - 1 for hour in sparse}
    history: dict[SeriesKey, list[ChangeEvent]] = {QUIET: [], replica: []}
    for hour in range(3):
        left = T0 + timedelta(hours=hour, minutes=59)
        right = left + MINUTE
        sparse[left.replace(minute=0)] |= 1 << 59
        sparse[right] |= 1
        history[QUIET].append(excursion(QUIET, left, 10.0))
        history[replica].append(excursion(replica, right, 10.0))

    assert learn(history, end, coverage={QUIET: dense, replica: dense}).get(QUIET, replica)
    assert learn(history, end, coverage={QUIET: dense, replica: sparse}).get(QUIET, replica) is None
