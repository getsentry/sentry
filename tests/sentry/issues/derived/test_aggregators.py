"""
Pure-Python tests for aggregators. No database, no Django TestCase.

Each test constructs a Pipeline with the relevant aggregators, feeds it
fake entries via pipeline.step(), and asserts on the resulting state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, get_args, get_type_hints

import pytest

from sentry.issues.action_log.types import GroupActionType, GroupActorType, ReconcileStatusAction
from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.features import (
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    VIEW_COUNT,
    IssueStatus,
)
from sentry.issues.derived.framework import (
    Aggregator,
    AggregatorResult,
    Feature,
    Pipeline,
    StateView,
    aggregator,
    resolve,
)
from sentry.issues.progress_state import IssueProgressState


def _pipeline(
    aggregators: list[Aggregator[Any]] | None = None,
    *,
    targets: tuple[Feature[Any], ...] | None = None,
) -> Pipeline[Any]:
    aggs = aggregators if aggregators is not None else AGGREGATORS
    if targets is not None:
        aggs = resolve(targets, aggs)
    return Pipeline(aggs, version=1, check_mutations=True)


def _run_for_feature[T](feature: Feature[T], entries: list[FakeEntry]) -> T:
    p = _pipeline(targets=(feature,))
    return p.run(entries)[feature]


@dataclass(frozen=True)
class FakeEntry:
    type: int
    date_added: datetime = datetime(2025, 1, 1, tzinfo=UTC)
    actor_type: int = GroupActorType.SYSTEM
    actor_id: int = 0
    data: dict[str, object] = field(default_factory=dict)


def _ts(year: int = 2025, month: int = 1, day: int = 1, hour: int = 0) -> datetime:
    return datetime(year, month, day, hour, tzinfo=UTC)


def _resolved_pr_data(pr_id: int) -> dict[str, object]:
    """Build a ResolvedInPullRequestAction-shaped data dict."""
    return {"pull_request": pr_id}


def _reconcile_entry(status: IssueStatus) -> FakeEntry:
    action = ReconcileStatusAction(status=status.value)
    return FakeEntry(
        type=GroupActionType.RECONCILE_STATUS,
        data=action.dict(),
    )


# ---------------------------------------------------------------------------
# track_views
# ---------------------------------------------------------------------------


def test_view_increments_count() -> None:
    assert (
        _run_for_feature(
            VIEW_COUNT,
            [
                FakeEntry(type=GroupActionType.VIEW, date_added=_ts(hour=1)),
                FakeEntry(type=GroupActionType.VIEW, date_added=_ts(hour=2)),
            ],
        )
        == 2
    )


def test_view_ignores_non_view() -> None:
    assert (
        _run_for_feature(
            VIEW_COUNT,
            [
                FakeEntry(type=GroupActionType.COMMENT),
            ],
        )
        == 0
    )


# ---------------------------------------------------------------------------
# track_status
# ---------------------------------------------------------------------------


def test_starts_open() -> None:
    assert _run_for_feature(STATUS, []) == IssueStatus.OPEN


def test_resolve_closes() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
            ],
        )
        == IssueStatus.CLOSED
    )


def test_unresolve_reopens() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.UNRESOLVE),
            ],
        )
        == IssueStatus.OPEN
    )


def test_duplicate_resolve_is_noop() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.RESOLVE),
            ],
        )
        == IssueStatus.CLOSED
    )


def test_unresolve_when_already_open_is_noop() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.UNRESOLVE),
            ],
        )
        == IssueStatus.OPEN
    )


def test_status_toggle() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.UNRESOLVE),
                FakeEntry(type=GroupActionType.RESOLVE),
            ],
        )
        == IssueStatus.CLOSED
    )


def test_regression_reopens() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.SET_REGRESSED),
            ],
        )
        == IssueStatus.OPEN
    )


def test_regression_resets_progress() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.SET_REGRESSED),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_archive_closes() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.ARCHIVE),
            ],
        )
        == IssueStatus.CLOSED
    )


def test_resolved_in_pull_request_closes() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
            ],
        )
        == IssueStatus.CLOSED
    )


def test_resolved_in_pr_when_already_closed_is_noop() -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
            ],
        )
        == IssueStatus.CLOSED
    )


class TestReconcileStatus:
    def test_literal_matches_issue_status(self) -> None:
        literal_values = set(get_args(get_type_hints(ReconcileStatusAction)["status"]))
        enum_values = {s.value for s in IssueStatus}
        assert literal_values == enum_values

    def test_action_roundtrips(self) -> None:
        action = ReconcileStatusAction(
            status=IssueStatus.CLOSED.value, reason="group model disagrees"
        )
        assert action.status == "closed"
        assert action.reason == "group model disagrees"
        assert IssueStatus(action.status) == IssueStatus.CLOSED
        # reason survives serialization round-trip through dict
        restored = ReconcileStatusAction(**action.dict())
        assert restored.reason == "group model disagrees"

    def test_overrides_status(self) -> None:
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

    def test_from_initial(self) -> None:
        assert (
            _run_for_feature(
                STATUS,
                [_reconcile_entry(IssueStatus.CLOSED)],
            )
            == IssueStatus.CLOSED
        )

    def test_reopens_closed(self) -> None:
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

    def test_same_value_is_noop(self) -> None:
        assert (
            _run_for_feature(
                STATUS,
                [_reconcile_entry(IssueStatus.OPEN)],
            )
            == IssueStatus.OPEN
        )

    def test_normal_actions_continue_after(self) -> None:
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

    def test_to_closed_nulls_progress(self) -> None:
        p = _pipeline()
        state = p.run(
            [
                FakeEntry(type=GroupActionType.ASSIGN),
                _reconcile_entry(IssueStatus.CLOSED),
            ]
        )
        assert state[STATUS] == IssueStatus.CLOSED
        assert state[PROGRESS] is None

    def test_updates_last_progressed_at(self) -> None:
        p = _pipeline()
        state = p.run(
            [
                FakeEntry(type=GroupActionType.ASSIGN),
                _reconcile_entry(IssueStatus.CLOSED),
            ]
        )
        assert state[LAST_PROGRESSED_AT] is not None

    def test_to_open_resets_progress(self) -> None:
        p = _pipeline()
        state = p.run(
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                _reconcile_entry(IssueStatus.OPEN),
            ]
        )
        assert state[STATUS] == IssueStatus.OPEN
        assert state[PROGRESS] == IssueProgressState.IDENTIFIED


# ---------------------------------------------------------------------------
# track_progress
# ---------------------------------------------------------------------------


def test_progress_starts_identified() -> None:
    assert _run_for_feature(PROGRESS, []) == IssueProgressState.IDENTIFIED


def test_view_does_not_advance_progress() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.VIEW),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_assign_advances_to_assigned() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ASSIGN),
            ],
        )
        == IssueProgressState.ASSIGNED
    )


def test_root_cause_identified_advances_to_diagnosed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
            ],
        )
        == IssueProgressState.DIAGNOSED
    )


def test_autofix_coding_complete_advances_to_fix_proposed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.AUTOFIX_CODING_COMPLETE),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_autofix_pr_advances_to_fix_proposed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data={}),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_progress_never_goes_backward() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data={}),
                FakeEntry(type=GroupActionType.VIEW),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_progress_none_when_closed() -> None:
    p = _pipeline(targets=(PROGRESS,))
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN))
    assert state[PROGRESS] == IssueProgressState.ASSIGNED
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    assert state[PROGRESS] is None


def test_progress_resets_on_reopen() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.UNRESOLVE),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_progress_advances_after_reopen() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.UNRESOLVE),
                FakeEntry(type=GroupActionType.ASSIGN),
            ],
        )
        == IssueProgressState.ASSIGNED
    )


def test_progress_advances_after_reopen_to_diagnosed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.UNRESOLVE),
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
            ],
        )
        == IssueProgressState.DIAGNOSED
    )


def test_assign_does_not_regress_fix_proposed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.AUTOFIX_CODING_COMPLETE),
                FakeEntry(type=GroupActionType.ASSIGN),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_set_priority_advances_to_assigned() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.SET_PRIORITY),
            ],
        )
        == IssueProgressState.ASSIGNED
    )


def test_mark_reviewed_advances_to_assigned() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.MARK_REVIEWED),
            ],
        )
        == IssueProgressState.ASSIGNED
    )


def test_trigger_autofix_advances_to_assigned() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.TRIGGER_AUTOFIX),
            ],
        )
        == IssueProgressState.ASSIGNED
    )


def test_progress_full_lifecycle() -> None:
    p = _pipeline(targets=(PROGRESS,))
    state = p.initial_state()
    assert state[PROGRESS] == IssueProgressState.IDENTIFIED

    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN))
    assert state[PROGRESS] == IssueProgressState.ASSIGNED

    state = p.step(state, FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED))
    assert state[PROGRESS] == IssueProgressState.DIAGNOSED

    state = p.step(state, FakeEntry(type=GroupActionType.AUTOFIX_CODING_COMPLETE))
    assert state[PROGRESS] == IssueProgressState.FIX_PROPOSED

    # PR created doesn't advance past FIX_PROPOSED (same rank)
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data={}),
    )
    assert state[PROGRESS] == IssueProgressState.FIX_PROPOSED

    # Resolve closes the issue
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    assert state[PROGRESS] is None

    # Reopen
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    assert state[PROGRESS] == IssueProgressState.IDENTIFIED

    # New investigation
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN))
    assert state[PROGRESS] == IssueProgressState.ASSIGNED


# ---------------------------------------------------------------------------
# last_progressed_at
# ---------------------------------------------------------------------------


def test_last_progressed_at_starts_none() -> None:
    assert _run_for_feature(LAST_PROGRESSED_AT, []) is None


def test_last_progressed_at_set_on_assign() -> None:
    assert _run_for_feature(
        LAST_PROGRESSED_AT,
        [
            FakeEntry(type=GroupActionType.ASSIGN, date_added=_ts(hour=1)),
        ],
    ) == _ts(hour=1)


def test_last_progressed_at_advances_with_progress() -> None:
    p = _pipeline(targets=(PROGRESS,))
    state = p.initial_state()
    t1 = _ts(hour=1)
    t2 = _ts(hour=2)
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN, date_added=t1))
    assert state[LAST_PROGRESSED_AT] == t1
    state = p.step(state, FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED, date_added=t2))
    assert state[LAST_PROGRESSED_AT] == t2


def test_last_progressed_at_unchanged_when_progress_unchanged() -> None:
    p = _pipeline(targets=(PROGRESS,))
    state = p.initial_state()
    t1 = _ts(hour=1)
    t2 = _ts(hour=2)
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN, date_added=t1))
    # VIEW doesn't change progress
    state = p.step(state, FakeEntry(type=GroupActionType.VIEW, date_added=t2))
    assert state[LAST_PROGRESSED_AT] == t1


def test_last_progressed_at_set_on_close() -> None:
    assert _run_for_feature(
        LAST_PROGRESSED_AT,
        [
            FakeEntry(type=GroupActionType.RESOLVE, date_added=_ts(hour=1)),
        ],
    ) == _ts(hour=1)


def test_last_progressed_at_set_on_reopen() -> None:
    assert _run_for_feature(
        LAST_PROGRESSED_AT,
        [
            FakeEntry(type=GroupActionType.RESOLVE, date_added=_ts(hour=1)),
            FakeEntry(type=GroupActionType.UNRESOLVE, date_added=_ts(hour=2)),
        ],
    ) == _ts(hour=2)


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Pipeline validation
# ---------------------------------------------------------------------------


def test_duplicate_output_rejected() -> None:
    A = Feature[int]("x", default=0)

    @aggregator((A,))
    def agg1(state: StateView, entry: object) -> AggregatorResult:
        return None

    @aggregator((A,))
    def agg2(state: StateView, entry: object) -> AggregatorResult:
        return None

    with pytest.raises(ValueError, match="output by both"):
        Pipeline([agg1, agg2], version=1)


def test_missing_dependency_rejected() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)

    @aggregator((A,), deps=(B,))
    def agg(state: StateView, entry: object) -> AggregatorResult:
        return None

    with pytest.raises(ValueError, match="not output by any aggregator"):
        Pipeline([agg], version=1)


def test_cycle_rejected() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)

    @aggregator((A,), deps=(B,))
    def agg1(state: StateView, entry: object) -> AggregatorResult:
        return None

    @aggregator((B,), deps=(A,))
    def agg2(state: StateView, entry: object) -> AggregatorResult:
        return None

    with pytest.raises(ValueError, match="Cycle detected"):
        Pipeline([agg1, agg2], version=1)


def test_full_pipeline_constructs() -> None:
    p = _pipeline()
    state = p.initial_state()
    assert state[STATUS] == IssueStatus.OPEN
    assert state[VIEW_COUNT] == 0
    assert state[PROGRESS] == IssueProgressState.IDENTIFIED


def test_full_pipeline_mixed_events() -> None:
    p = _pipeline()
    state = p.run(
        [
            FakeEntry(
                type=GroupActionType.VIEW,
                date_added=_ts(hour=1),
                actor_type=GroupActorType.USER,
                actor_id=1,
            ),
            FakeEntry(
                type=GroupActionType.COMMENT,
                date_added=_ts(hour=3),
                actor_type=GroupActorType.USER,
                actor_id=1,
            ),
            FakeEntry(
                type=GroupActionType.RESOLVE,
                date_added=_ts(hour=4),
                actor_type=GroupActorType.USER,
                actor_id=1,
            ),
        ]
    )
    assert state[STATUS] == IssueStatus.CLOSED
    assert state[VIEW_COUNT] == 1
