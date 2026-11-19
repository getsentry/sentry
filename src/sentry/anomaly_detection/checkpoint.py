"""Versioned JSON state for an organization evaluator, separate from issue delivery.

Only the fields below are persisted. There are no Python class names or callables in
this format. Ordered mappings use arrays of entries so JSON object key order does
not affect evaluation. Event references are indices into a snapshot-local table:
several subsystems update or observe the very same mutable ChangeEvent.
"""

from base64 import b64decode, b64encode
from collections import Counter, defaultdict, deque
from collections.abc import Mapping, Sequence
from collections.abc import Set as AbstractSet
from dataclasses import replace
from datetime import datetime, timedelta
from math import isfinite
from struct import Struct, pack
from typing import Any
from zlib import compress, decompress

from sentry.anomaly_detection.changepoint import _CP
from sentry.anomaly_detection.collection import MAX_ENVIRONMENTS, MAX_SLICES
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
    episode_key,
)
from sentry.anomaly_detection.detect import DISPERSION_MIN, RULES, CountTotals, SeriesState
from sentry.anomaly_detection.footprint import Footprint, SliceStats
from sentry.anomaly_detection.grouptype import AnomalyDetectionDetectorHandler
from sentry.anomaly_detection.pipeline import _CONTEXT_HORIZON, AnomalyDecision, OrgEvaluator
from sentry.anomaly_detection.series import Series, SeriesRow
from sentry.anomaly_detection.shared import PairStats, SharedDeps

CHECKPOINT_VERSION = 3
_MINUTE = timedelta(minutes=1)
_HOUR = timedelta(hours=1)
_FLOAT64 = Struct("<d")
_SLOT = Struct("<H")
_NULL_SLOT = 1 << 15
_COVERAGE_SLOT = Struct("<HQ")
# Preserve the current and one previous full collector cohort per project/signal.
# Cardinality is bounded even when every poll selects different dimensions;
# history size depends on the retained minute window, not on compression ratios.
_RETAINED_SLICE_GROUPS = 2 * MAX_ENVIRONMENTS * MAX_SLICES
# Errors and spans discover environments independently.
_RETAINED_ENVIRONMENTS = 2 * 2 * MAX_ENVIRONMENTS
# Keep more cohorts for learning than for the minute-level detector. The recent
# excursion cap is well above the recurrence rates the novelty model distinguishes.
_NOVELTY_COHORTS = 4
_NOVELTY_RECORDS_PER_SERIES = 64


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


def _minute_values(points: Series, since: datetime, cursor: datetime) -> list[Any]:
    # Dense series use 8 bytes per minute before optional compression. Sparse
    # series use a 2-byte minute offset per observed slot (high bit = explicit
    # null). Omitted minutes need no space, even with rapidly changing top slices.
    observed = [(ts, value) for ts, value in points.items() if since <= ts < cursor]
    if not observed:
        return []
    first, last = observed[0][0], observed[-1][0]
    dense = (last - first) // _MINUTE + 1 == len(observed) and all(
        value is not None for _, value in observed
    )
    if dense:
        raw = pack(f"<{len(observed)}d", *(value for _, value in observed))
    else:
        sparse = bytearray()
        for ts, value in observed:
            offset = (ts - first) // _MINUTE
            sparse += _SLOT.pack(offset if value is not None else offset | _NULL_SLOT)
            if value is not None:
                sparse += _FLOAT64.pack(value)
        raw = bytes(sparse)
    packed = compress(raw, level=1)
    compressed = len(packed) < len(raw)
    return [
        _iso(first),
        dense,
        compressed,
        b64encode(packed if compressed else raw).decode("ascii"),
    ]


def _series(series: dict[SeriesKey, Series], since: datetime, cursor: datetime) -> list[Any]:
    return [[_key(key), _minute_values(points, since, cursor)] for key, points in series.items()]


