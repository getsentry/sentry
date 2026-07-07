"""
Tests for status reconciliation: creating RECONCILE_STATUS actions and applying
them through the pipeline to override derived status values.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, get_args, get_type_hints

from sentry.issues.action_log.types import GroupActionType, GroupActorType, ReconcileStatusAction
from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.features import (
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    IssueStatus,
)
from sentry.issues.derived.framework import (
    Feature,
    Pipeline,
    resolve,
)
from sentry.issues.progress_state import IssueProgressState


@dataclass(frozen=True)
class FakeEntry:
    type: int
    date_added: datetime = datetime(2025, 1, 1, tzinfo=UTC)
    actor_type: int = GroupActorType.SYSTEM
    actor_id: int = 0
    data: dict[str, object] = field(default_factory=dict)


def _pipeline(
    targets: tuple[Feature[Any], ...] | None = None,
) -> Pipeline[Any]:
    aggs = AGGREGATORS
    if targets is not None:
        aggs = resolve(targets, aggs)
    return Pipeline(aggs, version=1, check_mutations=True)


def _run_for_feature[T](feature: Feature[T], entries: list[FakeEntry]) -> T:
    p = _pipeline(targets=(feature,))
    return p.run(entries)[feature]


def _reconcile_entry(status: IssueStatus) -> FakeEntry:
    action = ReconcileStatusAction(status=status.value)
    return FakeEntry(
        type=GroupActionType.RECONCILE_STATUS,
        data=action.dict(),
    )


# ---------------------------------------------------------------------------
# ReconcileStatusAction
# ---------------------------------------------------------------------------


def test_reconcile_status_literal_matches_issue_status() -> None:
    literal_values = set(get_args(get_type_hints(ReconcileStatusAction)["status"]))
    enum_values = {s.value for s in IssueStatus}
    assert literal_values == enum_values


def test_reconcile_status_action_roundtrips() -> None:
    action = ReconcileStatusAction(status=IssueStatus.CLOSED.value, reason="group model disagrees")
    assert action.status == "closed"
    assert action.reason == "group model disagrees"
    assert IssueStatus(action.status) == IssueStatus.CLOSED
    # reason survives serialization round-trip through dict
    restored = ReconcileStatusAction(**action.dict())
    assert restored.reason == "group model disagrees"


# ---------------------------------------------------------------------------
# Reconciliation through the pipeline: status
# ---------------------------------------------------------------------------


def test_reconcile_overrides_status() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.UNRESOLVE),
                _reconcile_entry(IssueStatus.CLOSED),
            ],
        )
        == IssueStatus.CLOSED
    )


def test_reconcile_status_from_initial() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [_reconcile_entry(IssueStatus.CLOSED)],
        )
        == IssueStatus.CLOSED
    )


def test_reconcile_status_reopens_closed() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                _reconcile_entry(IssueStatus.OPEN),
            ],
        )
        == IssueStatus.OPEN
    )


def test_reconcile_status_same_value_is_noop() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [_reconcile_entry(IssueStatus.OPEN)],
        )
        == IssueStatus.OPEN
    )


def test_normal_actions_continue_after_reconcile() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                _reconcile_entry(IssueStatus.CLOSED),
                FakeEntry(type=GroupActionType.UNRESOLVE),
            ],
        )
        == IssueStatus.OPEN
    )


# ---------------------------------------------------------------------------
# Cross-feature coupling: status reconciliation affects progress
# ---------------------------------------------------------------------------


def test_reconcile_status_to_closed_nulls_progress() -> None:
    p = _pipeline()
    state = p.run(
        [
            FakeEntry(type=GroupActionType.ASSIGN),
            _reconcile_entry(IssueStatus.CLOSED),
        ]
    )
    assert state[STATUS] == IssueStatus.CLOSED
    assert state[PROGRESS] is None


def test_reconcile_status_updates_last_progressed_at() -> None:
    p = _pipeline()
    state = p.run(
        [
            FakeEntry(type=GroupActionType.ASSIGN),
            _reconcile_entry(IssueStatus.CLOSED),
        ]
    )
    assert state[LAST_PROGRESSED_AT] is not None


def test_reconcile_status_to_open_resets_progress() -> None:
    p = _pipeline()
    state = p.run(
        [
            FakeEntry(type=GroupActionType.RESOLVE),
            _reconcile_entry(IssueStatus.OPEN),
        ]
    )
    assert state[STATUS] == IssueStatus.OPEN
    assert state[PROGRESS] == IssueProgressState.IDENTIFIED
