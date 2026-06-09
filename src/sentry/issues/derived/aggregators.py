from sentry.issues.action_log.types import GroupActionType
from sentry.issues.derived.features import (
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    VIEW_COUNT,
    IssueStatus,
    Progress,
)
from sentry.issues.derived.framework import (
    Aggregator,
    AggregatorResult,
    StateView,
    aggregator,
    emit,
)
from sentry.issues.groupactionlogentry import GroupActionLogEntry


@aggregator((VIEW_COUNT,), scope=(GroupActionType.VIEW,))
def track_views(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    return emit(VIEW_COUNT.value(state[VIEW_COUNT] + 1))


@aggregator(
    (STATUS,),
    scope=(  # TODO: This is certainly incomplete.
        GroupActionType.RESOLVE,
        GroupActionType.UNRESOLVE,
        GroupActionType.RESOLVED_IN_PULL_REQUEST,
    ),
)
def track_status(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    current = state[STATUS]
    resolves = (GroupActionType.RESOLVE.value, GroupActionType.RESOLVED_IN_PULL_REQUEST.value)
    if entry.type in resolves and current == IssueStatus.OPEN:
        return emit(STATUS.value(IssueStatus.CLOSED))
    if entry.type == GroupActionType.UNRESOLVE.value and current == IssueStatus.CLOSED:
        return emit(STATUS.value(IssueStatus.OPEN))
    return None


# Progress state machine for open issues (None when closed).
#
# Forward-only ordering (later value never reverts to an earlier one,
# except via REGRESSED which restarts the cycle):
#
#   IDENTIFIED → TRIAGED → DIAGNOSED → FIX_PROPOSED → FIX_APPLIED
#       │            │          │            │               │
#       └────────────┴──────────┴────────────┴───────────────┘
#                                   │
#                               (RESOLVE / RESOLVED_IN_PULL_REQUEST)
#                                   ↓
#                                 None  (issue closed)
#                                   │
#                               (UNRESOLVE)
#                                   ↓
#                               REGRESSED → TRIAGED → ...
#
# Rank order: IDENTIFIED < REGRESSED < TRIAGED < ... < FIX_APPLIED
# REGRESSED is ranked just above IDENTIFIED so any triage action
# (ASSIGN, SET_PRIORITY, etc.) advances it forward to TRIAGED.
#
# Action type → minimum Progress level:
#   ASSIGN, SET_PRIORITY, MARK_REVIEWED,
#   TRIGGER_AUTOFIX                        →  TRIAGED
#   ROOT_CAUSE_IDENTIFIED                  →  DIAGNOSED
#   AUTOFIX_CODING_COMPLETE                →  FIX_PROPOSED
#   AUTOFIX_PR_CREATED                     →  FIX_PROPOSED
#   (PR merged — no action type yet)       →  FIX_APPLIED
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

    # Reopened: if progress was None (just transitioned from closed), mark regressed.
    if current is None:
        return emit(PROGRESS.value(Progress.REGRESSED), LAST_PROGRESSED_AT.value(ts))

    # Check if this action advances progress forward.
    min_progress = _ACTION_TO_MIN_PROGRESS.get(entry.type)
    if min_progress is None:
        return None

    current_rank = _PROGRESS_RANK.get(Progress(current), 0)
    target_rank = _PROGRESS_RANK[min_progress]
    if target_rank > current_rank:
        return emit(PROGRESS.value(min_progress), LAST_PROGRESSED_AT.value(ts))

    return None


AGGREGATORS: list[Aggregator] = [
    track_views,
    track_status,
    track_progress,
]
