from sentry.issues.action_log.types import GroupActionType, ReconcileStatusAction
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
    StateView,
    aggregator,
    emit,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.progress_state import IssueProgressState


@aggregator((VIEW_COUNT,), scope=(GroupActionType.VIEW,))
def track_views(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    return emit(VIEW_COUNT.value(state[VIEW_COUNT] + 1))


_RESOLVES: frozenset[GroupActionType] = frozenset(
    {
        GroupActionType.RESOLVE,
        GroupActionType.RESOLVED_IN_PULL_REQUEST,
        GroupActionType.ARCHIVE,
    }
)

_REOPENS: frozenset[GroupActionType] = frozenset(
    {
        GroupActionType.UNRESOLVE,
        GroupActionType.SET_REGRESSED,
    }
)


@aggregator(
    (STATUS,),
    scope=(
        *_RESOLVES,
        *_REOPENS,
        GroupActionType.RECONCILE_STATUS,
    ),
)
def track_status(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    current = state[STATUS]

    if entry.type == GroupActionType.RECONCILE_STATUS:
        action = ReconcileStatusAction(**entry.data)
        new_status = IssueStatus(action.status)
        if new_status != current:
            return emit(STATUS.value(new_status))
    elif entry.type in _RESOLVES and current == IssueStatus.OPEN:
        return emit(STATUS.value(IssueStatus.CLOSED))
    elif entry.type in _REOPENS and current == IssueStatus.CLOSED:
        return emit(STATUS.value(IssueStatus.OPEN))

    return None


# Progress state machine for open issues (None when closed).
#
# Forward-only ordering (later value never reverts to an earlier one;
# reopening resets to IDENTIFIED):
#
#   IDENTIFIED → ASSIGNED → DIAGNOSED → FIX_PROPOSED → FIX_APPLIED
#       ↑            │          │            │               │
#       └────────────┴──────────┴────────────┴───────────────┘
#                                   │
#                               (RESOLVE / RESOLVED_IN_PULL_REQUEST)
#                                   ↓
#                                 None  (issue closed)
#                                   │
#                               (UNRESOLVE)
#                                   ↓
#                               IDENTIFIED → ASSIGNED → ...
#
# Action type → minimum Progress level:
#   ASSIGN, SET_PRIORITY, MARK_REVIEWED,
#   TRIGGER_AUTOFIX                        →  ASSIGNED
#   ROOT_CAUSE_IDENTIFIED                  →  DIAGNOSED
#   AUTOFIX_CODING_COMPLETE                →  FIX_PROPOSED
#   AUTOFIX_PR_CREATED                     →  FIX_PROPOSED
#   (PR merged — no action type yet)       →  FIX_APPLIED
#   RESOLVE, RESOLVED_IN_PULL_REQUEST      →  None (closed)
#   UNRESOLVE, SET_REGRESSED               →  IDENTIFIED

# Ordered from earliest to latest so we can compare with index.
_PROGRESS_ORDER = [
    IssueProgressState.IDENTIFIED,
    IssueProgressState.ASSIGNED,
    IssueProgressState.DIAGNOSED,
    IssueProgressState.FIX_PROPOSED,
    IssueProgressState.FIX_APPLIED,
]
_PROGRESS_RANK = {p: i for i, p in enumerate(_PROGRESS_ORDER)}

# Actions that advance progress to at least this level.
_ACTION_TO_MIN_PROGRESS: dict[int, IssueProgressState] = {
    GroupActionType.ASSIGN: IssueProgressState.ASSIGNED,
    GroupActionType.SET_PRIORITY: IssueProgressState.ASSIGNED,
    GroupActionType.MARK_REVIEWED: IssueProgressState.ASSIGNED,
    GroupActionType.TRIGGER_AUTOFIX: IssueProgressState.ASSIGNED,
    GroupActionType.ROOT_CAUSE_IDENTIFIED: IssueProgressState.DIAGNOSED,
    GroupActionType.AUTOFIX_CODING_COMPLETE: IssueProgressState.FIX_PROPOSED,
    GroupActionType.AUTOFIX_PR_CREATED: IssueProgressState.FIX_PROPOSED,
}


@aggregator(
    (PROGRESS, LAST_PROGRESSED_AT),
    deps=(STATUS,),
)
def track_progress(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    current = state[PROGRESS]
    ts = entry.date_added

    # Closed issues have no progress.
    if state[STATUS] != IssueStatus.OPEN:
        if current is not None:
            return emit(PROGRESS.value(None), LAST_PROGRESSED_AT.value(ts))
        return None

    # Reopened: reset to IDENTIFIED.
    if current is None:
        return emit(PROGRESS.value(IssueProgressState.IDENTIFIED), LAST_PROGRESSED_AT.value(ts))

    # Check if this action advances progress forward.
    min_progress = _ACTION_TO_MIN_PROGRESS.get(entry.type)
    if min_progress is None:
        return None

    current_rank = _PROGRESS_RANK[current]
    target_rank = _PROGRESS_RANK[min_progress]
    if target_rank > current_rank:
        return emit(PROGRESS.value(min_progress), LAST_PROGRESSED_AT.value(ts))

    return None


AGGREGATORS: list[Aggregator[GroupActionLogEntry]] = [
    track_views,
    track_status,
    track_progress,
]
