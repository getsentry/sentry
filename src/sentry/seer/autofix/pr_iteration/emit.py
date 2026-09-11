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

from django.utils import timezone

from sentry import analytics
from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationFeedbackBatchCompletedEvent,
)
from sentry.models.group import Group
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.autofix_agent import Iteration, get_iterations
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
    feedback_bot_logins: list[str],
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
            feedback_bot_logins=feedback_bot_logins,
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


def _latest_iteration(log_ctx: PrIterationLogContext, run_state: SeerRunState) -> Iteration | None:
    """The run's latest iteration, or None when it has none."""
    try:
        iterations = get_iterations(run_state)
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.get_iterations_failed")
        return None

    return iterations[-1] if iterations else None


def _iteration_id(iteration: Iteration) -> int | None:
    """The id the iteration was started with."""
    if not iteration.blocks:
        return None

    metadata = iteration.blocks[0].message.metadata or {}
    try:
        # Prompt metadata is a string map; the id goes out stringified.
        return int(metadata[ITERATION_ID_METADATA_KEY])
    except (KeyError, TypeError, ValueError):
        return None


def _pushed_head_shas(iteration: Iteration, run_state: SeerRunState) -> list[str]:
    """The commit SHAs the latest iteration pushed, one for each repository."""
    repos = {
        patch.repo_name for block in iteration.blocks for patch in (block.merged_file_patches or [])
    }
    shas = {
        pr_state.commit_sha
        for repo in repos
        if (pr_state := run_state.repo_pr_states.get(repo)) and pr_state.commit_sha
    }
    return sorted(shas)


def _build_event(
    log_ctx: PrIterationLogContext,
    iteration: SeerRunPrIteration,
    *,
    iteration_index: int,
    outcome: str,
    head_shas: list[str],
) -> AiAutofixPrIterationFeedbackBatchCompletedEvent | None:
    """The event for a finished iteration. None when its row is incomplete."""
    known = {f.name for f in fields(AiAutofixPrIterationFeedbackBatchCompletedEvent)}
    payload = {key: value for key, value in iteration.data.items() if key in known}
    duration_ms = int((timezone.now() - iteration.date_added).total_seconds() * 1000)
    try:
        return AiAutofixPrIterationFeedbackBatchCompletedEvent(
            iteration_id=iteration.id,
            iteration_index=iteration_index,
            duration_ms=duration_ms,
            outcome=outcome,
            head_shas=head_shas,
            **payload,
        )
    except TypeError:
        written = payload.keys() | {
            "iteration_id",
            "iteration_index",
            "duration_ms",
            "outcome",
            "head_shas",
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
    latest = _latest_iteration(log_ctx, run_state)
    iteration_id = _iteration_id(latest) if latest is not None else None
    if latest is None or iteration_id is None:
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

        head_shas = (
            _pushed_head_shas(latest, run_state)
            if outcome == PrIterationOutcome.ALREADY_PUSHED.value
            else []
        )
        event = _build_event(
            log_ctx,
            iteration,
            iteration_index=latest.index,
            outcome=outcome,
            head_shas=head_shas,
        )
        if event is None or not remove_iteration(iteration):
            return

        analytics.record(event)
    except Exception:
        log_ctx.error("autofix.pr_iteration.details.complete_failed")
