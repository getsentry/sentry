"""Each organization's hour-of-day shapes, built once a day and kept in Redis.

Detection scales every series by the typical value of the same hour over the last two
weeks. Those shapes only change once a day, so a daily build computes them from hourly
history and stores one value per organization and day (`shape:v1:<date>`, see the key
space in sentry.anomaly_detection.state). Minute runs only read it.

A day's value covers that day and the day before, so a run that warms up or catches up
across midnight reads one value. For each series with positive history it holds:

- a scale: the median of the series' positive hourly values over the SHAPE_DAYS before
  the day. It is also the shape of an hour without enough history.
- one byte per covered hour: round(16 * log2(shape / scale)) + 128. That spans 1/256x to
  256x the scale in 4.4% steps, inside detection's 10% sigma floor. 0 means the hour has
  no shape: fewer than three earlier values, or a median of zero.

It also holds each service's median hourly distinct error users over the USER_DAYS
before each covered day, which scales new failure thresholds.
"""

from __future__ import annotations

import math
import zlib
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from statistics import median
from typing import TYPE_CHECKING, NamedTuple

import msgspec

from sentry.anomaly_detection.contracts import Metric, SeriesKey, Service, Signal
from sentry.anomaly_detection.evaluation.series import Series, build
from sentry.anomaly_detection.inputs.measurements import collect
from sentry.anomaly_detection.state import client, org_key
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project

HOUR = timedelta(hours=1)
DAY = timedelta(days=1)
SHAPE_DAYS = 14  # Same-hour history behind a shape.
USER_DAYS = 15  # Hourly history behind a day's new failure thresholds.
# Hourly history a build collects: the day before needs its own full history.
LOOKBACK = DAY + timedelta(days=max(SHAPE_DAYS, USER_DAYS))
SHAPE_TTL = timedelta(days=2)
# How long one build request for an organization and day stands, about one build's run.
BUILD_CLAIM_TTL = timedelta(minutes=5)
_COVERED_HOURS = 48
_MIN_VALUES = 3
_STEPS_PER_DOUBLING = 16
_CENTER = 128
_NO_SHAPE = 0


def day_of(t: datetime) -> datetime:
    """Midnight UTC of the day containing t."""
    return t.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)


class SeriesShape(NamedTuple):
    """One series' hourly shapes over two days. A tuple, so checkpoints store it compactly."""

    first_hour: datetime  # Midnight UTC of the day before the build's day.
    scale: float
    factors: bytes  # One per hour from first_hour; see the module docstring.

    def at(self, hour: datetime) -> float | None:
        """The shape of the hour starting at `hour`, or None without one."""
        index, offset = divmod(hour - self.first_hour, HOUR)
        if offset or not 0 <= index < len(self.factors):
            return None
        factor = self.factors[index]
        if factor == _NO_SHAPE:
            return None
        return self.scale * 2 ** ((factor - _CENTER) / _STEPS_PER_DOUBLING)


@dataclass(frozen=True)
class DailyShapes:
    day: datetime  # Midnight UTC; the value covers this day and the day before.
    projects: frozenset[int]  # Projects whose history the build collected.
    series: dict[SeriesKey, SeriesShape]
    # Median hourly distinct error users of each service over the USER_DAYS before a day,
    # for each covered day.
    users: dict[datetime, dict[Service, float]]


class _Stored(msgspec.Struct, array_like=True, frozen=True):
    projects: list[int]
    series: list[tuple[SeriesKey, float, bytes]]
    # Each service's median users before the day before, then before the day.
    users: list[tuple[Service, float | None, float | None]]


_decoder = msgspec.msgpack.Decoder(_Stored)


