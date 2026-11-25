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
