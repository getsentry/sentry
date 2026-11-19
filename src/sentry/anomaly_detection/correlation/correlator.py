"""Group change episodes within an organization using structural evidence."""

from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Literal, Protocol

from sentry.anomaly_detection.contracts import (
    AnomalyGroup,
    AnomalyGroupKey,
    ChangeAction,
    ChangeEvent,
    ChangeType,
    EpisodeKey,
    Metric,
    SeriesKey,
    Signal,
    Urgency,
)
from sentry.anomaly_detection.correlation import call_graph, linking
from sentry.anomaly_detection.correlation.footprint import (
    DEPENDENCY_SIGNALS,
    FOOTPRINT_DEFERRED,
    CallEdge,
    Footprint,
    FootprintResult,
    service_of,
    slice_of,
)
from sentry.anomaly_detection.correlation.shared_dependencies import SharedDeps
from sentry.anomaly_detection.evaluation.novelty import mask_dim, size_of
from sentry.utils import json

ERROR_SIGNALS = frozenset({Signal.ERRORS, Signal.ERROR_RATE, Signal.FAILED_RATE, Signal.NEW_ISSUE})
FAILING_SHARE = 0.2
URGENCY_RANK = {Urgency.LOW: 0, Urgency.MEDIUM: 1, Urgency.HIGH: 2}

GroupActionKind = Literal["open", "join", "localize", "urgency", "update", "reopen", "close"]


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
    open_groups: dict[AnomalyGroupKey, GroupState] = field(default_factory=dict)
    closed_groups: dict[AnomalyGroupKey, GroupState] = field(default_factory=dict)
    latent: dict[EpisodeKey, ChangeEvent] = field(default_factory=dict)
    edges: Counter[CallEdge] = field(default_factory=Counter)
    edge_seen_at: dict[CallEdge, datetime] = field(default_factory=dict)
    shared: SharedDeps = field(default_factory=SharedDeps)


@dataclass
class GroupAction:
    """Actions reference the group, root and independent count as of the end of the step."""

    t: datetime
    kind: GroupActionKind
    group: AnomalyGroup
    event: ChangeEvent | None = None
    detail: str = ""
    merged_into: AnomalyGroupKey | None = None
    root: ChangeEvent | None = None
    independent_count: int = 1


