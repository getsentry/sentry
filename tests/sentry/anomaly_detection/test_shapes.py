from collections.abc import Callable
from datetime import UTC, datetime
from unittest import mock

import pytest

from sentry.anomaly_detection.contracts import Metric, SeriesKey, SeriesRow, Service, Signal
from sentry.anomaly_detection.evaluation.series import Series
from sentry.anomaly_detection.inputs import shapes
from sentry.anomaly_detection.inputs.shapes import (
    DAY,
    HOUR,
    LOOKBACK,
    SHAPE_TTL,
    build_shapes,
    claim_build,
    compute,
    load,
    store,
)
from sentry.anomaly_detection.state import client
from sentry.testutils.cases import TestCase

DAY0 = datetime(2025, 10, 8, tzinfo=UTC)  # A Wednesday.
SATURDAY = datetime(2025, 10, 11, tzinfo=UTC)
REQUESTS = SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT)
USERS = SeriesKey(1, "prod", Signal.ERRORS, Metric.COUNT_UNIQUE_USER)


def _hourly(day: datetime, value_at: Callable[[datetime], float | None]) -> Series:
    start = day - LOOKBACK
    hours = (start + index * HOUR for index in range(int(LOOKBACK / HOUR)))
    return {hour: value_at(hour) for hour in hours}


def test_shapes_are_same_hour_medians_around_the_scale() -> None:
    series = {
        REQUESTS: _hourly(DAY0, lambda hour: {12: 40.0, 13: 15.0}.get(hour.hour, 10.0)),
    }
    (shape,) = compute(series, DAY0, [1]).series.values()

    assert shape.scale == 10.0
    for day in (DAY0 - DAY, DAY0):
        assert shape.at(day + 12 * HOUR) == 40.0
        assert shape.at(day + 13 * HOUR) == pytest.approx(15.0, rel=0.022)
        assert shape.at(day + 14 * HOUR) == 10.0
    # Only the day and the day before are covered.
    assert shape.at(DAY0 - DAY - HOUR) is None
    assert shape.at(DAY0 + DAY) is None


def test_shapes_prefer_the_same_day_type() -> None:
    series = {REQUESTS: _hourly(SATURDAY, lambda hour: 5.0 if hour.weekday() >= 5 else 10.0)}
    (shape,) = compute(series, SATURDAY, [1]).series.values()

    assert shape.at(SATURDAY - DAY + 9 * HOUR) == 10.0  # Friday
    assert shape.at(SATURDAY + 9 * HOUR) == 5.0


def test_hours_without_enough_history_have_no_shape() -> None:
    recent = DAY0 - 2 * DAY
    series = {
        REQUESTS: _hourly(DAY0, lambda hour: 10.0 if hour >= recent else None),
        # A series that was never positive is left out: it reads as having no history.
        SeriesKey(1, "prod", Signal.FAILED_REQUESTS, Metric.COUNT): _hourly(DAY0, lambda _: 0.0),
    }
    result = compute(series, DAY0, [1]).series

    assert list(result) == [REQUESTS]
    assert result[REQUESTS].scale == 10.0
    assert all(result[REQUESTS].at(DAY0 - DAY + index * HOUR) is None for index in range(48))


def test_user_medians_cover_each_day_with_its_own_history() -> None:
    start = DAY0 - LOOKBACK
    # Increasing values make each median the middle of its window.
    series = {USERS: _hourly(DAY0, lambda hour: (hour - start) / HOUR)}
    users = compute(series, DAY0, [1]).users

    service = Service(1, "prod")
    assert users == {DAY0 - DAY: {service: 179.5}, DAY0: {service: 203.5}}


def test_store_and_load_round_trip_with_a_ttl() -> None:
    series = {
        REQUESTS: _hourly(DAY0, lambda hour: 40.0 if hour.hour == 12 else 10.0),
        USERS: _hourly(DAY0, lambda _: 3.0),
    }
    built = compute(series, DAY0, [1, 2])
    store(1, built)

    assert load(1, DAY0 + 5 * HOUR) == built
    assert load(1, DAY0 + DAY) is None
    assert load(2, DAY0) is None
    ttl = client().ttl("anomaly-detection:{1}:shape:v1:2025-10-08")
    assert 0 < ttl <= SHAPE_TTL.total_seconds()


def test_unreadable_shapes_load_as_missing() -> None:
    client().set("anomaly-detection:{1}:shape:v1:2025-10-08", b"corrupt")
    with mock.patch.object(shapes, "metrics") as metrics:
        assert load(1, DAY0) is None
    metrics.incr.assert_called_once_with("anomaly_detection.shapes.unreadable")


def test_one_build_claim_per_organization_and_day() -> None:
    assert claim_build(1, DAY0)
    assert not claim_build(1, DAY0 + 3 * HOUR)
    assert claim_build(1, DAY0 + DAY)
    assert claim_build(2, DAY0)


class BuildShapesTest(TestCase):
    def test_collects_the_hourly_lookback_and_stores_it(self) -> None:
        rows = [
            SeriesRow(hour, self.project.id, "prod", Signal.REQUESTS, Metric.COUNT, "", 10.0)
            for hour in _hourly(DAY0, lambda _: None)
        ]
        with mock.patch.object(shapes, "collect", return_value=rows) as collect:
            built = build_shapes(self.organization, [self.project], DAY0)

        collect.assert_called_once_with(
            self.organization, [self.project], DAY0 - LOOKBACK, DAY0, "1h"
        )
        assert built.projects == {self.project.id}
        assert list(built.series) == [
            SeriesKey(self.project.id, "prod", Signal.REQUESTS, Metric.COUNT)
        ]
        assert load(self.organization.id, DAY0) == built
