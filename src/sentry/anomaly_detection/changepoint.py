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
from typing import Literal

from sentry.anomaly_detection.baseline import Baseline
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey
from sentry.anomaly_detection.series import Series

MINUTE = timedelta(minutes=1)
RATES = {
    "error_rate": ("errors", "requests"),
    "failed_rate": ("failed_requests", "requests"),
}


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
        values = self._x(key, before_start, t)
        if values is None:
            return None
        after = [value for ts, value in values if ts > split]
        before = [value for ts, value in values if ts <= split]
        if len(after) < cfg.after_min // 2 or len(before) < cfg.before_min // 2:
            return None
        median_after, median_before = statistics.median(after), statistics.median(before)
        min_shift = math.log(cfg.min_shift)

        if state.open is not None:
            event = state.open
            shift = median_after - state.level_before
            event.peak_ratio = max(
                event.peak_ratio, min(math.exp(shift), self._pooled_ratio(key, t))
            )
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
            return None

        shift = median_after - median_before
        sigma = max(1.4826 * statistics.median(abs(v - median_before) for v in before), 0.05)
        z = shift / (1.253 * sigma * math.sqrt(1 / len(after) + 1 / len(before)))
        pooled = self._pooled_ratio(key, t)
        excess = self._excess_per_min(key, t, min(shift, math.log(max(pooled, 1.0))))
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

        start = _split([(ts, v) for ts, v in values if ts > t - cfg.split_min * MINUTE]) or split
        event = ChangeEvent(
            key=key,
            change_type=ChangeType.CHANGE_POINT,
            start=start,
            actual=self._rate(key, start, t),
            expected=self._rate(key, before_start, split),
            confidence=round(min(0.99, 0.5 + 0.05 * z), 2),
            detected_at=t,
            peak_ratio=pooled,
            open_ratio=pooled,
            evidence=[f"step {pooled:.2f}x vs the 2h before, z={z:.1f}, +{excess:.0f}/min"],
        )
        state.open, state.level_before, state.hits = event, median_before, 0
        state.hold_until = t + cfg.hold * MINUTE
        return "open", event

    def _counts(self, key: SeriesKey) -> tuple[Series, Series]:
        num_signal, den_signal = RATES[key.signal]
        return (
            self.series.get(SeriesKey(key.project, key.env, num_signal, "count()"), {}),
            self.series.get(SeriesKey(key.project, key.env, den_signal, "count()"), {}),
        )

    def _x(
        self, key: SeriesKey, start: datetime, end: datetime
    ) -> list[tuple[datetime, float]] | None:
        num, den = self._counts(key)
        volumes = [d for ts in _minutes(start, end) if (d := den.get(ts))]
        if not volumes or (typical := statistics.median(volumes)) < self.cfg.min_requests:
            return None
        floor = 0.5 / typical  # Half an event a minute at typical traffic.
        skip = self.spike_minutes[key]
        shape = self._shapes(key, start, end)
        out = []
        for ts in _minutes(start, end):
            requests = den.get(ts)
            if not requests or ts in skip:
                continue
            rate = (num.get(ts) or 0.0) / requests
            out.append((ts, math.log(rate / shape[ts] + floor)))
        return out

    def _shapes(self, key: SeriesKey, start: datetime, end: datetime) -> dict[datetime, float]:
        """Normalize hour-of-day shapes, or use a flat shape if any hour lacks history."""
        raw: dict[datetime, float] = {}
        for ts in _minutes(start, end):
            shape = self.baseline.raw_shape(key, ts)
            if shape is None:
                return dict.fromkeys(_minutes(start, end), 1.0)
            raw[ts] = shape
        if not raw:
            return {}
        mean = statistics.mean(raw.values())
        return {ts: value / mean for ts, value in raw.items()}

    def _rate(self, key: SeriesKey, start: datetime, end: datetime) -> float:
        num, den = self._counts(key)
        n = sum(num.get(ts) or 0 for ts in _minutes(start, end))
        d = sum(den.get(ts) or 0 for ts in _minutes(start, end))
        return n / d if d else 0.0

    def _pooled_ratio(self, key: SeriesKey, t: datetime) -> float:
        """Compare pooled rates after seasonal adjustment and an event-count floor."""
        split = t - self.cfg.after_min * MINUTE
        before_start = split - self.cfg.before_min * MINUTE
        shapes = self._shapes(key, before_start, t)
        after_shape = statistics.mean(shapes[ts] for ts in _minutes(split, t))
        before_shape = statistics.mean(shapes[ts] for ts in _minutes(before_start, split))
        after = self._rate(key, split, t) / after_shape
        before = self._rate(key, before_start, split) / before_shape
        floor = self._floor(key, before_start, split)
        return (after + floor) / (before + floor)

    def _floor(self, key: SeriesKey, start: datetime, end: datetime) -> float:
        """One event/minute as a rate, using sampled volume for failed spans."""
        metric = "count()" if key.signal == "error_rate" else "count_sample()"
        volume = self.series.get(SeriesKey(key.project, key.env, "requests", metric), {})
        values = [v for ts in _minutes(start, end) if (v := volume.get(ts))]
        typical = statistics.median(values) if values else 0.0
        return min(1.0, self.cfg.pseudo_events / typical) if typical > 0 else 1.0

    def _excess_per_min(self, key: SeriesKey, t: datetime, shift: float) -> float:
        """Extra errors (or sampled failed spans) a minute at the new level."""
        num_signal, _ = RATES[key.signal]
        metric = "count_sample()" if key.signal == "failed_rate" else "count()"
        num = self.series.get(SeriesKey(key.project, key.env, num_signal, metric), {})
        values = [num.get(ts) or 0 for ts in _minutes(t - self.cfg.after_min * MINUTE, t)]
        return statistics.mean(values) * (1 - math.exp(-shift)) if values else 0.0


def _minutes(start: datetime, end: datetime) -> Iterator[datetime]:
    t = start + MINUTE
    while t <= end:
        yield t
        t += MINUTE


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
