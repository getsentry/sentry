from datetime import UTC, datetime, timedelta

import pytest

from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, Metric, SeriesKey, Signal
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.rate_shifts import ChangePointConfig, RateShiftTracker
from sentry.anomaly_detection.evaluation.series import Series
from sentry.anomaly_detection.inputs.shapes import compute, day_of

START = datetime(2024, 1, 8, 12, tzinfo=UTC)
REQUESTS = SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT)
ERRORS = SeriesKey(1, "prod", Signal.ERRORS, Metric.COUNT)
LATENCY = SeriesKey(1, "prod", Signal.OUTBOUND_DB, Metric.P95_DURATION, "catalog-db")
FAILURES = SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.FAILURE_RATE, "/api/task")
ERROR_RATE = SeriesKey(1, "prod", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)


def minute(i: int) -> datetime:
    return START + timedelta(minutes=i)


def points(start: int, end: int, value: float | None) -> Series:
    return dict.fromkeys((minute(i) for i in range(start, end)), value)


def shaped(key: SeriesKey, hourly: Series, at: datetime = START) -> Baseline:
    return Baseline(compute({key: hourly}, day_of(at), [key.project_id]).series)


def test_history_scales_level_by_hour_and_prefers_same_day_type() -> None:
    hourly: Series = {START - timedelta(days=i, hours=1): 100.0 for i in range(1, 15)}
    # Three weekdays and four weekend days, so ignoring day type would pick the weekend value.
    hourly |= {START - timedelta(days=i): 20_000.0 for i in (1, 2, 8, 9)}
    hourly |= {START - timedelta(days=i): 200.0 for i in (3, 4, 5)}
    baseline = shaped(REQUESTS, hourly)
    ev = baseline.expected(REQUESTS, points(-60, 0, 10.0), START, set())
    assert ev is not None
    assert ev.expected == 20.0
    assert ev.sigma == pytest.approx(0.1)
    assert ev.lower < ev.expected < ev.upper


def test_missing_history_for_target_hour_uses_recent_signal_units() -> None:
    hourly: Series = {START - timedelta(days=i, hours=1): 200.0 for i in range(1, 15)}
    ev = shaped(REQUESTS, hourly).expected(REQUESTS, points(-60, 0, 10.0), START, set())
    assert ev is not None
    assert ev.expected == 10.0


def test_weekend_shape_uses_two_weekends_when_available() -> None:
    saturday = START + timedelta(days=5)
    hourly: Series = {}
    for i in range(1, 15):
        day = saturday - timedelta(days=i)
        hourly[day] = 20.0 if day.weekday() >= 5 else 100.0
    # Weekend factors are stored to within half a 4.4% step.
    assert shaped(REQUESTS, hourly, saturday).shape(REQUESTS, saturday) == pytest.approx(
        20.0, rel=0.022
    )


def test_warmup_requires_observations_and_widens_band() -> None:
    baseline = Baseline({})
    assert baseline.expected(LATENCY, points(-9, 0, 20.0), START, set()) is None
    few = baseline.expected(LATENCY, points(-10, 0, 20.0), START, set())
    full = baseline.expected(LATENCY, points(-60, 0, 20.0) | {minute(-5): 1000.0}, START, set())
    assert few is not None and full is not None
    assert few.expected == full.expected == 20.0
    assert few.upper > full.upper
    assert full.sigma == pytest.approx(0.1)


def test_mostly_zero_share_uses_sample_weighted_level() -> None:
    values = points(-10, 0, 0.0) | {minute(-1): 0.5, minute(-2): 1.0}
    samples = points(-10, 0, 10.0) | {minute(-1): 20.0, minute(-2): 40.0}
    ev = Baseline({}).expected(
        FAILURES, values, START, set(), weights=samples, pending={minute(-2)}
    )
    assert ev is not None
    assert ev.expected == pytest.approx(0.1)  # 10 failures in 100 spans; pending minute omitted.


def test_change_point_ignores_known_spikes_in_the_pooled_gate() -> None:
    series = {
        REQUESTS: points(0, 230, 10_000.0),
        ERRORS: points(0, 170, 20.0) | points(130, 135, 1000.0) | points(170, 230, 30.0),
        ERROR_RATE: points(0, 230, None),
    }
    detector = RateShiftTracker(series, Baseline({}))
    spike = ChangeEvent(ERROR_RATE, ChangeType.SPIKE, minute(130), 0.1, 0.002, 0.9)
    detector.note_spike(spike, minute(134))
    [(action, event)] = [action for i in range(230) for action in detector.step(minute(i))]
    assert action == "open"
    assert event.expected == pytest.approx(0.002, rel=0.01)
    assert event.actual == 0.003


def test_uncovered_change_point_tick_resets_persistence() -> None:
    series = {
        REQUESTS: points(0, 220, 1000.0),
        ERRORS: points(0, 170, 20.0) | points(170, 220, 40.0),
        ERROR_RATE: points(0, 220, None),
    }
    detector = RateShiftTracker(series, Baseline({}), ChangePointConfig(persist=2))
    assert detector.step(minute(185)) == []
    assert detector.state[ERROR_RATE].hits == 1
    counts = series[ERRORS]
    series[ERRORS] = points(0, 220, None)
    assert detector.step(minute(190)) == []
    series[ERRORS] = counts
    assert detector.step(minute(195)) == []
    assert detector.state[ERROR_RATE].hits == 1


def test_change_point_hold_closes_while_traffic_is_too_low_to_measure() -> None:
    series = {
        REQUESTS: points(0, 200, 1000.0) | points(200, 400, 100.0),
        ERRORS: points(0, 170, 20.0) | points(170, 200, 40.0) | points(200, 400, 4.0),
        ERROR_RATE: points(0, 400, None),
    }
    detector = RateShiftTracker(series, Baseline({}))
    [(opened, event)] = [action for i in range(200) for action in detector.step(minute(i))]
    assert opened == "open"
    hold_until = detector.state[ERROR_RATE].hold_until
    assert hold_until is not None
    # The whole window at hold expiry is below min_requests, so recovery cannot be measured.
    assert [action for i in range(200, 400) for action in detector.step(minute(i))] == [
        ("close", event)
    ]
    assert event.ended_at == hold_until
    assert event.evidence[-1] == "held: new level"


def test_change_point_recovery_uses_the_same_seasonal_scale_as_open() -> None:
    # A high-rate hour falls out of the window while the 50% regression is still present.
    hourly: Series = {
        START + timedelta(hours=hour, days=-day): 0.008 if hour == 0 else 0.002
        for day in range(1, 15)
        for hour in range(-3, 6)
    }
    errors = (
        points(-180, 0, 20.0)
        | points(0, 60, 80.0)
        | points(60, 65, 20.0)
        | points(65, 200, 30.0)
        | points(200, 240, 20.0)
    )
    detector = RateShiftTracker(
        {REQUESTS: points(-180, 240, 10_000.0), ERRORS: errors, ERROR_RATE: dict.fromkeys(errors)},
        Baseline({ERROR_RATE: hourly}),
    )
    [(opened, event)] = [action for i in range(-180, 200) for action in detector.step(minute(i))]
    assert opened == "open"
    assert [action for i in range(200, 240) for action in detector.step(minute(i))] == [
        ("close", event)
    ]
    assert event.evidence[-1] == "recovered"
