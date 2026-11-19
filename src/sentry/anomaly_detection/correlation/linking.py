"""Match episodes using structural evidence without owning group state."""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from itertools import chain, pairwise
from typing import TYPE_CHECKING, Literal, Protocol

from sentry.anomaly_detection.contracts import ChangeEvent, Metric, SeriesKey, Signal
from sentry.anomaly_detection.correlation import call_graph
from sentry.anomaly_detection.correlation.footprint import Footprint, service_of, slice_of
from sentry.anomaly_detection.correlation.shared_dependencies import PairStats, SharedDeps

if TYPE_CHECKING:
    from sentry.anomaly_detection.correlation.correlator import CorrelateConfig, MemberState

_CAUSE_LEAD = timedelta(minutes=20)
_LATENT_SLOW_RATIO = 3.0

# Why two episodes belong together: "series", "alias" and "part" are one piece of
# evidence measured several ways; "shared" is a learned common dependency; "cause"
# and "effect" orient the incoming episode along a call path; "sibling" is weaker.
LinkKind = Literal["series", "alias", "part", "shared", "cause", "effect", "sibling"]
# Signals that can explain one another within a service.
Family = Literal["latency", "failure"] | Signal


class _Evidence(Protocol):
    """Evidence lookup can load footprints lazily and update the historical call map."""

    @property
    def cfg(self) -> CorrelateConfig: ...

    @property
    def series(self) -> Mapping[SeriesKey, Mapping[datetime, float | None]]: ...

    @property
    def shared(self) -> SharedDeps: ...

    def _footprint(
        self, member: MemberState, observation_minute: datetime, /
    ) -> Footprint | None: ...

    def _order(
        self,
        reference_key: SeriesKey,
        compared_key: SeriesKey,
        footprints: Sequence[Footprint | None] = (),
        /,
    ) -> int | None: ...


@dataclass(frozen=True)
class Link:
    member: MemberState
    kind: LinkKind
    share: float
    detail: str
    trace: bool = False

    @property
    def bridges_groups(self) -> bool:
        return self.kind in ("alias", "part", "shared")

    @property
    def same_evidence(self) -> bool:
        return self.kind == "series" or self.bridges_groups

    def rank(self, event: ChangeEvent) -> tuple[bool, bool, timedelta, float]:
        return (
            self.kind != "series",
            self.kind != "effect",
            abs(event.start - self.member.event.start),
            -self.share,
        )


