"""Judge whether an excursion is unusual for its series by size or duration.

The rate of comparable excursions has a Gamma posterior: its shape is the
series' count plus a pooled prior weighted by prior days, and its rate parameter
is the series' exposure in days plus prior days. An excursion is absorbed only
when the posterior confidently puts the rate above the normal recurrence
threshold. Recording absorbed events as well as unusual ones lets the model
learn, and retaining the live event lets it learn the final size and duration.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import NamedTuple

from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    Metric,
    NoveltyEvidence,
    SeriesKey,
    Signal,
)
from sentry.anomaly_detection.evaluation.distributions import gamma_sf

DAY = 86400.0
_MINUTE = timedelta(minutes=1)

# One bit per minute keeps a full hour of observations in a single JSON-safe integer.
HourlyCoverage = dict[datetime, int]


class NoveltyKind(NamedTuple):
    """Series whose excursions pool into one another's prior."""

    signal: Signal
    metric: Metric

    def __str__(self) -> str:
        return f"{self.signal}|{self.metric}"


@dataclass
class NoveltyConfig:
    horizon_days: float = 14.0
    prior_weight_days: float = 2.0
    min_return_days: float = 3.0
    absorb_confidence: float = 0.8
    comparable: float = 1.5  # Compare excursions at least this close in size or duration.
    base_rate: float = 0.25
    pool_cap_per_day: float = 2.0
    base_minutes: float = 30.0


@dataclass
class Verdict:
    unusual: bool
    size: float
    return_days: float
    similar: int
    history_days: float
    pooled_rate: float
    kind: NoveltyKind
    p_normal: float = 0.0
    lasting_min: float | None = None

    def as_evidence(self) -> NoveltyEvidence:
        evidence = NoveltyEvidence(
            unusual=self.unusual,
            size=round(self.size, 2),
            return_days=round(self.return_days, 2),
            similar=self.similar,
            history_days=round(self.history_days, 2),
            pooled_rate=round(self.pooled_rate, 4),
            kind=str(self.kind),
            p_normal=round(self.p_normal, 3),
        )
        if self.lasting_min is not None:
            evidence["lasting_min"] = round(self.lasting_min)
        return evidence

    def text(self) -> str:
        basis = (
            f"{self.similar} similar in {self.history_days:.1f} days of this series' history"
            if self.history_days >= 0.5
            else "mostly similar series, little history of its own yet"
        )
        what = "this big" if self.lasting_min is None else f"lasting {_minutes(self.lasting_min)}+"
        label = "unusual" if self.unusual else "normal"
        every = _days(self.return_days)
        return f"{label} here: excursions {what} happen about once every {every} ({basis})"


@dataclass
class NoveltyState:
    """Recorded excursions and observed minutes per series, within the rolling horizon."""

    history: dict[SeriesKey, list[ChangeEvent]] = field(default_factory=dict)
    coverage: dict[SeriesKey, HourlyCoverage] = field(default_factory=dict)
    # Where a series' history became complete after older excursions were capped away;
    # its coverage before then has no matching excursions.
    complete_since: dict[SeriesKey, datetime] = field(default_factory=dict)