def compute(
    series: Mapping[SeriesKey, Series], day: datetime, projects: Iterable[int]
) -> DailyShapes:
    """Shape every series in hourly `series` for `day` and the day before."""
    if day != day_of(day):
        raise ValueError("Shapes are built for a UTC midnight")
    first_hour = day - DAY
    hours = [first_hour + index * HOUR for index in range(_COVERED_HOURS)]
    shapes: dict[SeriesKey, SeriesShape] = {}
    for key, values in series.items():
        since = day - SHAPE_DAYS * DAY
        positive = [
            value
            for hour, value in values.items()
            if since <= hour < day and value is not None and value > 0
        ]
        if not positive:
            continue
        scale = median(positive)
        factors = bytes(_factor(_hour_shape(values, hour), scale) for hour in hours)
        shapes[key] = SeriesShape(first_hour, scale, factors)

    users: dict[datetime, dict[Service, float]] = {first_hour: {}, day: {}}
    for key, values in series.items():
        if not (
            key.signal == Signal.ERRORS
            and key.metric == Metric.COUNT_UNIQUE_USER
            and not key.dim_value
        ):
            continue
        for covered, medians in users.items():
            since = covered - USER_DAYS * DAY
            samples = [
                value
                for hour, value in values.items()
                if since <= hour < covered and value is not None
            ]
            if samples:
                medians[Service(key.project_id, key.env)] = median(samples)
    return DailyShapes(day, frozenset(projects), shapes, users)


def _hour_shape(values: Series, hour: datetime) -> float | None:
    """The median of the same hour on earlier days, preferring the same day type."""
    observed = [
        (earlier, value)
        for days in range(1, SHAPE_DAYS + 1)
        if (value := values.get(earlier := hour - days * DAY)) is not None
    ]
    weekend = hour.weekday() >= 5
    same_type = [value for earlier, value in observed if (earlier.weekday() >= 5) == weekend]
    selected = same_type if len(same_type) >= _MIN_VALUES else [value for _, value in observed]
    if len(selected) < _MIN_VALUES:
        return None
    shape = median(selected)
    return shape if shape > 0 else None


def _factor(shape: float | None, scale: float) -> int:
    if shape is None:
        return _NO_SHAPE
    step = round(_STEPS_PER_DOUBLING * math.log2(shape / scale)) + _CENTER
    return min(255, max(1, step))


def _key(organization_id: int, day: datetime) -> str:
    return org_key(organization_id, "shape", "v1", day.date().isoformat())


def store(organization_id: int, shapes: DailyShapes) -> None:
    before = shapes.users.get(shapes.day - DAY, {})
    current = shapes.users.get(shapes.day, {})
    payload = msgspec.msgpack.encode(
        _Stored(
            projects=sorted(shapes.projects),
            series=[(key, shape.scale, shape.factors) for key, shape in shapes.series.items()],
            users=[
                (service, before.get(service), current.get(service))
                for service in sorted(before.keys() | current.keys())
            ],
        )
    )
    blob = zlib.compress(payload)
    metrics.distribution("anomaly_detection.shapes.bytes", len(blob))
    client().set(_key(organization_id, shapes.day), blob, ex=SHAPE_TTL)


def load(organization_id: int, day: datetime) -> DailyShapes | None:
    """The organization's shapes for `day`, or None if they weren't built or are unreadable."""
    day = day_of(day)
    blob = client().get(_key(organization_id, day))
    if blob is None:
        return None
    try:
        stored = _decoder.decode(zlib.decompress(blob))
    except (zlib.error, msgspec.DecodeError):
        metrics.incr("anomaly_detection.shapes.unreadable")
        return None
    first_hour = day - DAY
    users: dict[datetime, dict[Service, float]] = {first_hour: {}, day: {}}
    for service, before, current in stored.users:
        for covered, value in ((first_hour, before), (day, current)):
            if value is not None:
                users[covered][service] = value
    return DailyShapes(
        day,
        frozenset(stored.projects),
        {key: SeriesShape(first_hour, scale, factors) for key, scale, factors in stored.series},
        users,
    )


def build_shapes(
    organization: Organization, projects: Sequence[Project], day: datetime
) -> DailyShapes:
    """Collect the hourly history behind `day` and store the organization's shapes."""
    rows = collect(organization, projects, day - LOOKBACK, day, "1h")
    shapes = compute(build(rows), day, (project.id for project in projects))
    store(organization.id, shapes)
    return shapes


def claim_build(organization_id: int, day: datetime) -> bool:
    """Whether the caller may request a build of `day`: one request stands at a time."""
    key = org_key(organization_id, "shape-build", "v1", day_of(day).date().isoformat())
    return bool(client().set(key, b"1", nx=True, ex=BUILD_CLAIM_TTL))
