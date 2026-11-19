"""Group change episodes within an organization using structural evidence."""

from __future__ import annotations

import hashlib
import math
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from itertools import chain, pairwise
from typing import Literal, Protocol

from sentry.anomaly_detection.contracts import (
    AnomalyGroup,
    ChangeEvent,
    ChangeType,
    SeriesKey,
    Urgency,
)
from sentry.anomaly_detection.footprint import (
    DEPENDENCY_SIGNALS,
    FOOTPRINT_DEFERRED,
    SLICE_LAYERS,
    CallEdge,
    Footprint,
    FootprintResult,
    base_signal,
    service_of,
    slice_of,
)
from sentry.anomaly_detection.novelty import mask_dim, size_of
from sentry.anomaly_detection.shared import PairStats, SharedDeps
from sentry.utils import json

ERROR_SIGNALS = frozenset({"errors", "error_rate", "failed_rate", "new_issue"})
CAUSE_LEAD = timedelta(minutes=20)
LATENT_SLOW_RATIO = 3.0
FAILING_SHARE = 0.2
URGENCY_RANK = {Urgency.LOW: 0, Urgency.MEDIUM: 1, Urgency.HIGH: 2}

EpisodeKey = tuple[SeriesKey, ChangeType, datetime]
ActionKind = Literal["open", "join", "localize", "urgency", "update", "reopen", "close"]


class FootprintSource(Protocol):
    def footprint(self, event: ChangeEvent, observation_end: datetime, /) -> FootprintResult: ...


@dataclass
class CorrelateConfig:
    min_share: float = 0.2
    tolerance: timedelta = timedelta(minutes=10)
    co_onset: timedelta = timedelta(minutes=5)
    comove_min: timedelta = timedelta(hours=2)
    comove_r: float = 0.7
    member_grace: timedelta = timedelta(minutes=10)
    quiet: timedelta = timedelta(minutes=15)
    high_users: float = 50.0
    slow_promote: tuple[float, float] | None = (3.0, 30.0)  # ratio, minutes
    effect_window: timedelta | None = timedelta(minutes=60)
    call_map_retention: timedelta = timedelta(days=14)


@dataclass
class MemberState:
    event: ChangeEvent
    ratio: float
    escalated: bool = False
    closed_at: datetime | None = None
    footprint: Footprint | None = None
    footprint_loaded: bool = False
    representative: EpisodeKey | None = None
    latent: bool = False


@dataclass
class GroupState:
    group: AnomalyGroup
    root: ChangeEvent
    last_activity: datetime
    closed_at: datetime | None = None
    members: dict[EpisodeKey, MemberState] = field(default_factory=dict)


@dataclass
class CorrelationState:
    open_groups: dict[str, GroupState] = field(default_factory=dict)
    closed_groups: dict[str, GroupState] = field(default_factory=dict)
    latent: dict[EpisodeKey, ChangeEvent] = field(default_factory=dict)
    edges: Counter[CallEdge] = field(default_factory=Counter)
    edge_seen_at: dict[CallEdge, datetime] = field(default_factory=dict)
    shared: SharedDeps = field(default_factory=SharedDeps)


@dataclass
class GroupAction:
    """Actions reference the group, root and independent count as of the end of the step."""

    t: datetime
    kind: ActionKind
    group: AnomalyGroup
    event: ChangeEvent | None = None
    detail: str = ""
    merged_into: str | None = None
    root: ChangeEvent | None = None
    independent_count: int = 1


@dataclass(frozen=True)
class _Link:
    member: MemberState
    kind: str
    share: float
    detail: str
    trace: bool = False

    @property
    def same_evidence(self) -> bool:
        return self.kind in ("alias", "series", "part", "shared")

    def rank(self, event: ChangeEvent) -> tuple[bool, bool, timedelta, float]:
        return (
            self.kind != "series",
            self.kind != "effect",
            abs(event.start - self.member.event.start),
            -self.share,
        )


def episode_key(event: ChangeEvent) -> EpisodeKey:
    return event.key, event.change_type, event.start