class Novelty:
    def __init__(self, cfg: NoveltyConfig | None = None, state: NoveltyState | None = None):
        self.cfg = cfg or NoveltyConfig()
        self.state = state or NoveltyState()

    def observe(self, key: SeriesKey, minute: datetime) -> None:
        hour = minute.replace(minute=0)
        hours = self.state.coverage.setdefault(key, {})
        hours[hour] = hours.get(hour, 0) | (1 << minute.minute)

    def observed_duration(self, event: ChangeEvent, now: datetime) -> int:
        end = min(event.ended_at, now) if event.ended_at is not None else now
        return self._covered_minutes(event.key, event.start, end)

    def judge(self, e: ChangeEvent, size: float, t: datetime) -> Verdict:
        floor = size / self.cfg.comparable
        base = self.cfg.base_rate * min(1.0, 1.5 / floor) if floor > 0 else self.cfg.base_rate
        return self._judge(e, t, lambda record: size_of(record.peak_ratio) >= floor, base, size)

    def judge_duration(self, e: ChangeEvent, minutes: float, t: datetime) -> Verdict:
        """Rejudge a flare that may be routine in size but has lasted unusually long."""
        cfg = self.cfg
        floor = minutes / cfg.comparable
        base = cfg.base_rate * min(1.0, cfg.base_minutes / floor) if floor > 0 else cfg.base_rate
        verdict = self._judge(
            e,
            t,
            lambda record: self.observed_duration(record, t) >= floor,
            base,
            size_of(e.peak_ratio),
        )
        verdict.lasting_min = minutes
        return verdict

    def record(self, e: ChangeEvent) -> None:
        self.state.history.setdefault(e.key, []).append(e)

    def prune(self, t: datetime) -> None:
        """Drop excursions and observations outside the rolling history horizon."""
        state = self.state
        horizon = t - timedelta(days=self.cfg.horizon_days)
        for key in list(state.history):
            within_horizon = [record for record in state.history[key] if record.start >= horizon]
            if within_horizon:
                state.history[key] = within_horizon
            else:
                del state.history[key]
        first_hour = horizon.replace(minute=0)
        for key, hours in list(state.coverage.items()):
            for hour in list(hours):
                if hour < first_hour:
                    del hours[hour]
            if not hours:
                del state.coverage[key]
        for key, since in list(state.complete_since.items()):
            if since <= horizon or key not in state.history:
                del state.complete_since[key]

    def cap_history(self, max_records: int) -> None:
        """Keep each series' latest excursions, remembering where its history is complete."""
        for key, records in self.state.history.items():
            if len(records) > max_records:
                del records[:-max_records]
                self.state.complete_since[key] = records[0].start

    def keys(self) -> set[SeriesKey]:
        return self.state.coverage.keys() | self.state.history.keys()

    def last_seen(self, key: SeriesKey) -> datetime:
        """The latest observed minute or recorded excursion start of a series."""
        latest_observation = datetime.min
        if hours := self.state.coverage.get(key):
            latest_hour = max(hours)
            latest_observation = latest_hour + (hours[latest_hour].bit_length() - 1) * _MINUTE
        latest_excursion = max(
            (record.start for record in self.state.history.get(key, ())), default=datetime.min
        )
        return max(latest_observation, latest_excursion)

    def forget(self, keys: Iterable[SeriesKey]) -> None:
        state = self.state
        for key in keys:
            state.history.pop(key, None)
            state.coverage.pop(key, None)
            state.complete_since.pop(key, None)

    def _judge(
        self,
        e: ChangeEvent,
        t: datetime,
        similar: Callable[[ChangeEvent], bool],
        base: float,
        size: float,
    ) -> Verdict:
        cfg, key = self.cfg, e.key
        kind = kind_of(key)
        horizon = t - timedelta(days=cfg.horizon_days)
        count = sum(
            1
            for record in self.state.history.get(key, [])
            if record is not e and record.start >= horizon and similar(record)
        )
        exposure = self._exposure(key, t)
        pooled = self._pooled(kind, similar, base, t, horizon, exclude=key)
        shape = count + cfg.prior_weight_days * pooled
        rate_param = exposure + cfg.prior_weight_days
        mean_rate = shape / rate_param
        p_normal = gamma_sf(shape, rate_param / cfg.min_return_days) if shape > 0 else 0.0
        return Verdict(
            unusual=p_normal < cfg.absorb_confidence,
            size=size,
            return_days=1 / mean_rate if mean_rate > 0 else float("inf"),
            similar=count,
            history_days=exposure,
            pooled_rate=pooled,
            kind=kind,
            p_normal=p_normal,
        )

    def _exposure(self, key: SeriesKey, now: datetime) -> float:
        start = now - timedelta(days=self.cfg.horizon_days)
        return self._covered_minutes(key, start, now) / (DAY / 60)

    def _covered_minutes(self, key: SeriesKey, start: datetime, end: datetime) -> int:
        return sum(
            mask.bit_count()
            for _, mask in coverage_between(self.state.coverage.get(key, {}), start, end)
        )

    def _pooled(
        self,
        kind: NoveltyKind,
        similar: Callable[[ChangeEvent], bool],
        base: float,
        t: datetime,
        horizon: datetime,
        exclude: SeriesKey,
    ) -> float:
        count, days = 0.0, 0.0
        for key in sorted(self.state.coverage):
            if key == exclude or kind_of(key) != kind:
                continue
            exposure = self._exposure(key, t)
            if exposure <= 0:
                continue
            hits = sum(
                1
                for record in self.state.history.get(key, [])
                if record.start >= horizon and similar(record)
            )
            count += min(hits, self.cfg.pool_cap_per_day * exposure)
            days += exposure
        # The cold-start rate counts as one series-day, and each peer's influence is capped.
        return (count + base) / (days + 1.0)


_POD = re.compile(r"-[0-9a-f]{8,10}-[0-9a-z]{5}$")
_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_HEX = re.compile(r"(?<![0-9a-z])[0-9a-f]{12,}(?![0-9a-z])")


def mask_dim(v: str) -> str:
    """Mask ephemeral pod suffixes, UUIDs, and long hex IDs in correlation labels."""
    v = _POD.sub("-*", v)
    v = _UUID.sub("*", v)
    return _HEX.sub("*", v)


def kind_of(key: SeriesKey) -> NoveltyKind:
    return NoveltyKind(key.signal, key.metric)


def size_of(ratio: float) -> float:
    """A change's size in either direction: 3x up and 3x down are both 3."""
    if not ratio or ratio <= 0:
        return 1.0
    return max(ratio, 1 / ratio)


def coverage_between(
    hours: HourlyCoverage, start: datetime, end: datetime
) -> Iterator[tuple[datetime, int]]:
    """Yield observed-minute masks clipped to the minute-aligned interval [start, end)."""
    if start >= end:
        return
    first_hour = start.replace(minute=0)
    last_hour = (end - _MINUTE).replace(minute=0)
    for hour, mask in hours.items():
        if not first_hour <= hour <= last_hour:
            continue
        if hour == first_hour:
            mask &= ~((1 << start.minute) - 1)
        if hour == last_hour:
            minute_count = int((end - hour) / _MINUTE)
            mask &= (1 << minute_count) - 1
        if mask:
            yield hour, mask


def _minutes(m: float) -> str:
    return f"{m / 60:.0f}h" if m >= 120 else f"{m:.0f}m"


def _days(d: float) -> str:
    if d > 365:
        return "year+"
    if d >= 2:
        return f"{d:.0f} days"
    if d >= 1:
        return "day"
    return f"{d * 24:.0f} hours"
