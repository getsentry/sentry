from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest

from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, Metric, SeriesKey, Signal
from sentry.anomaly_detection.evaluation import quality
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.rate_shifts import RateShiftTracker
from sentry.anomaly_detection.evaluation.series import Series, samples_key

T0 = datetime(2024, 11, 4, 8, tzinfo=UTC)
MINUTE = timedelta(minutes=1)
FLAPPY = SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.P95_DURATION, "/flappy")
RATE = SeriesKey(1, "prod", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)
FAILED_RATE = SeriesKey(1, "prod", Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST)


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

    assert len(detector.state[RATE].spike_minutes) == 150


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
