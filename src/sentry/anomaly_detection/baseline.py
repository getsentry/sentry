"""Seasonal shape times recent level, with a robust band in log space."""

import math
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import partial
from statistics import median

from sentry.anomaly_detection.contracts import ExpectedValue, SeriesKey
from sentry.anomaly_detection.series import Series, is_share, rate_parts, samples_key

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
    history_days: int = 14
    sigma_floor: float = 0.1
    k: float = 4.0
    reach_back_min: int = 25 * 60


def _hour(t: datetime) -> datetime:
    return t.replace(minute=0, second=0, microsecond=0)


class Baseline:
    def __init__(self, hourly: Mapping[SeriesKey, Series], cfg: BaselineConfig | None = None):
        self.hourly = hourly
        self.cfg = cfg or BaselineConfig()
        self._shape_cache: dict[tuple[SeriesKey, datetime], float | None] = {}
        self._fallback_cache: dict[tuple[SeriesKey, datetime], float] = {}
        self._windows: dict[datetime, tuple[tuple[datetime, datetime], ...]] = {}

    def shape(self, key: SeriesKey, t: datetime) -> float:
        shape = self.raw_shape(key, t)
        if shape is not None:
            return shape
        # A missing hour still needs the same units as fitted seasonal observations.
        day = t.replace(hour=0, minute=0, second=0, microsecond=0)
        cache_key = (key, day)
        if cache_key not in self._fallback_cache:
            cutoff = day - timedelta(days=self.cfg.history_days)
            values = [
                value
                for hour, value in self.hourly.get(key, {}).items()
                if cutoff <= hour < day and value is not None and value > 0
            ]
            self._fallback_cache[cache_key] = median(values) if values else 1.0
        return self._fallback_cache[cache_key]

    def raw_shape(self, key: SeriesKey, t: datetime) -> float | None:
        """Prefer history from the same hour and day type (weekday or weekend)."""
        hour = _hour(t)
        cache_key = (key, hour)
        if cache_key not in self._shape_cache:
            history = self.hourly.get(key, {})
            days = [hour - timedelta(days=d) for d in range(1, self.cfg.history_days + 1)]
            values = [(day, value) for day in days if (value := history.get(day)) is not None]
            same_type = [
                value for day, value in values if (day.weekday() >= 5) == (hour.weekday() >= 5)
            ]
            selected = same_type if len(same_type) >= 3 else [value for _, value in values]
            shape = median(selected) if len(selected) >= 3 else 0.0
            self._shape_cache[cache_key] = shape if shape > 0 else None
        return self._shape_cache[cache_key]

    def _window(self, end: datetime) -> tuple[tuple[datetime, datetime], ...]:
        if end not in self._windows:
            if len(self._windows) >= 512:
                self._windows.clear()
            minutes = (end - i * MINUTE for i in range(self.cfg.window_min, 0, -1))
            self._windows[end] = tuple((minute, _hour(minute)) for minute in minutes)
        return self._windows[end]

    def expected(
        self,
        key: SeriesKey,
        series: Series,
        t: datetime,
        excluded_minutes: set[datetime],
        anchor: datetime | None = None,
        weights: Series | None = None,
        pending: set[datetime] | None = None,
    ) -> ExpectedValue | None:
        """Estimate the level from prior minutes, replacing excluded observations with earlier ones."""
        window = self._window(anchor or t)
        points: list[tuple[datetime, float, float]] = []
        recent: list[float | None] = []
        skipped = 0
        hour_shapes: dict[datetime, float] = {}
        for minute, hour in window:
            value = series.get(minute)
            recent.append(value)
            if value is None:
                continue
            if minute in excluded_minutes:
                skipped += 1
            else:
                if hour not in hour_shapes:
                    hour_shapes[hour] = self.shape(key, hour)
                points.append((minute, hour_shapes[hour], value))
        if skipped:
            minute = window[0][0]
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
        if level == 0 and any(ratios) and weight_key(key) is not None:
            # A mostly-zero rate's median misses intermittent failures. Pool its events and
            # denominators instead, ignoring recently flagged minutes while a change is pending.
            unflagged = [
                (minute, ratio)
                for (minute, _, _), ratio in zip(points, ratios)
                if minute not in (pending or ())
            ]
            if unflagged:
                level = _pooled(unflagged, weights)

        expected = self.shape(key, t) * level
        offset = offset_for(key)
        return ExpectedValue(
            key,
            t,
            expected,
            tuple(recent[-10:]),
            len(points),
            partial(_estimate_band, self.cfg, points, level, expected, offset),
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
            (),
            point_count,
            partial(_band, expected, offset_for(key), sigma, self.cfg.k),
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
) -> tuple[float, float, float]:
    residuals = [
        math.log((value + offset) / (shape * level + offset)) for _, shape, value in points
    ]
    center = median(residuals)
    sigma = max(1.4826 * median(abs(r - center) for r in residuals), cfg.sigma_floor)
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
