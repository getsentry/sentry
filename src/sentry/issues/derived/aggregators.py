from sentry.issues.action_log.types import GroupActionType, GroupActorType
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
from sentry.issues.derived.lib import Aggregator, AggregatorResult, StateView, aggregator, emit
from sentry.issues.groupactionlogentry import GroupActionLogEntry

RECENT_EXPIRY_SECONDS = 30 * 24 * 60 * 60  # 1 month


@aggregator(outputs=(LAST_SEEN, VIEW_COUNT), scope=(GroupActionType.VIEW,))
def track_views(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    ts = entry.date_added.timestamp()
    current = state[LAST_SEEN]
    if current is None or ts > current:
        return emit(LAST_SEEN.value(ts), VIEW_COUNT.value(state[VIEW_COUNT] + 1))
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


AGGREGATORS: list[Aggregator] = [
    track_views,
    track_status,
    track_last_opened,
    track_recent_viewers,
    compute_working_on,
    track_autofix_prs,
    compute_was_autofixed,
]