class Correlator:
    def __init__(
        self,
        footprints: FootprintSource | None = None,
        cfg: CorrelateConfig | None = None,
        *,
        series: Mapping[SeriesKey, Mapping[datetime, float | None]] | None = None,
        state: CorrelationState | None = None,
    ) -> None:
        self.footprints = footprints
        self.cfg = cfg or CorrelateConfig()
        self.series = series if series is not None else {}
        self.state = state or CorrelationState()
        self.by_event = {key: state for state in self.groups for key in state.members}
        self._graph: _CallGraph | None = None

    @property
    def groups(self) -> list[GroupState]:
        return [*self.state.open_groups.values(), *self.state.closed_groups.values()]

    @property
    def shared(self) -> SharedDeps:
        return self.state.shared

    @shared.setter
    def shared(self, value: SharedDeps) -> None:
        self.state.shared = value

    def step(self, t: datetime, actions: Sequence[tuple[str, ChangeEvent]]) -> list[GroupAction]:
        """Consume detector actions in event time, including empty ticks for quiet close."""
        opened: list[MemberState] = []
        new_latent: list[ChangeEvent] = []
        emitted: list[tuple[GroupState, GroupAction]] = []
        merged_counts: dict[str, int] = {}

        def emit(
            state: GroupState,
            kind: ActionKind,
            event: ChangeEvent | None = None,
            detail: str = "",
            merged_into: str | None = None,
        ) -> None:
            # The survivor can union member evidence after the merge. The closed group's
            # representative keys must not be followed into the survivor's membership.
            if merged_into is not None:
                merged_counts[state.group.id] = self.independent(state)
            emitted.append((state, GroupAction(t, kind, state.group, event, detail, merged_into)))

        # Process newly observed escalation metadata before matching changes in the same minute.
        # Recovery is applied after matching, allowing a final handoff on that tick.
        for action, event in actions:
            key = episode_key(event)
            owner = self.by_event.get(key)
            if action == "latent" and owner is None:
                self.state.latent[key] = event
                new_latent.append(event)
            elif action == "open" and owner is None:
                self.state.latent.pop(key, None)
                opened.append(
                    MemberState(
                        event,
                        event.open_ratio,
                        escalated=bool((event.novelty or {}).get("opened_on_escalation")),
                    )
                )
            elif owner is not None and action in ("open", "escalate") and owner.closed_at is None:
                member = owner.members[key]
                if member.closed_at is not None:
                    continue
                if action == "open" and not member.latent:
                    continue
                member.latent = False
                if action == "escalate":
                    if event.escalations:
                        member.ratio = event.escalations[-1][1]
                    member.escalated = True
                else:
                    member.ratio = event.open_ratio
                    member.escalated = bool((event.novelty or {}).get("opened_on_escalation"))
                owner.last_activity = t
                emit(owner, "update", event)
                self._update_group(t, owner, emit)

        if len(opened) > 1 or (opened and self.state.open_groups):
            for member in opened:
                self._footprint(member, t)
        # Place causes observed in the same minute before their effects.
        opened.sort(
            key=lambda m: (-self._position(m.event.key), m.event.start, episode_key(m.event))
        )
        for member in opened:
            if episode_key(member.event) not in self.by_event:
                self._on_open(t, member, emit)
        for event in new_latent:
            if episode_key(event) in self.state.latent:
                self._attach_new_latent(t, event, emit)

        for action, event in actions:
            if action not in ("close", "expire"):
                continue
            key = episode_key(event)
            self.state.latent.pop(key, None)
            owner = self.by_event.get(key)
            if owner is not None and owner.members[key].closed_at is None:
                owner.members[key].closed_at = t
                owner.last_activity = t

        for state in list(self.state.open_groups.values()):
            if self._promote_slow(t, state):
                emit(state, "urgency", detail="sustained slowdown")
            if t - state.last_activity >= self.cfg.quiet and all(
                m.closed_at is not None for m in state.members.values()
            ):
                state.closed_at = t
                del self.state.open_groups[state.group.id]
                self.state.closed_groups[state.group.id] = state
                emit(state, "close", detail="all changes ended")

        counts = merged_counts
        for state, group_action in emitted:
            if state.group.id not in counts:
                counts[state.group.id] = self.independent(state)
            group_action.independent_count = counts[state.group.id]
            group_action.root = state.root
        return [group_action for _, group_action in emitted]

    def prune(self, t: datetime) -> None:
        """Discard closed groups that can't be continued, and age out stale call paths."""
        latent_by_series: dict[SeriesKey, list[ChangeEvent]] = defaultdict(list)
        for latent in self.state.latent.values():
            latent_by_series[latent.key].append(latent)
        for group_id, state in list(self.state.closed_groups.items()):
            closed_at = state.closed_at
            if closed_at is None or t - closed_at <= self.cfg.tolerance:
                continue
            if any(
                latent.start <= closed_at and self._restart(latent, member)
                for member in state.members.values()
                for latent in latent_by_series.get(member.event.key, ())
            ):
                continue
            for key in state.members:
                del self.by_event[key]
            del self.state.closed_groups[group_id]
            for other in self.state.open_groups.values():
                if group_id in other.group.possibly_related:
                    other.group.possibly_related.remove(group_id)
        for edge, seen_at in list(self.state.edge_seen_at.items()):
            if t - seen_at > self.cfg.call_map_retention:
                del self.state.edge_seen_at[edge]
                del self.state.edges[edge]
                self._graph = None

    def _on_open(self, t: datetime, member: MemberState, emit: _Emit) -> None:
        event = member.event
        candidates = []
        for state in self.state.open_groups.values():
            links = [
                link
                for existing in self._live_members(t, state, event)
                if (link := self._link(t, member, existing)) is not None
            ]
            if links:
                candidates.append((state, min(links, key=lambda link: link.rank(event)), links))

        if candidates:
            candidates.sort(key=lambda item: item[1].rank(event))
            group, best, links = candidates[0]
            self._add_member(group, member)
            self._record_aliases(group, member, links)
            emit(group, "join", event, best.detail)
            for other, link, other_links in candidates[1:]:
                if self._ties(event, best, link) or any(
                    identity.kind in ("alias", "part", "shared") for identity in other_links
                ):
                    self._merge(t, group, other, emit)
                    self._record_aliases(group, member, other_links)
                else:
                    self._relate(group, other)
        elif continuation := self._continued(member):
            group, previous = continuation
            group.closed_at = None
            self.state.open_groups[group.group.id] = self.state.closed_groups.pop(group.group.id)
            self._add_member(group, member)
            self._union(group, member, previous)
            emit(group, "reopen", event, "same series restarted")
        elif home := self._failure_mode_home(t, event):
            group = home
            self._add_member(group, member)
            emit(group, "join", event, "new failure mode in an affected service")
        else:
            group = self._create_group(t, member)
            if same_issue := self._same_issue(t, group):
                self._merge(t, same_issue, group, emit, emit_close=False)
                group = same_issue
                emit(group, "join", event, "same driving issue")
            else:
                emit(group, "open", event)
                for other in self.state.open_groups.values():
                    if (
                        t - other.group.opened_at <= self.cfg.tolerance
                        or other.group.urgency != Urgency.LOW
                    ):
                        self._relate(group, other)

        self._attach_latent_causes(t, group, member, emit)
        group.last_activity = t
        self._update_group(t, group, emit)

    def _live_members(
        self, t: datetime, group: GroupState, event: ChangeEvent | None = None
    ) -> Iterable[MemberState]:
        for member in group.members.values():
            if member.closed_at is None or t - member.closed_at <= self.cfg.member_grace:
                yield member
            elif event is not None and self._restart(event, member):
                yield member

    def _link(self, t: datetime, new: MemberState, member: MemberState) -> _Link | None:
        event, existing = new.event, member.event
        a, b = event.key, existing.key
        onset, other_onset = _onset(event), _onset(existing)
        gap = abs(onset - other_onset)
        tolerance = self.cfg.tolerance
        same_service = service_of(a) == service_of(b)
        family_a, family_b = _family(a), _family(b)
        same_family = family_a == family_b
        failure_totals = (
            family_a == family_b == "failure" and _project_level(a) and _project_level(b)
        )
        if a == b:
            if event.change_type != existing.change_type and _overlap(event, existing, tolerance):
                return _Link(member, "series", 1.0, "same series detected two ways")
            if self._restart(event, member):
                return _Link(member, "alias", 1.0, "same series restarted")
        if (
            not _project_level(a)
            and slice_of(a) == slice_of(b)
            and _overlap(event, existing, tolerance)
        ):
            return _Link(member, "alias", 1.0, "same slice measured two ways")
        if same_service and failure_totals:
            if gap <= tolerance:
                return _Link(member, "alias", 1.0, "same service's errors measured two ways")
            return None
        if same_service and same_family and _project_level(a) != _project_level(b):
            total, part = (new, member) if _project_level(a) else (member, new)
            footprint = self._footprint(total, t)
            stats = footprint.touches(part.event.key, self.cfg.min_share) if footprint else None
            if stats and _overlap(event, existing, tolerance):
                return _Link(
                    member, "part", stats.trace_share, "slice contributes to its service total"
                )
            return None

        if pair := self.shared.get(a, b):
            if (
                gap <= tolerance
                or abs(event.start - existing.start) <= tolerance
                or any(
                    _worse_near(change, time, tolerance, t)
                    for change, time in (
                        (event, other_onset),
                        (event, existing.start),
                        (existing, onset),
                        (existing, event.start),
                    )
                )
            ):
                return _Link(member, "shared", 1.0, _shared_detail(pair))
            return None

        share = self._trace_share(t, new, member)
        if share is not None:
            relation = self._order(a, b, (new.footprint, member.footprint))
            if relation == 1:  # Existing member is downstream: the new change is its effect.
                if other_onset > onset + tolerance or (
                    event.start < other_onset - tolerance and gap > tolerance
                ):
                    return None
                window = self.cfg.effect_window
                if (
                    window is not None
                    and onset - _last_onset(existing, onset + tolerance, t) > window
                ):
                    return None
                return _Link(
                    member,
                    "effect",
                    share,
                    "affected traces pass through a downstream change",
                    True,
                )
            if relation == -1:  # New change is downstream and must explain the member's timing.
                worsened = any(
                    _worse_near(existing, at, tolerance, t) for at in (onset, event.start)
                )
                if onset > other_onset + tolerance and not worsened:
                    return None
                if onset < other_onset - CAUSE_LEAD and not _worse_near(
                    event, other_onset, tolerance, t
                ):
                    return None
                return _Link(
                    member,
                    "cause",
                    share,
                    "affected traces pass through this downstream change",
                    True,
                )
            first = member if other_onset <= onset else new
            ended = first.event.ended_at if first.closed_at is not None else None
            if gap <= tolerance or (
                gap <= CAUSE_LEAD and (ended is None or ended >= max(onset, other_onset))
            ):
                return _Link(member, "sibling", share, "changes share affected traces", True)
            return None

        if same_service:
            if (
                same_family
                and (r := self._comovement(t, new, member)) is not None
                and r >= self.cfg.comove_r
            ):
                return _Link(member, "sibling", r, "same-service changes move together")
            if gap <= (tolerance if same_family else self.cfg.co_onset):
                return _Link(member, "sibling", 1.0, "same service, nearby onset")
        elif gap <= self.cfg.co_onset and failure_totals:
            relation = self._order(a, b)
            if relation is not None:
                return _Link(
                    member,
                    "effect" if relation == 1 else "cause",
                    0.5,
                    "errors along a known call path",
                )
        return None

    def _trace_share(self, t: datetime, a: MemberState, b: MemberState) -> float | None:
        shares = []
        for source, target in ((a, b), (b, a)):
            footprint = self._footprint(source, t)
            if footprint is None:
                continue
            if _project_level(target.event.key) and not _error_path(
                source.event.key, target.event.key, footprint
            ):
                continue
            if stats := footprint.touches(target.event.key, self.cfg.min_share):
                shares.append(stats.trace_share)
        return max(shares, default=None)

    def _ties(self, event: ChangeEvent, a: _Link, b: _Link) -> bool:
        onsets = [_onset(change) for change in (event, a.member.event, b.member.event)]
        concurrent = a.trace and b.trace and max(onsets) - min(onsets) <= self.cfg.co_onset
        # A common effect doesn't make two otherwise independent causes the same problem.
        return (
            b.kind == "cause"
            and a.kind in ("cause", "effect")
            or (concurrent and not (a.kind == b.kind == "effect"))
        )

    def _create_group(self, t: datetime, member: MemberState) -> GroupState:
        event = member.event
        group = AnomalyGroup(id=_group_id(event), opened_at=t, localization=_localize(event.key))
        state = GroupState(group, event, t)
        self.state.open_groups[group.id] = state
        self._add_member(state, member)
        return state

    def _add_member(self, state: GroupState, member: MemberState) -> None:
        event = member.event
        key = episode_key(event)
        state.members[key] = member
        self.by_event[key] = state
        state.group.change_events.append(event)
        service = service_of(event.key)
        if service not in state.group.blast_radius:
            state.group.blast_radius.append(service)
        for issue in sorted(str(issue_id) for issue_id in event.issue_ids):
            if issue not in state.group.driving_issues:
                state.group.driving_issues.append(issue)

    def _merge(
        self,
        t: datetime,
        into: GroupState,
        other: GroupState,
        emit: _Emit,
        *,
        emit_close: bool = True,
    ) -> None:
        for member in other.members.values():
            self._add_member(into, member)
        into.group.opened_at = min(into.group.opened_at, other.group.opened_at)
        if URGENCY_RANK[other.group.urgency] > URGENCY_RANK[into.group.urgency]:
            into.group.urgency = other.group.urgency
        del self.state.open_groups[other.group.id]
        other.closed_at = t
        for remaining in self.state.open_groups.values():
            if other.group.id in remaining.group.possibly_related:
                remaining.group.possibly_related.remove(other.group.id)
                self._relate(into, remaining)
        emit(into, "join", detail="merged structurally linked groups")
        if emit_close:
            emit(other, "close", detail="merged into another group", merged_into=into.group.id)

    @staticmethod
    def _relate(a: GroupState, b: GroupState) -> None:
        if a is not b and b.group.id not in a.group.possibly_related:
            a.group.possibly_related.append(b.group.id)
            b.group.possibly_related.append(a.group.id)

    def _continued(self, member: MemberState) -> tuple[GroupState, MemberState] | None:
        for state in reversed(self.state.closed_groups.values()):
            if state.closed_at is not None and state.closed_at >= member.event.start:
                for previous in state.members.values():
                    if self._restart(member.event, previous):
                        return state, previous
        return None

    def _restart(self, event: ChangeEvent, member: MemberState) -> bool:
        end = member.event.ended_at
        return (
            event.key == member.event.key
            and member.closed_at is not None
            and end is not None
            and timedelta() <= event.start - end <= self.cfg.tolerance
        )

    def _failure_mode_home(self, t: datetime, event: ChangeEvent) -> GroupState | None:
        if event.change_type != ChangeType.NEW_FAILURE_MODE:
            return None
        service = service_of(event.key)
        for state in self.state.open_groups.values():
            if any(
                service_of(member.event.key) == service
                and (
                    abs(member.event.start - event.start) <= self.cfg.tolerance
                    or _worse_near(member.event, event.start, self.cfg.tolerance, t)
                )
                for member in self._live_members(t, state)
            ):
                return state
        return None

    def _same_issue(self, t: datetime, state: GroupState) -> GroupState | None:
        issue_keys = {
            (event.key.project, issue)
            for event in state.group.change_events
            for issue in event.issue_ids
        }
        if not issue_keys:
            return None
        for other in self.state.open_groups.values():
            if (
                other is not state
                and t - other.group.opened_at <= self.cfg.tolerance
                and any(
                    (event.key.project, issue) in issue_keys
                    for event in other.group.change_events
                    for issue in event.issue_ids
                )
            ):
                return other
        return None

    def _attach_latent_causes(
        self, t: datetime, state: GroupState, source: MemberState, emit: _Emit
    ) -> None:
        event = source.event
        tolerance = self.cfg.tolerance
        support: MemberState | None
        for latent in list(self.state.latent.values()):
            pair = self.shared.get(event.key, latent.key)
            near_onset = abs(latent.start - _onset(event)) <= tolerance
            if pair and (near_onset or abs(latent.start - event.start) <= tolerance):
                support = self._attach_support(
                    state, latent, emit, _shared_detail(pair), alias_of=source
                )
            elif latent.key == event.key and _overlap(event, latent, tolerance):
                support = self._attach_support(state, latent, emit, "same series", alias_of=source)
            else:
                support = self._attach_downstream_support(t, state, source, latent, emit)
            if support is not None:
                self._bridge_support(t, state, support, emit)

    def _attach_new_latent(self, t: datetime, latent: ChangeEvent, emit: _Emit) -> None:
        for state in self.state.open_groups.values():
            for source in self._live_members(t, state):
                if abs(latent.start - source.event.start) <= self.cfg.tolerance and (
                    pair := self.shared.get(latent.key, source.event.key)
                ):
                    self._attach_support(state, latent, emit, _shared_detail(pair), alias_of=source)
                elif (
                    not source.latent
                    and (support := self._attach_downstream_support(t, state, source, latent, emit))
                    is not None
                ):
                    self._bridge_support(t, state, support, emit)
                else:
                    continue
                state.last_activity = t
                self._update_group(t, state, emit)
                return

    def _attach_downstream_support(
        self, t: datetime, state: GroupState, source: MemberState, latent: ChangeEvent, emit: _Emit
    ) -> MemberState | None:
        event = source.event
        tolerance = self.cfg.tolerance
        if (
            abs(latent.start - _onset(event)) > tolerance
            or latent.start > event.start + tolerance
            or _project_level(latent.key)
        ):
            return None
        footprint = self._footprint(source, t)
        stats = footprint.touches(latent.key, self.cfg.min_share) if footprint else None
        if not stats or self._order(event.key, latent.key, (footprint,)) != 1:
            return None
        if latent.key.metric.startswith("p95") and (
            stats.p95_ms is None
            or not latent.expected
            or stats.p95_ms < LATENT_SLOW_RATIO * latent.expected
        ):
            return None
        return self._attach_support(
            state, latent, emit, "downstream routine change seen in affected traces"
        )

    def _attach_support(
        self,
        state: GroupState,
        event: ChangeEvent,
        emit: _Emit,
        detail: str,
        *,
        alias_of: MemberState | None = None,
    ) -> MemberState:
        member = MemberState(event, event.open_ratio, latent=True)
        self._add_member(state, member)
        if alias_of is not None:
            self._union(state, member, alias_of)
        self.state.latent.pop(episode_key(event), None)
        emit(state, "join", event, detail)
        return member

    def _bridge_support(
        self, t: datetime, state: GroupState, support: MemberState, emit: _Emit
    ) -> None:
        for other in list(self.state.open_groups.values()):
            if other is state:
                continue
            links = [
                link
                for member in self._live_members(t, other)
                if (link := self._link(t, support, member)) is not None
                and link.kind in ("alias", "part", "shared")
            ]
            if links:
                self._merge(t, state, other, emit)
                self._record_aliases(state, support, links)

    def _record_aliases(
        self, state: GroupState, member: MemberState, links: Iterable[_Link]
    ) -> None:
        for link in links:
            if link.same_evidence:
                self._union(state, member, link.member)

    @staticmethod
    def _representative(state: GroupState, member: MemberState) -> EpisodeKey:
        key = episode_key(member.event)
        path = []
        while (parent := state.members[key].representative) is not None:
            path.append(key)
            key = parent
        for child in path:
            state.members[child].representative = key
        return key

    def _union(self, state: GroupState, a: MemberState, b: MemberState) -> None:
        left, right = self._representative(state, a), self._representative(state, b)
        if left != right:
            state.members[max(left, right)].representative = min(left, right)

    def independent(self, state: GroupState) -> int:
        return len({self._representative(state, m) for m in state.members.values() if not m.latent})

    def _update_group(self, t: datetime, state: GroupState, emit: _Emit) -> None:
        if self._localize_group(t, state):
            emit(state, "localize", state.root)
        if self._update_urgency(state):
            emit(state, "urgency")

    def _localize_group(self, t: datetime, state: GroupState) -> bool:
        members = list(state.members.values())
        if len(members) < 2:
            return False

        def explained(member: MemberState) -> bool:
            key = member.event.key
            footprint = self._footprint(member, t)
            for other in members:
                other_key = other.event.key
                if (
                    other is member
                    or self._order(key, other_key, (footprint, other.footprint)) != 1
                ):
                    continue
                if service_of(key) == service_of(other_key) or (
                    footprint is not None and footprint.touches(other_key, self.cfg.min_share)
                ):
                    return True
            return False

        def coverage(member: MemberState) -> int:
            return len(
                {
                    service_of(other.event.key)
                    for other in members
                    if self.shared.get(member.event.key, other.event.key)
                }
            )

        candidates = [m for m in members if not explained(m)] or members
        best_coverage = max(map(coverage, candidates))
        candidates = [m for m in candidates if coverage(m) == best_coverage]
        earliest = min(m.event.start for m in candidates)
        best = max(
            (m for m in candidates if m.event.start <= earliest + self.cfg.tolerance),
            key=lambda m: (
                size_of(m.ratio),
                self._position(m.event.key),
                not _project_level(m.event.key),
            ),
        )
        key = best.event.key
        localization = _localize(key)
        shared = sorted(
            {service_of(m.event.key) for m in members if self.shared.get(key, m.event.key)}
        )
        if shared:
            localization += f" (shared with {', '.join(shared)})"
        if waiting := _waiting_on(key, best.footprint):
            localization += f", waiting on {waiting}"
        if best.event is state.root and localization == state.group.localization:
            return False
        state.root = best.event
        state.group.localization = localization
        return True

    def _update_urgency(self, state: GroupState) -> bool:
        members = [(m.event, m.ratio, m.escalated) for m in state.members.values() if not m.latent]
        new = urgency(members, self.cfg.high_users)
        if URGENCY_RANK[new] > URGENCY_RANK[state.group.urgency]:
            state.group.urgency = new
            return True
        return False

    def _promote_slow(self, t: datetime, state: GroupState) -> bool:
        if self.cfg.slow_promote is None or state.group.urgency != Urgency.LOW:
            return False
        ratio, minutes = self.cfg.slow_promote
        for member in state.members.values():
            event = member.event
            if (
                not member.latent
                and member.closed_at is None
                and event.change_type == ChangeType.SLOWDOWN
                and event.sustained_at is not None
                and event.sustained_at <= t
                and t - event.start >= timedelta(minutes=minutes)
                and (event.recent_ratio is None or event.recent_ratio >= ratio)
            ):
                state.group.urgency = Urgency.MEDIUM
                return True
        return False

    def _comovement(self, t: datetime, new: MemberState, member: MemberState) -> float | None:
        event, existing = new.event, member.event
        # Evaluate the same window after checkpoint restoration as in a continuous run.
        start = max(event.start, existing.start, t - timedelta(hours=26))
        end = min(t, existing.ended_at or t) if member.closed_at is not None else t
        if end - start < self.cfg.comove_min:
            return None
        a, b = self.series.get(event.key), self.series.get(existing.key)
        if not a or not b:
            return None
        bins = zip(
            _log_bins(a, start, end, event.key), _log_bins(b, start, end, existing.key), strict=True
        )
        moves = [
            (next_a - prev_a, next_b - prev_b)
            for (prev_a, prev_b), (next_a, next_b) in pairwise(bins)
            if prev_a is not None
            and prev_b is not None
            and next_a is not None
            and next_b is not None
        ]
        if len(moves) < max(3, self.cfg.comove_min / timedelta(minutes=10) - 3):
            return None
        mean_a = sum(x for x, _ in moves) / len(moves)
        mean_b = sum(y for _, y in moves) / len(moves)
        spread_a = sum((x - mean_a) ** 2 for x, _ in moves)
        spread_b = sum((y - mean_b) ** 2 for _, y in moves)
        if not spread_a or not spread_b:
            return None
        return sum((x - mean_a) * (y - mean_b) for x, y in moves) / math.sqrt(spread_a * spread_b)

    def _footprint(self, member: MemberState, t: datetime) -> Footprint | None:
        if self.footprints is not None and not member.footprint_loaded:
            footprint = self.footprints.footprint(member.event, t + timedelta(minutes=1))
            if footprint is FOOTPRINT_DEFERRED:
                return None
            member.footprint = footprint
            member.footprint_loaded = True
            if member.footprint:
                for edge, count in member.footprint.edges.items():
                    if count > 0 and edge[0] != edge[2]:
                        if t - self.state.edge_seen_at.get(edge, t) > self.cfg.call_map_retention:
                            self.state.edges[edge] = count
                        else:
                            self.state.edges[edge] += count
                        self.state.edge_seen_at[edge] = t
                        self._graph = None
        return member.footprint

    @property
    def _call_graph(self) -> _CallGraph:
        if self._graph is None:
            self._graph = _CallGraph(self.state.edges, majority=True)
        return self._graph

    def _position(self, key: SeriesKey) -> int:
        return self._call_graph.depth.get(service_of(key), 0) * 3 + _layer(key)

    def _order(
        self, a: SeriesKey, b: SeriesKey, footprints: Sequence[Footprint | None] = ()
    ) -> int | None:
        """1 if b is downstream of a, -1 for the reverse, 0 for equal layer, None if unordered."""
        if service_of(a) == service_of(b):
            return (_layer(b) > _layer(a)) - (_layer(b) < _layer(a))
        # Prefer direction observed in the affected traces to the historical call map.
        edges: Counter[CallEdge] = Counter()
        for footprint in footprints:
            if footprint:
                edges.update(footprint.edges)
        if edges:
            order = _CallGraph(edges).order(a, b)
            if order is not None:
                return order
        return self._call_graph.order(a, b)


