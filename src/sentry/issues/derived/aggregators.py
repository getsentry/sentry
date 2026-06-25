from sentry.issues.action_log.types import GroupActionType
from sentry.issues.derived.features import (
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    STATUS_FROM_MERGED,
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


@aggregator(
    (STATUS, STATUS_FROM_MERGED),
    scope=(
        GroupActionType.RESOLVE,
        GroupActionType.UNRESOLVE,
        GroupActionType.RESOLVED_IN_PULL_REQUEST,
        GroupActionType.ARCHIVE,
        GroupActionType.SET_REGRESSED,
    ),
)
def track_status(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    from_merged = entry.original_group_id is not None
    has_merged_status = state[STATUS_FROM_MERGED]
    if has_merged_status and not from_merged:
        return None

    current = state[STATUS]
    resolves = (
        GroupActionType.RESOLVE.value,
        GroupActionType.RESOLVED_IN_PULL_REQUEST.value,
        GroupActionType.ARCHIVE.value,
    )
    reopens = (
        GroupActionType.UNRESOLVE.value,
        GroupActionType.SET_REGRESSED.value,
    )
    new_status = current
    if entry.type in resolves and current == IssueStatus.OPEN:
        new_status = IssueStatus.CLOSED
    elif entry.type in reopens and current == IssueStatus.CLOSED:
        new_status = IssueStatus.OPEN

    if new_status == current and not (from_merged and not has_merged_status):
        return None
    return emit(
        STATUS.value(new_status), STATUS_FROM_MERGED.value(has_merged_status or from_merged)
    )


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
