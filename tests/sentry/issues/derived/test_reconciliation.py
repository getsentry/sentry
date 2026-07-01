"""
Tests for reconciliation: creating reconciliation actions and applying them
through the pipeline to override derived feature values.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import pytest

from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.features import (
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    IssueStatus,
)
from sentry.issues.derived.framework import (
    Feature,
    FeatureEntry,
    Pipeline,
    resolve,
)
from sentry.issues.derived.reconciliation import create_reconciliation_action
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


def _reconcile_entry(update: FeatureEntry) -> FakeEntry:
    action = create_reconciliation_action(update)
    return FakeEntry(
        type=GroupActionType.RECONCILE_FEATURES,
        data=action.dict(),
    )


# ---------------------------------------------------------------------------
# create_reconciliation_action
# ---------------------------------------------------------------------------


def test_create_reconciliation_action_roundtrips_enum() -> None:
    action = create_reconciliation_action(STATUS.value(IssueStatus.CLOSED))
    assert action.feature_name == "status"
    assert action.new_value == "closed"
    assert STATUS.load(action.new_value) == IssueStatus.CLOSED


def test_create_reconciliation_action_roundtrips_optional_enum() -> None:
    action = create_reconciliation_action(PROGRESS.value(IssueProgressState.DIAGNOSED))
    assert action.new_value == "diagnosed"
    assert PROGRESS.load(action.new_value) == IssueProgressState.DIAGNOSED


def test_create_reconciliation_action_roundtrips_none() -> None:
    action = create_reconciliation_action(PROGRESS.value(None))
    assert action.new_value is None
    assert PROGRESS.load(action.new_value) is None


def test_create_reconciliation_action_rejects_unsupported_feature() -> None:
    unsupported = Feature[int]("not_reconcilable", default=0)
    with pytest.raises(ValueError, match="not supported for reconciliation"):
        create_reconciliation_action(unsupported.value(42))


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
                _reconcile_entry(STATUS.value(IssueStatus.CLOSED)),
            ],
        )
        == IssueStatus.CLOSED
    )


def test_reconcile_status_from_initial() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [_reconcile_entry(STATUS.value(IssueStatus.CLOSED))],
        )
        == IssueStatus.CLOSED
    )


def test_reconcile_status_reopens_closed() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                _reconcile_entry(STATUS.value(IssueStatus.OPEN)),
            ],
        )
        == IssueStatus.OPEN
    )


def test_reconcile_status_same_value_is_noop() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [_reconcile_entry(STATUS.value(IssueStatus.OPEN))],
        )
        == IssueStatus.OPEN
    )


def test_normal_actions_continue_after_reconcile() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                _reconcile_entry(STATUS.value(IssueStatus.CLOSED)),
                FakeEntry(type=GroupActionType.UNRESOLVE),
            ],
        )
        == IssueStatus.OPEN
    )


# ---------------------------------------------------------------------------
# Reconciliation through the pipeline: progress
# ---------------------------------------------------------------------------


def test_reconcile_progress_forward() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [_reconcile_entry(PROGRESS.value(IssueProgressState.DIAGNOSED))],
        )
        == IssueProgressState.DIAGNOSED
    )


def test_reconcile_progress_to_none() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [_reconcile_entry(PROGRESS.value(None))],
        )
        is None
    )


def test_reconcile_progress_backward() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
                _reconcile_entry(PROGRESS.value(IssueProgressState.IDENTIFIED)),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_reconcile_last_progressed_at() -> None:
    t = datetime(2025, 6, 15, 12, 0, tzinfo=UTC)
    assert (
        _run_for_feature(
            LAST_PROGRESSED_AT,
            [_reconcile_entry(LAST_PROGRESSED_AT.value(t))],
        )
        == t
    )


# ---------------------------------------------------------------------------
# Reconciliation with unrelated features (ignored by aggregator)
# ---------------------------------------------------------------------------


def test_reconcile_unrelated_feature_is_noop() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [_reconcile_entry(PROGRESS.value(IssueProgressState.FIX_APPLIED))],
        )
        == IssueStatus.OPEN
    )


# ---------------------------------------------------------------------------
# Multi-feature reconciliation (separate actions)
# ---------------------------------------------------------------------------


def test_reconcile_status_and_progress_separately() -> None:
    p = _pipeline()
    state = p.run(
        [
            _reconcile_entry(STATUS.value(IssueStatus.CLOSED)),
            _reconcile_entry(PROGRESS.value(None)),
        ]
    )
    assert state[STATUS] == IssueStatus.CLOSED
    assert state[PROGRESS] is None


def test_reconcile_mid_sequence_with_continuation() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ASSIGN),
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
                # Reconcile backward to IDENTIFIED
                _reconcile_entry(PROGRESS.value(IssueProgressState.IDENTIFIED)),
                # Then advance again normally
                FakeEntry(type=GroupActionType.ASSIGN),
            ],
        )
        == IssueProgressState.ASSIGNED
    )
