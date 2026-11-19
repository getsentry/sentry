"""Checkpoint encoding for correlated groups and their footprints."""

from collections import Counter
from datetime import datetime
from typing import Any

from sentry.anomaly_detection.checkpoint.event_codec import (
    _EventReader,
    _EventWriter,
    _iso,
    _key,
    _time,
)
from sentry.anomaly_detection.contracts import AnomalyGroup, ChangeType, SeriesKey, Urgency
from sentry.anomaly_detection.correlation.correlator import (
    CorrelationState,
    EpisodeKey,
    GroupState,
    MemberState,
)
from sentry.anomaly_detection.correlation.footprint import Footprint, SliceStats
from sentry.anomaly_detection.correlation.shared_dependencies import PairStats, SharedDeps


def _episode(key: EpisodeKey) -> list[Any]:
    series_key, change_type, start = key
    return [_key(series_key), change_type.value, start.isoformat()]


def _read_episode(data: list[Any]) -> EpisodeKey:
    key, change_type, start = data
    return SeriesKey(*key), ChangeType(change_type), datetime.fromisoformat(start)


def _footprint(footprint: Footprint | None) -> dict[str, Any] | None:
    if footprint is None:
        return None
    return {
        "event": _key(footprint.event),
        "traces": list(footprint.traces),
        "slices": [
            [list(key), stats.trace_share, stats.p95_ms, stats.spans]
            for key, stats in footprint.slices.items()
        ],
        "edges": [[list(key), count] for key, count in footprint.edges.items()],
        "via": footprint.via,
        "window": [ts.isoformat() for ts in footprint.window] if footprint.window else None,
    }


def _read_footprint(data: dict[str, Any] | None) -> Footprint | None:
    if data is None:
        return None
    window = data["window"]
    return Footprint(
        event=SeriesKey(*data["event"]),
        traces=list(data["traces"]),
        slices={
            (project, env, signal, dim): SliceStats(share, p95, spans)
            for (project, env, signal, dim), share, p95, spans in data["slices"]
        },
        edges=Counter({(src, domain, dst): count for (src, domain, dst), count in data["edges"]}),
        via=data["via"],
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
        "nearby_changes": [list(change) for change in group.nearby_changes],
        "localization": group.localization,
        "blast_radius": list(group.blast_radius),
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
            id=data["id"],
            opened_at=datetime.fromisoformat(data["opened_at"]),
            change_events=[events.ref(index) for index in data["change_events"]],
            driving_issues=list(data["driving_issues"]),
            nearby_changes=[(label, score) for label, score in data["nearby_changes"]],
            localization=data["localization"],
            blast_radius=list(data["blast_radius"]),
            urgency=Urgency(data["urgency"]),
            possibly_related=list(data["possibly_related"]),
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
        "edges": [[list(edge), count] for edge, count in state.edges.items()],
        "edge_seen_at": [[list(edge), ts.isoformat()] for edge, ts in state.edge_seen_at.items()],
        "shared": {
            "learned_at": _iso(state.shared.learned_at),
            "pairs": [
                [list(pair.a), list(pair.b), pair.co, pair.n_a, pair.n_b, pair.expected, pair.p]
                for pair in state.shared.pairs.values()
            ],
        },
    }


def _read_correlation(data: dict[str, Any], events: _EventReader) -> CorrelationState:
    shared = SharedDeps(learned_at=_time(data["shared"]["learned_at"]))
    for (sa, siga, da), (sb, sigb, db), co, n_a, n_b, expected, p in data["shared"]["pairs"]:
        stats = PairStats((sa, siga, da), (sb, sigb, db), co, n_a, n_b, expected, p)
        shared.pairs[frozenset((stats.a, stats.b))] = stats
    return CorrelationState(
        open_groups={group["id"]: _read_group(group, events) for group in data["open_groups"]},
        closed_groups={group["id"]: _read_group(group, events) for group in data["closed_groups"]},
        latent={_read_episode(key): events.ref(index) for key, index in data["latent"]},
        edges=Counter({(src, domain, dst): count for (src, domain, dst), count in data["edges"]}),
        edge_seen_at={
            (src, domain, dst): datetime.fromisoformat(ts)
            for (src, domain, dst), ts in data["edge_seen_at"]
        },
        shared=shared,
    )
