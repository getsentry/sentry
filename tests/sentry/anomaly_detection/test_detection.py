from datetime import datetime, timedelta

import pytest

from sentry.anomaly_detection.contracts import (
    Metric,
    SeriesKey,
    SeriesRow,
    Signal,
)
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.series import Series, build

START = datetime(2024, 1, 8, 12)
REQUESTS = SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT)
LATENCY = SeriesKey(1, "prod", Signal.OUTBOUND_DB, Metric.P95_DURATION, "catalog-db")
FAILURES = SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.FAILURE_RATE, "/api/task")


def minute(i: int) -> datetime:
    return START + timedelta(minutes=i)


def points(start: int, end: int, value: float | None) -> Series:
    return dict.fromkeys((minute(i) for i in range(start, end)), value)


def test_history_scales_level_by_hour_and_prefers_same_day_type() -> None:
    hourly: Series = {START - timedelta(days=i, hours=1): 100.0 for i in range(1, 15)}
    # Three weekdays and four weekend days, so ignoring day type would pick the weekend value.
    hourly |= {START - timedelta(days=i): 20_000.0 for i in (1, 2, 8, 9)}
    hourly |= {START - timedelta(days=i): 200.0 for i in (3, 4, 5)}
    baseline = Baseline({REQUESTS: hourly})
    ev = baseline.expected(REQUESTS, points(-60, 0, 10.0), START, set())
    assert ev is not None
    assert ev.expected == 20.0
    assert ev.sigma == pytest.approx(0.1)
    assert ev.lower < ev.expected < ev.upper


def test_missing_history_for_target_hour_uses_recent_signal_units() -> None:
    hourly: Series = {START - timedelta(days=i, hours=1): 200.0 for i in range(1, 15)}
    ev = Baseline({REQUESTS: hourly}).expected(REQUESTS, points(-60, 0, 10.0), START, set())
    assert ev is not None
    assert ev.expected == 10.0


def test_weekend_shape_uses_two_weekends_when_available() -> None:
    saturday = START + timedelta(days=5)
    hourly: Series = {}
    for i in range(1, 15):
        day = saturday - timedelta(days=i)
        hourly[day] = 20.0 if day.weekday() >= 5 else 100.0
    assert Baseline({REQUESTS: hourly}).raw_shape(REQUESTS, saturday) == 20.0


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


def test_build_masks_empty_latency_and_distinguishes_zero_from_missing_rate_inputs() -> None:
    rows: list[SeriesRow] = [
        SeriesRow(minute(0), Signal.REQUESTS, Metric.COUNT, 1, "prod", "", 2000),
        SeriesRow(minute(1), Signal.REQUESTS, Metric.COUNT, 1, "prod", "", 2000),
        SeriesRow(minute(0), Signal.REQUESTS, Metric.COUNT_SAMPLE, 1, "prod", "", 20),
        SeriesRow(minute(1), Signal.REQUESTS, Metric.COUNT_SAMPLE, 1, "prod", "", 20),
        SeriesRow(minute(0), Signal.FAILED_REQUESTS, Metric.COUNT_SAMPLE, 1, "prod", "", 5),
        SeriesRow(minute(0), Signal.ERRORS, Metric.COUNT, 1, "prod", "", 0),
        SeriesRow(minute(0), Signal.OUTBOUND_DB, Metric.P95_DURATION, 1, "prod", "catalog-db", 0),
        SeriesRow(minute(0), Signal.OUTBOUND_DB, Metric.COUNT_SAMPLE, 1, "prod", "catalog-db", 0),
    ]
    series = build(rows)
    assert series[LATENCY] == {minute(0): None}
    assert series[SeriesKey(1, "prod", Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST)] == {
        minute(0): 0.25,
        minute(1): None,
    }
    assert series[SeriesKey(1, "prod", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)] == {
        minute(0): 0.0,
        minute(1): None,
    }
