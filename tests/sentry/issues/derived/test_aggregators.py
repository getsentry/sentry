"""
Pure-Python tests for aggregators. No database, no Django TestCase.

Each test constructs a Pipeline with the relevant aggregators, feeds it
fake entries via pipeline.step(), and asserts on the resulting state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.derived.aggregators import (
    AGGREGATORS,
    track_status,
    track_views,
)
from sentry.issues.derived.features import (
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    VIEW_COUNT,
    IssueStatus,
    Progress,
)
from sentry.issues.derived.framework import Pipeline, resolve


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


# ---------------------------------------------------------------------------
# track_views
# ---------------------------------------------------------------------------


def test_view_increments_count() -> None:
    p = Pipeline([track_views], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.VIEW, date_added=_ts(hour=1)))
    state = p.step(state, FakeEntry(type=GroupActionType.VIEW, date_added=_ts(hour=2)))
    assert state[VIEW_COUNT] == 2


def test_view_ignores_non_view() -> None:
    p = Pipeline([track_views], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.COMMENT))
    assert state[VIEW_COUNT] == 0


# ---------------------------------------------------------------------------
# track_status
# ---------------------------------------------------------------------------


def test_starts_open() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    assert state[STATUS] == IssueStatus.OPEN


def test_resolve_closes() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    assert state[STATUS] == IssueStatus.CLOSED


def test_unresolve_reopens() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    assert state[STATUS] == IssueStatus.OPEN


def test_duplicate_resolve_is_noop() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    assert state[STATUS] == IssueStatus.CLOSED


def test_unresolve_when_already_open_is_noop() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    assert state[STATUS] == IssueStatus.OPEN


def test_status_toggle() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    assert state[STATUS] == IssueStatus.CLOSED


def test_resolved_in_pull_request_closes() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    assert state[STATUS] == IssueStatus.CLOSED


def test_resolved_in_pr_when_already_closed_is_noop() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    assert state[STATUS] == IssueStatus.CLOSED


# ---------------------------------------------------------------------------
# track_progress
# ---------------------------------------------------------------------------


def test_progress_starts_identified() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    assert state[PROGRESS] == Progress.IDENTIFIED


def test_view_does_not_advance_progress() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.VIEW))
    assert state[PROGRESS] == Progress.IDENTIFIED


def test_assign_advances_to_triaged() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN))
    assert state[PROGRESS] == Progress.TRIAGED


def test_root_cause_identified_advances_to_diagnosed() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED))
    assert state[PROGRESS] == Progress.DIAGNOSED


def test_autofix_coding_complete_advances_to_fix_proposed() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.AUTOFIX_CODING_COMPLETE))
    assert state[PROGRESS] == Progress.FIX_PROPOSED


def test_autofix_pr_advances_to_fix_proposed() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data={}),
    )
    assert state[PROGRESS] == Progress.FIX_PROPOSED


def test_progress_never_goes_backward() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data={}),
    )
    assert state[PROGRESS] == Progress.FIX_PROPOSED
    # A VIEW shouldn't regress from FIX_PROPOSED back to TRIAGED
    state = p.step(state, FakeEntry(type=GroupActionType.VIEW))
    assert state[PROGRESS] == Progress.FIX_PROPOSED


def test_progress_none_when_closed() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN))
    assert state[PROGRESS] == Progress.TRIAGED
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    assert state[PROGRESS] is None


def test_progress_regressed_on_reopen() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    assert state[PROGRESS] == Progress.REGRESSED


def test_progress_advances_from_regressed() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    assert state[PROGRESS] == Progress.REGRESSED
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN))
    assert state[PROGRESS] == Progress.TRIAGED


def test_progress_full_lifecycle() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    assert state[PROGRESS] == Progress.IDENTIFIED

    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN))
    assert state[PROGRESS] == Progress.TRIAGED

    state = p.step(state, FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED))
    assert state[PROGRESS] == Progress.DIAGNOSED

    state = p.step(state, FakeEntry(type=GroupActionType.AUTOFIX_CODING_COMPLETE))
    assert state[PROGRESS] == Progress.FIX_PROPOSED

    # PR created doesn't advance past FIX_PROPOSED (same rank)
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data={}),
    )
    assert state[PROGRESS] == Progress.FIX_PROPOSED

    # Resolve closes the issue
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    assert state[PROGRESS] is None

    # Reopen
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    assert state[PROGRESS] == Progress.REGRESSED

    # New investigation
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN))
    assert state[PROGRESS] == Progress.TRIAGED


# ---------------------------------------------------------------------------
# last_progressed_at
# ---------------------------------------------------------------------------


def test_last_progressed_at_starts_none() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    assert state[LAST_PROGRESSED_AT] is None


def test_last_progressed_at_set_on_assign() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    t = _ts(hour=1)
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN, date_added=t))
    assert state[LAST_PROGRESSED_AT] == t


def test_last_progressed_at_advances_with_progress() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    t1 = _ts(hour=1)
    t2 = _ts(hour=2)
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN, date_added=t1))
    assert state[LAST_PROGRESSED_AT] == t1
    state = p.step(state, FakeEntry(type=GroupActionType.ROOT_CAUSE_IDENTIFIED, date_added=t2))
    assert state[LAST_PROGRESSED_AT] == t2


def test_last_progressed_at_unchanged_when_progress_unchanged() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    t1 = _ts(hour=1)
    t2 = _ts(hour=2)
    state = p.step(state, FakeEntry(type=GroupActionType.ASSIGN, date_added=t1))
    # VIEW doesn't change progress
    state = p.step(state, FakeEntry(type=GroupActionType.VIEW, date_added=t2))
    assert state[LAST_PROGRESSED_AT] == t1


def test_last_progressed_at_set_on_close() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    t = _ts(hour=1)
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE, date_added=t))
    assert state[LAST_PROGRESSED_AT] == t


def test_last_progressed_at_set_on_reopen() -> None:
    p = Pipeline(resolve([PROGRESS], AGGREGATORS), version=1)
    state = p.initial_state()
    t1 = _ts(hour=1)
    t2 = _ts(hour=2)
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE, date_added=t1))
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE, date_added=t2))
    assert state[LAST_PROGRESSED_AT] == t2


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------


def test_full_pipeline_constructs() -> None:
    p = Pipeline(AGGREGATORS, version=1)
    state = p.initial_state()
    assert state[STATUS] == IssueStatus.OPEN
    assert state[VIEW_COUNT] == 0
    assert state[PROGRESS] == Progress.IDENTIFIED


def test_full_pipeline_mixed_events() -> None:
    p = Pipeline(AGGREGATORS, version=1)
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
