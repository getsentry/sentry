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

from sentry.issues.action_log.types import (
    GroupAction,
    GroupActionType,
    GroupActorType,
    ReconcileStatusAction,
)
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

    @property
    def action(self) -> GroupAction:
        action_type = GroupActionType(self.type)
        action_cls = GroupAction.by_type(action_type)
        if action_cls is None:
            raise ValueError(f"No GroupAction registered for {action_type!r}")
        return action_cls(**self.data)


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


def _pr_closed(has_other: bool | None = None, *, pr_id: int = 101, hour: int = 0) -> FakeEntry:
    """Build a PULL_REQUEST_CLOSED entry. ``has_other`` omitted -> no key."""
    data: dict[str, object] = {"pull_request": pr_id}
    if has_other is not None:
        data["has_other_open_prs"] = has_other
    return FakeEntry(type=GroupActionType.PULL_REQUEST_CLOSED, date_added=_ts(hour=hour), data=data)


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


@pytest.mark.parametrize(
    "action_type",
    [
        GroupActionType.RESOLVE,
        GroupActionType.SET_RESOLVED_IN_RELEASE,
        GroupActionType.SET_RESOLVED_BY_AGE,
        GroupActionType.SET_RESOLVED_IN_COMMIT,
        GroupActionType.ARCHIVE,
    ],
)
def test_close_actions(action_type: GroupActionType) -> None:
    assert (
        _run_for_feature(
            STATUS,
            [
                FakeEntry(type=action_type),
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


@pytest.mark.parametrize(
    "action_type",
    [
        GroupActionType.ROOT_CAUSE_IDENTIFIED,
        GroupActionType.SEER_RCA_COMPLETED,
    ],
)
def test_root_cause_advances_to_diagnosed(action_type: GroupActionType) -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=action_type),
            ],
        )
        == IssueProgressState.DIAGNOSED
    )


def test_resolved_in_pull_request_advances_to_fix_proposed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
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


def test_resolved_in_pr_advances_to_fix_proposed() -> None:
    # An open PR referencing the issue proposes a fix, like any other PR proposal.
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_resolved_in_pr_is_demotable_when_pr_closes() -> None:
    # When the referencing PR closes with none left open, the proposal is
    # withdrawn and progress falls back to the prior floor.
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                _pr_closed(has_other=False),
            ],
        )
        == IssueProgressState.DIAGNOSED
    )


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


def test_reopen_preserves_root_cause_identified() -> None:
    # A manual reopen (UNRESOLVE) keeps the diagnosis; only a regression resets it.
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.UNRESOLVE),
            ],
        )
        == IssueProgressState.DIAGNOSED
    )


def test_reopen_after_unassign_resets_to_identified() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ASSIGN),
                FakeEntry(type=GroupActionType.UNASSIGN),
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.UNRESOLVE),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_regression_preserves_assigned_floor() -> None:
    # SET_REGRESSED reopens the same way UNRESOLVE does.
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ASSIGN),
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.SET_REGRESSED),
            ],
        )
        == IssueProgressState.ASSIGNED
    )


def test_assign_does_not_regress_fix_proposed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                FakeEntry(type=GroupActionType.ASSIGN),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


@pytest.mark.parametrize(
    "action",
    [
        GroupActionType.SET_PRIORITY,
        GroupActionType.MARK_REVIEWED,
        GroupActionType.TRIGGER_AUTOFIX,
    ],
)
def test_triage_actions_do_not_advance_progress(action: GroupActionType) -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=action),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_unassign_demotes_to_identified() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ASSIGN),
                FakeEntry(type=GroupActionType.UNASSIGN),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_unassign_does_not_demote_diagnosed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ASSIGN),
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
                FakeEntry(type=GroupActionType.UNASSIGN),
            ],
        )
        == IssueProgressState.DIAGNOSED
    )


def test_unassign_without_prior_assign_is_noop() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.UNASSIGN),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_reassign_after_unassign_returns_to_assigned() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ASSIGN),
                FakeEntry(type=GroupActionType.UNASSIGN),
                FakeEntry(type=GroupActionType.ASSIGN),
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

    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    assert state[PROGRESS] == IssueProgressState.FIX_PROPOSED

    # Resolve closes the issue
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    assert state[PROGRESS] is None

    # Reopen: PR is still open, root cause and assignment preserved
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    assert state[PROGRESS] == IssueProgressState.FIX_PROPOSED


# ---------------------------------------------------------------------------
# PR-close demotion of fix_proposed
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "prior,expected",
    [
        ([], IssueProgressState.IDENTIFIED),
        ([GroupActionType.ASSIGN], IssueProgressState.ASSIGNED),
        ([GroupActionType.ROOT_CAUSE_IDENTIFIED], IssueProgressState.DIAGNOSED),
    ],
)
def test_pr_close_demotes_to_prior_floor(prior: list[int], expected: IssueProgressState) -> None:
    entries = [FakeEntry(type=t) for t in prior]
    entries.append(
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101))
    )
    entries.append(_pr_closed(has_other=False))
    assert _run_for_feature(PROGRESS, entries) == expected


