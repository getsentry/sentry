"""Detect sustained increases in aggregate error and failed-request rates.

Compare the median seasonally adjusted log rate in the recent window with the
preceding window. A step must persist and clear both a pooled rate ratio and an
excess-event floor, so short spikes and changes driven by sparse counts do not
open change points.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import NamedTuple

from sentry.anomaly_detection.contracts import (
    ChangeAction,
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    Signal,
)
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.distributions import MAD_TO_SIGMA, MEDIAN_SE_FACTOR
from sentry.anomaly_detection.evaluation.series import Series, rate_parts

MINUTE = timedelta(minutes=1)
RATE_FLOOR = 1e-6
RATES = frozenset({Signal.ERROR_RATE, Signal.FAILED_RATE})


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
class RateShiftState:
    hits: int = 0
    open: ChangeEvent | None = None
    level_before: float = 0.0
    hold_until: datetime | None = None
    # Minutes covered by open spikes on this series, excluded from its windows.
    spike_minutes: set[datetime] = field(default_factory=set)
    spike_seen: datetime | None = None


@dataclass
class RateShiftTracker:
    """Track sustained rate shifts for the anomaly handler, not issue state."""

    series: dict[SeriesKey, Series]
    baseline: Baseline
    cfg: ChangePointConfig = field(default_factory=ChangePointConfig)
    # Watched series in scoring order.
    state: dict[SeriesKey, RateShiftState] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.refresh()

    def refresh(self, *, project_id: int | None = None) -> int:
        new = [
            key
            for key in sorted(self.series)
            if (project_id is None or key.project_id == project_id)
            and key.signal in RATES
            and not key.dim_value
            and key not in self.state
        ]
        for key in new:
            self.state[key] = RateShiftState()
        return len(new)

    def note_spike(self, event: ChangeEvent, minute: datetime) -> None:
        """Mark minutes covered by an open spike event on a watched series."""
        state = self.state.get(event.key)
        if state is not None:
            # Older minutes cannot enter a detection window again as event time advances.
            window_start = minute - (self.cfg.after_min + self.cfg.before_min) * MINUTE
            state.spike_minutes.intersection_update(_minutes(window_start, minute))
            state.spike_minutes.update(_minutes(max(event.start - MINUTE, window_start), minute))
            state.spike_seen = minute

    def step(self, minute: datetime, *, project_id: int | None = None) -> list[ChangeAction]:
        if minute.minute % self.cfg.every:
            return []
        actions = []
        for key in self.state:
            if project_id is not None and key.project_id != project_id:
                continue
            action = self._step(key, minute)
            if action is not None:
                actions.append(action)
        return actions

    def open_keys(self) -> set[SeriesKey]:
        return {key for key, state in self.state.items() if state.open}

    def expire(self, key: SeriesKey, at: datetime, reason: str) -> ChangeEvent | None:
        """End the series' open shift without observing recovery, and reset its state."""
        state = self.state.get(key)
        if state is None or state.open is None:
            return None
        event = state.open
        event.ended_at = at
        event.evidence.append(reason)
        self.state[key] = RateShiftState(
            spike_minutes=state.spike_minutes, spike_seen=state.spike_seen
        )
        return event

    def forget(self, keys: Iterable[SeriesKey]) -> None:
        for key in keys:
            self.state.pop(key, None)

    def drop_projects(self, keep: set[int]) -> None:
        self.forget([key for key in self.state if key.project_id not in keep])

    def _step(self, key: SeriesKey, minute: datetime) -> ChangeAction | None:
        config, state = self.cfg, self.state[key]
        recent_boundary = minute - config.after_min * MINUTE
        history_start = recent_boundary - config.before_min * MINUTE
        observations = self._observations(key, history_start, minute)
        historical_points = [point for point in observations if point.minute <= recent_boundary]
        recent_points = [point for point in observations if point.minute > recent_boundary]
        measurable = (
            len(recent_points) >= max(1, config.after_min // 2)
            and len(historical_points) >= max(1, config.before_min // 2)
            and statistics.median(point.traffic for point in observations) >= config.min_requests
        )
        min_log_shift = math.log(config.min_shift)

        if event := state.open:
            # The hold expires even while traffic is too low to measure recovery.
            recovered = False
            if measurable:
                # Recovery uses the frozen pre-change level, not the moving historical window.
                recent_log_rates = [point.log_rate(RATE_FLOOR) for point in recent_points]
                log_shift = statistics.median(recent_log_rates) - state.level_before
                pooled_ratio = self._pooled_ratio(historical_points, recent_points)
                event.peak_ratio = max(event.peak_ratio, min(math.exp(log_shift), pooled_ratio))
                recovered = log_shift < min_log_shift / 2
            if recovered or (state.hold_until is not None and minute >= state.hold_until):
                event.ended_at = minute
                event.evidence.append("recovered" if recovered else "held: new level")
                state.open = None
                return "close", event
            return None
        if (
            not measurable
            or (state.hold_until is not None and minute < state.hold_until)
            or state.spike_seen == minute
        ):
            state.hits = 0
            return None

        # A fixed rate floor and raw hourly shapes keep the frozen level comparable.
        recent_log_rates = [point.log_rate(RATE_FLOOR) for point in recent_points]
        historical_log_rates = [point.log_rate(RATE_FLOOR) for point in historical_points]
        pooled_ratio = self._pooled_ratio(historical_points, recent_points)
        recent_level = statistics.median(recent_log_rates)
        historical_level = statistics.median(historical_log_rates)

        log_shift = recent_level - historical_level
        median_deviation = statistics.median(
            abs(rate - historical_level) for rate in historical_log_rates
        )
        historical_sigma = max(MAD_TO_SIGMA * median_deviation, 0.05)
        standard_error = (
            MEDIAN_SE_FACTOR
            * historical_sigma
            * math.sqrt(1 / len(recent_log_rates) + 1 / len(historical_log_rates))
        )
        z_score = log_shift / standard_error
        excess_per_minute = statistics.mean(point.events for point in recent_points) * (
            1 - math.exp(-min(log_shift, math.log(max(pooled_ratio, 1.0))))
        )
        if not (
            log_shift >= min_log_shift
            and pooled_ratio >= config.min_shift
            and z_score >= config.min_z
            and excess_per_minute >= config.min_excess
        ):
            state.hits = 0
            return None
        state.hits += 1
        if state.hits < config.persist:
            return None

        onset_search_start = minute - config.split_min * MINUTE
        estimated_onset = _split(
            [
                (point.minute, point.log_rate(RATE_FLOOR))
                for point in observations
                if point.minute > onset_search_start
            ]
        )
        onset = estimated_onset or recent_boundary
        event = ChangeEvent(
            key=key,
            change_type=ChangeType.CHANGE_POINT,
            start=onset,
            actual=_rate([point for point in observations if point.minute >= onset]),
            expected=_rate(historical_points),
            confidence=round(min(0.99, 0.5 + 0.05 * z_score), 2),
            detected_at=minute,
            peak_ratio=pooled_ratio,
            open_ratio=pooled_ratio,
            evidence=[
                f"step {pooled_ratio:.2f}x vs the 2h before, z={z_score:.1f}, +{excess_per_minute:.0f}/min"
            ],
        )
        state.open = event
        state.level_before = historical_level
        state.hits = 0
        state.hold_until = minute + config.hold * MINUTE
        return "open", event

    def _observations(self, key: SeriesKey, start: datetime, end: datetime) -> list[_Observation]:
        parts = rate_parts(key)
        assert parts is not None
        numerator, denominator = (self.series.get(part, {}) for part in parts[:2])
        total_traffic = self.series.get(
            SeriesKey(key.project_id, key.env, Signal.REQUESTS, Metric.COUNT), {}
        )
        spike_minutes = self.state[key].spike_minutes
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
    sample_count = len(values)
    if sample_count < 10:
        return None
    cumulative_rates = [0.0]
    for _, log_rate in values:
        cumulative_rates.append(cumulative_rates[-1] + log_rate)
    best_score = 0.0
    best_minute = None
    for split_index in range(5, sample_count - 4):
        recent_count = sample_count - split_index
        historical_mean = cumulative_rates[split_index] / split_index
        recent_mean = (
            cumulative_rates[sample_count] - cumulative_rates[split_index]
        ) / recent_count
        score = (recent_mean - historical_mean) * math.sqrt(
            split_index * recent_count / sample_count
        )
        if score > best_score:
            best_score = score
            best_minute = values[split_index][0]
    return best_minute
