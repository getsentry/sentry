from datetime import UTC, datetime, timedelta

from sentry.anomaly_detection.contracts import (
    Metric,
    SeriesKey,
    SeriesRow,
    Signal,
)
from sentry.anomaly_detection.evaluation.series import build

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
