"""Checkpoint encoding for correlated groups and their footprints."""

from collections import Counter
from datetime import datetime
from typing import Any

from sentry.anomaly_detection.checkpoint.event_codec import (
    _EventReader,
    _EventWriter,
    _iso,
    _key,
    _read_key,
    _read_service,
    _service,
    _time,
)
from sentry.anomaly_detection.contracts import (
    AnomalyGroup,
    AnomalyGroupKey,
    ChangeType,
    EpisodeKey,
    Signal,
    Urgency,
)
from sentry.anomaly_detection.correlation.correlator import (
    CorrelationState,
    GroupState,
    MemberState,
)
from sentry.anomaly_detection.correlation.footprint import CallEdge, Footprint, Slice, SliceStats
from sentry.anomaly_detection.correlation.shared_dependencies import (
    DependencySlice,
    PairStats,
    SharedDeps,
)


def _episode(key: EpisodeKey) -> list[Any]:
    return [_key(key.series_key), key.change_type.value, key.start.isoformat()]


def _read_episode(data: list[Any]) -> EpisodeKey:
    key, change_type, start = data
    return EpisodeKey(_read_key(key), ChangeType(change_type), datetime.fromisoformat(start))


def _edge(edge: CallEdge) -> list[Any]:
    return [_service(edge.caller), edge.domain, _service(edge.callee)]


def _read_edge(data: list[Any]) -> CallEdge:
    caller, domain, callee = data
    return CallEdge(_read_service(caller), domain, _read_service(callee))


def _slice(part: Slice) -> list[Any]:
    return [_service(part.service), part.signal, part.dim_value]


def _read_slice(data: list[Any]) -> Slice:
    service, signal, dim_value = data
    return Slice(_read_service(service), Signal(signal) if signal is not None else None, dim_value)


def _dependency(dependency: DependencySlice) -> list[Any]:
    return [_service(dependency.service), dependency.signal, dependency.dim_value]


def _read_dependency(data: list[Any]) -> DependencySlice:
    service, signal, dim_value = data
    return DependencySlice(_read_service(service), Signal(signal), dim_value)


def _footprint(footprint: Footprint | None) -> dict[str, Any] | None:
    if footprint is None:
        return None
    return {
        "event": _key(footprint.event),
        "traces": list(footprint.traces),
        "slices": [
            [_slice(part), stats.trace_share, stats.p95_ms, stats.spans]
            for part, stats in footprint.slices.items()
        ],
        "edges": [[_edge(edge), count] for edge, count in footprint.edges.items()],
        "window": [ts.isoformat() for ts in footprint.window] if footprint.window else None,
    }


def _read_footprint(data: dict[str, Any] | None) -> Footprint | None:
    if data is None:
        return None
    window = data["window"]
    return Footprint(
        event=_read_key(data["event"]),
        traces=list(data["traces"]),
        slices={
            _read_slice(part): SliceStats(share, p95, spans)
            for part, share, p95, spans in data["slices"]
        },
        edges=Counter({_read_edge(edge): count for edge, count in data["edges"]}),
        window=(datetime.fromisoformat(window[0]), datetime.fromisoformat(window[1]))
        if window
        else None,
    )


def _group(state: GroupState, events: _EventWriter) -> dict[str, Any]:
    group = state.group
    return {
        "id": group.id,
        "opened_at": group.opened_at.isoformat(),
        "change_events": [events.ref(event) for event in group.change_events],
        "driving_issues": list(group.driving_issues),
        "localization": group.localization,
        "blast_radius": [_service(service) for service in group.blast_radius],
        "urgency": group.urgency.value,
        "possibly_related": list(group.possibly_related),
        "root": events.ref(state.root),
        "last_activity": state.last_activity.isoformat(),
        "closed_at": _iso(state.closed_at),
        "members": [
            [
                _episode(key),
                {
                    "event": events.ref(member.event),
                    "ratio": member.ratio,
                    "escalated": member.escalated,
                    "closed_at": _iso(member.closed_at),
                    "footprint": _footprint(member.footprint),
                    "footprint_loaded": member.footprint_loaded,
                    "latent": member.latent,
                    "representative": _episode(member.representative)
                    if member.representative
                    else None,
                },
            ]
            for key, member in state.members.items()
        ],
    }


def _read_group(data: dict[str, Any], events: _EventReader) -> GroupState:
    return GroupState(
        group=AnomalyGroup(
            id=AnomalyGroupKey(data["id"]),
            opened_at=datetime.fromisoformat(data["opened_at"]),
            change_events=[events.ref(index) for index in data["change_events"]],
            driving_issues=list(data["driving_issues"]),
            localization=data["localization"],
            blast_radius=[_read_service(service) for service in data["blast_radius"]],
            urgency=Urgency(data["urgency"]),
            possibly_related=[AnomalyGroupKey(key) for key in data["possibly_related"]],
        ),
        root=events.ref(data["root"]),
        last_activity=datetime.fromisoformat(data["last_activity"]),
        closed_at=_time(data["closed_at"]),
        members={
            _read_episode(key): MemberState(
                event=events.ref(member["event"]),
                ratio=member["ratio"],
                escalated=member["escalated"],
                closed_at=_time(member["closed_at"]),
                footprint=_read_footprint(member["footprint"]),
                footprint_loaded=member["footprint_loaded"],
                latent=member["latent"],
                representative=(
                    _read_episode(member["representative"]) if member["representative"] else None
                ),
            )
            for key, member in data["members"]
        },
    )


def _correlation(state: CorrelationState, events: _EventWriter) -> dict[str, Any]:
    return {
        "open_groups": [_group(group, events) for group in state.open_groups.values()],
        "closed_groups": [_group(group, events) for group in state.closed_groups.values()],
        "latent": [[_episode(key), events.ref(event)] for key, event in state.latent.items()],
        "edges": [[_edge(edge), count] for edge, count in state.edges.items()],
        "edge_seen_at": [[_edge(edge), ts.isoformat()] for edge, ts in state.edge_seen_at.items()],
        "shared": {
            "learned_at": _iso(state.shared.learned_at),
            "pairs": [
                [
                    _dependency(pair.a),
                    _dependency(pair.b),
                    pair.co,
                    pair.n_a,
                    pair.n_b,
                    pair.expected,
                    pair.p,
                ]
                for pair in state.shared.pairs.values()
            ],
        },
    }


def _read_correlation(data: dict[str, Any], events: _EventReader) -> CorrelationState:
    shared = SharedDeps(learned_at=_time(data["shared"]["learned_at"]))
    for a, b, co, n_a, n_b, expected, p in data["shared"]["pairs"]:
        stats = PairStats(_read_dependency(a), _read_dependency(b), co, n_a, n_b, expected, p)
        shared.pairs[frozenset((stats.a, stats.b))] = stats
    return CorrelationState(
        open_groups=_read_groups(data["open_groups"], events),
        closed_groups=_read_groups(data["closed_groups"], events),
        latent={_read_episode(key): events.ref(index) for key, index in data["latent"]},
        edges=Counter({_read_edge(edge): count for edge, count in data["edges"]}),
        edge_seen_at={
            _read_edge(edge): datetime.fromisoformat(ts) for edge, ts in data["edge_seen_at"]
        },
        shared=shared,
    )


def _read_groups(
    data: list[dict[str, Any]], events: _EventReader
) -> dict[AnomalyGroupKey, GroupState]:
    return {state.group.id: state for state in (_read_group(group, events) for group in data)}
