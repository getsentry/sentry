"""Seasonal shape times recent level, with a robust band in log space."""

import math
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import median

from sentry.anomaly_detection.contracts import ExpectedValue, SeriesKey
from sentry.anomaly_detection.evaluation.distributions import MAD_TO_SIGMA
from sentry.anomaly_detection.evaluation.series import Series, is_share, rate_parts, samples_key
from sentry.anomaly_detection.inputs.shapes import SeriesShape

MINUTE = timedelta(minutes=1)


def weight_key(key: SeriesKey) -> SeriesKey | None:
    """Denominator used to pool a rate over multiple minutes."""
    if is_share(key):
        return samples_key(key)
    parts = rate_parts(key)
    return parts[1] if parts else None


def offset_for(key: SeriesKey) -> float:
    return 1e-4 if weight_key(key) is not None else 1.0


@dataclass
class BaselineConfig:
    window_min: int = 60
    min_points: int = 10
    full_points: int = 30
    sigma_floor: float = 0.1
    k: float = 4.0
    reach_back_min: int = 25 * 60


def _hour(t: datetime) -> datetime:
    return t.replace(minute=0, second=0, microsecond=0)


class Baseline:
    def __init__(
        self, shapes: Mapping[SeriesKey, SeriesShape], cfg: BaselineConfig | None = None
    ) -> None:
        self.shapes = shapes  # Daily hour-of-day shapes, see inputs.shapes.
        self.cfg = cfg or BaselineConfig()

    def shape(self, key: SeriesKey, t: datetime) -> float:
        """The seasonal shape of t's hour.

        An hour without a shape still needs the same units as fitted seasonal observations,
        so it falls back to the series' scale; a series without history has a flat shape.
        """
        stored = self.shapes.get(key)
        if stored is None:
            return 1.0
        shape = stored.at(_hour(t))
        return stored.scale if shape is None else shape

    def expected(
        self,
        key: SeriesKey,
        series: Series,
        t: datetime,
        excluded_minutes: set[datetime],
        weights: Series | None = None,
        pending: set[datetime] | None = None,
    ) -> ExpectedValue | None:
        """Estimate the level from prior minutes, replacing excluded observations with earlier ones."""
        points: list[tuple[datetime, float, float]] = []
        skipped = 0
        hour_shapes: dict[datetime, float] = {}
        for i in range(self.cfg.window_min, 0, -1):
            minute = t - i * MINUTE
            value = series.get(minute)
            if value is None:
                continue
            if minute in excluded_minutes:
                skipped += 1
            else:
                hour = _hour(minute)
                if hour not in hour_shapes:
                    hour_shapes[hour] = self.shape(key, hour)
                points.append((minute, hour_shapes[hour], value))
        if skipped:
            minute = t - self.cfg.window_min * MINUTE
            for _ in range(self.cfg.reach_back_min):
                minute -= MINUTE
                value = series.get(minute)
                if value is not None and minute not in excluded_minutes:
                    points.append((minute, self.shape(key, minute), value))
                    skipped -= 1
                    if not skipped:
                        break
        if len(points) < self.cfg.min_points:
            return None
        ratios = [value / shape for _, shape, value in points]
        level = median(ratios)
        band_points, pooled = points, False
        if level == 0 and any(ratios) and weight_key(key) is not None:
            # A mostly-zero rate's median misses intermittent failures. Pool its events and
            # denominators instead, ignoring recently flagged minutes while a change is pending.
            unflagged = [point for point in points if point[0] not in (pending or ())]
            if unflagged:
                unflagged_ratios = [(minute, value / shape) for minute, shape, value in unflagged]
                level = _pooled(unflagged_ratios, weights)
                band_points, pooled = unflagged, True

        expected = self.shape(key, t) * level
        offset = offset_for(key)
        return ExpectedValue(
            key,
            t,
            expected,
            len(points),
            *_estimate_band(self.cfg, band_points, level, expected, offset, pooled),
        )

    def anchored(
        self, key: SeriesKey, t: datetime, level: float, sigma: float, point_count: int
    ) -> ExpectedValue:
        """Project a frozen episode baseline through the current hour's seasonal shape."""
        expected = self.shape(key, t) * level
        return ExpectedValue(
            key,
            t,
            expected,
            point_count,
            *_band(expected, offset_for(key), sigma, self.cfg.k),
        )


def _pooled(points: list[tuple[datetime, float]], weights: Series | None) -> float:
    if weights:
        weighted = [(ratio, w) for minute, ratio in points if (w := weights.get(minute))]
        if total := sum(weight for _, weight in weighted):
            return sum(ratio * weight for ratio, weight in weighted) / total
    return sum(ratio for _, ratio in points) / len(points)


def _estimate_band(
    cfg: BaselineConfig,
    points: list[tuple[datetime, float, float]],
    level: float,
    expected: float,
    offset: float,
    pooled: bool,
) -> tuple[float, float, float]:
    residuals = [
        math.log((value + offset) / (shape * level + offset)) for _, shape, value in points
    ]
    if pooled:
        # Most minutes are zero, so a MAD around the median collapses and every routine burst
        # looks extreme. Only upward rules pool, so measure how far minutes rise above the
        # pooled level (the upside semideviation).
        sigma = math.sqrt(sum(max(r, 0.0) ** 2 for r in residuals) / len(residuals))
    else:
        center = median(residuals)
        sigma = MAD_TO_SIGMA * median(abs(r - center) for r in residuals)
    sigma = max(sigma, cfg.sigma_floor)
    # Warmup widens the band instead of making short histories look more certain.
    sigma *= math.sqrt(max(cfg.full_points, len(points)) / len(points))
    return _band(expected, offset, sigma, cfg.k)


def _band(expected: float, offset: float, sigma: float, k: float) -> tuple[float, float, float]:
    factor = math.exp(k * sigma)
    return (
        sigma,
        max(0.0, (expected + offset) / factor - offset),
        (expected + offset) * factor - offset,
    )


def zscore(ev: ExpectedValue, actual: float) -> float:
    offset = offset_for(ev.key)
    return math.log((actual + offset) / (ev.expected + offset)) / ev.sigma