def episode_key(event: ChangeEvent) -> EpisodeKey:
    return EpisodeKey(event.key, event.change_type, event.start)


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
        self._graph: call_graph._CallGraph | None = None

    @property
    def groups(self) -> list[GroupState]:
        return [*self.state.open_groups.values(), *self.state.closed_groups.values()]

    @property
    def shared(self) -> SharedDeps:
        return self.state.shared

    @shared.setter
    def shared(self, value: SharedDeps) -> None:
        self.state.shared = value

    def step(self, t: datetime, actions: Sequence[ChangeAction]) -> list[GroupAction]:
        """Consume detector actions in event time, including empty ticks for quiet close."""
        opened: list[MemberState] = []
        new_latent: list[ChangeEvent] = []
        emitted: list[tuple[GroupState, GroupAction]] = []
        merged_counts: dict[AnomalyGroupKey, int] = {}

        def emit(
            state: GroupState,
            kind: GroupActionKind,
            event: ChangeEvent | None = None,
            detail: str = "",
            merged_into: AnomalyGroupKey | None = None,
        ) -> None:
            # The survivor can union member evidence after the merge. The closed group's
            # representative keys must not be followed into the survivor's membership.
            if merged_into is not None:
                merged_counts[state.group.id] = self.independent(state)
            emitted.append((state, GroupAction(t, kind, state.group, event, detail, merged_into)))

        # Process newly observed escalation metadata before matching changes in the same minute.
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
            key=lambda m: (
                -self._call_graph.position(m.event.key),
                m.event.start,
                episode_key(m.event),
            )
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
                latent.start <= closed_at and linking.restart(latent, member, self.cfg.tolerance)
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
                if (link := linking.link(self, t, member, existing, error_signals=ERROR_SIGNALS))
                is not None
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
                if linking.ties(event, best, link, self.cfg.co_onset) or any(
                    identity.bridges_groups for identity in other_links
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
            elif event is not None and linking.restart(event, member, self.cfg.tolerance):
                yield member

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
        for issue in sorted(event.issue_ids):
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
                    if linking.restart(member.event, previous, self.cfg.tolerance):
                        return state, previous
        return None

    def _failure_mode_home(self, t: datetime, event: ChangeEvent) -> GroupState | None:
        if event.change_type != ChangeType.NEW_FAILURE_MODE:
            return None
        service = service_of(event.key)
        for state in self.state.open_groups.values():
            if any(
                service_of(member.event.key) == service
                and (
                    abs(member.event.start - event.start) <= self.cfg.tolerance
                    or linking.worse_near(member.event, event.start, self.cfg.tolerance, t)
                )
                for member in self._live_members(t, state)
            ):
                return state
        return None

    def _same_issue(self, t: datetime, state: GroupState) -> GroupState | None:
        issue_keys = {
            (event.key.project_id, issue)
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
                    (event.key.project_id, issue) in issue_keys
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
        for latent in list(self.state.latent.values()):
            support = self._attach_shared_support(t, state, source, latent, emit)
            if support is None:
                if latent.key == event.key and linking.overlap(event, latent, self.cfg.tolerance):
                    support = self._attach_support(
                        state, latent, emit, "same series", alias_of=source
                    )
                else:
                    support = self._attach_downstream_support(t, state, source, latent, emit)
            if support is not None:
                self._bridge_support(t, state, support, emit)

    def _attach_new_latent(self, t: datetime, latent: ChangeEvent, emit: _Emit) -> None:
        for state in self.state.open_groups.values():
            for source in self._live_members(t, state):
                support = self._attach_shared_support(t, state, source, latent, emit)
                if support is None and not source.latent:
                    support = self._attach_downstream_support(t, state, source, latent, emit)
                if support is None:
                    continue
                self._bridge_support(t, state, support, emit)
                state.last_activity = t
                self._update_group(t, state, emit)
                return

    def _attach_shared_support(
        self, t: datetime, state: GroupState, source: MemberState, latent: ChangeEvent, emit: _Emit
    ) -> MemberState | None:
        if self.shared.get(latent.key, source.event.key) is None:
            return None
        support = MemberState(latent, latent.open_ratio, latent=True)
        link = linking.link(self, t, support, source, error_signals=ERROR_SIGNALS)
        if link is None or link.kind != "shared":
            return None
        return self._attach_support(state, latent, emit, link.detail, alias_of=source)

    def _attach_downstream_support(
        self, t: datetime, state: GroupState, source: MemberState, latent: ChangeEvent, emit: _Emit
    ) -> MemberState | None:
        if not linking.is_downstream_support(self, t, source, latent):
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
                if (link := linking.link(self, t, support, member, error_signals=ERROR_SIGNALS))
                is not None
                and link.bridges_groups
            ]
            if links:
                self._merge(t, state, other, emit)
                self._record_aliases(state, support, links)

    def _record_aliases(
        self, state: GroupState, member: MemberState, links: Iterable[linking.Link]
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
                if other is member:
                    continue
                other_key = other.event.key
                related = service_of(key) == service_of(other_key) or (
                    footprint is not None and footprint.touches(other_key, self.cfg.min_share)
                )
                # Ordering may build a call graph, so only order related pairs.
                if (
                    related
                    and self._order(key, other_key, (footprint, other.footprint))
                    == call_graph.DOWNSTREAM
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
                self._call_graph.position(m.event.key),
                not call_graph.is_project_level(m.event.key),
            ),
        )
        key = best.event.key
        localization = _localize(key)
        shared = sorted(
            {service_of(m.event.key) for m in members if self.shared.get(key, m.event.key)}
        )
        if shared:
            localization += f" (shared with {', '.join(map(str, shared))})"
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

    def _footprint(self, member: MemberState, observation_minute: datetime) -> Footprint | None:
        if self.footprints is not None and not member.footprint_loaded:
            footprint = self.footprints.footprint(
                member.event, observation_minute + timedelta(minutes=1)
            )
            if footprint is FOOTPRINT_DEFERRED:
                return None
            member.footprint = footprint
            member.footprint_loaded = True
            if member.footprint:
                for edge, count in member.footprint.edges.items():
                    if count > 0 and edge[0] != edge[2]:
                        if (
                            observation_minute
                            - self.state.edge_seen_at.get(edge, observation_minute)
                            > self.cfg.call_map_retention
                        ):
                            self.state.edges[edge] = count
                        else:
                            self.state.edges[edge] += count
                        self.state.edge_seen_at[edge] = observation_minute
                        self._graph = None
        return member.footprint

    @property
    def _call_graph(self) -> call_graph._CallGraph:
        if self._graph is None:
            self._graph = call_graph._CallGraph(self.state.edges, majority=True)
        return self._graph

    def _order(
        self,
        reference_key: SeriesKey,
        compared_key: SeriesKey,
        footprints: Sequence[Footprint | None] = (),
    ) -> int | None:
        # Prefer direction observed in the affected traces to the historical call map.
        direction = call_graph.observed_order(reference_key, compared_key, footprints)
        if direction is not None:
            return direction
        return self._call_graph.order(reference_key, compared_key)


class _Emit(Protocol):
    def __call__(
        self,
        state: GroupState,
        kind: GroupActionKind,
        event: ChangeEvent | None = None,
        detail: str = "",
        merged_into: AnomalyGroupKey | None = None,
    ) -> None: ...


def urgency(
    members: Sequence[tuple[ChangeEvent, float, bool]], high_users: float = 50.0
) -> Urgency:
    """Classify the group from observed failure, affected-user and escalation evidence."""
    has_failure = False
    for event, ratio, escalated in members:
        key = event.key
        level = event.expected * ratio if event.expected else event.actual
        if key.signal not in ERROR_SIGNALS and (
            key.metric != Metric.FAILURE_RATE or level - event.expected < FAILING_SHARE
        ):
            continue
        if escalated or (
            key.metric == Metric.COUNT_UNIQUE_USER and level - event.expected >= high_users
        ):
            return Urgency.HIGH
        has_failure = True
    if (
        has_failure
        or any(esc for _, _, esc in members)
        or len({event.key.project_id for event, _, _ in members}) > 1
    ):
        return Urgency.MEDIUM
    return Urgency.LOW


def _group_id(event: ChangeEvent) -> AnomalyGroupKey:
    key = event.key
    start = event.start.astimezone(UTC) if event.start.tzinfo else event.start.replace(tzinfo=UTC)
    # Hash the project as a string: group keys predate integer project IDs, and
    # detector state of active groups must survive checkpoint format changes.
    identity = (
        str(key.project_id),
        key.env,
        key.signal,
        key.metric,
        key.dim_value,
        event.change_type,
        start.isoformat(),
    )
    return AnomalyGroupKey(hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:32])


