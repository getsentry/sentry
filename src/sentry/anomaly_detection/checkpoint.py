"""Versioned JSON state for an organization evaluator, separate from issue delivery.

Only the fields below are persisted. There are no Python class names or callables in
this format. Ordered mappings use arrays of entries so JSON object key order does
not affect evaluation. Event references are indices into a snapshot-local table:
several subsystems update or observe the very same mutable ChangeEvent.
"""

from base64 import b64decode, b64encode
from collections import Counter, deque
from collections.abc import Sequence
from collections.abc import Set as AbstractSet
from datetime import datetime, timedelta
from math import isfinite
from struct import Struct, pack
from typing import Any

from sentry.anomaly_detection.changepoint import _CP
from sentry.anomaly_detection.contracts import (
    AnomalyGroup,
    ChangeEvent,
    ChangeType,
    SeriesKey,
    Urgency,
)
from sentry.anomaly_detection.correlate import (
    CorrelationState,
    Correlator,
    EpisodeKey,
    FootprintSource,
    GroupState,
    MemberState,
)
from sentry.anomaly_detection.detect import DISPERSION_MIN, RULES, CountTotals, DetectorState
from sentry.anomaly_detection.footprint import Footprint, SliceStats
from sentry.anomaly_detection.pipeline import AnomalyDecision, OrgEvaluator
from sentry.anomaly_detection.series import Series, SeriesRow
from sentry.anomaly_detection.shared import PairStats, SharedDeps

CHECKPOINT_VERSION = 2
_MINUTE = timedelta(minutes=1)
_FLOAT64 = Struct("<d")


def _iso(ts: datetime | None) -> str | None:
    return ts.isoformat() if ts is not None else None


