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
    track_autofix_prs,
    track_last_opened,
    track_recent_viewers,
    track_status,
    track_views,
)
from sentry.issues.derived.fields import (
    AUTOFIX_PRS,
    CLOSING_PRS,
    LAST_OPENED,
    LAST_SEEN,
    RECENT_VIEWERS,
    STATUS,
    VIEW_COUNT,
    WAS_AUTOFIXED,
    WORKING_ON,
    IssueStatus,
    WorkingOnEntry,
)
from sentry.issues.derived.lib import Pipeline, resolve


@dataclass(frozen=True)
class FakeEntry:
    type: int
    date_added: datetime = datetime(2025, 1, 1, tzinfo=UTC)
    actor_type: int = GroupActorType.SYSTEM
    actor_id: int = 0
    data: dict[str, object] = field(default_factory=dict)


def _ts(year: int = 2025, month: int = 1, day: int = 1, hour: int = 0) -> datetime:
    return datetime(year, month, day, hour, tzinfo=UTC)


def _seer_pr_data(*pr_ids: int) -> dict[str, object]:
    """Build an AutofixPrCreatedAction-shaped data dict."""
    return {
        "pull_requests": [
            {"repo_name": "getsentry/sentry", "pull_request": {"pr_id": pid, "pr_number": pid}}
            for pid in pr_ids
        ],
    }


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


def test_view_updates_last_seen() -> None:
    p = Pipeline([track_views], version=1)
    state = p.initial_state()
    t1 = _ts(hour=1)
    t2 = _ts(hour=2)
    state = p.step(state, FakeEntry(type=GroupActionType.VIEW, date_added=t1))
    assert state[LAST_SEEN] == t1.timestamp()
    state = p.step(state, FakeEntry(type=GroupActionType.VIEW, date_added=t2))
    assert state[LAST_SEEN] == t2.timestamp()


def test_view_ignores_non_view() -> None:
    p = Pipeline([track_views], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.COMMENT))
    assert state[VIEW_COUNT] == 0
    assert state[LAST_SEEN] is None


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
    assert state[CLOSING_PRS] == frozenset({"101"})


def test_resolved_in_pr_when_already_closed_is_noop() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    assert state[CLOSING_PRS] == frozenset()


def test_unresolve_clears_closing_prs() -> None:
    p = Pipeline([track_status], version=1)
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    assert state[CLOSING_PRS] == frozenset({"101"})
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    assert state[CLOSING_PRS] == frozenset()


# ---------------------------------------------------------------------------
# track_last_opened
# ---------------------------------------------------------------------------


def test_last_opened_set_on_unresolve() -> None:
    p = Pipeline([track_status, track_last_opened], version=1)
    state = p.initial_state()
    t = _ts(hour=5)
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE, date_added=_ts(hour=1)))
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE, date_added=t))
    assert state[LAST_OPENED] == t.timestamp()


# ---------------------------------------------------------------------------
# track_recent_viewers
# ---------------------------------------------------------------------------


def test_recent_viewers_tracks_user() -> None:
    p = Pipeline([track_recent_viewers], version=1)
    state = p.initial_state()
    t = _ts(hour=1)
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW, date_added=t, actor_type=GroupActorType.USER, actor_id=42
        ),
    )
    assert state[RECENT_VIEWERS] == {"42": t.timestamp()}


def test_recent_viewers_ignores_no_user() -> None:
    p = Pipeline([track_recent_viewers], version=1)
    state = p.initial_state()
    state = p.step(state, FakeEntry(type=GroupActionType.VIEW))
    assert state[RECENT_VIEWERS] == {}


def test_recent_viewers_expires_stale() -> None:
    p = Pipeline([track_recent_viewers], version=1)
    state = p.initial_state()
    old = _ts(2024, 1, 1)
    recent = _ts(2025, 6, 1)  # far enough apart that the old entry expires
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW, date_added=old, actor_type=GroupActorType.USER, actor_id=1
        ),
    )
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW, date_added=recent, actor_type=GroupActorType.USER, actor_id=2
        ),
    )
    assert "1" not in state[RECENT_VIEWERS]
    assert "2" in state[RECENT_VIEWERS]


def test_recent_viewers_updates_timestamp() -> None:
    p = Pipeline([track_recent_viewers], version=1)
    state = p.initial_state()
    t1 = _ts(hour=1)
    t2 = _ts(hour=2)
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW, date_added=t1, actor_type=GroupActorType.USER, actor_id=42
        ),
    )
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW, date_added=t2, actor_type=GroupActorType.USER, actor_id=42
        ),
    )
    assert state[RECENT_VIEWERS] == {"42": t2.timestamp()}


# ---------------------------------------------------------------------------
# track_autofix_prs / compute_was_autofixed
# ---------------------------------------------------------------------------