def link(
    evidence: _Evidence,
    observation_minute: datetime,
    incoming_member: MemberState,
    existing_member: MemberState,
    *,
    error_signals: frozenset[Signal],
) -> Link | None:
    incoming, existing = incoming_member.event, existing_member.event
    incoming_key, existing_key = incoming.key, existing.key
    incoming_onset, existing_onset = onset(incoming), onset(existing)
    onset_gap = abs(incoming_onset - existing_onset)
    cfg = evidence.cfg
    tolerance = cfg.tolerance
    same_service = service_of(incoming_key) == service_of(existing_key)
    incoming_family = _family(incoming_key, error_signals)
    existing_family = _family(existing_key, error_signals)
    same_family = incoming_family == existing_family
    failure_pair = incoming_family == existing_family == "failure"
    incoming_total = call_graph.is_project_level(incoming_key)
    existing_total = call_graph.is_project_level(existing_key)
    failure_totals = failure_pair and incoming_total and existing_total
    if incoming_key == existing_key:
        if incoming.change_type != existing.change_type and overlap(incoming, existing, tolerance):
            return Link(existing_member, "series", 1.0, "same series detected two ways")
        if restart(incoming, existing_member, tolerance):
            return Link(existing_member, "alias", 1.0, "same series restarted")
    if (
        not incoming_total
        and slice_of(incoming_key) == slice_of(existing_key)
        and onset_gap <= tolerance
        and overlap(incoming, existing, tolerance)
    ):
        return Link(existing_member, "alias", 1.0, "same slice measured two ways")
    if same_service and failure_totals:
        if onset_gap <= tolerance:
            return Link(existing_member, "alias", 1.0, "same service's errors measured two ways")
        return None
    if same_service and same_family and incoming_total != existing_total:
        total, part = (
            (incoming_member, existing_member)
            if incoming_total
            else (existing_member, incoming_member)
        )
        footprint = evidence._footprint(total, observation_minute)
        # A missing or deferred footprint isn't evidence of absence; fall back to timing.
        if footprint is not None:
            stats = footprint.touches(part.event.key, cfg.min_share)
            if stats and overlap(incoming, existing, tolerance):
                return Link(
                    existing_member,
                    "part",
                    stats.trace_share,
                    "slice contributes to its service total",
                )
            return None

    if pair := evidence.shared.get(incoming_key, existing_key):
        if (
            onset_gap <= tolerance
            or abs(incoming.start - existing.start) <= tolerance
            or any(
                worse_near(change, when, tolerance, observation_minute)
                for change, when in (
                    (incoming, existing_onset),
                    (incoming, existing.start),
                    (existing, incoming_onset),
                    (existing, incoming.start),
                )
            )
        ):
            return Link(existing_member, "shared", 1.0, shared_detail(pair))
        return None

    trace_share = _trace_share(
        evidence, observation_minute, incoming_member, existing_member, failure_pair=failure_pair
    )
    # A trace tie rejected on timing must not fall through to weaker evidence.
    if trace_share is not None:
        direction = evidence._order(
            incoming_key, existing_key, (incoming_member.footprint, existing_member.footprint)
        )
        if (
            direction == call_graph.DOWNSTREAM
        ):  # The incoming change is the existing member's effect.
            if existing_onset > incoming_onset + tolerance or (
                incoming.start < existing_onset - tolerance and onset_gap > tolerance
            ):
                return None
            effect_window = cfg.effect_window
            if (
                effect_window is not None
                and incoming_onset
                - _last_onset(existing, incoming_onset + tolerance, observation_minute)
                > effect_window
            ):
                return None
            return Link(
                existing_member,
                "effect",
                trace_share,
                "affected traces pass through a downstream change",
                True,
            )

        if (
            direction == call_graph.UPSTREAM
        ):  # The incoming change must explain the existing member.
            existing_worsened = any(
                worse_near(existing, when, tolerance, observation_minute)
                for when in (incoming_onset, incoming.start)
            )
            if incoming_onset > existing_onset + tolerance and not existing_worsened:
                return None
            if incoming_onset < existing_onset - _CAUSE_LEAD and not worse_near(
                incoming, existing_onset, tolerance, observation_minute
            ):
                return None
            return Link(
                existing_member,
                "cause",
                trace_share,
                "affected traces pass through this downstream change",
                True,
            )

        earlier = existing_member if existing_onset <= incoming_onset else incoming_member
        earlier_end = earlier.event.ended_at if earlier.closed_at is not None else None
        if onset_gap <= tolerance or (
            onset_gap <= _CAUSE_LEAD
            and (earlier_end is None or earlier_end >= max(incoming_onset, existing_onset))
        ):
            return Link(
                existing_member, "sibling", trace_share, "changes share affected traces", True
            )
        return None

    if same_service:
        if (
            same_family
            and (
                correlation := _comovement(
                    evidence.series,
                    cfg.comove_min,
                    observation_minute,
                    incoming_member,
                    existing_member,
                    failure_family=failure_pair,
                )
            )
            is not None
            and correlation >= cfg.comove_r
        ):
            return Link(
                existing_member, "sibling", correlation, "same-service changes move together"
            )
        if onset_gap <= (tolerance if same_family else cfg.co_onset):
            return Link(existing_member, "sibling", 1.0, "same service, nearby onset")
    elif onset_gap <= cfg.co_onset and failure_totals:
        direction = evidence._order(incoming_key, existing_key)
        if direction is not None:
            return Link(
                existing_member,
                "effect" if direction == call_graph.DOWNSTREAM else "cause",
                0.5,
                "errors along a known call path",
            )
    return None


def _trace_share(
    evidence: _Evidence,
    observation_minute: datetime,
    incoming_member: MemberState,
    existing_member: MemberState,
    *,
    failure_pair: bool,
) -> float | None:
    trace_shares = []
    for source, target in ((incoming_member, existing_member), (existing_member, incoming_member)):
        footprint = evidence._footprint(source, observation_minute)
        if footprint is None:
            continue
        if call_graph.is_project_level(target.event.key) and not (
            failure_pair and _error_path(source.event.key, target.event.key, footprint)
        ):
            continue
        if stats := footprint.touches(target.event.key, evidence.cfg.min_share):
            trace_shares.append(stats.trace_share)
    return max(trace_shares, default=None)


def ties(event: ChangeEvent, a: Link, b: Link, co_onset: timedelta) -> bool:
    onsets = [onset(change) for change in (event, a.member.event, b.member.event)]
    concurrent = a.trace and b.trace and max(onsets) - min(onsets) <= co_onset
    # A common effect doesn't make two otherwise independent causes the same problem.
    return (
        b.kind == "cause"
        and a.kind in ("cause", "effect")
        or (concurrent and not (a.kind == b.kind == "effect"))
    )


def restart(event: ChangeEvent, member: MemberState, tolerance: timedelta) -> bool:
    end = member.event.ended_at
    return (
        event.key == member.event.key
        and member.closed_at is not None
        and end is not None
        and timedelta() <= event.start - end <= tolerance
    )


def is_downstream_support(
    evidence: _Evidence, t: datetime, source: MemberState, latent: ChangeEvent
) -> bool:
    event = source.event
    tolerance = evidence.cfg.tolerance
    if abs(latent.start - onset(event)) > tolerance or call_graph.is_project_level(latent.key):
        return False
    footprint = evidence._footprint(source, t)
    stats = footprint.touches(latent.key, evidence.cfg.min_share) if footprint else None
    if not stats or evidence._order(event.key, latent.key, (footprint,)) != call_graph.DOWNSTREAM:
        return False
    if latent.key.metric == Metric.P95_DURATION and (
        stats.p95_ms is None
        or not latent.expected
        or stats.p95_ms < _LATENT_SLOW_RATIO * latent.expected
    ):
        return False
    return True


