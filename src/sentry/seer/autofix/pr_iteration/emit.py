"""PR-iteration analytics, buffered per iteration and flushed when one ends.

Each iteration gets a ``SeerRunPrIteration`` row (see ``details_store``), opened
when its first feedback item is queued and named by that row's id. Two iterations
are in play whenever feedback for the next one arrives while Seer is still
working on the current one, so they get a row each rather than sharing one.

The id rides the agent's memory-block metadata (``iteration_id``), which is how
the completion hook knows which row the finished work belongs to.

Nothing here may change what the product does. Every entry point swallows its
own failures: a caller records what it can and carries on regardless --
``bootstrap_iteration`` excepted, since it runs before there is an identity to
record under.
"""

from __future__ import annotations

import logging
from dataclasses import fields
from enum import StrEnum

from sentry import analytics
from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationFeedbackBatchCompletedEvent,
)
from sentry.models.group import Group
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.autofix_agent import get_latest_iteration_index
from sentry.seer.autofix.pr_iteration.current_iteration import triggered_iteration_id
from sentry.seer.autofix.pr_iteration.details_store import (
    claim_iteration,
    get_iteration,
    remove_iteration,
    untriggered_iteration,
    update_iteration,
)
from sentry.seer.autofix.pr_iteration.logs import LogCtxIteration, PrIterationLogContext
from sentry.seer.models.run import SeerRun, SeerRunPrIteration


class PrIterationOutcome(StrEnum):
    """How a batch ended.

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


def outcome_for_failed_run(run_state: SeerRunState) -> str:
    """Seer's reason for a failed run, or ``ERRORED`` when it did not give one.

    Only a failed run carries a reason; every other ending is decided from what
    the batch left on the PR.
    """
    return run_state.failure_reason or PrIterationOutcome.ERRORED.value


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


def bootstrap_iteration(
    *,
    logger: logging.Logger,
    run_state: SeerRunState,
    organization_id: int,
    group_id: int,
    create: bool = True,
) -> PrIterationLogContext:
    """The untriggered iteration this work belongs to, opened if needed, named in logs.

    create = false is for the green check suite / missing permissions tasks where we're receiving an event for an existing
    waiting iteration and we don't have any feedback to add, so we don't want to create a new row if it doesn't already exist

    Raises rather than logging a failure: the identity to log under is what this
    returns, so anything that goes wrong goes to Sentry instead.
    """
    seer_run = _seer_run(run_id=run_state.run_id, organization_id=organization_id)
    if seer_run is None:
        raise ValueError(f"No SeerRun for run {run_state.run_id} in organization {organization_id}")

    if create:
        project_id = (
            Group.objects.filter(id=group_id, project__organization_id=organization_id)
            .values_list("project_id", flat=True)
            .first()
        )
        if project_id is None:
            raise ValueError(f"No group {group_id} in organization {organization_id}")

        # A partial unique constraint allows one waiting row for each run, so a
        # racing opener gets the winner's row rather than a second one. The data
        # stamps only a row opened here; one already waiting keeps its own.
        SeerRunPrIteration.objects.get_or_create(
            seer_run=seer_run,
            triggered=False,
            defaults={
                "data": {
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "group_id": group_id,
                    "run_id": run_state.run_id,
                }
            },
        )

    # Reads back the row just settled above, so the context reflects what is
    # actually in the table rather than what this call believes it wrote.
    return PrIterationLogContext.for_run(
        logger,
        run_state,
        organization_id,
        group_id,
        iteration=LogCtxIteration.UNTRIGGERED,
    )


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


def _build_event(
    log_ctx: PrIterationLogContext,
    iteration: SeerRunPrIteration,
    *,
    iteration_index: int,
    outcome: str,
) -> AiAutofixPrIterationFeedbackBatchCompletedEvent | None:
    """The event for a finished iteration. None when its row is incomplete."""
    known = {f.name for f in fields(AiAutofixPrIterationFeedbackBatchCompletedEvent)}
    payload = {key: value for key, value in iteration.data.items() if key in known}
    try:
        return AiAutofixPrIterationFeedbackBatchCompletedEvent(
            iteration_id=iteration.id,
            iteration_index=iteration_index,
            outcome=outcome,
            **payload,
        )
    except TypeError:
        written = payload.keys() | {
            "iteration_id",
            "iteration_index",
            "outcome",
        }
        log_ctx.error(
            "autofix.pr_iteration.details.incomplete_row",
            exc_info=False,
            iteration_id=iteration.id,
            missing=sorted(known - written),
        )
        return None


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
    iteration_id = triggered_iteration_id(run_state)
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
            iteration_index=get_latest_iteration_index(run_state),
            outcome=outcome,
        )
        if event is None or not remove_iteration(iteration):
            return

        analytics.record(event)
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.complete_failed")
