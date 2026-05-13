"""
Aggregator definitions.

Each aggregator processes one IssueActionLog entry at a time, reading from
declared dep fields and writing to declared output fields.
"""

from sentry.issues.derived.fields import (
    AUTOFIX_PRS,
    CLOSING_PRS,
    LAST_OPENED,
    LAST_SEEN,
    RECENT_FETCHED,
    RECENT_VIEWERS,
    STATUS,
    VIEW_COUNT,
    WAS_AUTOFIXED,
    WORKING_ON,
    FetchInfo,
    IssueStatus,
    WorkingOnEntry,
)
from sentry.issues.derived.lib import Aggregator, AggregatorResult, StateView, aggregator, emit
from sentry.issues.derived.types import IssueActionType
from sentry.models.issueactionlog import IssueActionLog

RECENT_EXPIRY_SECONDS = 30 * 24 * 60 * 60  # 1 month


@aggregator(outputs=(LAST_SEEN, VIEW_COUNT), scope=(IssueActionType.VIEW,))
def track_views(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    ts = entry.date_added.timestamp()
    current = state[LAST_SEEN]
    if current is None or ts > current:
        return emit(LAST_SEEN.value(ts), VIEW_COUNT.value(state[VIEW_COUNT] + 1))
    return emit(VIEW_COUNT.value(state[VIEW_COUNT] + 1))


@aggregator(
    outputs=(STATUS, CLOSING_PRS),
    scope=(
        IssueActionType.SET_RESOLVED,
        IssueActionType.SET_UNRESOLVED,
        IssueActionType.RESOLVED_IN_PULL_REQUEST,
    ),
)
def track_status(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    current = state[STATUS]
    resolves = (IssueActionType.SET_RESOLVED.value, IssueActionType.RESOLVED_IN_PULL_REQUEST.value)
    if entry.type in resolves and current == IssueStatus.OPEN:
        closing_prs: list[str] = list(state[CLOSING_PRS])
        pr_id = entry.data.get("pr_id")
        if entry.type == IssueActionType.RESOLVED_IN_PULL_REQUEST.value and pr_id:
            closing_prs.append(pr_id)
        return emit(STATUS.value(IssueStatus.CLOSED), CLOSING_PRS.value(closing_prs))
    if entry.type == IssueActionType.SET_UNRESOLVED.value and current == IssueStatus.CLOSED:
        return emit(STATUS.value(IssueStatus.OPEN), CLOSING_PRS.value([]))
    return None


@aggregator(
    outputs=(LAST_OPENED,),
    scope=(IssueActionType.SET_UNRESOLVED,),
)
def track_last_opened(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    return emit(LAST_OPENED.value(entry.date_added.timestamp()))


@aggregator(outputs=(RECENT_VIEWERS,), scope=(IssueActionType.VIEW,))
def track_recent_viewers(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    if entry.user_id is None:
        return None

    ts = entry.date_added.timestamp()
    cutoff = ts - RECENT_EXPIRY_SECONDS
    current = state[RECENT_VIEWERS]

    updated = {uid: t for uid, t in current.items() if t >= cutoff}
    updated[str(entry.user_id)] = ts

    return emit(RECENT_VIEWERS.value(updated))


@aggregator(outputs=(RECENT_FETCHED,), scope=(IssueActionType.FETCH,))
def track_recent_fetched(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    if entry.user_id is None:
        return None

    ts = entry.date_added.timestamp()
    cutoff = ts - RECENT_EXPIRY_SECONDS
    current = state[RECENT_FETCHED]

    updated = {uid: info for uid, info in current.items() if info.ts >= cutoff}
    updated[str(entry.user_id)] = FetchInfo(ts=ts, tool=entry.data.get("tool"))

    return emit(RECENT_FETCHED.value(updated))


@aggregator(
    deps=(STATUS, LAST_OPENED, RECENT_VIEWERS, RECENT_FETCHED),
    outputs=(WORKING_ON,),
)
def compute_working_on(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    current = state[WORKING_ON]

    if state[STATUS] != IssueStatus.OPEN:
        if current:
            return emit(WORKING_ON.value({}))
        return None

    # Only count activity since the last reopen (or all time if never closed).
    opened_at = state[LAST_OPENED] or 0

    # Collect active users: anyone who viewed or fetched since opened_at.
    active: dict[str, WorkingOnEntry] = {}
    for uid, ts in state[RECENT_VIEWERS].items():
        if ts >= opened_at:
            active[uid] = WorkingOnEntry(since=ts)

    for uid, info in state[RECENT_FETCHED].items():
        if info.ts >= opened_at:
            if uid in active:
                active[uid] = WorkingOnEntry(
                    since=min(active[uid].since, info.ts),
                    tool=info.tool,
                )
            else:
                active[uid] = WorkingOnEntry(since=info.ts, tool=info.tool)

    # Carry forward existing "since" for users still active — their first
    # engagement in this open period shouldn't move forward.
    for uid, candidate in active.items():
        if uid in current and current[uid].since < candidate.since:
            active[uid] = WorkingOnEntry(since=current[uid].since, tool=candidate.tool)

    if active == current:
        return None
    return emit(WORKING_ON.value(active))


@aggregator(
    outputs=(AUTOFIX_PRS,),
    scope=(IssueActionType.AUTOFIX_PR_CREATED,),
)
def track_autofix_prs(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    pr_id = entry.data.get("pr_id")
    if not pr_id:
        return None
    current: list[str] = state[AUTOFIX_PRS]
    if pr_id in current:
        return None
    return emit(AUTOFIX_PRS.value(current + [pr_id]))


@aggregator(
    deps=(CLOSING_PRS, AUTOFIX_PRS),
    outputs=(WAS_AUTOFIXED,),
)
def compute_was_autofixed(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    if state[WAS_AUTOFIXED]:
        return None  # already true, stays true
    autofix_prs: list[str] = state[AUTOFIX_PRS]
    closing_prs: list[str] = state[CLOSING_PRS]
    if autofix_prs and set(autofix_prs).intersection(closing_prs):
        return emit(WAS_AUTOFIXED.value(True))
    return None


AGGREGATORS: list[Aggregator] = [
    track_views,
    track_status,
    track_last_opened,
    track_recent_viewers,
    track_recent_fetched,
    compute_working_on,
    track_autofix_prs,
    compute_was_autofixed,
]