def _time(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value is not None else None


def _key(key: SeriesKey) -> list[str]:
    return [key.project, key.env, key.signal, key.metric, key.dim_value]


def _episode(key: EpisodeKey) -> list[Any]:
    series_key, change_type, start = key
    return [_key(series_key), change_type.value, start.isoformat()]


def _read_episode(data: list[Any]) -> EpisodeKey:
    key, change_type, start = data
    return SeriesKey(*key), ChangeType(change_type), datetime.fromisoformat(start)


def _minute_values(points: Series, since: datetime) -> list[Any]:
    # Minutes are inserted chronologically. Store the first timestamp, then place the
    # floats in consecutive slots, using skip runs for gaps and offsets for explicit nulls.
    first = None
    previous = -1
    values: list[float] = []
    gaps: list[tuple[int, int]] = []
    nulls: list[int] = []
    for ts, value in points.items():
        if ts < since:
            continue
        if first is None:
            first = ts
        offset = (ts - first) // _MINUTE
        if offset > previous + 1:
            gaps.append((previous + 1, offset - previous - 1))
        if value is None:
            nulls.append(offset)
        else:
            values.append(value)
        previous = offset
    # Base64 float64s take about 5.27 MiB for 330 full 1569-minute series,
    # independent of their decimal precision, leaving space for checkpoint metadata.
    return [_iso(first), b64encode(pack(f"<{len(values)}d", *values)).decode("ascii"), gaps, nulls]


def _series(series: dict[SeriesKey, Series], since: datetime) -> list[Any]:
    # Preserve even empty keys: their existence can affect rule selection and rate derivation.
    return [[_key(key), _minute_values(points, since)] for key, points in series.items()]


def _read_series(data: list[Any]) -> dict[SeriesKey, Series]:
    series: dict[SeriesKey, Series] = {}
    for key, (first, packed, gaps, nulls) in data:
        points: Series = {}
        series[SeriesKey(*key)] = points
        if first is None:
            continue
        ts = datetime.fromisoformat(first)
        raw = b64decode(packed)
        values = _FLOAT64.iter_unpack(raw)
        skips, missing = dict(gaps), set(nulls)
        offset = 0
        for _ in range(len(raw) // _FLOAT64.size + len(missing)):
            if skip := skips.get(offset):
                ts += skip * _MINUTE
                offset += skip
            points[ts] = None if offset in missing else next(values)[0]
            ts += _MINUTE
            offset += 1
    return series


_NOVELTY_FIELDS = (
    "unusual",
    "size",
    "return_days",
    "similar",
    "history_days",
    "pooled_rate",
    "kind",
    "p_normal",
    "lasting_min",
    "harm",
    "vouched",
    "opened_on_escalation",
    "opened_on_duration",
)


def _novelty_data(novelty: dict[str, Any] | None) -> dict[str, Any] | None:
    if novelty is None:
        return None
    data = {}
    for key in _NOVELTY_FIELDS:
        if key in novelty:
            value = novelty[key]
            # JSON cannot represent infinity (e.g. a return period with zero mean rate).
            data[key] = str(value) if isinstance(value, float) and not isfinite(value) else value
    if "unusual_since" in novelty:
        data["unusual_since"] = _iso(novelty["unusual_since"])
    return data


def _read_novelty(data: dict[str, Any] | None) -> dict[str, Any] | None:
    if data is None:
        return None
    novelty = {}
    for key in _NOVELTY_FIELDS:
        if key in data:
            value = data[key]
            novelty[key] = (
                float(value)
                if key not in ("kind", "harm", "vouched")
                and isinstance(value, str)
                and value in ("inf", "-inf", "nan")
                else value
            )
    if "unusual_since" in data:
        novelty["unusual_since"] = _time(data["unusual_since"])
    return novelty


class _EventWriter:
    def __init__(self) -> None:
        self.records: list[dict[str, Any]] = []
        self._indices: dict[int, int] = {}

    def ref(self, event: ChangeEvent) -> int:
        identity = id(event)
        if identity in self._indices:
            return self._indices[identity]
        index = self._indices[identity] = len(self.records)
        self.records.append(
            {
                "key": _key(event.key),
                "change_type": event.change_type.value,
                "start": event.start.isoformat(),
                "actual": event.actual,
                "expected": event.expected,
                "confidence": event.confidence,
                "evidence": list(event.evidence),
                "detected_at": _iso(event.detected_at),
                "ended_at": _iso(event.ended_at),
                "peak_ratio": event.peak_ratio,
                "open_ratio": event.open_ratio,
                "novelty": _novelty_data(event.novelty),
                "escalations": [[ts.isoformat(), ratio] for ts, ratio in event.escalations],
                "recent_ratio": event.recent_ratio,
                "sustained_at": _iso(event.sustained_at),
            }
        )
        return index

    def optional(self, event: ChangeEvent | None) -> int | None:
        return self.ref(event) if event is not None else None


class _EventReader:
    def __init__(self, records: list[dict[str, Any]]) -> None:
        self._events = [
            ChangeEvent(
                key=SeriesKey(*data["key"]),
                change_type=ChangeType(data["change_type"]),
                start=datetime.fromisoformat(data["start"]),
                actual=data["actual"],
                expected=data["expected"],
                confidence=data["confidence"],
                evidence=list(data["evidence"]),
                detected_at=_time(data["detected_at"]),
                ended_at=_time(data["ended_at"]),
                peak_ratio=data["peak_ratio"],
                open_ratio=data["open_ratio"],
                novelty=_read_novelty(data["novelty"]),
                escalations=[
                    (datetime.fromisoformat(ts), ratio) for ts, ratio in data["escalations"]
                ],
                recent_ratio=data["recent_ratio"],
                sustained_at=_time(data["sustained_at"]),
            )
            for data in records
        ]

    def ref(self, index: int) -> ChangeEvent:
        if type(index) is not int or not 0 <= index < len(self._events):
            raise ValueError("Invalid anomaly checkpoint event reference")
        return self._events[index]

    def optional(self, index: int | None) -> ChangeEvent | None:
        return self.ref(index) if index is not None else None


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


def _detector(evaluator: OrgEvaluator, events: _EventWriter) -> dict[str, Any]:
    detector = evaluator.det
    return {
        "watched": [_key(key) for key in detector.watched],
        "exclude": [[_key(key), reason] for key, reason in detector.exclude.items()],
        # Pseudo-event floors are computed on the first observation in an hour, not
        # at the hour boundary. Recomputing a floor mid-hour would change sizing.
        "pseudo": [
            [_key(key), ts.isoformat(), floor] for (key, ts), floor in detector._pseudo.items()
        ],
        "state": [
            [
                _key(key),
                {
                    "recent": [[ts.isoformat(), flag, actual] for ts, flag, actual in state.recent],
                    "open": events.optional(state.open),
                    "anchor": _iso(state.anchor),
                    "anchor_level": state.anchor_level,
                    "anchor_sigma": state.anchor_sigma,
                    "anchor_points": state.anchor_points,
                    "excluded": [ts.isoformat() for ts in sorted(state.excluded)],
                    "score": state.score,
                    "level_ratio": state.level_ratio,
                    "worse_run": list(state.worse_run),
                    "counts": None
                    if state.counts is None
                    else [
                        [
                            _iso(point.ts),
                            point.events,
                            point.expected,
                            point.samples,
                            point.missing,
                            point.volume,
                            point.shaped_denominator,
                            point.level,
                        ]
                        for point in state.counts
                    ],
                    "window": state.window,
                    "closed_at": _iso(state.closed_at),
                    "recent_ratios": list(state.recent_ratios),
                },
            ]
            for key, state in detector.state.items()
        ],
    }


def _restore_detector(evaluator: OrgEvaluator, data: dict[str, Any], events: _EventReader) -> None:
    detector = evaluator.det
    watched = {}
    for fields in data["watched"]:
        key = SeriesKey(*fields)
        rule = next(
            (
                rule
                for rule in RULES
                if (rule.signal, rule.metric, rule.slices)
                == (key.signal, key.metric, bool(key.dim_value))
            ),
            None,
        )
        if rule is None:
            raise ValueError("Invalid anomaly checkpoint detector rule")
        watched[key] = rule
    detector.watched = watched
    detector.exclude = {SeriesKey(*key): reason for key, reason in data["exclude"]}
    detector._pseudo = {
        (SeriesKey(*key), datetime.fromisoformat(ts)): floor for key, ts, floor in data["pseudo"]
    }
    for key, state in data["state"]:
        counts = state["counts"]
        series_key = SeriesKey(*key)
        detector.state[series_key] = DetectorState(
            recent=deque(
                (
                    (datetime.fromisoformat(ts), flag, actual)
                    for ts, flag, actual in state["recent"]
                ),
                maxlen=watched[series_key].persist[1],
            ),
            open=events.optional(state["open"]),
            anchor=_time(state["anchor"]),
            anchor_level=state["anchor_level"],
            anchor_sigma=state["anchor_sigma"],
            anchor_points=state["anchor_points"],
            excluded={datetime.fromisoformat(ts) for ts in state["excluded"]},
            score=state["score"],
            level_ratio=state["level_ratio"],
            worse_run=list(state["worse_run"]),
            counts=None
            if counts is None
            else deque(
                (
                    CountTotals(_time(ts), n, expected, samples, missing, vol, den, level)
                    for ts, n, expected, samples, missing, vol, den, level in counts
                ),
                maxlen=max(detector.cfg.windows) + DISPERSION_MIN + 1,
            ),
            window=state["window"],
            closed_at=_time(state["closed_at"]),
            recent_ratios=deque(state["recent_ratios"], maxlen=30),
        )


def _change_points(evaluator: OrgEvaluator, events: _EventWriter) -> dict[str, Any]:
    cp = evaluator.cp
    return {
        "watched": [_key(key) for key in cp.watched],
        "exclude": [[_key(key), reason] for key, reason in cp.exclude.items()],
        "state": [
            [
                _key(key),
                state.hits,
                events.optional(state.open),
                state.level_before,
                _iso(state.hold_until),
            ]
            for key, state in cp.state.items()
        ],
        "spike_minutes": [
            [_key(key), [ts.isoformat() for ts in sorted(times)]]
            for key, times in cp.spike_minutes.items()
        ],
        "spike_seen": [[_key(key), ts.isoformat()] for key, ts in cp._spike_seen.items()],
    }


def _restore_change_points(
    evaluator: OrgEvaluator, data: dict[str, Any], events: _EventReader
) -> None:
    cp = evaluator.cp
    cp.watched = [SeriesKey(*key) for key in data["watched"]]
    cp.exclude = {SeriesKey(*key): reason for key, reason in data["exclude"]}
    cp.state = {
        SeriesKey(*key): _CP(hits, events.optional(index), level_before, _time(hold_until))
        for key, hits, index, level_before, hold_until in data["state"]
    }
    cp.spike_minutes = {
        SeriesKey(*key): {datetime.fromisoformat(ts) for ts in times}
        for key, times in data["spike_minutes"]
    }
    cp._spike_seen = {SeriesKey(*key): datetime.fromisoformat(ts) for key, ts in data["spike_seen"]}


def _decision(decision: AnomalyDecision) -> dict[str, Any]:
    return {
        "group_key": decision.group_key,
        "project_id": decision.project_id,
        "timestamp": decision.timestamp.isoformat(),
        "urgency": decision.urgency.value,
        "is_resolved": decision.is_resolved,
        "title": decision.title,
        "evidence": dict(decision.evidence),  # Already public JSON data, not evaluator objects.
        "env": decision.env,
    }


def _read_decision(data: dict[str, Any]) -> AnomalyDecision:
    return AnomalyDecision(
        group_key=data["group_key"],
        project_id=data["project_id"],
        timestamp=datetime.fromisoformat(data["timestamp"]),
        urgency=Urgency(data["urgency"]),
        is_resolved=data["is_resolved"],
        title=data["title"],
        evidence=dict(data["evidence"]),
        env=data["env"],
    )


def _snapshot(evaluator: OrgEvaluator, end: datetime) -> dict[str, Any]:
    events = _EventWriter()
    baseline_cfg = evaluator.baseline.cfg
    # Include the 60m baseline plus its reach-back for excluded minutes. A new
    # episode refits at its first persistence hit, up to one rule window earlier.
    # Already-open episodes carry their frozen reference level and sigma.
    cursor = evaluator.next_minute or end
    anchor_lookback = max(rule.persist[1] for rule in RULES) - 1
    since = cursor - timedelta(
        minutes=baseline_cfg.window_min + baseline_cfg.reach_back_min + anchor_lookback
    )
    novelty = evaluator.novelty
    novelty.prune(cursor)
    return {
        "version": CHECKPOINT_VERSION,
        "next_minute": _iso(evaluator.next_minute),
        "series": _series(evaluator.series, since),
        "detector": _detector(evaluator, events),
        "change_points": _change_points(evaluator, events),
        "correlation": _correlation(evaluator.corr.state, events),
        "novelty": {
            "first_seen": [[_key(key), ts.isoformat()] for key, ts in novelty.first_seen.items()],
            "history": [
                [events.ref(record.event) for record in records]
                for records in novelty.history.values()
            ],
        },
        "qualified": [_decision(decision) for decision in evaluator.qualified.values()],
        "absorbed": [
            [_episode(key), events.ref(event)] for key, event in evaluator.absorbed.items()
        ],
        "next_look": [[_episode(key), minute] for key, minute in evaluator.next_look.items()],
        "harm": [
            [list(service), [events.ref(event) for event in changes]]
            for service, changes in evaluator.harm.items()
        ],
        "pending_issues": [events.ref(event) for event in evaluator.pending_issues],
        "known_issues": [events.ref(event) for event in evaluator.known_issues],
        "point_closes": [
            [ts.isoformat(), events.ref(event)] for ts, event in evaluator.point_closes
        ],
        "events": events.records,
    }


def _require_version(data: dict[str, Any]) -> None:
    version = data.get("version")
    if type(version) is not int or version != CHECKPOINT_VERSION:
        raise ValueError("Unsupported anomaly checkpoint version")


def retained_group_keys(checkpoint: dict[str, Any]) -> set[str]:
    """Return qualified groups still retained for recovery or continuation."""
    _require_version(checkpoint)
    return {decision["group_key"] for decision in checkpoint["qualified"]}


def _restore(footprints: FootprintSource, data: dict[str, Any]) -> OrgEvaluator:
    _require_version(data)
    evaluator = OrgEvaluator(footprints)
    events = _EventReader(data["events"])
    # The evaluator, detector, change-point detector, and correlator all share series.
    evaluator.series.update(_read_series(data["series"]))
    evaluator.next_minute = _time(data["next_minute"])
    _restore_detector(evaluator, data["detector"], events)
    _restore_change_points(evaluator, data["change_points"], events)
    evaluator.corr = Correlator(
        footprints,
        evaluator.corr.cfg,
        series=evaluator.series,
        state=_read_correlation(data["correlation"], events),
    )
    for key, ts in data["novelty"]["first_seen"]:
        evaluator.novelty.observe(SeriesKey(*key), datetime.fromisoformat(ts))
    for records in data["novelty"]["history"]:
        for index in records:
            evaluator.novelty.record(events.ref(index))
    evaluator.qualified = {
        decision["group_key"]: _read_decision(decision) for decision in data["qualified"]
    }
    evaluator.absorbed = {_read_episode(key): events.ref(index) for key, index in data["absorbed"]}
    evaluator.next_look = {_read_episode(key): minute for key, minute in data["next_look"]}
    evaluator.harm = {
        (project, env): [events.ref(index) for index in changes]
        for (project, env), changes in data["harm"]
    }
    evaluator.pending_issues = [events.ref(index) for index in data["pending_issues"]]
    evaluator.known_issues = [events.ref(index) for index in data["known_issues"]]
    evaluator.point_closes = [
        (datetime.fromisoformat(ts), events.ref(index)) for ts, index in data["point_closes"]
    ]
    return evaluator


def _reconcile_correlation(evaluator: OrgEvaluator, projects: AbstractSet[str]) -> None:
    corr = evaluator.corr
    state = corr.state

    def service_in_scope(service: str) -> bool:
        return service.partition("/")[0] in projects

    retired = set()
    for groups in (state.open_groups, state.closed_groups):
        for group_id, group in list(groups.items()):
            if group.root.key.project not in projects or any(
                key[0].project not in projects for key in group.members
            ):
                retired.add(group_id)
                del groups[group_id]
                for key, member in group.members.items():
                    if corr.by_event.get(key) is not group:
                        continue
                    del corr.by_event[key]
                    # Keep ongoing changes as support only. Reopening one as a
                    # standalone finding could recreate the retired group's ID.
                    if (
                        group.closed_at is None
                        and member.closed_at is None
                        and member.event.ended_at is None
                        and member.event.change_type != ChangeType.NEW_FAILURE_MODE
                        and key[0].project in projects
                    ):
                        state.latent[key] = member.event
            else:
                for member in group.members.values():
                    if (footprint := member.footprint) is not None:
                        for slice_key in list(footprint.slices):
                            if slice_key[0] not in projects:
                                del footprint.slices[slice_key]
                        for edge in list(footprint.edges):
                            if not service_in_scope(edge[0]) or not service_in_scope(edge[2]):
                                del footprint.edges[edge]

    for group in corr.groups:
        group.group.possibly_related[:] = [
            key for key in group.group.possibly_related if key not in retired
        ]
    for group_id, decision in list(evaluator.qualified.items()):
        if group_id in retired or str(decision.project_id) not in projects:
            del evaluator.qualified[group_id]
    for edges in (state.edges, state.edge_seen_at):
        for edge in list(edges):
            if not service_in_scope(edge[0]) or not service_in_scope(edge[2]):
                del edges[edge]
    for pair_key, pair in list(state.shared.pairs.items()):
        if not service_in_scope(pair.a[0]) or not service_in_scope(pair.b[0]):
            del state.shared.pairs[pair_key]


def _reconcile_projects(evaluator: OrgEvaluator, projects: AbstractSet[str]) -> None:
    detector, cp, novelty = evaluator.det, evaluator.cp, evaluator.novelty
    for mapping in (
        evaluator.series,
        detector.watched,
        detector.state,
        cp.exclude,
        cp.state,
        cp.spike_minutes,
        cp._spike_seen,
        novelty.first_seen,
        novelty.history,
    ):
        for key in list(mapping):
            if key.project not in projects:
                del mapping[key]
    cp.watched[:] = [key for key in cp.watched if key.project in projects]
    detector.exclude = {
        key: reason for key, reason in detector.exclude.items() if key.project in projects
    }
    for kind, keys in list(novelty.kinds.items()):
        keys.intersection_update(novelty.first_seen)
        if not keys:
            del novelty.kinds[kind]
    for key, hour in list(detector._pseudo):
        if key.project not in projects:
            del detector._pseudo[key, hour]

    _reconcile_correlation(evaluator, projects)
    for episodes in (evaluator.absorbed, evaluator.next_look, evaluator.corr.state.latent):
        for episode in list(episodes):
            if episode[0].project not in projects:
                del episodes[episode]
    for service in list(evaluator.harm):
        if service[0] not in projects:
            del evaluator.harm[service]
    evaluator.pending_issues[:] = [e for e in evaluator.pending_issues if e.key.project in projects]
    evaluator.known_issues[:] = [e for e in evaluator.known_issues if e.key.project in projects]
    evaluator.point_closes[:] = [
        (ts, e) for ts, e in evaluator.point_closes if e.key.project in projects
    ]


def advance_org(
    *,
    rows: Sequence[SeriesRow],
    hourly_rows: Sequence[SeriesRow],
    start: datetime,
    end: datetime,
    footprints: FootprintSource,
    new_issues: Sequence[ChangeEvent] = (),
    checkpoint: dict[str, Any] | None = None,
    current_projects: AbstractSet[str] | None = None,
) -> tuple[Sequence[AnomalyDecision], dict[str, Any]]:
    """Advance one organization; pass the full seasonal support in hourly_rows each time.

    Minute support is carried across calls; hourly aggregates are loaded by the
    caller each time. The checkpoint does not acknowledge any emitted decision.
    When supplied, current_projects is the authoritative set of enabled project IDs.
    Pass a footprint source scoped to this set. Invalidation retires intersecting
    groups without emitting a decision; delivery can drop their keys from retention.
    """
    evaluator = OrgEvaluator(footprints) if checkpoint is None else _restore(footprints, checkpoint)
    if current_projects is not None:
        if checkpoint is not None:
            _reconcile_projects(evaluator, current_projects)
        rows = [row for row in rows if row[3] in current_projects]
        hourly_rows = [row for row in hourly_rows if row[3] in current_projects]
        new_issues = [event for event in new_issues if event.key.project in current_projects]
    decisions = evaluator.advance(
        rows=rows,
        hourly_rows=hourly_rows,
        start=start,
        end=end,
        new_issues=new_issues,
    )
    return decisions, _snapshot(evaluator, end)
