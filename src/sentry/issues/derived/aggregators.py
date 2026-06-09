from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.derived.fields import (
    AUTOFIX_PRS,
    CLOSING_PRS,
    LAST_OPENED,
    PROGRESS,
    RECENT_VIEWERS,
    STATUS,
    VIEW_COUNT,
    WAS_AUTOFIXED,
    WORKING_ON,
    IssueStatus,
    Progress,
    WorkingOnEntry,
)
from sentry.issues.derived.lib import Aggregator, AggregatorResult, StateView, aggregator, emit
from sentry.issues.groupactionlogentry import GroupActionLogEntry

RECENT_EXPIRY_SECONDS = 30 * 24 * 60 * 60  # 1 month


@aggregator(outputs=(VIEW_COUNT,), scope=(GroupActionType.VIEW,))
def track_views(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    return emit(VIEW_COUNT.value(state[VIEW_COUNT] + 1))


@aggregator(
    outputs=(STATUS, CLOSING_PRS),
    scope=(
        GroupActionType.RESOLVE,
        GroupActionType.UNRESOLVE,
        GroupActionType.RESOLVED_IN_PULL_REQUEST,
    ),
)
def track_status(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    current = state[STATUS]
    resolves = (GroupActionType.RESOLVE.value, GroupActionType.RESOLVED_IN_PULL_REQUEST.value)
    if entry.type in resolves and current == IssueStatus.OPEN:
        closing_prs = state[CLOSING_PRS]
        # ResolvedInPullRequestAction stores {"pull_request": <PullRequest.id>}
        pr_id = entry.data.get("pull_request")
        if entry.type == GroupActionType.RESOLVED_IN_PULL_REQUEST.value and pr_id is not None:
            closing_prs = closing_prs | {str(pr_id)}
        return emit(STATUS.value(IssueStatus.CLOSED), CLOSING_PRS.value(closing_prs))
    if entry.type == GroupActionType.UNRESOLVE.value and current == IssueStatus.CLOSED:
        return emit(STATUS.value(IssueStatus.OPEN), CLOSING_PRS.value(frozenset()))
    return None


@aggregator(
    deps=(STATUS,),
    outputs=(LAST_OPENED,),
    scope=(GroupActionType.UNRESOLVE,),
)
def track_last_opened(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    # Only record when actually reopening (status just transitioned to OPEN).
    # track_status runs first due to topological sort and will have already
    # flipped STATUS if this was a real reopen.
    if state[STATUS] != IssueStatus.OPEN:
        return None
    return emit(LAST_OPENED.value(entry.date_added.timestamp()))


@aggregator(outputs=(RECENT_VIEWERS,), scope=(GroupActionType.VIEW,))
def track_recent_viewers(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    if entry.actor_type != GroupActorType.USER:
        return None

    ts = entry.date_added.timestamp()
    cutoff = ts - RECENT_EXPIRY_SECONDS
    current = state[RECENT_VIEWERS]

    updated = {uid: t for uid, t in current.items() if t >= cutoff}
    updated[str(entry.actor_id)] = ts

    return emit(RECENT_VIEWERS.value(updated))


@aggregator(
    deps=(STATUS, LAST_OPENED, RECENT_VIEWERS),
    outputs=(WORKING_ON,),
)
def compute_working_on(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    current = state[WORKING_ON]

    if state[STATUS] != IssueStatus.OPEN:
        if current:
            return emit(WORKING_ON.value({}))
        return None

    # Only count activity since the last reopen (or all time if never closed).
    opened_at = state[LAST_OPENED] or 0

    # Collect active users: anyone who viewed since opened_at.
    active: dict[str, WorkingOnEntry] = {}
    for uid, ts in state[RECENT_VIEWERS].items():
        if ts >= opened_at:
            active[uid] = WorkingOnEntry(since=ts)

    # Carry forward existing "since" for users still active — their first
    # engagement in this open period shouldn't move forward.
    for uid, candidate in active.items():
        if uid in current and current[uid].since < candidate.since:
            active[uid] = WorkingOnEntry(since=current[uid].since)

    if active == current:
        return None
    return emit(WORKING_ON.value(active))


@aggregator(
    outputs=(AUTOFIX_PRS,),
    scope=(GroupActionType.AUTOFIX_PR_CREATED,),
)
def track_autofix_prs(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    # AutofixPrCreatedAction stores {"pull_requests": [{..., "pull_request": {"pr_id": N, ...}}, ...]}
    pull_requests = entry.data.get("pull_requests")
    if not pull_requests:
        return None
    current = state[AUTOFIX_PRS]
    new_ids: set[str] = set()
    for pr_entry in pull_requests:
        pr = pr_entry.get("pull_request", {}) if isinstance(pr_entry, dict) else {}
        pr_id = pr.get("pr_id") if isinstance(pr, dict) else None
        if pr_id is not None:
            new_ids.add(str(pr_id))
    added = new_ids - current
    if not added:
        return None
    return emit(AUTOFIX_PRS.value(current | added))


@aggregator(
    deps=(CLOSING_PRS, AUTOFIX_PRS),
    outputs=(WAS_AUTOFIXED,),
)
def compute_was_autofixed(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    if state[WAS_AUTOFIXED]:
        return None  # already true, stays true
    autofix_prs = state[AUTOFIX_PRS]
    closing_prs = state[CLOSING_PRS]
    if autofix_prs and autofix_prs & closing_prs:
        return emit(WAS_AUTOFIXED.value(True))
    return None


# Progress state machine for open issues (None when closed).
#
# Forward-only ordering (later value never reverts to an earlier one,
# except via REGRESSED which restarts the cycle):
#
#   IDENTIFIED → TRIAGED → DIAGNOSED → FIX_PROPOSED → FIX_APPLIED → FIX_DEPLOYED
#       │            │          │            │               │             │
#       └────────────┴──────────┴────────────┴───────────────┴─────────────┘
#                                   │
#                               (RESOLVE / RESOLVED_IN_PULL_REQUEST)
#                                   ↓
#                                 None  (issue closed)
#                                   │
#                               (UNRESOLVE)
#                                   ↓
#                               REGRESSED → TRIAGED → ...
#
# Action type → minimum Progress level:
#   ASSIGN, SET_PRIORITY, MARK_REVIEWED,
#   TRIGGER_AUTOFIX                        →  TRIAGED
#   ROOT_CAUSE_IDENTIFIED                  →  DIAGNOSED
#   AUTOFIX_CODING_COMPLETE                →  FIX_PROPOSED
#   AUTOFIX_PR_CREATED                     →  FIX_PROPOSED
#   (PR merged — no action type yet)       →  FIX_APPLIED
#   (deploy seen — no action type yet)     →  FIX_DEPLOYED
#   RESOLVE, RESOLVED_IN_PULL_REQUEST      →  None (closed)
#   UNRESOLVE                              →  REGRESSED

# Ordered from earliest to latest so we can compare with index.
_PROGRESS_ORDER = [
    Progress.IDENTIFIED,
    Progress.REGRESSED,
    Progress.TRIAGED,
    Progress.DIAGNOSED,
    Progress.FIX_PROPOSED,
    Progress.FIX_APPLIED,
    Progress.FIX_DEPLOYED,
]
_PROGRESS_RANK = {p: i for i, p in enumerate(_PROGRESS_ORDER)}

# Actions that advance progress to at least this level.
_ACTION_TO_MIN_PROGRESS: dict[int, Progress] = {
    GroupActionType.ASSIGN: Progress.TRIAGED,
    GroupActionType.SET_PRIORITY: Progress.TRIAGED,
    GroupActionType.MARK_REVIEWED: Progress.TRIAGED,
    GroupActionType.TRIGGER_AUTOFIX: Progress.TRIAGED,
    GroupActionType.ROOT_CAUSE_IDENTIFIED: Progress.DIAGNOSED,
    GroupActionType.AUTOFIX_CODING_COMPLETE: Progress.FIX_PROPOSED,
    GroupActionType.AUTOFIX_PR_CREATED: Progress.FIX_PROPOSED,
}


@aggregator(
    deps=(STATUS,),
    outputs=(PROGRESS,),
)
def track_progress(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    current = state[PROGRESS]

    # Closed issues have no progress.
    if state[STATUS] != IssueStatus.OPEN:
        if current is not None:
            return emit(PROGRESS.value(None))
        return None

    # Reopened: if progress was None (just transitioned from closed), mark regressed.
    if current is None:
        return emit(PROGRESS.value(Progress.REGRESSED))

    # Check if this action advances progress forward.
    min_progress = _ACTION_TO_MIN_PROGRESS.get(entry.type)
    if min_progress is None:
        return None

    current_rank = _PROGRESS_RANK.get(Progress(current), 0)
    target_rank = _PROGRESS_RANK[min_progress]
    if target_rank > current_rank:
        return emit(PROGRESS.value(min_progress))

    return None


AGGREGATORS: list[Aggregator] = [
    track_views,
    track_status,
    track_last_opened,
    track_recent_viewers,
    compute_working_on,
    track_autofix_prs,
    compute_was_autofixed,
    track_progress,
]