_SLICE_NOUNS = {
    Signal.ENDPOINTS: "endpoint",
    Signal.OUTBOUND_DB: "database",
    Signal.OUTBOUND_HTTP: "dependency",
}
_TOTAL_NOUNS = {
    Signal.ERROR_RATE: "error rate",
    Signal.FAILED_RATE: "failed-request rate",
    Signal.ERRORS: "affected users",
    Signal.REQUESTS: "traffic",
}


def _localize(key: SeriesKey) -> str:
    if not call_graph.is_project_level(key):
        return f"{service_of(key)} {_SLICE_NOUNS[key.signal]} {mask_dim(key.dim_value)}"
    if key.signal == Signal.NEW_ISSUE:
        return f"{service_of(key)} new issue {key.dim_value}"
    return f"{service_of(key)} {_TOTAL_NOUNS.get(key.signal, key.signal)} (service-wide)"


def _waiting_on(key: SeriesKey, footprint: Footprint | None) -> str | None:
    if key.signal != Signal.ENDPOINTS or footprint is None:
        return None
    own = footprint.slices.get(slice_of(key))
    if own is None or not own.p95_ms:
        return None
    waits = [
        (stats.p95_ms, part.signal, part.dim_value)
        for part, stats in footprint.slices.items()
        if part.service == service_of(key)
        and part.signal in DEPENDENCY_SIGNALS
        and stats.trace_share >= 0.5
        and stats.p95_ms is not None
        and stats.p95_ms >= 0.6 * own.p95_ms
    ]
    if not waits:
        return None
    duration, signal, dimension = max(waits)
    kind = "database" if signal == Signal.OUTBOUND_DB else "calls to"
    return f"{kind} {mask_dim(dimension)} (p95 {duration / 1000:.1f}s of {own.p95_ms / 1000:.1f}s)"