def _read_series(data: list[Any]) -> dict[SeriesKey, Series]:
    series: dict[SeriesKey, Series] = {}
    # Reuse timestamp instances across series instead of allocating a datetime
    # for every measurement on restore.
    minutes: dict[datetime, datetime] = {}
    for key, history in data:
        points: Series = {}
        series[SeriesKey(*key)] = points
        if not history:
            continue
        first, dense, compressed, packed = history
        start = datetime.fromisoformat(first)
        raw = b64decode(packed)
        if compressed:
            raw = decompress(raw)
        if dense:
            for offset, (value,) in enumerate(_FLOAT64.iter_unpack(raw)):
                ts = start + offset * _MINUTE
                points[minutes.setdefault(ts, ts)] = value
        else:
            index = 0
            while index < len(raw):
                (slot,) = _SLOT.unpack_from(raw, index)
                index += _SLOT.size
                ts = start + (slot & (_NULL_SLOT - 1)) * _MINUTE
                value = None
                if not slot & _NULL_SLOT:
                    (value,) = _FLOAT64.unpack_from(raw, index)
                    index += _FLOAT64.size
                points[minutes.setdefault(ts, ts)] = value
    return series


def _coverage(hours: dict[datetime, int]) -> list[Any]:
    first = min(hours)
    packed = b"".join(
        _COVERAGE_SLOT.pack((hour - first) // _HOUR, mask) for hour, mask in hours.items()
    )
    return [first.isoformat(), b64encode(packed).decode("ascii")]


def _read_coverage(first: str, packed: str) -> dict[datetime, int]:
    start = datetime.fromisoformat(first)
    return {
        start + offset * _HOUR: mask
        for offset, mask in _COVERAGE_SLOT.iter_unpack(b64decode(packed))
    }


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
                "issue_ids": list(event.issue_ids),
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
                issue_ids=tuple(data["issue_ids"]),
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
                    "failure_reference": state.failure_reference,
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
        detector.state[series_key] = SeriesState(
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
            failure_reference=tuple(state["failure_reference"])
            if state["failure_reference"] is not None
            else None,
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


def _history_floor(evaluator: OrgEvaluator, cursor: datetime) -> datetime:
    baseline_cfg = evaluator.baseline.cfg
    # Include the 60m baseline plus its reach-back for excluded minutes. A new
    # episode refits at its first persistence hit, up to one rule window earlier.
    # Already-open episodes carry their frozen reference level and sigma.
    anchor_lookback = max(rule.persist[1] for rule in RULES) - 1
    return cursor - timedelta(
        minutes=baseline_cfg.window_min + baseline_cfg.reach_back_min + anchor_lookback
    )


def _prune_group_members(corr: Correlator, cursor: datetime) -> None:
    # A continuous group can contain arbitrarily many completed episodes. Keep
    # its root, ongoing members and the same recent context used for late issues.
    floor = cursor - _CONTEXT_HORIZON
    for group in corr.groups:
        root_key = episode_key(group.root)
        expired = {
            key
            for key, member in group.members.items()
            if key != root_key and member.closed_at is not None and member.closed_at < floor
        }
        if not expired:
            continue

        # Retained members must not point to a representative that no longer
        # exists. Preserve the alias classes even if the old parent is expired.
        aliases: dict[EpisodeKey, list[EpisodeKey]] = defaultdict(list)
        for key, member in group.members.items():
            if key not in expired:
                aliases[corr._representative(group, member)].append(key)
        for members in aliases.values():
            representative = min(members)
            for key in members:
                group.members[key].representative = (
                    None if key == representative else representative
                )

        for key in expired:
            del group.members[key]
            if corr.by_event.get(key) is group:
                del corr.by_event[key]
        group.group.change_events[:] = [
            event for event in group.group.change_events if episode_key(event) not in expired
        ]


def _prune_novelty(evaluator: OrgEvaluator, cursor: datetime) -> None:
    novelty = evaluator.novelty
    novelty.prune(cursor)
    cohorts: dict[tuple[str, str, str, bool], list[tuple[datetime, SeriesKey]]] = defaultdict(list)
    for key in novelty.coverage.keys() | novelty.history.keys():
        hours = novelty.coverage.get(key, {})
        latest_observation = datetime.min
        if hours:
            latest_hour = max(hours)
            latest_observation = latest_hour + (hours[latest_hour].bit_length() - 1) * _MINUTE
        latest_excursion = max(
            (record.start for record in novelty.history.get(key, ())), default=datetime.min
        )
        cohorts[key.project, key.signal, key.metric, bool(key.dim_value)].append(
            (max(latest_observation, latest_excursion), key)
        )
    retained = evaluator.det.watched.keys() | evaluator.cp.state.keys()
    for (_, _, _, sliced), candidates in cohorts.items():
        limit = _NOVELTY_COHORTS * MAX_ENVIRONMENTS * (MAX_SLICES if sliced else 2)
        retained.update(key for _, key in sorted(candidates, reverse=True)[:limit])
    for key in novelty.coverage.keys() - retained:
        del novelty.coverage[key]
    for key in novelty.history.keys() - retained:
        del novelty.history[key]
    for records in novelty.history.values():
        if len(records) > _NOVELTY_RECORDS_PER_SERIES:
            del records[:-_NOVELTY_RECORDS_PER_SERIES]


def _snapshot(evaluator: OrgEvaluator, end: datetime) -> dict[str, Any]:
    events = _EventWriter()
    cursor = evaluator.next_minute or end
    _prune_group_members(evaluator.corr, cursor)
    _prune_novelty(evaluator, cursor)
    novelty = evaluator.novelty
    return {
        "version": CHECKPOINT_VERSION,
        "next_minute": _iso(evaluator.next_minute),
        "series": _series(evaluator.series, _history_floor(evaluator, cursor), cursor),
        "detector": _detector(evaluator, events),
        "change_points": _change_points(evaluator, events),
        "correlation": _correlation(evaluator.corr.state, events),
        "novelty": {
            "coverage": [[_key(key), _coverage(hours)] for key, hours in novelty.coverage.items()],
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


def _restore(
    footprints: FootprintSource,
    data: dict[str, Any],
    *,
    handlers: Mapping[str, AnomalyDetectionDetectorHandler],
) -> OrgEvaluator:
    _require_version(data)
    evaluator = OrgEvaluator(footprints, handlers=handlers)
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
    evaluator.novelty.coverage = {
        SeriesKey(*key): _read_coverage(first, packed)
        for key, (first, packed) in data["novelty"]["coverage"]
    }
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


def _reconcile_correlation(
    evaluator: OrgEvaluator, projects: AbstractSet[str], boundary: datetime
) -> list[AnomalyDecision]:
    corr = evaluator.corr
    state = corr.state

    def service_in_scope(service: str) -> bool:
        return service.partition("/")[0] in projects

    retired = set()
    discarded_open = set()
    for groups in (state.open_groups, state.closed_groups):
        for group_id, group in list(groups.items()):
            previous = evaluator.qualified.get(group_id)
            if (
                (previous is not None and str(previous.project_id) not in projects)
                or group.root.key.project not in projects
                or any(key[0].project not in projects for key in group.members)
            ):
                retired.add(group_id)
                if group.closed_at is None:
                    discarded_open.add(group_id)
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
                        evaluator.absorbed.pop(key, None)
                        evaluator.next_look.pop(key, None)
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
    closes = []
    for group_id, decision in list(evaluator.qualified.items()):
        owner_enabled = str(decision.project_id) in projects
        if group_id in discarded_open and owner_enabled and not decision.is_resolved:
            # The current root may differ from the published owner. Close the
            # original lifecycle at the scope boundary, never migrate it.
            closes.append(replace(decision, timestamp=boundary, is_resolved=True))
        if group_id in retired or not owner_enabled:
            del evaluator.qualified[group_id]
    for edges in (state.edges, state.edge_seen_at):
        for edge in list(edges):
            if not service_in_scope(edge[0]) or not service_in_scope(edge[2]):
                del edges[edge]
    for pair_key, pair in list(state.shared.pairs.items()):
        if not service_in_scope(pair.a[0]) or not service_in_scope(pair.b[0]):
            del state.shared.pairs[pair_key]
    return closes


def _reconcile_projects(
    evaluator: OrgEvaluator, projects: AbstractSet[str], boundary: datetime
) -> list[AnomalyDecision]:
    detector, cp, novelty = evaluator.det, evaluator.cp, evaluator.novelty
    for mapping in (
        evaluator.series,
        detector.watched,
        detector.state,
        cp.exclude,
        cp.state,
        cp.spike_minutes,
        cp._spike_seen,
        novelty.coverage,
        novelty.history,
    ):
        for key in list(mapping):
            if key.project not in projects:
                del mapping[key]
    cp.watched[:] = [key for key in cp.watched if key.project in projects]
    detector.exclude = {
        key: reason for key, reason in detector.exclude.items() if key.project in projects
    }
    for key, hour in list(detector._pseudo):
        if key.project not in projects:
            del detector._pseudo[key, hour]

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
    return _reconcile_correlation(evaluator, projects, boundary)


def _evict_stale_series(
    evaluator: OrgEvaluator, cursor: datetime, at: datetime
) -> list[AnomalyDecision]:
    floor = _history_floor(evaluator, cursor)
    slices: dict[tuple[str, str], dict[tuple[str, str], datetime]] = defaultdict(dict)
    environments: dict[str, dict[str, datetime]] = defaultdict(dict)
    last_seen = {
        key: next(reversed(points), datetime.min) for key, points in evaluator.series.items()
    }
    for key, seen in last_seen.items():
        if key.dim_value:
            if seen >= floor:
                group = key.env, key.dim_value
                members = slices[key.project, key.signal]
                members[group] = max(seen, members.get(group, seen))
        else:
            envs = environments[key.project]
            envs[key.env] = max(seen, envs.get(key.env, seen))

    # Rank scope groups, not metric keys, so a latency/share never loses its
    # sample-count companion under churn. Ties do not depend on collection order.
    kept_slices = {
        scope: set(
            sorted(groups, key=lambda group: (groups[group], group), reverse=True)[
                :_RETAINED_SLICE_GROUPS
            ]
        )
        for scope, groups in slices.items()
    }
    kept_envs = {
        project: set(
            sorted(envs, key=lambda env: (envs[env], env), reverse=True)[:_RETAINED_ENVIRONMENTS]
        )
        for project, envs in environments.items()
    }
    evicted: set[SeriesKey] = set()
    for key, seen in last_seen.items():
        if key.dim_value:
            if seen < floor or (key.env, key.dim_value) not in kept_slices[key.project, key.signal]:
                evicted.add(key)
        elif key.env not in kept_envs[key.project]:
            # Empty aggregate keys preserve the presence of request instrumentation
            # for this environment, but environments themselves are bounded.
            evicted.add(key)
    if not evicted:
        return []

    det, cp = evaluator.det, evaluator.cp
    expirations: list[tuple[str, ChangeEvent]] = []
    maps = (
        evaluator.series,
        det.watched,
        det.state,
        cp.exclude,
        cp.state,
        cp.spike_minutes,
        cp._spike_seen,
    )
    for key in sorted(evicted):
        for states in (det.state, cp.state):
            if (state := states.get(key)) is not None and (event := state.open) is not None:
                event.ended_at = at
                event.evidence.append("expired: measurements no longer collected")
                expirations.append(("expire", event))
        for mapping in maps:
            mapping.pop(key, None)
    cp.watched[:] = [key for key in cp.watched if key not in evicted]
    det.exclude = {key: reason for key, reason in det.exclude.items() if key not in evicted}
    for pseudo_key in list(det._pseudo):
        if pseudo_key[0] in evicted:
            del det._pseudo[pseudo_key]

    # Retain novelty and existing correlation context on their own horizons.
    # Unlike a recovery, expiration does not imply an observed return to normal.
    if expirations:
        return evaluator._decisions(evaluator.corr.step(at, evaluator._judge(at, expirations)))
    return []


def advance_org(
    *,
    rows: Sequence[SeriesRow],
    hourly_rows: Sequence[SeriesRow],
    start: datetime,
    end: datetime,
    footprints: FootprintSource,
    handlers: Mapping[str, AnomalyDetectionDetectorHandler],
    new_issues: Sequence[ChangeEvent] = (),
    checkpoint: dict[str, Any] | None = None,
) -> tuple[Sequence[AnomalyDecision], dict[str, Any]]:
    """Advance one organization; pass the full seasonal support in hourly_rows each time.

    Minute support is carried across calls; hourly aggregates are loaded by the
    caller each time. The checkpoint does not acknowledge any emitted decision.
    The handler map defines the enabled projects. Pass a footprint source scoped to
    these projects. Invalidation retires intersecting groups, closing previously
    qualified opens only if their original owner remains enabled.
    """
    evaluator = (
        OrgEvaluator(footprints, handlers=handlers)
        if checkpoint is None
        else _restore(footprints, checkpoint, handlers=handlers)
    )
    if start >= end:
        return [], _snapshot(evaluator, end)
    scope_closes = (
        _reconcile_projects(evaluator, handlers.keys(), start) if checkpoint is not None else []
    )
    decisions = evaluator.advance(
        rows=rows,
        hourly_rows=hourly_rows,
        start=start,
        end=end,
        new_issues=new_issues,
    )
    cursor = evaluator.next_minute or end
    stale_closes = _evict_stale_series(evaluator, cursor, max(start, cursor - _MINUTE))
    return [*scope_closes, *decisions, *stale_closes], _snapshot(evaluator, end)