def test_pr_close_with_remaining_keeps_fix_proposed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                _pr_closed(has_other=True),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


@pytest.mark.parametrize(
    "action_type",
    [
        GroupActionType.PULL_REQUEST_MERGED,
        GroupActionType.PULL_REQUEST_UNLINKED,
    ],
)
def test_pr_merged_or_unlinked_demotes_when_no_open_prs_remain(action_type: int) -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST,
                    data=_resolved_pr_data(101),
                ),
                FakeEntry(
                    type=action_type,
                    data={"pull_request": 101, "has_other_open_prs": False},
                ),
            ],
        )
        == IssueProgressState.DIAGNOSED
    )


@pytest.mark.parametrize(
    "action_type",
    [
        GroupActionType.PULL_REQUEST_MERGED,
        GroupActionType.PULL_REQUEST_UNLINKED,
    ],
)
def test_pr_merged_or_unlinked_with_remaining_keeps_fix_proposed(action_type: int) -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST,
                    data=_resolved_pr_data(101),
                ),
                FakeEntry(
                    type=action_type,
                    data={"pull_request": 101, "has_other_open_prs": True},
                ),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_pr_reopened_restores_fix_proposed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST,
                    data=_resolved_pr_data(101),
                ),
                _pr_closed(has_other=False),
                FakeEntry(
                    type=GroupActionType.PULL_REQUEST_REOPENED,
                    data={"pull_request": 101},
                ),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_pr_close_last_remaining_then_zero_demotes() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                _pr_closed(has_other=True),
                _pr_closed(has_other=False),
            ],
        )
        == IssueProgressState.DIAGNOSED
    )


def test_pr_close_missing_field_is_noop() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                _pr_closed(has_other=None),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_resolved_in_pr_advances_and_is_demotable() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                _pr_closed(has_other=False),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_pr_close_without_prior_proposal_is_noop() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED),
                _pr_closed(has_other=False),
            ],
        )
        == IssueProgressState.DIAGNOSED
    )


def test_two_linked_prs_demote_only_after_both_close() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(102)
                ),
                _pr_closed(has_other=True, pr_id=101),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(102)
                ),
                _pr_closed(has_other=True, pr_id=101),
                _pr_closed(has_other=False, pr_id=102),
            ],
        )
        == IssueProgressState.IDENTIFIED
    )


def test_unassign_during_open_pr_keeps_fix_proposed_but_lowers_floor() -> None:
    p = _pipeline(targets=(PROGRESS,))
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN))
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    state = p.step(state, FakeEntry(type=GroupActionType.UNASSIGN))
    # The open fix PR still wins the max while the floor silently drops.
    assert state[PROGRESS] == IssueProgressState.FIX_PROPOSED
    state = p.step(state, _pr_closed(has_other=False))
    assert state[PROGRESS] == IssueProgressState.IDENTIFIED


def test_pr_close_when_closed_is_noop() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                FakeEntry(type=GroupActionType.RESOLVE),
                _pr_closed(has_other=False),
            ],
        )
        is None
    )


def test_reopen_preserves_fix_pr_flag() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                FakeEntry(type=GroupActionType.RESOLVE),
                FakeEntry(type=GroupActionType.UNRESOLVE),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_repropose_after_demotion_returns_to_fix_proposed() -> None:
    assert (
        _run_for_feature(
            PROGRESS,
            [
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)
                ),
                _pr_closed(has_other=False),
                FakeEntry(
                    type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(102)
                ),
            ],
        )
        == IssueProgressState.FIX_PROPOSED
    )


def test_last_progressed_at_updated_on_demotion() -> None:
    p = _pipeline(targets=(PROGRESS,))
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.RESOLVED_IN_PULL_REQUEST,
            data=_resolved_pr_data(101),
            date_added=_ts(hour=1),
        ),
    )
    assert state[LAST_PROGRESSED_AT] == _ts(hour=1)
    state = p.step(state, _pr_closed(has_other=False, hour=2))
    assert state[PROGRESS] == IssueProgressState.IDENTIFIED
    assert state[LAST_PROGRESSED_AT] == _ts(hour=2)


def test_last_progressed_at_untouched_on_pr_close_noop() -> None:
    p = _pipeline(targets=(PROGRESS,))
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.RESOLVED_IN_PULL_REQUEST,
            data=_resolved_pr_data(101),
            date_added=_ts(hour=1),
        ),
    )
    # A close that leaves another PR open does not change progress.
    state = p.step(state, _pr_closed(has_other=True, hour=2))
    assert state[PROGRESS] == IssueProgressState.FIX_PROPOSED
    assert state[LAST_PROGRESSED_AT] == _ts(hour=1)


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