class _Emit(Protocol):
    def __call__(
        self,
        state: GroupState,
        kind: ActionKind,
        event: ChangeEvent | None = None,
        detail: str = "",
        merged_into: str | None = None,
    ) -> None: ...


class _CallGraph:
    def __init__(self, edges: Mapping[CallEdge, int], *, majority: bool = False) -> None:
        counts: Counter[tuple[str, str]] = Counter()
        for (caller, _, callee), count in edges.items():
            if caller != callee and count > 0:
                counts[caller, callee] += count
        self.forward: dict[str, set[str]] = defaultdict(set)
        self.domains: dict[tuple[str, str], set[str]] = defaultdict(set)
        for caller, domain, callee in edges:
            count, reverse = counts[caller, callee], counts[callee, caller]
            if not count or (majority and (count, callee) <= (reverse, caller)):
                continue
            self.forward[caller].add(callee)
            self.domains[caller, domain].add(callee)
        self._reachable: dict[str, set[str]] = {}
        self.depth: dict[str, int] = {}
        if majority:
            paths = sorted((a, b) for a, targets in self.forward.items() for b in targets)
            limit = len({node for path in paths for node in path})
            # Longest path for acyclic graphs. Bound relaxation for cyclic call maps.
            for _ in range(limit):
                changed = False
                for a, b in paths:
                    depth = self.depth.get(a, 0) + 1
                    if self.depth.get(b, 0) < depth <= limit:
                        self.depth[b] = depth
                        changed = True
                if not changed:
                    break

    def reachable(self, start: str) -> set[str]:
        if start not in self._reachable:
            seen, pending = {start}, [start]
            while pending:
                for target in self.forward.get(pending.pop(), ()):
                    if target not in seen:
                        seen.add(target)
                        pending.append(target)
            seen.remove(start)
            self._reachable[start] = seen
        return self._reachable[start]

    def _on_path(self, key: SeriesKey, target: str) -> bool:
        source = service_of(key)
        if target not in self.reachable(source):
            return False
        if _layer(key) < 2:
            return True  # Service totals and endpoints sit above their outbound calls.
        if base_signal(key.signal) != "outbound_http":
            return False  # A database slice isn't a step toward another project.
        return any(
            target == callee or target in self.reachable(callee)
            for callee in self.domains.get((source, key.dim_value), ())
        )

    def order(self, a: SeriesKey, b: SeriesKey) -> int | None:
        downstream = self._on_path(a, service_of(b))
        upstream = self._on_path(b, service_of(a))
        if downstream == upstream:
            return None
        return 1 if downstream else -1


