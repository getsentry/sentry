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
from typing import NamedTuple, Protocol

from sentry.anomaly_detection.contracts import Metric, SeriesKey, Service, Signal
from sentry.anomaly_detection.correlation.footprint import DEPENDENCY_SIGNALS, service_of
from sentry.anomaly_detection.evaluation.novelty import HourlyCoverage, coverage_between


class DependencySlice(NamedTuple):
    service: Service
    signal: Signal  # One of DEPENDENCY_SIGNALS.
    dim_value: str  # Database or domain name.


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
        first_slice, second_slice = _dependency_slice(a), _dependency_slice(b)
        if first_slice is None or second_slice is None or first_slice == second_slice:
            return None
        return self.pairs.get(frozenset((first_slice, second_slice)))


class Excursion(Protocol):
    @property
    def start(self) -> datetime: ...


def _dependency_slice(key: SeriesKey) -> DependencySlice | None:
    if key.signal in DEPENDENCY_SIGNALS and key.dim_value not in ("", "None"):
        return DependencySlice(service_of(key), key.signal, key.dim_value)
    return None


def learn(
    history: Mapping[SeriesKey, Sequence[Excursion]],
    until: datetime,
    cfg: SharedConfig | None = None,
    *,
    coverage: Mapping[SeriesKey, HourlyCoverage],
) -> SharedDeps:
    """Use only excursion onsets in the rolling window before `until`."""
    cfg = cfg or SharedConfig()
    since = until - timedelta(days=cfg.window_days)
    excursions_by_slice: dict[DependencySlice, list[tuple[Metric, Excursion]]] = defaultdict(list)
    observed: dict[DependencySlice, HourlyCoverage] = defaultdict(dict)
    for key, excursions in history.items():
        dependency = _dependency_slice(key)
        if dependency is None:
            continue
        key_coverage = dict(coverage_between(coverage.get(key, {}), since, until))
        excursions_by_slice[dependency].extend(
            (key.metric, exc)
            for exc in excursions
            if since <= exc.start < until and _observed_at(key_coverage, exc.start)
        )
        for hour, mask in key_coverage.items():
            hours = observed[dependency]
            hours[hour] = hours.get(hour, 0) | mask

    tolerance = timedelta(minutes=cfg.coincide_min)
    by_name: dict[tuple[Signal, str], list[DependencySlice]] = defaultdict(list)
    for dependency, candidates in sorted(excursions_by_slice.items()):
        if len(candidates) >= cfg.min_co:
            by_name[dependency.signal, dependency.dim_value].append(dependency)

    pairs: dict[frozenset[DependencySlice], PairStats] = {}
    for dependencies in by_name.values():
        for first, second in combinations(dependencies, 2):
            sample_overlap = _overlap(observed[first], observed[second])
            if not sample_overlap:
                continue
            first_onsets = _distinct_onsets(excursions_by_slice[first], sample_overlap, tolerance)
            second_onsets = _distinct_onsets(excursions_by_slice[second], sample_overlap, tolerance)
            stats = _pair_stats(first, second, first_onsets, second_onsets, sample_overlap, cfg)
            if stats is not None and stats.p <= cfg.max_p:
                pairs[frozenset((first, second))] = stats
    for first, second in cfg.force:
        pairs[frozenset((first, second))] = PairStats(first, second, 0, 0, 0, 0.0, 0.0)
    for first, second in cfg.forbid:
        pairs.pop(frozenset((first, second)), None)
    return SharedDeps(pairs, until)


def _overlap(left: HourlyCoverage, right: HourlyCoverage) -> HourlyCoverage:
    if len(left) > len(right):
        left, right = right, left
    return {hour: common for hour, mask in left.items() if (common := mask & right.get(hour, 0))}


def _observed_at(hours: HourlyCoverage, minute: datetime) -> bool:
    hour = minute.replace(minute=0)
    return bool(hours.get(hour, 0) & (1 << minute.minute))


def _distinct_onsets(
    excursions: list[tuple[Metric, Excursion]], coverage: HourlyCoverage, tolerance: timedelta
) -> list[datetime]:
    ordered = sorted(
        ((metric, exc) for metric, exc in excursions if _observed_at(coverage, exc.start)),
        key=lambda item: (item[1].start, item[0]),
    )
    starts: set[datetime] = set()
    unmatched: list[tuple[Metric, Excursion]] = []
    for metric, exc in ordered:
        unmatched = [
            (other_metric, other)
            for other_metric, other in unmatched
            if exc.start - other.start <= tolerance
            and ((end := getattr(other, "ended_at", other.start)) is None or exc.start < end)
        ]
        # Pair the nearest overlapping cross-metric start once; a long excursion
        # must not hide repeated starts on the other metric.
        for index in range(len(unmatched) - 1, -1, -1):
            if unmatched[index][0] != metric:
                unmatched.pop(index)
                break
        else:
            starts.add(exc.start)
            unmatched.append((metric, exc))
    return sorted(starts)


def _pair_stats(
    first: DependencySlice,
    second: DependencySlice,
    first_onsets: list[datetime],
    second_onsets: list[datetime],
    coverage: HourlyCoverage,
    cfg: SharedConfig,
) -> PairStats | None:
    # Match each onset at most once, even if one slice flaps around the other's onset.
    tolerance = timedelta(minutes=cfg.coincide_min)
    first_index = second_index = coincidences = 0
    while first_index < len(first_onsets) and second_index < len(second_onsets):
        delta = first_onsets[first_index] - second_onsets[second_index]
        if abs(delta) <= tolerance:
            coincidences += 1
            first_index += 1
            second_index += 1
        elif delta < timedelta():
            first_index += 1
        else:
            second_index += 1
    if coincidences < cfg.min_co:
        return None

    phase_opportunities = [
        sum(bool(mask & (1 << phase)) for mask in coverage.values()) for phase in range(60)
    ]
    offsets = [
        timedelta(minutes=offset) for offset in range(-cfg.coincide_min, cfg.coincide_min + 1)
    ]
    expected = max(
        _expected_matches(first_onsets, second_onsets, offsets, coverage, phase_opportunities),
        _expected_matches(second_onsets, first_onsets, offsets, coverage, phase_opportunities),
    )
    return PairStats(
        first,
        second,
        coincidences,
        len(first_onsets),
        len(second_onsets),
        expected,
        _poisson_tail(coincidences, expected),
    )


def _expected_matches(
    starts: list[datetime],
    peers: list[datetime],
    offsets: list[timedelta],
    coverage: HourlyCoverage,
    phase_opportunities: list[int],
) -> float:
    peer_onsets_by_minute = Counter(start.minute for start in peers)
    # Datetime offsets carry the window across hour boundaries; each observed
    # neighbor uses its own phase's exposure.
    return sum(
        min(
            1.0,
            sum(
                peer_onsets_by_minute[minute.minute] / phase_opportunities[minute.minute]
                for offset in offsets
                if _observed_at(coverage, minute := start + offset)
            ),
        )
        for start in starts
    )


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
