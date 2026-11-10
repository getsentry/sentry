import math
import random
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import TypedDict

SECONDS_PER_DAY = 86400


@dataclass(frozen=True)
class Bump:
    """
    A stretch of the series that is raised, lowered or scaled, easing in and out over `ramp` points
    """

    start: int
    length: int
    height: float = 0
    scale: float = 1
    ramp: int = 0


@dataclass(frozen=True)
class SeriesShape:
    point_count: int
    level: float
    daily_swing: float = 0
    noise: float = 0
    bumps: Sequence[Bump] = field(default_factory=tuple)
    seed: int = 0
    decimals: int = 0


class TimeseriesPoint(TypedDict):
    name: int
    value: float


def get_bump_strength(bump: Bump, index: int) -> float:
    if not bump.start <= index < bump.start + bump.length:
        return 0

    points_since_start = index - bump.start + 1

    points_until_end = bump.start + bump.length - index

    return min(1, points_since_start / (bump.ramp + 1), points_until_end / (bump.ramp + 1))


def apply_bump(value: float, bump: Bump, index: int) -> float:
    strength = get_bump_strength(bump, index)

    scale = 1 + (bump.scale - 1) * strength

    return value * scale + bump.height * strength


def build_expected_values(
    shape: SeriesShape, interval_seconds: int, first_index: int = 0
) -> list[float]:
    points_per_day = SECONDS_PER_DAY / interval_seconds

    return [
        shape.level + shape.daily_swing * math.sin(2 * math.pi * index / points_per_day)
        for index in range(first_index, shape.point_count)
    ]


def build_series_values(
    shape: SeriesShape, interval_seconds: int, history_point_count: int = 0
) -> list[float]:
    """
    Values for the shape, preceded by `history_point_count` points before the chart starts.
    Bump positions count from the start of the chart.
    """
    expected_values = build_expected_values(
        shape, interval_seconds, first_index=-history_point_count
    )

    noise_generator = random.Random(shape.seed)

    noisy_values = [value + noise_generator.gauss(0, shape.noise) for value in expected_values]

    bumped_values = [
        apply_bumps(value, shape.bumps, index - history_point_count)
        for index, value in enumerate(noisy_values)
    ]

    return [round(max(value, 0), shape.decimals) for value in bumped_values]


def apply_bumps(value: float, bumps: Sequence[Bump], index: int) -> float:
    for bump in bumps:
        value = apply_bump(value, bump, index)

    return value


def get_bucket_starts_ms(chart_end: datetime, point_count: int, interval_seconds: int) -> list[int]:
    chart_end_ms = int(chart_end.timestamp() * 1000)

    interval_ms = interval_seconds * 1000

    return [chart_end_ms - (point_count - index) * interval_ms for index in range(point_count)]


def build_timeseries_points(
    values: Sequence[float], bucket_starts_ms: Sequence[int]
) -> list[TimeseriesPoint]:
    return [
        {"name": bucket_start_ms, "value": value}
        for bucket_start_ms, value in zip(bucket_starts_ms, values)
    ]
