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

import logging
from dataclasses import fields

from sentry import analytics
from sentry.analytics.events.pr_iteration_events import AiAutofixPrIterationDetailsCompletedEvent
from sentry.models.group import Group
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.autofix_agent import get_iterations
from sentry.seer.autofix.pr_iteration.details_store import (
    add_iteration,
    get_iteration,
    open_iterations,
    remove_iteration,
    update_iteration,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.models.run import SeerRun, SeerRunPrIteration

logger = logging.getLogger(__name__)

ITERATION_ID_METADATA_KEY = "iteration_id"

TRIGGERED_KEY = "triggered"


def _seer_run(*, run_id: int, organization_id: int) -> SeerRun | None:
    return SeerRun.objects.filter(seer_run_state_id=run_id, organization_id=organization_id).first()


def _untriggered(seer_run: SeerRun) -> SeerRunPrIteration | None:
    """The run's iteration no drain has handed to the agent yet.

    At most one exists, since only an enqueue onto an empty queue opens one.
    """
    for iteration in open_iterations(seer_run):
        if not iteration.data.get(TRIGGERED_KEY):
            return iteration
    return None


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
        logger.exception(
            "autofix.pr_iteration.details.open_failed",
            extra={"run_id": run_state.run_id, "organization_id": organization_id},
        )


def trigger_pr_iteration_details(*, run_id: int, organization_id: int) -> int | None:
    """Claim the waiting iteration for the agent run about to start, and name it.

    The returned id travels with the agent request so the completion hook can
    find this row again; the next feedback item opens a fresh one.
    """
    try:
        seer_run = _seer_run(run_id=run_id, organization_id=organization_id)
        if seer_run is None:
            return None

        iteration = _untriggered(seer_run)
        if iteration is None:
            return None

        update_iteration(iteration, **{TRIGGERED_KEY: True})
        return iteration.id
    except Exception:
        logger.exception(
            "autofix.pr_iteration.details.trigger_failed",
            extra={"run_id": run_id, "organization_id": organization_id},
        )
        return None


def state_iteration_id(run_state: SeerRunState) -> int | None:
    """The id the run's latest iteration was started with."""
    try:
        iterations = get_iterations(run_state)
    except Exception:
        logger.exception("autofix.pr_iteration.details.get_iterations_failed")
        return None

    if not iterations or not iterations[-1].blocks:
        return None

    metadata = iterations[-1].blocks[0].message.metadata or {}
    try:
        # Prompt metadata is a string map; the id goes out stringified.
        return int(metadata[ITERATION_ID_METADATA_KEY])
    except (KeyError, TypeError, ValueError):
        return None


def complete_pr_iteration_details(
    *, log_ctx: PrIterationLogContext, run_state: SeerRunState, organization_id: int
) -> None:
    """Emit the row for the iteration that just finished, and drop it."""
    iteration_id = state_iteration_id(run_state)
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
        if iteration is None or not remove_iteration(iteration):
            # The completion hook re-fires across an iteration's passes; only the
            # pass that claims the row emits it.
            log_ctx.info("autofix.pr_iteration.details.skipped", reason="already_emitted")
            return

        known = {f.name for f in fields(AiAutofixPrIterationDetailsCompletedEvent)}
        analytics.record(
            AiAutofixPrIterationDetailsCompletedEvent(
                iteration_id=iteration.id,
                **{key: value for key, value in iteration.data.items() if key in known},
            )
        )
    except Exception:
        logger.exception(
            "autofix.pr_iteration.details.complete_failed",
            extra={"run_id": run_state.run_id, "organization_id": organization_id},
        )