def urgency(
    members: Sequence[tuple[ChangeEvent, float, bool]], high_users: float = 50.0
) -> Urgency:
    """Classify the group from observed failure, affected-user and escalation evidence."""
    has_failure = False
    for event, ratio, escalated in members:
        key = event.key
        level = event.expected * ratio if event.expected else event.actual
        if key.signal not in ERROR_SIGNALS and (
            key.metric != "failure_rate()" or level - event.expected < FAILING_SHARE
        ):
            continue
        if escalated or (
            key.metric == "count_unique(user)" and level - event.expected >= high_users
        ):
            return Urgency.HIGH
        has_failure = True
    if (
        has_failure
        or any(esc for _, _, esc in members)
        or len({event.key.project for event, _, _ in members}) > 1
    ):
        return Urgency.MEDIUM
    return Urgency.LOW


def _group_id(event: ChangeEvent) -> str:
    key = event.key
    start = event.start.astimezone(UTC) if event.start.tzinfo else event.start.replace(tzinfo=UTC)
    identity = (
        key.project,
        key.env,
        key.signal,
        key.metric,
        key.dim_value,
        event.change_type,
        start.isoformat(),
    )
    return hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:32]


def _error_path(source: SeriesKey, target: SeriesKey, footprint: Footprint) -> bool:
    if (
        _family(source) != "failure"
        or _family(target) != "failure"
        or service_of(source) == service_of(target)
    ):
        return False
    return service_of(target) in _CallGraph(footprint.edges).reachable(service_of(source))


