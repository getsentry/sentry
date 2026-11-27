from datetime import UTC, datetime, timedelta

import pytest

from sentry.anomaly_detection.contracts import Metric, SeriesKey, SeriesRow, Signal
from sentry.anomaly_detection.evaluation.series import (
    build,
    has_traffic,
    is_share,
    rate_parts,
    uses_trials,
)

START = datetime(2024, 1, 8, 12, tzinfo=UTC)
LATENCY = SeriesKey(1, "prod", Signal.OUTBOUND_DB, Metric.P95_DURATION, "catalog-db")


def minute(i: int) -> datetime:
    return START + timedelta(minutes=i)


def test_build_masks_empty_latency_and_distinguishes_zero_from_missing_rate_inputs() -> None:
    rows: list[SeriesRow] = [
        SeriesRow(minute(0), 1, "prod", Signal.REQUESTS, Metric.COUNT, "", 2000),
        SeriesRow(minute(1), 1, "prod", Signal.REQUESTS, Metric.COUNT, "", 2000),
        SeriesRow(minute(0), 1, "prod", Signal.REQUESTS, Metric.COUNT_SAMPLE, "", 20),
        SeriesRow(minute(1), 1, "prod", Signal.REQUESTS, Metric.COUNT_SAMPLE, "", 20),
        # The rate divides extrapolated failures; the sampled count (5 / 20) must not leak in.
        SeriesRow(minute(0), 1, "prod", Signal.FAILED_REQUESTS, Metric.COUNT, "", 300),
        SeriesRow(minute(0), 1, "prod", Signal.FAILED_REQUESTS, Metric.COUNT_SAMPLE, "", 5),
        SeriesRow(minute(0), 1, "prod", Signal.ERRORS, Metric.COUNT, "", 0),
        SeriesRow(minute(0), 1, "prod", Signal.OUTBOUND_DB, Metric.P95_DURATION, "catalog-db", 0),
        SeriesRow(minute(0), 1, "prod", Signal.OUTBOUND_DB, Metric.COUNT_SAMPLE, "catalog-db", 0),
    ]
    series = build(rows)
    assert series[LATENCY] == {minute(0): None}
    assert series[SeriesKey(1, "prod", Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST)] == {
        minute(0): 0.15,
        minute(1): None,
    }
    assert series[SeriesKey(1, "prod", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)] == {
        minute(0): 0.0,
        minute(1): None,
    }


def test_build_masks_by_count_when_a_slice_has_no_sample_series() -> None:
    def endpoint(i: int, metric: Metric, value: float) -> SeriesRow:
        return SeriesRow(minute(i), 1, "prod", Signal.ENDPOINTS, metric, "/checkout", value)

    rows = [
        endpoint(0, Metric.COUNT, 0),
        endpoint(1, Metric.COUNT, 40),
        endpoint(0, Metric.FAILURE_RATE, 0.0),
        endpoint(1, Metric.FAILURE_RATE, 0.1),
        endpoint(0, Metric.P95_DURATION, 0.0),
        endpoint(1, Metric.P95_DURATION, 250.0),
    ]
    series = build(rows)
    share = SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.FAILURE_RATE, "/checkout")
    latency = SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.P95_DURATION, "/checkout")
    assert series[share] == {minute(0): None, minute(1): 0.1}
    assert series[latency] == {minute(0): None, minute(1): 250.0}


def test_has_traffic_requires_the_unsliced_request_total() -> None:
    series = build(
        [
            SeriesRow(minute(0), 1, "prod", Signal.REQUESTS, Metric.COUNT, "", 10),
            SeriesRow(minute(0), 1, "staging", Signal.ENDPOINTS, Metric.COUNT, "/checkout", 3),
        ]
    )
    assert has_traffic(series, 1, "prod")
    assert not has_traffic(series, 1, "staging")
    assert not has_traffic(series, 2, "prod")


@pytest.mark.parametrize(
    ("signal", "metric", "events"),
    [
        (Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST, Signal.ERRORS),
        (Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST, Signal.FAILED_REQUESTS),
    ],
)
def test_rate_parts_divide_extrapolated_counts(
    signal: Signal, metric: Metric, events: Signal
) -> None:
    assert rate_parts(SeriesKey(1, "prod", signal, metric)) == (
        SeriesKey(1, "prod", events, Metric.COUNT),
        SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT),
        SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT_SAMPLE),
    )


def test_rate_parts_is_none_for_measured_series() -> None:
    assert rate_parts(SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT)) is None


@pytest.mark.parametrize(
    ("key", "share", "trials"),
    [
        (SeriesKey(1, "prod", Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST), False, True),
        (SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.FAILURE_RATE, "/checkout"), True, True),
        (SeriesKey(1, "prod", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST), False, False),
        (SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.COUNT, "/checkout"), False, False),
    ],
)
def test_share_and_trial_series(key: SeriesKey, share: bool, trials: bool) -> None:
    assert is_share(key) is share
    assert uses_trials(key) is trials