def _comovement(
    series: Mapping[SeriesKey, Mapping[datetime, float | None]],
    comove_min: timedelta,
    observation_minute: datetime,
    incoming_member: MemberState,
    existing_member: MemberState,
    *,
    failure_family: bool,
) -> float | None:
    incoming, existing = incoming_member.event, existing_member.event
    # Evaluate the same window after checkpoint restoration as in a continuous run.
    overlap_start = max(incoming.start, existing.start, observation_minute - timedelta(hours=26))
    overlap_end = (
        min(observation_minute, existing.ended_at or observation_minute)
        if existing_member.closed_at is not None
        else observation_minute
    )
    if overlap_end - overlap_start < comove_min:
        return None
    incoming_series = series.get(incoming.key)
    existing_series = series.get(existing.key)
    if not incoming_series or not existing_series:
        return None
    paired_bins = zip(
        _log_bins(incoming_series, overlap_start, overlap_end, failure_family),
        _log_bins(existing_series, overlap_start, overlap_end, failure_family),
        strict=True,
    )
    moves = [
        (next_incoming - prev_incoming, next_existing - prev_existing)
        for (prev_incoming, prev_existing), (next_incoming, next_existing) in pairwise(paired_bins)
        if prev_incoming is not None
        and prev_existing is not None
        and next_incoming is not None
        and next_existing is not None
    ]
    if len(moves) < max(3, comove_min / timedelta(minutes=10) - 3):
        return None
    incoming_mean = sum(incoming_move for incoming_move, _ in moves) / len(moves)
    existing_mean = sum(existing_move for _, existing_move in moves) / len(moves)
    incoming_sum_squares = sum((move - incoming_mean) ** 2 for move, _ in moves)
    existing_sum_squares = sum((move - existing_mean) ** 2 for _, move in moves)
    if not incoming_sum_squares or not existing_sum_squares:
        return None
    sum_cross_deviations = sum(
        (incoming_move - incoming_mean) * (existing_move - existing_mean)
        for incoming_move, existing_move in moves
    )
    # The normalizing factor for the standard deviations cancels in the correlation.
    std_scale = math.sqrt(incoming_sum_squares * existing_sum_squares)
    return sum_cross_deviations / std_scale


def _error_path(source: SeriesKey, target: SeriesKey, footprint: Footprint) -> bool:
    caller, callee = service_of(source), service_of(target)
    return caller != callee and callee in call_graph._CallGraph(footprint.edges).reachable(caller)


def onset(event: ChangeEvent) -> datetime:
    unusual_since = (event.novelty or {}).get("unusual_since")
    return unusual_since if isinstance(unusual_since, datetime) else event.start


def worse_near(
    event: ChangeEvent, other: datetime, tolerance: timedelta, observation_minute: datetime
) -> bool:
    change_onset = onset(event)
    return (
        event.start < change_onset <= observation_minute and abs(change_onset - other) <= tolerance
    ) or any(
        when <= observation_minute and abs(when - other) <= tolerance
        for when, _ in event.escalations
    )


def _last_onset(event: ChangeEvent, cutoff: datetime, observation_minute: datetime) -> datetime:
    onsets = chain((event.start, onset(event)), (when for when, _ in event.escalations))
    return max(
        (when for when in onsets if when <= min(cutoff, observation_minute)), default=event.start
    )


def overlap(a: ChangeEvent, b: ChangeEvent, tolerance: timedelta) -> bool:
    first, later = (a, b) if a.start <= b.start else (b, a)
    return first.ended_at is None or later.start <= first.ended_at + tolerance


def _family(key: SeriesKey, error_signals: frozenset[Signal]) -> Family:
    if key.metric == Metric.P95_DURATION:
        return "latency"
    if key.metric == Metric.FAILURE_RATE or key.signal in error_signals:
        return "failure"
    return key.signal


def shared_detail(pair: PairStats) -> str:
    if not pair.co:
        return "configured shared dependency"
    return f"shared dependency: {pair.co} co-onsets ({pair.expected:.1f} expected by chance)"


def _log_bins(
    series: Mapping[datetime, float | None],
    start: datetime,
    end: datetime,
    failure_family: bool,
) -> Iterable[float | None]:
    step = timedelta(minutes=10)
    offset = 1e-4 if failure_family else 1.0
    bin_start = start
    while bin_start + step <= end:
        values = sorted(
            math.log(value + offset)
            for i in range(10)
            if (value := series.get(bin_start + timedelta(minutes=i))) is not None and value >= 0
        )
        yield values[len(values) // 2] if values else None
        bin_start += step
