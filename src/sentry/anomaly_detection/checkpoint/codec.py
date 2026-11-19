"""Versioned JSON state for an organization evaluator.

Only the fields below are persisted. There are no Python class names or callables in
this format. Ordered mappings use arrays of entries so JSON object key order does
not affect evaluation. Event references are indices into a snapshot-local table:
several subsystems update or observe the very same mutable ChangeEvent.
"""

from collections.abc import Iterable
from datetime import datetime
from typing import Any

from sentry.anomaly_detection.checkpoint.correlation_codec import (
    _correlation,
    _episode,
    _read_correlation,
    _read_episode,
)
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
from sentry.anomaly_detection.checkpoint.retention import _history_floor, _prune_for_snapshot
from sentry.anomaly_detection.checkpoint.series_codec import (
    _change_points,
    _coverage,
    _detector,
    _read_coverage,
    _read_series,
    _restore_change_points,
    _restore_detector,
    _series,
)
from sentry.anomaly_detection.contracts import AnomalyGroupKey, ChangeType, Signal, Urgency
from sentry.anomaly_detection.correlation.correlator import Correlator, FootprintSource
from sentry.anomaly_detection.evaluation.organization import (
    AnomalyDecision,
    AnomalyEvidence,
    OrgEvaluator,
)
from sentry.anomaly_detection.evaluation.series import Series

# Version 4: integer project IDs and typed services, slices and call edges.
CHECKPOINT_VERSION = 4


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


def _read_evidence(data: dict[str, Any]) -> AnomalyEvidence:
    signal = data["signal"]
    evidence = AnomalyEvidence(
        signal=Signal(signal) if signal != "other" else "other",
        change_type=ChangeType(data["change_type"]),
        started_at=data["started_at"],
    )
    if "actual" in data:
        evidence["actual"] = data["actual"]
    if "expected" in data:
        evidence["expected"] = data["expected"]
    if "confidence" in data:
        evidence["confidence"] = data["confidence"]
    return evidence


def _read_decision(data: dict[str, Any]) -> AnomalyDecision:
    return AnomalyDecision(
        group_key=AnomalyGroupKey(data["group_key"]),
        project_id=data["project_id"],
        timestamp=datetime.fromisoformat(data["timestamp"]),
        urgency=Urgency(data["urgency"]),
        is_resolved=data["is_resolved"],
        title=data["title"],
        evidence=_read_evidence(data["evidence"]),
        env=data["env"],
    )


def _snapshot(evaluator: OrgEvaluator, end: datetime) -> dict[str, Any]:
    """Apply retention before encoding, preserving the effects on the live evaluator."""
    cursor = evaluator.next_minute or end
    _prune_for_snapshot(evaluator, cursor)
    return _encode_snapshot(evaluator, _history_floor(evaluator, cursor), cursor)


def _hourly_support(evaluator: OrgEvaluator, cursor: datetime) -> list[Any]:
    since, until = evaluator.baseline.checkpoint_hourly_bounds(cursor)
    # Only live slice anchors need their previous seasonal units. At most
    # 14 days plus the closed hours of the cursor day fit in the sparse
    # measurement codec's minute offsets.
    series = {}
    for key, state in evaluator.series_history.state.items():
        if not (key.dim_value and state.open and state.anchor_level is not None):
            continue
        points: Series = {
            hour: value
            for hour, value in sorted(evaluator.hourly.get(key, {}).items())
            if since <= hour < until
            and hour == hour.replace(minute=0, second=0, microsecond=0)
            and value is not None
        }
        if points:
            series[key] = points
    return _series(series, since, until)


def _encode_snapshot(evaluator: OrgEvaluator, since: datetime, cursor: datetime) -> dict[str, Any]:
    events = _EventWriter()
    novelty = evaluator.novelty
    return {
        "version": CHECKPOINT_VERSION,
        "next_minute": _iso(evaluator.next_minute),
        "series": _series(evaluator.series, since, cursor),
        "hourly_support": _hourly_support(evaluator, cursor),
        "detector": _detector(evaluator.series_history, events),
        "change_points": _change_points(evaluator.rate_shifts, events),
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
            [_service(service), [events.ref(event) for event in changes]]
            for service, changes in evaluator.harm.items()
        ],
        "pending_issues": [events.ref(event) for event in evaluator.pending_issues],
        "known_issues": [events.ref(event) for event in evaluator.known_issues],
        "point_closes": [
            [ts.isoformat(), events.ref(event)] for ts, event in evaluator.point_closes
        ],
        "events": events.records,
    }


def is_current(data: dict[str, Any]) -> bool:
    """Whether this checkpoint uses the current format; other versions are discarded."""
    version = data.get("version")
    return type(version) is int and version == CHECKPOINT_VERSION


def _restore(
    footprints: FootprintSource, data: dict[str, Any], *, projects: Iterable[int]
) -> OrgEvaluator:
    if not is_current(data):
        raise ValueError("Unsupported anomaly checkpoint version")
    evaluator = OrgEvaluator(footprints, projects=projects)
    events = _EventReader(data["events"])
    # The evaluator, detector, change-point detector, and correlator all share series.
    evaluator.series.update(_read_series(data["series"]))
    # The next collection overlays this by key and hour, including explicit
    # missing values. Fresh input wins; omitted top slices keep their reference.
    evaluator.hourly.update(_read_series(data["hourly_support"]))
    evaluator.next_minute = _time(data["next_minute"])
    _restore_detector(evaluator.series_history, data["detector"], events)
    _restore_change_points(evaluator.rate_shifts, data["change_points"], events)
    evaluator.corr = Correlator(
        footprints,
        evaluator.corr.cfg,
        series=evaluator.series,
        state=_read_correlation(data["correlation"], events),
    )
    evaluator.novelty.coverage = {
        _read_key(key): _read_coverage(first, packed)
        for key, (first, packed) in data["novelty"]["coverage"]
    }
    for records in data["novelty"]["history"]:
        for index in records:
            evaluator.novelty.record(events.ref(index))
    evaluator.qualified = {
        decision.group_key: decision
        for decision in (_read_decision(entry) for entry in data["qualified"])
    }
    evaluator.absorbed = {_read_episode(key): events.ref(index) for key, index in data["absorbed"]}
    evaluator.next_look = {_read_episode(key): minute for key, minute in data["next_look"]}
    evaluator.harm = {
        _read_service(service): [events.ref(index) for index in changes]
        for service, changes in data["harm"]
    }
    evaluator.pending_issues = [events.ref(index) for index in data["pending_issues"]]
    evaluator.known_issues = [events.ref(index) for index in data["known_issues"]]
    evaluator.point_closes = [
        (datetime.fromisoformat(ts), events.ref(index)) for ts, index in data["point_closes"]
    ]
    return evaluator
