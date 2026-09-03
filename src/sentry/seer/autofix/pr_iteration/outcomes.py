"""What each PR iteration did about the feedback that drove it.

The feedback list shows the outcome next to the feedback, so a reader can tell
whether Seer is still working on a CI failure or made no changes for it without
opening the PR. Outcomes are derived from the run state on read — an iteration's
blocks carry the edits it made — so nothing extra is persisted and iterations
that ran before this existed still resolve.
"""

from __future__ import annotations

from enum import StrEnum

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.autofix_agent import Iteration, get_iterations
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext


class IterationOutcome(StrEnum):
    IN_PROGRESS = "in_progress"
    CHANGES_PUSHED = "changes_pushed"
    # Edits were made but the run ended without them reaching the PR.
    PUSH_FAILED = "push_failed"
    # The iteration ran to completion and edited nothing: Seer had no fix for
    # this feedback.
    NO_CHANGES = "no_changes"


def _made_changes(iteration: Iteration) -> bool:
    """`file_patches` are the edits made in that block, so any of them means this
    iteration (not an earlier one) touched code."""
    return any(block.file_patches for block in iteration.blocks)


def get_iteration_outcomes(
    state: SeerRunState, *, log_ctx: PrIterationLogContext
) -> dict[str, str]:
    """Outcome per iteration, keyed by iteration index as a string so it survives
    JSON.

    Only the newest iteration can be unfinished, and only its changes can still
    be waiting on a push: everything older is settled by the fact that another
    iteration started after it.
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
