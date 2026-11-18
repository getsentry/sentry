"""Learn which same-named outbound slices in an organization share a fate.

Names alone don't identify a dependency. Require repeated co-onsets beyond what
would be expected from each slice's minute-of-hour activity (e.g. hourly jobs).
"""

import math
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from itertools import combinations
from typing import Protocol

from sentry.anomaly_detection.contracts import SeriesKey
from sentry.anomaly_detection.footprint import DEPENDENCY_SIGNALS, base_signal, service_of

DependencySlice = tuple[str, str, str]  # service, signal, dimension


@dataclass
class SharedConfig:
    window_days: float = 14.0
    coincide_min: int = 3
    min_co: int = 3
    max_p: float = 1e-4
    force: list[tuple[DependencySlice, DependencySlice]] = field(default_factory=list)
    forbid: list[tuple[DependencySlice, DependencySlice]] = field(default_factory=list)


@dataclass(frozen=True)
class PairStats:
    a: DependencySlice
    b: DependencySlice
    co: int
    n_a: int
    n_b: int
    expected: float
    p: float


@dataclass
class SharedDeps:
    pairs: dict[frozenset[DependencySlice], PairStats] = field(default_factory=dict)
    learned_at: datetime | None = None

    def get(self, a: SeriesKey, b: SeriesKey) -> PairStats | None:
        left, right = _dependency_slice(a), _dependency_slice(b)
        if left is None or right is None or left == right:
            return None
        return self.pairs.get(frozenset((left, right)))


class Excursion(Protocol):
    @property
    def start(self) -> datetime: ...


def _dependency_slice(key: SeriesKey) -> DependencySlice | None:
    signal = base_signal(key.signal)
    if signal in DEPENDENCY_SIGNALS and key.dim_value not in ("", "None"):
        return service_of(key), signal, key.dim_value
    return None


def learn(
    history: Mapping[SeriesKey, Sequence[Excursion]],
    until: datetime,
    cfg: SharedConfig | None = None,
) -> SharedDeps:
    """Use only excursion onsets in the rolling window before `until`."""
    cfg = cfg or SharedConfig()
    since = until - timedelta(days=cfg.window_days)
    onsets: dict[DependencySlice, set[datetime]] = defaultdict(set)
    for key, excursions in history.items():
        dependency = _dependency_slice(key)
        if dependency is not None:
            onsets[dependency].update(exc.start for exc in excursions if since <= exc.start < until)

    by_name: dict[tuple[str, str], list[DependencySlice]] = defaultdict(list)
    for dependency, starts in sorted(onsets.items()):
        if len(starts) >= cfg.min_co:
            by_name[dependency[1:]].append(dependency)

    ordered = {dependency: sorted(starts) for dependency, starts in onsets.items()}
    pairs: dict[frozenset[DependencySlice], PairStats] = {}
    hours = max((until - since) / timedelta(hours=1), 1.0)
    for dependencies in by_name.values():
        for a, b in combinations(dependencies, 2):
            stats = _pair_stats(a, b, ordered[a], ordered[b], hours, cfg)
            if stats is not None and stats.p <= cfg.max_p:
                pairs[frozenset((a, b))] = stats
    for a, b in cfg.force:
        pairs[frozenset((a, b))] = PairStats(a, b, 0, 0, 0, 0.0, 0.0)
    for a, b in cfg.forbid:
        pairs.pop(frozenset((a, b)), None)
    return SharedDeps(pairs, until)


def _pair_stats(
    a: DependencySlice,
    b: DependencySlice,
    starts_a: list[datetime],
    starts_b: list[datetime],
    hours: float,
    cfg: SharedConfig,
) -> PairStats | None:
    # Match each onset at most once, even if one slice flaps around the other's onset.
    tolerance = timedelta(minutes=cfg.coincide_min)
    i = j = co = 0
    while i < len(starts_a) and j < len(starts_b):
        delta = starts_a[i] - starts_b[j]
        if abs(delta) <= tolerance:
            co += 1
            i += 1
            j += 1
        elif delta < timedelta():
            i += 1
        else:
            j += 1
    if co < cfg.min_co:
        return None

    offsets = {offset % 60 for offset in range(-cfg.coincide_min, cfg.coincide_min + 1)}
    phase_b = Counter(start.minute for start in starts_b)
    expected = sum(
        min(1.0, sum(phase_b[(start.minute + offset) % 60] for offset in offsets) / hours)
        for start in starts_a
    )
    return PairStats(a, b, co, len(starts_a), len(starts_b), expected, _poisson_tail(co, expected))


def _poisson_tail(observed: int, expected: float) -> float:
    """P(X >= observed) for X ~ Poisson(expected)."""
    if not expected:
        return 0.0 if observed else 1.0
    # Log probabilities avoid underflow when a busy dependency pair has a large expectation.
    log_expected = math.log(expected)
    below = math.fsum(
        math.exp(k * log_expected - expected - math.lgamma(k + 1)) for k in range(observed)
    )
    return max(0.0, 1.0 - below)
