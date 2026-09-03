"""What each PR iteration did about the feedback that started it.

The feedback list shows this outcome next to the feedback. A reader can then see
that Seer works on a CI failure, or that Seer made no changes for it.

Each outcome comes from the run state at read time. The blocks of an iteration
hold the edits that the iteration made. This module stores nothing, so an
iteration that ran before this code also gets an outcome.
"""

from __future__ import annotations

from enum import StrEnum

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.autofix_agent import Iteration, get_iterations
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext


class IterationOutcome(StrEnum):
    IN_PROGRESS = "in_progress"
    CHANGES_PUSHED = "changes_pushed"
    PUSH_FAILED = "push_failed"
    NO_CHANGES = "no_changes"


def _made_changes(iteration: Iteration) -> bool:
    """`file_patches` hold the edits of one block, so they show only the work of
    this iteration."""
    return any(block.file_patches for block in iteration.blocks)


def get_iteration_outcomes(
    state: SeerRunState, *, log_ctx: PrIterationLogContext
) -> dict[str, str]:
    """The outcome of each iteration, keyed by the iteration index as a string.

    Only the newest iteration can be incomplete. Only the edits of the newest
    iteration can wait for a push. An older iteration is complete, because a
    later iteration started after it.
    """
    try:
        iterations = get_iterations(state)
    except Exception:
        log_ctx.error("autofix.pr_iteration.iteration_outcomes.failed")
        return {}

    if not iterations:
        return {}

    _, is_synced = state.has_code_changes()
    outcomes: dict[str, str] = {}
    for iteration in iterations:
        is_latest = iteration is iterations[-1]
        outcome: IterationOutcome
        if is_latest and state.status == "processing":
            outcome = IterationOutcome.IN_PROGRESS
        elif not _made_changes(iteration):
            outcome = IterationOutcome.NO_CHANGES
        elif is_latest and not is_synced:
            outcome = IterationOutcome.PUSH_FAILED
        else:
            outcome = IterationOutcome.CHANGES_PUSHED
        outcomes[str(iteration.index)] = outcome.value

    return outcomes
