"""Versioned JSON state for an organization evaluator, separate from issue delivery.

Only the fields below are persisted. There are no Python class names or callables in
this format. Ordered mappings use arrays of entries so JSON object key order does
not affect evaluation. Event references are indices into a snapshot-local table:
several subsystems update or observe the very same mutable ChangeEvent.
"""

from collections.abc import Mapping
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
from sentry.anomaly_detection.contracts import SeriesKey, Urgency
from sentry.anomaly_detection.correlation.correlator import Correlator, FootprintSource
from sentry.anomaly_detection.detector_handler import AnomalyDetectionDetectorHandler
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision, OrgEvaluator

CHECKPOINT_VERSION = 3


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
    """Apply retention before encoding, preserving the effects on the live evaluator."""
    cursor = evaluator.next_minute or end
    _prune_for_snapshot(evaluator, cursor)
    return _encode_snapshot(evaluator, _history_floor(evaluator, cursor), cursor)


def _encode_snapshot(evaluator: OrgEvaluator, since: datetime, cursor: datetime) -> dict[str, Any]:
    events = _EventWriter()
    novelty = evaluator.novelty
    return {
        "version": CHECKPOINT_VERSION,
        "next_minute": _iso(evaluator.next_minute),
        "series": _series(evaluator.series, since, cursor),
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
    _restore_detector(evaluator.series_history, data["detector"], events)
    _restore_change_points(evaluator.rate_shifts, data["change_points"], events)
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