def test_autofix_pr_tracked() -> None:
    p = Pipeline([track_autofix_prs], version=1)
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data=_seer_pr_data(101)),
    )
    assert state[AUTOFIX_PRS] == frozenset({"101"})


def test_duplicate_autofix_pr_is_noop() -> None:
    p = Pipeline([track_autofix_prs], version=1)
    state = p.initial_state()
    entry = FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data=_seer_pr_data(101))
    state = p.step(state, entry)
    state = p.step(state, entry)
    assert state[AUTOFIX_PRS] == frozenset({"101"})


def test_was_autofixed_when_resolved_by_autofix_pr() -> None:
    p = Pipeline(
        resolve([WAS_AUTOFIXED], AGGREGATORS),
        version=1,
    )
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data=_seer_pr_data(101)),
    )
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    assert state[WAS_AUTOFIXED] is True


def test_not_autofixed_when_resolved_by_different_pr() -> None:
    p = Pipeline(
        resolve([WAS_AUTOFIXED], AGGREGATORS),
        version=1,
    )
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data=_seer_pr_data(101)),
    )
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(999)),
    )
    assert state[WAS_AUTOFIXED] is False


def test_not_autofixed_when_manually_resolved() -> None:
    p = Pipeline(
        resolve([WAS_AUTOFIXED], AGGREGATORS),
        version=1,
    )
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data=_seer_pr_data(101)),
    )
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE))
    assert state[WAS_AUTOFIXED] is False


def test_was_autofixed_stays_true_after_reopen() -> None:
    p = Pipeline(
        resolve([WAS_AUTOFIXED], AGGREGATORS),
        version=1,
    )
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.AUTOFIX_PR_CREATED, data=_seer_pr_data(101)),
    )
    state = p.step(
        state,
        FakeEntry(type=GroupActionType.RESOLVED_IN_PULL_REQUEST, data=_resolved_pr_data(101)),
    )
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE))
    assert state[WAS_AUTOFIXED] is True


# ---------------------------------------------------------------------------
# compute_working_on
# ---------------------------------------------------------------------------


def test_working_on_includes_viewer() -> None:
    p = Pipeline(
        resolve([WORKING_ON], AGGREGATORS),
        version=1,
    )
    state = p.initial_state()
    t = _ts(hour=1)
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW, date_added=t, actor_type=GroupActorType.USER, actor_id=42
        ),
    )
    assert "42" in state[WORKING_ON]
    assert state[WORKING_ON]["42"] == WorkingOnEntry(since=t.timestamp())


def test_working_on_empty_when_closed() -> None:
    p = Pipeline(
        resolve([WORKING_ON], AGGREGATORS),
        version=1,
    )
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW,
            date_added=_ts(hour=1),
            actor_type=GroupActorType.USER,
            actor_id=42,
        ),
    )
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE, date_added=_ts(hour=2)))
    assert state[WORKING_ON] == {}


def test_working_on_resets_on_reopen() -> None:
    p = Pipeline(
        resolve([WORKING_ON], AGGREGATORS),
        version=1,
    )
    state = p.initial_state()
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW,
            date_added=_ts(hour=1),
            actor_type=GroupActorType.USER,
            actor_id=1,
        ),
    )
    state = p.step(state, FakeEntry(type=GroupActionType.RESOLVE, date_added=_ts(hour=2)))
    state = p.step(state, FakeEntry(type=GroupActionType.UNRESOLVE, date_added=_ts(hour=3)))
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW,
            date_added=_ts(hour=4),
            actor_type=GroupActorType.USER,
            actor_id=2,
        ),
    )
    assert "1" not in state[WORKING_ON]
    assert "2" in state[WORKING_ON]


def test_working_on_since_preserved() -> None:
    p = Pipeline(
        resolve([WORKING_ON], AGGREGATORS),
        version=1,
    )
    state = p.initial_state()
    t1 = _ts(hour=1)
    t2 = _ts(hour=2)
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW, date_added=t1, actor_type=GroupActorType.USER, actor_id=42
        ),
    )
    first_since = state[WORKING_ON]["42"].since
    state = p.step(
        state,
        FakeEntry(
            type=GroupActionType.VIEW, date_added=t2, actor_type=GroupActorType.USER, actor_id=42
        ),
    )
    assert state[WORKING_ON]["42"].since == first_since


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------


def test_full_pipeline_constructs() -> None:
    p = Pipeline(AGGREGATORS, version=1)
    state = p.initial_state()
    assert state[STATUS] == IssueStatus.OPEN
    assert state[VIEW_COUNT] == 0
    assert state[LAST_SEEN] is None
    assert state[WAS_AUTOFIXED] is False


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
    assert state[LAST_SEEN] == _ts(hour=1).timestamp()
    assert state[WORKING_ON] == {}
