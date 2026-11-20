"""Group change episodes within an organization using structural evidence."""

from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Literal, Protocol

from sentry.anomaly_detection.contracts import (
    AnomalyGroupKey,
    ChangeAction,
    ChangeEvent,
    ChangeType,
    EpisodeKey,
    Metric,
    SeriesKey,
    Service,
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
class AnomalyGroup:
    """Correlated change episodes, their root change and the group's lifecycle."""

    id: AnomalyGroupKey
    opened_at: datetime
    root: ChangeEvent
    last_activity: datetime
    localization: str
    urgency: Urgency = Urgency.LOW
    closed_at: datetime | None = None
    members: dict[EpisodeKey, MemberState] = field(default_factory=dict)

    @property
    def change_events(self) -> list[ChangeEvent]:
        return [member.event for member in self.members.values()]

    @property
    def driving_issues(self) -> list[int]:
        issues = (issue for event in self.change_events for issue in sorted(event.issue_ids))
        return list(dict.fromkeys(issues))

    @property
    def blast_radius(self) -> list[Service]:
        return list(dict.fromkeys(service_of(key.series_key) for key in self.members))


@dataclass
class CorrelationState:
    open_groups: dict[AnomalyGroupKey, AnomalyGroup] = field(default_factory=dict)
    closed_groups: dict[AnomalyGroupKey, AnomalyGroup] = field(default_factory=dict)
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
        self.by_event = {key: group for group in self.groups for key in group.members}
        self._graph: call_graph.CallGraph | None = None

    @property
    def groups(self) -> list[AnomalyGroup]:
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
        emitted: list[GroupAction] = []
        independent_counts: dict[AnomalyGroupKey, int] = {}

        def emit(
            group: AnomalyGroup,
            kind: GroupActionKind,
            event: ChangeEvent | None = None,
            detail: str = "",
            merged_into: AnomalyGroupKey | None = None,
        ) -> None:
            # The survivor can union member evidence after the merge. The closed group's
            # representative keys must not be followed into the survivor's membership.
            if merged_into is not None:
                independent_counts[group.id] = self.independent(group)
            emitted.append(GroupAction(t, kind, group, event, detail, merged_into))

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
                self.footprint(member, t)
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

        for group in list(self.state.open_groups.values()):
            if self._promote_slow(t, group):
                emit(group, "urgency", detail="sustained slowdown")
            if t - group.last_activity >= self.cfg.quiet and all(
                m.closed_at is not None for m in group.members.values()
            ):
                group.closed_at = t
                del self.state.open_groups[group.id]
                self.state.closed_groups[group.id] = group
                emit(group, "close", detail="all changes ended")

        for group_action in emitted:
            group = group_action.group
            if group.id not in independent_counts:
                independent_counts[group.id] = self.independent(group)
            group_action.independent_count = independent_counts[group.id]
            group_action.root = group.root
        return emitted

    def prune(self, t: datetime) -> None:
        """Discard closed groups that can't be continued, and age out stale call paths."""
        latent_by_series: dict[SeriesKey, list[ChangeEvent]] = defaultdict(list)
        for latent in self.state.latent.values():
            latent_by_series[latent.key].append(latent)
        for group_id, group in list(self.state.closed_groups.items()):
            closed_at = group.closed_at
            if closed_at is None or t - closed_at <= self.cfg.tolerance:
                continue
            if any(
                latent.start <= closed_at and linking.restart(latent, member, self.cfg.tolerance)
                for member in group.members.values()
                for latent in latent_by_series.get(member.event.key, ())
            ):
                continue
            for key in group.members:
                del self.by_event[key]
            del self.state.closed_groups[group_id]
        for edge, seen_at in list(self.state.edge_seen_at.items()):
            if t - seen_at > self.cfg.call_map_retention:
                del self.state.edge_seen_at[edge]
                del self.state.edges[edge]
                self._graph = None

    def prune_members(self, floor: datetime) -> None:
        """Drop completed non-root members that closed before `floor`.

        A continuous group can contain arbitrarily many completed episodes. Keep its root,
        ongoing members and recent context, preserving alias classes of retained members.
        """
        for group in self.groups:
            root_key = episode_key(group.root)
            expired = {
                key
                for key, member in group.members.items()
                if key != root_key and member.closed_at is not None and member.closed_at < floor
            }
            if not expired:
                continue

            # Retained members must not point to a representative that no longer exists.
            aliases: dict[EpisodeKey, list[EpisodeKey]] = defaultdict(list)
            for key, member in group.members.items():
                if key not in expired:
                    aliases[self.representative(group, member)].append(key)
            for keys in aliases.values():
                representative = min(keys)
                for key in keys:
                    group.members[key].representative = (
                        None if key == representative else representative
                    )

            services = set(group.blast_radius)
            for key in expired:
                del group.members[key]
                if self.by_event.get(key) is group:
                    del self.by_event[key]
            # Localization can name peers that are no longer members. Fall back to the
            # retained root without relocalizing (which may query trace evidence).
            if services - set(group.blast_radius):
                group.localization = _localize(group.root.key)

    def drop_projects(
        self, keep: set[int], owners: Mapping[AnomalyGroupKey, int]
    ) -> tuple[dict[AnomalyGroupKey, AnomalyGroup], list[EpisodeKey]]:
        """Retire groups touching projects outside `keep` and forget their evidence.

        `owners` maps published groups to the project they were published for. Returns the
        retired groups and the ongoing in-scope episodes of retired open groups, which are
        kept as latent support only: reopening one as a standalone finding could recreate
        the retired group's ID.
        """
        state = self.state
        retired: dict[AnomalyGroupKey, AnomalyGroup] = {}
        demoted: list[EpisodeKey] = []
        for groups in (state.open_groups, state.closed_groups):
            for group_id, group in list(groups.items()):
                root_project = group.root.key.project_id
                if (
                    owners.get(group_id, root_project) in keep
                    and root_project in keep
                    and all(key.series_key.project_id in keep for key in group.members)
                ):
                    for member in group.members.values():
                        if member.footprint is not None:
                            _scope_footprint(member.footprint, keep)
                    continue
                retired[group_id] = group
                del groups[group_id]
                for key, member in group.members.items():
                    if self.by_event.get(key) is not group:
                        continue
                    del self.by_event[key]
                    if (
                        group.closed_at is None
                        and member.closed_at is None
                        and member.event.ended_at is None
                        and member.event.change_type != ChangeType.NEW_FAILURE_MODE
                        and key.series_key.project_id in keep
                    ):
                        state.latent[key] = member.event
                        demoted.append(key)
        for key in [key for key in state.latent if key.series_key.project_id not in keep]:
            del state.latent[key]
        for edge in list(state.edges):
            if edge.caller.project_id not in keep or edge.callee.project_id not in keep:
                del state.edges[edge]
                state.edge_seen_at.pop(edge, None)
                self._graph = None
        state.shared.drop_projects(keep)
        return retired, demoted

    def _on_open(self, t: datetime, member: MemberState, emit: _Emit) -> None:
        event = member.event
        candidates = []
        for group in self.state.open_groups.values():
            links = [
                link
                for existing in self._live_members(t, group, event)
                if (link := linking.link(self, t, member, existing, error_signals=ERROR_SIGNALS))
                is not None
            ]
            if links:
                candidates.append((group, min(links, key=lambda link: link.rank(event)), links))

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
        elif continuation := self._continued(member):
            group, previous = continuation
            group.closed_at = None
            self.state.open_groups[group.id] = self.state.closed_groups.pop(group.id)
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

        self._attach_latent_causes(t, group, member, emit)
        group.last_activity = t
        self._update_group(t, group, emit)

    def _live_members(
        self, t: datetime, group: AnomalyGroup, event: ChangeEvent | None = None
    ) -> Iterable[MemberState]:
        for member in group.members.values():
            if member.closed_at is None or t - member.closed_at <= self.cfg.member_grace:
                yield member
            elif event is not None and linking.restart(event, member, self.cfg.tolerance):
                yield member

    def _create_group(self, t: datetime, member: MemberState) -> AnomalyGroup:
        event = member.event
        group = AnomalyGroup(
            id=_group_id(event),
            opened_at=t,
            root=event,
            last_activity=t,
            localization=_localize(event.key),
        )
        self.state.open_groups[group.id] = group
        self._add_member(group, member)
        return group

    def _add_member(self, group: AnomalyGroup, member: MemberState) -> None:
        key = episode_key(member.event)
        group.members[key] = member
        self.by_event[key] = group

    def _merge(
        self,
        t: datetime,
        into: AnomalyGroup,
        other: AnomalyGroup,
        emit: _Emit,
        *,
        emit_close: bool = True,
    ) -> None:
        for member in other.members.values():
            self._add_member(into, member)
        into.opened_at = min(into.opened_at, other.opened_at)
        if URGENCY_RANK[other.urgency] > URGENCY_RANK[into.urgency]:
            into.urgency = other.urgency
        del self.state.open_groups[other.id]
        other.closed_at = t
        emit(into, "join", detail="merged structurally linked groups")
        if emit_close:
            emit(other, "close", detail="merged into another group", merged_into=into.id)

    def _continued(self, member: MemberState) -> tuple[AnomalyGroup, MemberState] | None:
        for group in reversed(self.state.closed_groups.values()):
            if group.closed_at is not None and group.closed_at >= member.event.start:
                for previous in group.members.values():
                    if linking.restart(member.event, previous, self.cfg.tolerance):
                        return group, previous
        return None

    def _failure_mode_home(self, t: datetime, event: ChangeEvent) -> AnomalyGroup | None:
        if event.change_type != ChangeType.NEW_FAILURE_MODE:
            return None
        service = service_of(event.key)
        for group in self.state.open_groups.values():
            if any(
                service_of(member.event.key) == service
                and (
                    abs(member.event.start - event.start) <= self.cfg.tolerance
                    or linking.worse_near(member.event, event.start, self.cfg.tolerance, t)
                )
                for member in self._live_members(t, group)
            ):
                return group
        return None

    def _same_issue(self, t: datetime, group: AnomalyGroup) -> AnomalyGroup | None:
        issue_keys = {
            (event.key.project_id, issue)
            for event in group.change_events
            for issue in event.issue_ids
        }
        if not issue_keys:
            return None
        for other in self.state.open_groups.values():
            if (
                other is not group
                and t - other.opened_at <= self.cfg.tolerance
                and any(
                    (event.key.project_id, issue) in issue_keys
                    for event in other.change_events
                    for issue in event.issue_ids
                )
            ):
                return other
        return None

    def _attach_latent_causes(
        self, t: datetime, group: AnomalyGroup, source: MemberState, emit: _Emit
    ) -> None:
        event = source.event
        for latent in list(self.state.latent.values()):
            support = self._attach_shared_support(t, group, source, latent, emit)
            if support is None:
                if latent.key == event.key and linking.overlap(event, latent, self.cfg.tolerance):
                    support = self._attach_support(
                        group, latent, emit, "same series", alias_of=source
                    )
                else:
                    support = self._attach_downstream_support(t, group, source, latent, emit)
            if support is not None:
                self._bridge_support(t, group, support, emit)

    def _attach_new_latent(self, t: datetime, latent: ChangeEvent, emit: _Emit) -> None:
        for group in self.state.open_groups.values():
            for source in self._live_members(t, group):
                support = self._attach_shared_support(t, group, source, latent, emit)
                if support is None and not source.latent:
                    support = self._attach_downstream_support(t, group, source, latent, emit)
                if support is None:
                    continue
                self._bridge_support(t, group, support, emit)
                group.last_activity = t
                self._update_group(t, group, emit)
                return

    def _attach_shared_support(
        self,
        t: datetime,
        group: AnomalyGroup,
        source: MemberState,
        latent: ChangeEvent,
        emit: _Emit,
    ) -> MemberState | None:
        if self.shared.get(latent.key, source.event.key) is None:
            return None
        support = MemberState(latent, latent.open_ratio, latent=True)
        link = linking.link(self, t, support, source, error_signals=ERROR_SIGNALS)
        if link is None or link.kind != "shared":
            return None
        return self._attach_support(group, latent, emit, link.detail, alias_of=source)

    def _attach_downstream_support(
        self,
        t: datetime,
        group: AnomalyGroup,
        source: MemberState,
        latent: ChangeEvent,
        emit: _Emit,
    ) -> MemberState | None:
        if not linking.is_downstream_support(self, t, source, latent):
            return None
        return self._attach_support(
            group, latent, emit, "downstream routine change seen in affected traces"
        )

    def _attach_support(
        self,
        group: AnomalyGroup,
        event: ChangeEvent,
        emit: _Emit,
        detail: str,
        *,
        alias_of: MemberState | None = None,
    ) -> MemberState:
        member = MemberState(event, event.open_ratio, latent=True)
        self._add_member(group, member)
        if alias_of is not None:
            self._union(group, member, alias_of)
        self.state.latent.pop(episode_key(event), None)
        emit(group, "join", event, detail)
        return member

    def _bridge_support(
        self, t: datetime, group: AnomalyGroup, support: MemberState, emit: _Emit
    ) -> None:
        for other in list(self.state.open_groups.values()):
            if other is group:
                continue
            links = [
                link
                for member in self._live_members(t, other)
                if (link := linking.link(self, t, support, member, error_signals=ERROR_SIGNALS))
                is not None
                and link.bridges_groups
            ]
            if links:
                self._merge(t, group, other, emit)
                self._record_aliases(group, support, links)

    def _record_aliases(
        self, group: AnomalyGroup, member: MemberState, links: Iterable[linking.Link]
    ) -> None:
        for link in links:
            if link.same_evidence:
                self._union(group, member, link.member)

    @staticmethod
    def representative(group: AnomalyGroup, member: MemberState) -> EpisodeKey:
        """The member's alias-class representative (union-find with path compression)."""
        key = episode_key(member.event)
        path = []
        while (parent := group.members[key].representative) is not None:
            path.append(key)
            key = parent
        for child in path:
            group.members[child].representative = key
        return key

    def _union(self, group: AnomalyGroup, a: MemberState, b: MemberState) -> None:
        left, right = self.representative(group, a), self.representative(group, b)
        if left != right:
            group.members[max(left, right)].representative = min(left, right)

    def independent(self, group: AnomalyGroup) -> int:
        return len({self.representative(group, m) for m in group.members.values() if not m.latent})

    def _update_group(self, t: datetime, group: AnomalyGroup, emit: _Emit) -> None:
        if self._localize_group(t, group):
            emit(group, "localize", group.root)
        if self._update_urgency(group):
            emit(group, "urgency")

    def _localize_group(self, t: datetime, group: AnomalyGroup) -> bool:
        members = list(group.members.values())
        if len(members) < 2:
            return False

        def explained(member: MemberState) -> bool:
            key = member.event.key
            footprint = self.footprint(member, t)
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
                    and self.order(key, other_key, (footprint, other.footprint))
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
        if best.event is group.root and localization == group.localization:
            return False
        group.root = best.event
        group.localization = localization
        return True

    def _update_urgency(self, group: AnomalyGroup) -> bool:
        members = [(m.event, m.ratio, m.escalated) for m in group.members.values() if not m.latent]
        new = urgency(members, self.cfg.high_users)
        if URGENCY_RANK[new] > URGENCY_RANK[group.urgency]:
            group.urgency = new
            return True
        return False

    def _promote_slow(self, t: datetime, group: AnomalyGroup) -> bool:
        if self.cfg.slow_promote is None or group.urgency != Urgency.LOW:
            return False
        ratio, minutes = self.cfg.slow_promote
        for member in group.members.values():
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
                group.urgency = Urgency.MEDIUM
                return True
        return False

    def footprint(self, member: MemberState, observation_minute: datetime) -> Footprint | None:
        """The member's trace footprint, loaded once; also learns the call map from it."""
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
                    if count <= 0 or edge.caller == edge.callee:
                        continue
                    last_seen = self.state.edge_seen_at.get(edge, observation_minute)
                    if observation_minute - last_seen > self.cfg.call_map_retention:
                        self.state.edges[edge] = count
                    else:
                        self.state.edges[edge] += count
                    self.state.edge_seen_at[edge] = observation_minute
                    self._graph = None
        return member.footprint

    @property
    def _call_graph(self) -> call_graph.CallGraph:
        if self._graph is None:
            self._graph = call_graph.CallGraph(self.state.edges, majority=True)
        return self._graph

    def order(
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
        group: AnomalyGroup,
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


def _scope_footprint(footprint: Footprint, keep: set[int]) -> None:
    """Forget trace evidence about services of projects outside `keep`."""
    for part in [part for part in footprint.slices if part.service.project_id not in keep]:
        del footprint.slices[part]
    for edge in list(footprint.edges):
        if edge.caller.project_id not in keep or edge.callee.project_id not in keep:
            del footprint.edges[edge]


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
