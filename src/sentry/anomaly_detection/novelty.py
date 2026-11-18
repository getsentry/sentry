"""Judge whether an excursion is unusual for its series by size or duration.

The rate of comparable excursions has a Gamma posterior: its shape is the
series' count plus a pooled prior weighted by prior days, and its rate parameter
is the series' exposure in days plus prior days. An excursion is absorbed only
when the posterior confidently puts the rate above the normal recurrence
threshold. Recording absorbed events as well as unusual ones lets the model
learn, and retaining the live event lets it learn the final size and duration.
"""

from __future__ import annotations

import math
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from sentry.anomaly_detection.contracts import ChangeEvent, SeriesKey

DAY = 86400.0


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
    kind: str
    p_normal: float = 0.0
    lasting_min: float | None = None

    def as_dict(self) -> dict[str, bool | float | int | str]:
        data: dict[str, bool | float | int | str] = {
            "unusual": self.unusual,
            "size": round(self.size, 2),
            "return_days": round(self.return_days, 2),
            "similar": self.similar,
            "history_days": round(self.history_days, 2),
            "pooled_rate": round(self.pooled_rate, 4),
            "kind": self.kind,
            "p_normal": round(self.p_normal, 3),
        }
        if self.lasting_min is not None:
            data["lasting_min"] = round(self.lasting_min)
        return data

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
class _Ex:
    start: datetime
    event: ChangeEvent

    @property
    def size(self) -> float:
        return size_of(self.event.peak_ratio)


class Novelty:
    def __init__(self, cfg: NoveltyConfig | None = None) -> None:
        self.cfg = cfg or NoveltyConfig()
        self.history: dict[SeriesKey, list[_Ex]] = {}
        self.first_seen: dict[SeriesKey, datetime] = {}
        self.kinds: dict[str, set[SeriesKey]] = {}

    def observe(self, key: SeriesKey, first: datetime) -> None:
        """Register when a watched series' data starts (its exposure can't be older)."""
        if key not in self.first_seen or first < self.first_seen[key]:
            self.first_seen[key] = first
        self.kinds.setdefault(kind_of(key), set()).add(key)

    def judge(self, e: ChangeEvent, size: float, t: datetime) -> Verdict:
        floor = size / self.cfg.comparable
        base = self.cfg.base_rate * min(1.0, 1.5 / floor) if floor > 0 else self.cfg.base_rate
        return self._judge(e, t, lambda x: x.size >= floor, base, size)

    def judge_duration(self, e: ChangeEvent, minutes: float, t: datetime) -> Verdict:
        """Rejudge a flare that may be routine in size but has lasted unusually long."""
        cfg = self.cfg
        floor = minutes / cfg.comparable
        base = cfg.base_rate * min(1.0, cfg.base_minutes / floor) if floor > 0 else cfg.base_rate
        verdict = self._judge(
            e, t, lambda x: _duration_min(x, t) >= floor, base, size_of(e.peak_ratio)
        )
        verdict.lasting_min = minutes
        return verdict

    def record(self, e: ChangeEvent) -> None:
        self.history.setdefault(e.key, []).append(_Ex(e.start, e))

    def prune(self, t: datetime) -> None:
        """Drop excursions outside the history horizon without resetting series exposure."""
        horizon = t - timedelta(days=self.cfg.horizon_days)
        for key in list(self.history):
            within_horizon = [record for record in self.history[key] if record.start >= horizon]
            if within_horizon:
                self.history[key] = within_horizon
            else:
                del self.history[key]

    def _judge(
        self, e: ChangeEvent, t: datetime, similar: Callable[[_Ex], bool], base: float, size: float
    ) -> Verdict:
        cfg, key = self.cfg, e.key
        kind = kind_of(key)
        self.observe(key, self.first_seen.get(key, t))
        horizon = t - timedelta(days=cfg.horizon_days)
        count = sum(
            1
            for record in self.history.get(key, [])
            if record.event is not e and record.start >= horizon and similar(record)
        )
        exposure = self._exposure(key, t)
        pooled = self._pooled(kind, similar, base, t, horizon, exclude=key)
        shape = count + cfg.prior_weight_days * pooled
        rate_param = exposure + cfg.prior_weight_days
        mean_rate = shape / rate_param
        p_normal = _gammaincc(shape, rate_param / cfg.min_return_days) if shape > 0 else 0.0
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

    def _exposure(self, key: SeriesKey, t: datetime) -> float:
        first = self.first_seen.get(key, t)
        return max(0.0, min(self.cfg.horizon_days, (t - first).total_seconds() / DAY))

    def _pooled(
        self,
        kind: str,
        similar: Callable[[_Ex], bool],
        base: float,
        t: datetime,
        horizon: datetime,
        exclude: SeriesKey,
    ) -> float:
        count, days = 0.0, 0.0
        for key in sorted(self.kinds[kind]):
            if key == exclude:
                continue
            exposure = self._exposure(key, t)
            if exposure <= 0:
                continue
            hits = sum(
                1
                for record in self.history.get(key, [])
                if record.start >= horizon and similar(record)
            )
            count += min(hits, self.cfg.pool_cap_per_day * exposure)
            days += exposure
        # The cold-start rate counts as one series-day, and each peer's influence is capped.
        return (count + base) / (days + 1.0)


def _gammaincc(a: float, x: float) -> float:
    """Regularized upper incomplete gamma Q(a, x) = P(Gamma(a, 1) >= x)."""
    if x <= 0:
        return 1.0
    lead = math.exp(-x + a * math.log(x) - math.lgamma(a))
    if x < a + 1:  # Series for P(a, x), the complement of Q(a, x).
        ap, term = a, 1 / a
        total = term
        for _ in range(500):
            ap += 1
            term *= x / ap
            total += term
            if abs(term) < abs(total) * 1e-12:
                break
        return max(0.0, 1 - total * lead)

    tiny = 1e-300  # Continued fraction for Q(a, x), using the modified Lentz method.
    b = x + 1 - a
    c, d = 1 / tiny, 1 / b
    h = d
    for i in range(1, 500):
        an = -i * (i - a)
        b += 2
        d = an * d + b
        d = tiny if abs(d) < tiny else d
        c = b + an / c
        c = tiny if abs(c) < tiny else c
        d = 1 / d
        h *= d * c
        if abs(d * c - 1) < 1e-12:
            break
    return lead * h


_POD = re.compile(r"-[0-9a-f]{8,10}-[0-9a-z]{5}$")
_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_HEX = re.compile(r"(?<![0-9a-z])[0-9a-f]{12,}(?![0-9a-z])")


def mask_dim(v: str) -> str:
    """Mask ephemeral pod suffixes, UUIDs, and long hex IDs in correlation labels."""
    v = _POD.sub("-*", v)
    v = _UUID.sub("*", v)
    return _HEX.sub("*", v)


def kind_of(key: SeriesKey) -> str:
    # Pool slow-rate series across different thresholds, but not across different signals.
    return f"{key.signal}|{key.metric.split('(>')[0]}"


def size_of(ratio: float) -> float:
    """A change's size in either direction: 3x up and 3x down are both 3."""
    if not ratio or ratio <= 0:
        return 1.0
    return max(ratio, 1 / ratio)


def _duration_min(record: _Ex, t: datetime) -> float:
    return ((record.event.ended_at or t) - record.start).total_seconds() / 60


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
