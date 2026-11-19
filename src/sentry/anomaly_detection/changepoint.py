"""Detect sustained increases in aggregate error and failed-request rates.

Compare the median seasonally adjusted log rate in the recent window with the
preceding window. A step must persist and clear both a pooled rate ratio and an
excess-event floor, so short spikes and changes driven by sparse counts do not
open change points.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Literal, NamedTuple

from sentry.anomaly_detection.baseline import Baseline
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey
from sentry.anomaly_detection.series import Series, rate_parts

MINUTE = timedelta(minutes=1)
RATE_FLOOR = 1e-6
RATES = {"error_rate", "failed_rate"}


class _Observation(NamedTuple):
    minute: datetime
    events: float
    requests: float
    shape: float
    traffic: float

    def log_rate(self, floor: float) -> float:
        return math.log((self.events / self.requests + floor) / self.shape)


@dataclass
class ChangePointConfig:
    after_min: int = 30
    before_min: int = 120
    every: int = 5
    persist: int = 3
    min_shift: float = 1.3
    min_z: float = 4.0
    min_excess: float = 2.0
    min_requests: float = 200.0
    hold: int = 150
    split_min: int = 45
    pseudo_events: float = 1.0


@dataclass
class _CP:
    hits: int = 0
    open: ChangeEvent | None = None
    level_before: float = 0.0
    hold_until: datetime | None = None


@dataclass
class ChangePointDetector:
    series: dict[SeriesKey, Series]
    baseline: Baseline
    cfg: ChangePointConfig = field(default_factory=ChangePointConfig)
    exclude: dict[SeriesKey, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.watched: list[SeriesKey] = []
        self.state: dict[SeriesKey, _CP] = {}
        self.spike_minutes: dict[SeriesKey, set[datetime]] = {}
        self._spike_seen: dict[SeriesKey, datetime] = {}
        self.refresh()

    def refresh(self) -> int:
        new = [
            key
            for key in sorted(self.series)
            if key.signal in RATES
            and not key.dim_value
            and key not in self.exclude
            and key not in self.state
        ]
        for key in new:
            self.watched.append(key)
            self.state[key] = _CP()
            self.spike_minutes[key] = set()
        return len(new)

    def note_spike(self, e: ChangeEvent, t: datetime) -> None:
        """Mark minutes covered by an open spike event on a watched series."""
        if e.key in self.spike_minutes:
            # Older minutes cannot enter a detection window again as event time advances.
            window_start = t - (self.cfg.after_min + self.cfg.before_min) * MINUTE
            marked = self.spike_minutes[e.key]
            marked.intersection_update(_minutes(window_start, t))
            marked.update(_minutes(max(e.start - MINUTE, window_start), t))
            self._spike_seen[e.key] = t

    def step(self, t: datetime) -> list[tuple[Literal["open", "close"], ChangeEvent]]:
        if t.minute % self.cfg.every:
            return []
        out = []
        for key in self.watched:
            action = self._step(key, t)
            if action is not None:
                out.append(action)
        return out

    def _step(
        self, key: SeriesKey, t: datetime
    ) -> tuple[Literal["open", "close"], ChangeEvent] | None:
        cfg, state = self.cfg, self.state[key]
        split = t - cfg.after_min * MINUTE
        before_start = split - cfg.before_min * MINUTE
        observations = self._observations(key, before_start, t)
        before_points = [point for point in observations if point.minute <= split]
        after_points = [point for point in observations if point.minute > split]
        if (
            len(after_points) < max(1, cfg.after_min // 2)
            or len(before_points) < max(1, cfg.before_min // 2)
            or statistics.median(point.traffic for point in observations) < cfg.min_requests
        ):
            state.hits = 0
            return None
        # A fixed rate floor and raw hourly shapes keep the frozen level comparable.
        after = [point.log_rate(RATE_FLOOR) for point in after_points]
        before = [point.log_rate(RATE_FLOOR) for point in before_points]
        pooled = self._pooled_ratio(before_points, after_points)
        median_after, median_before = statistics.median(after), statistics.median(before)
        min_shift = math.log(cfg.min_shift)

        if state.open is not None:
            event = state.open
            shift = median_after - state.level_before
            event.peak_ratio = max(event.peak_ratio, min(math.exp(shift), pooled))
            recovered = shift < min_shift / 2
            if recovered or (state.hold_until is not None and t >= state.hold_until):
                event.ended_at = t
                event.evidence.append("recovered" if recovered else "held: new level")
                state.open = None
                return "close", event
            return None
        if (state.hold_until is not None and t < state.hold_until) or self._spike_seen.get(
            key
        ) == t:
            state.hits = 0
            return None

        shift = median_after - median_before
        sigma = max(1.4826 * statistics.median(abs(v - median_before) for v in before), 0.05)
        z = shift / (1.253 * sigma * math.sqrt(1 / len(after) + 1 / len(before)))
        excess = statistics.mean(point.events for point in after_points) * (
            1 - math.exp(-min(shift, math.log(max(pooled, 1.0))))
        )
        if not (
            shift >= min_shift
            and pooled >= cfg.min_shift
            and z >= cfg.min_z
            and excess >= cfg.min_excess
        ):
            state.hits = 0
            return None
        state.hits += 1
        if state.hits < cfg.persist:
            return None

        split_point = _split(
            [
                (point.minute, point.log_rate(RATE_FLOOR))
                for point in observations
                if point.minute > t - cfg.split_min * MINUTE
            ]
        )
        start = split_point or split
        event = ChangeEvent(
            key=key,
            change_type=ChangeType.CHANGE_POINT,
            start=start,
            actual=_rate([point for point in observations if point.minute >= start]),
            expected=_rate(before_points),
            confidence=round(min(0.99, 0.5 + 0.05 * z), 2),
            detected_at=t,
            peak_ratio=pooled,
            open_ratio=pooled,
            evidence=[f"step {pooled:.2f}x vs the 2h before, z={z:.1f}, +{excess:.0f}/min"],
        )
        state.open, state.level_before, state.hits = event, median_before, 0
        state.hold_until = t + cfg.hold * MINUTE
        return "open", event

    def _observations(self, key: SeriesKey, start: datetime, end: datetime) -> list[_Observation]:
        parts = rate_parts(key)
        assert parts is not None
        numerator, denominator = (self.series.get(part, {}) for part in parts[:2])
        total_traffic = self.series.get(SeriesKey(key.project, key.env, "requests", "count()"), {})
        spike_minutes = self.spike_minutes[key]
        observations = []
        for minute in _minutes(start, end):
            if minute in spike_minutes:
                continue
            requests, events = denominator.get(minute), numerator.get(minute)
            if not requests or events is None:
                continue
            observations.append(
                _Observation(
                    minute,
                    events,
                    requests,
                    self.baseline.shape(key, minute),
                    total_traffic.get(minute) or requests,
                )
            )
        return observations

    def _pooled_ratio(self, before: list[_Observation], after: list[_Observation]) -> float:
        # Add the event prior before normalizing so it has the same units as the observations.
        prior = self.cfg.pseudo_events
        return _seasonal_rate(after, prior) / _seasonal_rate(before, prior)


def _rate(points: list[_Observation]) -> float:
    requests = sum(point.requests for point in points)
    return sum(point.events for point in points) / requests if requests else 0.0


def _seasonal_rate(points: list[_Observation], prior: float) -> float:
    return (sum(point.events for point in points) + prior * len(points)) / sum(
        point.requests * point.shape for point in points
    )


def _minutes(start: datetime, end: datetime) -> Iterator[datetime]:
    minute = start + MINUTE
    while minute <= end:
        yield minute
        minute += MINUTE


def _split(values: list[tuple[datetime, float]]) -> datetime | None:
    """Find the upward split maximizing the difference in means, weighted by sample sizes."""
    n = len(values)
    if n < 10:
        return None
    prefix = [0.0]
    for _, value in values:
        prefix.append(prefix[-1] + value)
    best = 0.0
    at = None
    for i in range(5, n - 4):
        left, right = prefix[i] / i, (prefix[n] - prefix[i]) / (n - i)
        score = (right - left) * math.sqrt(i * (n - i) / n)
        if score > best:
            best, at = score, values[i][0]
    return at
