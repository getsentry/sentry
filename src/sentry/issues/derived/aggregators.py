from sentry.issues.action_log.types import (
    ArchiveAction,
    AssignAction,
    PullRequestClosedAction,
    ReconcileStatusAction,
    ResolveAction,
    ResolvedInPullRequestAction,
    RootCauseIdentifiedAction,
    SetRegressedAction,
    UnassignAction,
    UnresolveAction,
    ViewAction,
)
from sentry.issues.derived.features import (
    HAS_OPEN_FIX_PR,
    HAS_ROOT_CAUSE,
    IS_ASSIGNED,
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


@aggregator((VIEW_COUNT,), scope=(ViewAction,))
def track_views(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    return emit(VIEW_COUNT.value(state[VIEW_COUNT] + 1))


@aggregator(
    (STATUS,),
    scope=(
        ResolveAction,
        ArchiveAction,
        UnresolveAction,
        SetRegressedAction,
        ReconcileStatusAction,
    ),
)
def track_status(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    current = state[STATUS]

    match entry.action:
        case ReconcileStatusAction(status=raw_status):
            new_status = IssueStatus(raw_status)
            if new_status != current:
                return emit(STATUS.value(new_status))
        case ResolveAction() | ArchiveAction() if current == IssueStatus.OPEN:
            return emit(STATUS.value(IssueStatus.CLOSED))
        case UnresolveAction() | SetRegressedAction() if current == IssueStatus.CLOSED:
            return emit(STATUS.value(IssueStatus.OPEN))

    return None


# Progress for open issues (None when closed).
#
# Progress is dervived from a few features, which are tracked independently:
#
#   * IS_ASSIGNED     — issue has an assignee. Survives close/reopen.
#   * HAS_ROOT_CAUSE  — a root cause has been identified (diagnosed). Cleared on
#     regression (SET_REGRESSED), but preserved when manually reopened (UNRESOLVE).
#   * HAS_OPEN_FIX_PR — at least one PR which resolves the issue is still open.
#     Cleared when the last linked PR closes without being merged.
#
# Highest applicable stage wins:
#   HAS_OPEN_FIX_PR → FIX_PROPOSED
#   HAS_ROOT_CAUSE  → DIAGNOSED
#   IS_ASSIGNED     → ASSIGNED
#   (none)          → IDENTIFIED
#
#   IDENTIFIED → ASSIGNED → DIAGNOSED → FIX_PROPOSED → FIX_APPLIED
#                                (RESOLVE / ARCHIVE)         → None (closed)
#                                (UNRESOLVE / SET_REGRESSED) → Reopened


@aggregator(
    (IS_ASSIGNED,),
    scope=(
        AssignAction,
        UnassignAction,
    ),
)
def track_assignment(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    """Track whether the issue currently has an assignee."""
    is_assigned = isinstance(entry.action, AssignAction)
    if is_assigned != state[IS_ASSIGNED]:
        return emit(IS_ASSIGNED.value(is_assigned))
    return None


@aggregator(
    (HAS_ROOT_CAUSE,),
    scope=(
        RootCauseIdentifiedAction,
        SetRegressedAction,
    ),
)
def track_root_cause(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    """Track whether the issue has a root cause identified (i.e. is diagnosed).

    Set by ROOT_CAUSE_IDENTIFIED and cleared on regression (SET_REGRESSED), since
    a regressed issue is a fresh occurrence that needs re-diagnosing. A manual
    reopen (UNRESOLVE) preserves the diagnosis.
    """
    has_root_cause = isinstance(entry.action, RootCauseIdentifiedAction)
    if has_root_cause != state[HAS_ROOT_CAUSE]:
        return emit(HAS_ROOT_CAUSE.value(has_root_cause))
    return None


@aggregator(
    (HAS_OPEN_FIX_PR,),
    deps=(STATUS,),
    scope=(
        ResolvedInPullRequestAction,
        PullRequestClosedAction,
    ),
)
def track_open_fix_prs(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    """Track whether an issue has an open fix PR.
    When an issue has a fix PR created, the flag should be True.
    When the last open PR closes, the flag should be False.
    """
    current_has_open_fix_pr = state[HAS_OPEN_FIX_PR]

    # TODO(malwilley): Merging or unlinking a PR should also clear the flag.
    match entry.action:
        case ResolvedInPullRequestAction() if not current_has_open_fix_pr:
            return emit(HAS_OPEN_FIX_PR.value(True))
        case PullRequestClosedAction(has_other_open_prs=False) if current_has_open_fix_pr:
            return emit(HAS_OPEN_FIX_PR.value(False))

    return None


@aggregator(
    (PROGRESS, LAST_PROGRESSED_AT),
    deps=(STATUS, IS_ASSIGNED, HAS_ROOT_CAUSE, HAS_OPEN_FIX_PR),
)
def track_progress(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    current_progress = state[PROGRESS]

    if state[STATUS] != IssueStatus.OPEN:
        new_progress = None
    elif state[HAS_OPEN_FIX_PR]:
        new_progress = IssueProgressState.FIX_PROPOSED
    elif state[HAS_ROOT_CAUSE]:
        new_progress = IssueProgressState.DIAGNOSED
    elif state[IS_ASSIGNED]:
        new_progress = IssueProgressState.ASSIGNED
    else:
        new_progress = IssueProgressState.IDENTIFIED

    if new_progress != current_progress:
        return emit(PROGRESS.value(new_progress), LAST_PROGRESSED_AT.value(entry.date_added))
    return None


AGGREGATORS: list[Aggregator[GroupActionLogEntry]] = [
    track_views,
    track_status,
    track_assignment,
    track_root_cause,
    track_open_fix_prs,
    track_progress,
]
