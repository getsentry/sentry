from datetime import UTC, datetime

import pytest

from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    SeriesSlice,
    Signal,
)

START = datetime(2024, 1, 8, 12, tzinfo=UTC)
KEY = SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.P95_DURATION, "/checkout")


def test_series_slice_drops_only_the_metric() -> None:
    assert KEY.slice == SeriesSlice(1, "prod", Signal.ENDPOINTS, "/checkout")
    assert KEY.slice.series(Metric.COUNT) == SeriesKey(
        1, "prod", Signal.ENDPOINTS, Metric.COUNT, "/checkout"
    )
    assert KEY.slice.series(KEY.metric) == KEY


def test_change_event_replace_returns_a_changed_copy() -> None:
    event = ChangeEvent(
        KEY, ChangeType.SLOWDOWN, START, actual=900.0, expected=300.0, confidence=0.9
    )
    closed = event.replace(ended_at=START, peak_ratio=3.0)

    assert closed is not event
    assert (closed.ended_at, closed.peak_ratio) == (START, 3.0)
    assert (event.ended_at, event.peak_ratio) == (None, 1.0)
    assert (closed.key, closed.start, closed.actual) == (KEY, START, 900.0)


def test_change_event_compares_values_and_is_unhashable() -> None:
    event = ChangeEvent(
        KEY, ChangeType.SLOWDOWN, START, actual=900.0, expected=300.0, confidence=0.9
    )

    assert event.replace() == event
    assert event.replace(confidence=0.5) != event
    with pytest.raises(TypeError):
        hash(event)