def _onset(event: ChangeEvent) -> datetime:
    unusual_since = (event.novelty or {}).get("unusual_since")
    return unusual_since if isinstance(unusual_since, datetime) else event.start


def _worse_near(event: ChangeEvent, other: datetime, tolerance: timedelta, now: datetime) -> bool:
    onset = _onset(event)
    return (event.start < onset <= now and abs(onset - other) <= tolerance) or any(
        when <= now and abs(when - other) <= tolerance for when, _ in event.escalations
    )


def _last_onset(event: ChangeEvent, cutoff: datetime, now: datetime) -> datetime:
    onsets = chain((event.start, _onset(event)), (when for when, _ in event.escalations))
    return max((when for when in onsets if when <= min(cutoff, now)), default=event.start)


def _overlap(a: ChangeEvent, b: ChangeEvent, tolerance: timedelta) -> bool:
    first, later = (a, b) if a.start <= b.start else (b, a)
    return first.ended_at is None or later.start <= first.ended_at + tolerance


def _layer(key: SeriesKey) -> int:
    return SLICE_LAYERS.get(base_signal(key.signal), 0) if key.dim_value else 0


def _project_level(key: SeriesKey) -> bool:
    return _layer(key) == 0


def _family(key: SeriesKey) -> str:
    if key.metric.startswith(("p95", "slow_rate(")):
        return "latency"
    if key.metric == "failure_rate()" or key.signal in ERROR_SIGNALS:
        return "failure"
    return base_signal(key.signal)


