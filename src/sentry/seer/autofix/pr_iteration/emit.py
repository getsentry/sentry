"""PR-iteration analytics, buffered per iteration and flushed when one ends.

Each iteration gets a ``SeerRunPrIteration`` row (see ``details_store``), opened
when its first feedback item is queued and named by that row's id. Two iterations
are in play whenever feedback for the next one arrives while Seer is still
working on the current one, so they get a row each rather than sharing one.

The id rides the agent's memory-block metadata (``iteration_id``), which is how
the completion hook knows which row the finished work belongs to.

Nothing here may change what the product does. Every entry point swallows its
own failures: a caller records what it can and carries on regardless.
"""

from __future__ import annotations

from dataclasses import fields
from enum import StrEnum
from typing import TypeVar

from django.utils import timezone

from sentry import analytics
from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationFeedbackBatchBlockedEvent,
    AiAutofixPrIterationFeedbackBatchCompletedEvent,
)
from sentry.models.group import Group
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.autofix_agent import get_iterations, get_latest_iteration_index
from sentry.seer.autofix.pr_iteration.details_store import (
    add_iteration,
    claim_iteration,
    get_iteration,
    remove_iteration,
    untriggered_iteration,
    update_iteration,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.models.run import SeerRun, SeerRunPrIteration

ITERATION_ID_METADATA_KEY = "iteration_id"

EventT = TypeVar("EventT", bound=analytics.Event)

# Blocking outcomes a row has already reported, so each is emitted once per
# iteration.
BLOCKED_OUTCOMES_DATA_KEY = "blocked_outcomes"


class PrIterationOutcome(StrEnum):
    """How far a batch got. Ending values below the blocking ones.

    The ending values go on the completed event, the blocking values on the
    blocked event. ``MISSING_PERMISSIONS`` only holds a batch up, so a batch
    blocked on it reports both: the block now, and an ending value later, once
    the app is granted what it needs and the work runs.

    The ``PAUSED_`` values are the opposite, and the reason they name the pause
    rather than just reporting one: nothing lifts a pause, so a batch blocked
    on one never runs and reports no ending at all. Whether the feedback was
    abandoned because someone asked Seer to stop or because the run before it
    broke is the whole question those rows answer. One per ``PauseReason``, and
    :func:`outcome_for_pause` says so when the two lists drift apart.

    ``ALREADY_PUSHED`` is the success: the batch is recorded on the hook pass
    where its changes are on the PR, not on the earlier pass that only asked
    for the push.

    The failure values are Seer's own ``ExplorerFailureReason`` spellings, so a
    reason Seer adds since is recorded under its own outcome by
    :func:`outcome_for_failed_run` rather than folded into ``ERRORED``.
    """

    ALREADY_PUSHED = "already_pushed"
    NO_CODE_CHANGES = "no_code_changes"
    NO_PULL_REQUEST = "no_pull_request"
    PR_CLOSED = "pr_closed"
    PR_CREATION_ERRORED = "pr_creation_errored"
    PUSH_FAILED = "push_failed"
    TIMEOUT = "timeout"
    STALLED = "stalled"
    ERRORED = "errored"

    MISSING_PERMISSIONS = "missing_permissions"
    PAUSED = "paused"
    PAUSED_USER_STOP = "paused_user_stop"
    PAUSED_RUN_ERRORED = "paused_run_errored"


# The pause reasons this module names an outcome for, derived so that adding a
# ``PAUSED_`` member above is all it takes to report that reason as itself.
_PAUSE_OUTCOMES = frozenset(
    outcome.value
    for outcome in PrIterationOutcome
    if outcome.value.startswith(f"{PrIterationOutcome.PAUSED.value}_")
)


def outcome_for_failed_run(run_state: SeerRunState) -> str:
    """Seer's reason for a failed run, or ``ERRORED`` when it did not give one.

    Only a failed run carries a reason; every other ending is decided from what
    the batch left on the PR.
    """
    return run_state.failure_reason or PrIterationOutcome.ERRORED.value


def outcome_for_pause(log_ctx: PrIterationLogContext, reason: str | None) -> str:
    """The outcome for a batch that arrived after the run was paused.

    Only the reasons named above are reported as themselves. A ``PauseReason``
    added to ``pause`` without an outcome here is logged and reported as plain
    ``PAUSED``, so the batch is still counted under an outcome that already
    means something rather than opening a value nothing here has defined.
    ``PAUSED`` also covers a marker too old or too new to name its reason.
    """
    if reason is None:
        return PrIterationOutcome.PAUSED.value

    outcome = f"{PrIterationOutcome.PAUSED.value}_{reason}"
    if outcome in _PAUSE_OUTCOMES:
        return outcome

    log_ctx.error(
        "autofix.pr_iteration.details.unknown_pause_reason", exc_info=False, pause_reason=reason
    )
    return PrIterationOutcome.PAUSED.value


def _seer_run(*, run_id: int, organization_id: int) -> SeerRun | None:
    return SeerRun.objects.filter(seer_run_state_id=run_id, organization_id=organization_id).first()


def _claim_untriggered(seer_run: SeerRun) -> SeerRunPrIteration | None:
    """The run's waiting iteration, claimed. None when another caller won it.

    A unique constraint allows one waiting row for each run.
    """
    iteration = untriggered_iteration(seer_run)
    if iteration is None or not claim_iteration(iteration):
        return None
    return iteration


def open_pr_iteration_details(
    *,
    log_ctx: PrIterationLogContext,
    run_state: SeerRunState,
    organization_id: int,
    group_id: int,
) -> None:
    """Open a row for the iteration this feedback starts.

    The run metadata is resolved once here and carried until the iteration ends.
    """
    try:
        seer_run = _seer_run(run_id=run_state.run_id, organization_id=organization_id)
        if seer_run is None:
            log_ctx.error(
                "autofix.pr_iteration.details.unresolved", exc_info=False, reason="no_seer_run"
            )
            return

        project_id = (
            Group.objects.filter(id=group_id, project__organization_id=organization_id)
            .values_list("project_id", flat=True)
            .first()
        )
        if project_id is None:
            log_ctx.error(
                "autofix.pr_iteration.details.unresolved", exc_info=False, reason="group_not_found"
            )
            return

        add_iteration(
            seer_run,
            {
                "organization_id": organization_id,
                "project_id": project_id,
                "group_id": group_id,
                "run_id": run_state.run_id,
            },
        )
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.open_failed")


def trigger_pr_iteration_details(
    *,
    log_ctx: PrIterationLogContext,
    run_id: int,
    organization_id: int,
    trigger_source: str | None,
) -> int | None:
    """Claim the waiting iteration for the drain that is about to pop the queue.

    The claim comes before the pop, so feedback that arrives while the drain
    works opens its own row instead of conflicting with this one. The returned
    id travels with the agent request, so the completion hook finds this row.
    """
    try:
        seer_run = _seer_run(run_id=run_id, organization_id=organization_id)
        if seer_run is None:
            return None

        iteration = _claim_untriggered(seer_run)
        if iteration is None:
            return None

        update_iteration(iteration, trigger_source=trigger_source)
        return iteration.id
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.trigger_failed")
        return None


def record_pr_iteration_counts(
    *,
    log_ctx: PrIterationLogContext,
    run_id: int,
    organization_id: int,
    iteration_id: int,
    referrer: str | None,
    feedback_count: int,
    queued_count: int,
    dropped_count: int,
    automated_feedback_count: int,
) -> None:
    """Write what the drain saw onto the row it claimed."""
    try:
        seer_run = _seer_run(run_id=run_id, organization_id=organization_id)
        if seer_run is None:
            return

        iteration = get_iteration(seer_run, iteration_id)
        if iteration is None:
            return

        update_iteration(
            iteration,
            referrer=referrer,
            feedback_count=feedback_count,
            queued_count=queued_count,
            dropped_count=dropped_count,
            automated_feedback_count=automated_feedback_count,
        )
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.counts_failed")


def discard_pr_iteration_details(
    *, log_ctx: PrIterationLogContext, run_id: int, organization_id: int, iteration_id: int
) -> None:
    """Drop the row of an iteration that will never reach the agent."""
    try:
        seer_run = _seer_run(run_id=run_id, organization_id=organization_id)
        if seer_run is None:
            return

        iteration = get_iteration(seer_run, iteration_id)
        if iteration is None:
            return

        remove_iteration(iteration)
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.discard_failed")


def state_iteration_id(log_ctx: PrIterationLogContext, run_state: SeerRunState) -> int | None:
    """The id the run's latest iteration was started with."""
    try:
        iterations = get_iterations(run_state)
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.get_iterations_failed")
        return None

    if not iterations or not iterations[-1].blocks:
        return None

    metadata = iterations[-1].blocks[0].message.metadata or {}
    try:
        # Prompt metadata is a string map; the id goes out stringified.
        return int(metadata[ITERATION_ID_METADATA_KEY])
    except (KeyError, TypeError, ValueError):
        return None


def _build_event(
    log_ctx: PrIterationLogContext,
    iteration: SeerRunPrIteration,
    event_cls: type[EventT],
    *,
    iteration_index: int,
    outcome: str,
) -> EventT | None:
    """An event filled from an iteration's row. None when that row is incomplete.

    The row accumulates whatever each stage of the batch learned, and the event
    class decides how much of that is in scope: a blocked event takes the four
    identity fields and leaves the drain's behind, still on the row, for the
    completed event to pick up if the batch gets that far.
    """
    known = {f.name for f in fields(event_cls)}
    payload = {key: value for key, value in iteration.data.items() if key in known}
    duration_ms = int((timezone.now() - iteration.date_added).total_seconds() * 1000)
    try:
        return event_cls(
            iteration_id=iteration.id,
            iteration_index=iteration_index,
            duration_ms=duration_ms,
            outcome=outcome,
            **payload,
        )
    except TypeError:
        written = payload.keys() | {
            "iteration_id",
            "iteration_index",
            "duration_ms",
            "outcome",
        }
        log_ctx.error(
            "autofix.pr_iteration.details.incomplete_row",
            exc_info=False,
            iteration_id=iteration.id,
            missing=sorted(known - written),
        )
        return None


def record_pr_iteration_blocked(
    *,
    log_ctx: PrIterationLogContext,
    run_state: SeerRunState,
    run_id: int,
    organization_id: int,
    outcome: str,
) -> None:
    """Record that the run's waiting iteration is blocked, once per outcome.

    Unlike :func:`complete_pr_iteration_details`, this neither claims nor
    removes the row. For a block that lifts, such as missing permissions, that
    is because the batch has not ended: it reaches the agent once the block
    clears and completes on its own, so this is a checkpoint on top of that
    completion rather than a substitute for it.

    For a block that never lifts, such as a paused run, the row stays for a
    different reason. Keeping it is what holds the ``blocked_outcomes`` marker,
    and the marker is the only thing stopping a batch nothing will ever drain
    from recording itself again on every check suite the PR produces. Nothing
    completes those rows; the stale-row sweep is what eventually takes them.

    Which outcomes a row has already reported lives on the row, so a gate that
    re-checks on every failing check suite still says each one once.
    """
    try:
        seer_run = _seer_run(run_id=run_id, organization_id=organization_id)
        if seer_run is None:
            return

        iteration = untriggered_iteration(seer_run)
        if iteration is None:
            return

        recorded = iteration.data.get(BLOCKED_OUTCOMES_DATA_KEY) or []
        if outcome in recorded:
            return

        event = _build_event(
            log_ctx,
            iteration,
            AiAutofixPrIterationFeedbackBatchBlockedEvent,
            iteration_index=get_latest_iteration_index(run_state),
            outcome=outcome,
        )
        if event is None:
            return

        # Marked before the record, so a failing emit costs one event rather
        # than repeating on every later check of the same outcome.
        update_iteration(iteration, **{BLOCKED_OUTCOMES_DATA_KEY: [*recorded, outcome]})
        analytics.record(event)
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.blocked_failed")


def complete_pr_iteration_details(
    *,
    log_ctx: PrIterationLogContext,
    run_state: SeerRunState,
    organization_id: int,
    outcome: str,
) -> None:
    """Emit the row for the iteration that just ended, and drop it.

    The row goes however the batch ended: leaving it behind would let the next
    completion hook emit this batch under a later iteration's outcome.
    """
    iteration_id = state_iteration_id(log_ctx, run_state)
    if iteration_id is None:
        log_ctx.error(
            "autofix.pr_iteration.details.unresolved", exc_info=False, reason="no_iteration_id"
        )
        return

    try:
        seer_run = _seer_run(run_id=run_state.run_id, organization_id=organization_id)
        if seer_run is None:
            log_ctx.error(
                "autofix.pr_iteration.details.unresolved", exc_info=False, reason="no_seer_run"
            )
            return

        iteration = get_iteration(seer_run, iteration_id)
        if iteration is None:
            log_ctx.info("autofix.pr_iteration.details.skipped", reason="already_emitted")
            return

        event = _build_event(
            log_ctx,
            iteration,
            AiAutofixPrIterationFeedbackBatchCompletedEvent,
            iteration_index=get_latest_iteration_index(run_state),
            outcome=outcome,
        )
        if event is None or not remove_iteration(iteration):
            return

        analytics.record(event)
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.complete_failed")
