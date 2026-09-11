from sentry.issues.action_log.types import (
    ArchiveAction,
    AssignAction,
    AutofixCodingCompleteAction,
    PullRequestClosedAction,
    PullRequestMergedAction,
    PullRequestReopenedAction,
    PullRequestUnlinkedAction,
    ReconcileStatusAction,
    ResolveAction,
    ResolvedInPullRequestAction,
    RootCauseIdentifiedAction,
    SeerCodingCompletedAction,
    SeerCodingStartedAction,
    SeerIterationCompletedAction,
    SeerIterationStartedAction,
    SeerPRCreatedAction,
    SeerRCACompletedAction,
    SeerRCAStartedAction,
    SeerSolutionCompletedAction,
    SeerSolutionStartedAction,
    SetEscalatingAction,
    SetRegressedAction,
    SetResolvedByAgeAction,
    SetResolvedInCommitAction,
    SetResolvedInReleaseAction,
    UnassignAction,
    UnresolveAction,
    ViewAction,
)
from sentry.issues.derived.features import (
    _COUNTERFACTUAL_STATUS,
    _MIRROR_STATUS,
    _WATCHED_RECONCILE_ID,
    BLOCKER,
    FIRST_NO_CHANGE_RECONCILE_ID,
    FIRST_SUPERSEDED_RECONCILE_ID,
    HAS_OPEN_FIX_PR,
    HAS_ROOT_CAUSE,
    IS_ASSIGNED,
    LAST_COMPLETED_AUTOFIX_STEP,
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    VIEW_COUNT,
    IssueStatus,
)
from sentry.issues.derived.framework import (
    Aggregator,
    AggregatorResult,
    Scope,
    StateView,
    aggregator,
    emit,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.progress_state import IssueProgressState
from sentry.types.group import IssueAutofixStep, IssueBlocker


@aggregator((VIEW_COUNT,), scope=(ViewAction,))
def track_views(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    return emit(VIEW_COUNT.value(state[VIEW_COUNT] + 1))


_STATUS_SCOPE = (
    ResolveAction,
    SetResolvedInReleaseAction,
    SetResolvedByAgeAction,
    SetResolvedInCommitAction,
    ArchiveAction,
    UnresolveAction,
    SetEscalatingAction,
    SetRegressedAction,
    ReconcileStatusAction,
)


def _natural_status_transition(current: IssueStatus, entry: GroupActionLogEntry) -> IssueStatus:
    """New status after a non-reconcile status action. Unchanged if the entry is a no-op."""
    match entry.action:
        case (
            ResolveAction()
            | SetResolvedInReleaseAction()
            | SetResolvedByAgeAction()
            | SetResolvedInCommitAction()
            | ArchiveAction()
        ) if current == IssueStatus.OPEN:
            return IssueStatus.CLOSED
        case UnresolveAction() | SetRegressedAction() | SetEscalatingAction() if (
            current == IssueStatus.CLOSED
        ):
            return IssueStatus.OPEN
    return current


@aggregator(
    (STATUS, FIRST_NO_CHANGE_RECONCILE_ID),
    scope=_STATUS_SCOPE,
)
def track_status(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    # A merge preserves the destination group's status. Ignore actions migrated
    # from source groups so their history cannot overwrite that status.
    if entry.original_group_id is not None:
        return None

    current = state[STATUS]

    match entry.action:
        case ReconcileStatusAction(status=raw_status):
            new_status = IssueStatus(raw_status)
            if new_status != current:
                return emit(STATUS.value(new_status))
            if state[FIRST_NO_CHANGE_RECONCILE_ID] is None:
                return emit(FIRST_NO_CHANGE_RECONCILE_ID.value(entry.id))
            return None
        case _:
            new_status = _natural_status_transition(current, entry)
            if new_status != current:
                return emit(STATUS.value(new_status))

    return None


@aggregator(
    (
        FIRST_SUPERSEDED_RECONCILE_ID,
        _MIRROR_STATUS,
        _COUNTERFACTUAL_STATUS,
        _WATCHED_RECONCILE_ID,
    ),
    scope=_STATUS_SCOPE,
)
def track_reconcile_redundancy(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    """Detect ReconcileStatusActions that a later natural event would have made redundant.

    Maintains a self-contained STATUS mirror plus a counterfactual mirror that
    ignores the currently-watched reconcile. When the two converge, the watched
    reconcile is superseded. Any subsequent reconcile cancels an in-flight watch.
    """
    if state[FIRST_SUPERSEDED_RECONCILE_ID] is not None:
        return None
    if entry.original_group_id is not None:
        return None

    mirror = state[_MIRROR_STATUS]
    counterfactual = state[_COUNTERFACTUAL_STATUS]
    watched = state[_WATCHED_RECONCILE_ID]

    match entry.action:
        case ReconcileStatusAction(status=raw_status):
            target = IssueStatus(raw_status)
            # Any reconcile invalidates an in-flight watch; a status-changing
            # reconcile then starts a fresh watch on itself.
            if target != mirror:
                return emit(
                    _MIRROR_STATUS.value(target),
                    _COUNTERFACTUAL_STATUS.value(mirror),
                    _WATCHED_RECONCILE_ID.value(entry.id),
                )
            if watched is None:
                return None
            return emit(
                _COUNTERFACTUAL_STATUS.value(None),
                _WATCHED_RECONCILE_ID.value(None),
            )
        case _:
            new_mirror = _natural_status_transition(mirror, entry)
            if watched is None:
                if new_mirror == mirror:
                    return None
                return emit(_MIRROR_STATUS.value(new_mirror))

            assert counterfactual is not None
            new_counterfactual = _natural_status_transition(counterfactual, entry)
            if new_mirror == new_counterfactual:
                return emit(
                    FIRST_SUPERSEDED_RECONCILE_ID.value(watched),
                    _MIRROR_STATUS.value(new_mirror),
                    _COUNTERFACTUAL_STATUS.value(None),
                    _WATCHED_RECONCILE_ID.value(None),
                )
            if new_mirror == mirror and new_counterfactual == counterfactual:
                return None
            return emit(
                _MIRROR_STATUS.value(new_mirror),
                _COUNTERFACTUAL_STATUS.value(new_counterfactual),
            )


# Progress for open issues (None when closed).
#
# Progress is derived from a few features, which are tracked independently:
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
# A merged fix PR advances progress to FIX_APPLIED, which remains sticky until
# the issue closes.
#
#   IDENTIFIED → ASSIGNED → DIAGNOSED → FIX_PROPOSED → FIX_APPLIED
#   (RESOLVE / ARCHIVE) → None (closed)
#   (UNRESOLVE / SET_REGRESSED) → Reopen


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
        SeerRCACompletedAction,
        SetRegressedAction,
    ),
)
def track_root_cause(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    """Track whether the issue has a root cause identified (i.e. is diagnosed).

    Set by ROOT_CAUSE_IDENTIFIED or SEER_RCA_COMPLETED and cleared on regression
    (SET_REGRESSED), since a regressed issue is a fresh occurrence that needs
    re-diagnosing. A manual reopen (UNRESOLVE) preserves the diagnosis.
    """
    has_root_cause = isinstance(entry.action, (RootCauseIdentifiedAction, SeerRCACompletedAction))
    if has_root_cause != state[HAS_ROOT_CAUSE]:
        return emit(HAS_ROOT_CAUSE.value(has_root_cause))
    return None


@aggregator(
    (HAS_OPEN_FIX_PR,),
    scope=(
        ResolvedInPullRequestAction,
        PullRequestClosedAction,
        PullRequestReopenedAction,
        PullRequestMergedAction,
        PullRequestUnlinkedAction,
    ),
)
def track_open_fix_prs(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    """Track whether an issue has an open fix PR.
    When an issue has a fix PR created or reopened, the flag should be True.
    When the last open PR closes, merges, or is unlinked, the flag should be False.
    """
    current_has_open_fix_pr = state[HAS_OPEN_FIX_PR]

    match entry.action:
        case ResolvedInPullRequestAction() | PullRequestReopenedAction() if (
            not current_has_open_fix_pr
        ):
            return emit(HAS_OPEN_FIX_PR.value(True))
        case (
            PullRequestClosedAction(has_other_open_prs=False)
            | PullRequestMergedAction(has_other_open_prs=False)
            | PullRequestUnlinkedAction(has_other_open_prs=False)
        ) if current_has_open_fix_pr:
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
    elif entry.type == PullRequestMergedAction.get_type() or (
        current_progress == IssueProgressState.FIX_APPLIED
        and entry.type
        # Usually an issue will first close before it regresses, but there are cases where a regression action
        #  is seen without a resolution action. This handles that case and clears the FIX_APPLIED progress.
        not in (
            UnresolveAction.get_type(),
            SetRegressedAction.get_type(),
        )
    ):
        new_progress = IssueProgressState.FIX_APPLIED
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


@aggregator(
    (LAST_COMPLETED_AUTOFIX_STEP,),
    scope=(
        AutofixCodingCompleteAction,
        RootCauseIdentifiedAction,
        SeerCodingCompletedAction,
        SeerCodingStartedAction,
        SeerIterationCompletedAction,
        SeerIterationStartedAction,
        SeerPRCreatedAction,
        SeerRCACompletedAction,
        SeerRCAStartedAction,
        SeerSolutionCompletedAction,
        SeerSolutionStartedAction,
    ),
)
def track_last_completed_autofix_step(
    state: StateView, entry: GroupActionLogEntry
) -> AggregatorResult:
    """Track how far along we are in the autofix flow. This feeds into the `BLOCKER` feature."""
    current_step = state[LAST_COMPLETED_AUTOFIX_STEP]
    new_step = current_step

    match entry.action:
        case RootCauseIdentifiedAction() | SeerRCAStartedAction() | SeerRCACompletedAction():
            new_step = IssueAutofixStep.ROOT_CAUSE
        case SeerSolutionStartedAction() | SeerSolutionCompletedAction():
            new_step = IssueAutofixStep.SOLUTION
        case (
            AutofixCodingCompleteAction() | SeerCodingStartedAction() | SeerCodingCompletedAction()
        ):
            new_step = IssueAutofixStep.CODE_CHANGES
        case SeerPRCreatedAction():
            new_step = IssueAutofixStep.PR_CREATED
        case SeerIterationStartedAction() | SeerIterationCompletedAction():
            new_step = IssueAutofixStep.PR_ITERATION

    if new_step != current_step:
        return emit(LAST_COMPLETED_AUTOFIX_STEP.value(new_step))
    return None


@aggregator(
    (BLOCKER,),
    deps=(STATUS, HAS_OPEN_FIX_PR, LAST_COMPLETED_AUTOFIX_STEP),
    scope=Scope.DEPS,
)
def track_blocker(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
    """Track the human action blocking the issue's progress toward resolution.
    If there are open PRs, the blocker is MERGE_PR.
    Otherwise, the blocker is decided by the last completed pre-PR autofix step.
    """
    current = state[BLOCKER]
    new_blocker = current

    if state[STATUS] != IssueStatus.OPEN:
        new_blocker = IssueBlocker.NONE
    elif state[HAS_OPEN_FIX_PR]:
        new_blocker = IssueBlocker.MERGE_PR
    else:
        match state[LAST_COMPLETED_AUTOFIX_STEP]:
            case (
                IssueAutofixStep.NONE | IssueAutofixStep.PR_CREATED | IssueAutofixStep.PR_ITERATION
            ):
                new_blocker = IssueBlocker.NONE
            case IssueAutofixStep.ROOT_CAUSE:
                new_blocker = IssueBlocker.APPROVE_ROOT_CAUSE
            case IssueAutofixStep.SOLUTION:
                new_blocker = IssueBlocker.APPROVE_PLAN
            case IssueAutofixStep.CODE_CHANGES:
                new_blocker = IssueBlocker.APPROVE_CODE_CHANGES

    if new_blocker != current:
        return emit(BLOCKER.value(new_blocker))
    return None


AGGREGATORS: list[Aggregator[GroupActionLogEntry]] = [
    track_views,
    track_status,
    track_reconcile_redundancy,
    track_assignment,
    track_root_cause,
    track_open_fix_prs,
    track_progress,
    track_last_completed_autofix_step,
    track_blocker,
]