def _shared_detail(pair: PairStats) -> str:
    if not pair.co:
        return "configured shared dependency"
    return f"shared dependency: {pair.co} co-onsets ({pair.expected:.1f} expected by chance)"


def _localize(key: SeriesKey) -> str:
    signal = base_signal(key.signal)
    if not _project_level(key):
        kind = {"endpoints": "endpoint", "outbound_db": "database", "outbound_http": "dependency"}[
            signal
        ]
        return f"{service_of(key)} {kind} {mask_dim(key.dim_value)}"
    names = {
        "error_rate": "error rate",
        "failed_rate": "failed-request rate",
        "errors": "affected users",
        "requests": "traffic",
    }
    if signal == "new_issue":
        return f"{service_of(key)} new issue {key.dim_value}"
    return f"{service_of(key)} {names.get(signal, signal)} (service-wide)"


def _waiting_on(key: SeriesKey, footprint: Footprint | None) -> str | None:
    if base_signal(key.signal) != "endpoints" or footprint is None:
        return None
    own = footprint.slices.get(slice_of(key))
    if own is None or not own.p95_ms:
        return None
    project, env, _, _ = slice_of(key)
    waits = [
        (stats.p95_ms, signal, dimension)
        for (p, e, signal, dimension), stats in footprint.slices.items()
        if (p, e) == (project, env)
        and signal in DEPENDENCY_SIGNALS
        and stats.trace_share >= 0.5
        and stats.p95_ms is not None
        and stats.p95_ms >= 0.6 * own.p95_ms
    ]
    if not waits:
        return None
    duration, signal, dimension = max(waits)
    kind = "database" if signal == "outbound_db" else "calls to"
    return f"{kind} {mask_dim(dimension)} (p95 {duration / 1000:.1f}s of {own.p95_ms / 1000:.1f}s)"


def _log_bins(
    series: Mapping[datetime, float | None], start: datetime, end: datetime, key: SeriesKey
) -> Iterable[float | None]:
    step = timedelta(minutes=10)
    offset = 1e-4 if _family(key) == "failure" or key.metric.startswith("slow_rate(") else 1.0
    t = start
    while t + step <= end:
        values = sorted(
            math.log(value + offset)
            for i in range(10)
            if (value := series.get(t + timedelta(minutes=i))) is not None and value >= 0
        )
        yield values[len(values) // 2] if values else None
        t += step
