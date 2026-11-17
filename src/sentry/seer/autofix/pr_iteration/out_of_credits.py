from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.pr_iteration.iterations import is_pr_feedback_turn
from sentry.seer.autofix.pr_iteration.run_markers import (
    get_run_extra,
    get_seer_run,
    record_run_extras,
)
from sentry.seer.autofix.types import PrIterationUnfinishedAction
from sentry.seer.credits import OUT_OF_CREDITS
from sentry.seer.models.run import SeerRun

# Run-level SeerRun.extras key. Set when Seer credits refuse the run's next step, which holds
# its queue and can strand unfinished actions; taken when the next drain dispatches.
OUT_OF_CREDITS_EXTRA = "pr_iteration_out_of_credits"


class StrandedAction(StrEnum):
    """What the drain redoes before it takes new feedback."""

    PUSH = "push"
    BRANCH_MOVED_RETRY = "branch_moved_retry"


@dataclass(frozen=True)
class OutOfCreditsMarker:
    stranded_action: StrandedAction | None


@dataclass(frozen=True)
class PrIterationOutOfCredits:
    # What the latest PR iteration left unfinished, if anything.
    unfinished_action: PrIterationUnfinishedAction | None


def _parse(marker: Any | None) -> OutOfCreditsMarker | None:
    if marker is None:
        return None
    try:
        return OutOfCreditsMarker(stranded_action=StrandedAction(marker["stranded_action"]))
    except (KeyError, TypeError, ValueError):
        return OutOfCreditsMarker(stranded_action=None)


def mark_out_of_credits(
    *, run_id: int, organization_id: int, stranded_action: StrandedAction | None = None
) -> bool:
    """Mark the run stopped on credits, keeping any stranded action already recorded."""
    seer_run = get_seer_run(run_id=run_id, organization_id=organization_id)
    if seer_run is None:
        return False

    try:
        with record_run_extras(seer_run) as extras:
            previous = _parse(extras.get(OUT_OF_CREDITS_EXTRA))
            if stranded_action is None and previous is not None:
                stranded_action = previous.stranded_action
            extras[OUT_OF_CREDITS_EXTRA] = {
                "stranded_action": stranded_action.value if stranded_action else None
            }
    except SeerRun.DoesNotExist:
        return False
    return True


def get_out_of_credits(*, run_id: int, organization_id: int) -> OutOfCreditsMarker | None:
    seer_run = get_seer_run(run_id=run_id, organization_id=organization_id)
    if seer_run is None:
        return None
    return out_of_credits_marker(seer_run)


def out_of_credits_marker(seer_run: SeerRun) -> OutOfCreditsMarker | None:
    return _parse(get_run_extra(seer_run, OUT_OF_CREDITS_EXTRA))


def _unfinished_action(
    state: SeerRunState, marker: OutOfCreditsMarker
) -> PrIterationUnfinishedAction | None:
    """What the latest iteration left unfinished for credits. Checked against the run state,
    so a marker that outlived the work it records is ignored."""
    # Only report when the latest turn is a PR iteration.
    if not is_pr_feedback_turn(state):
        return None

    # Check if Sentry refused a push or branch-moved retry, or Seer's push failed, because
    # we ran out of credits.
    stranded_action = marker.stranded_action
    # Pushed changes mean the stranded work happened since, before any drain took the marker.
    # Eg, the UI's Retry PR skips draining.
    _, synced = state.has_code_changes()
    if stranded_action is not None and not synced:
        return (
            "branch_moved_retry" if stranded_action == StrandedAction.BRANCH_MOVED_RETRY else "push"
        )

    # Check if Seer tried to push and ran out of credits.
    if any(
        pr.pr_creation_status == "error" and pr.pr_creation_error_code == OUT_OF_CREDITS
        for pr in state.repo_pr_states.values()
    ):
        return "push"
    # Check if the agent's turn ran out of credits mid-run in Seer.
    if state.status == "error" and state.failure_reason == OUT_OF_CREDITS:
        return "agent_turn"
    return None


def pr_iteration_out_of_credits(
    state: SeerRunState, run: SeerRun | None
) -> PrIterationOutOfCredits | None:
    """The run's out-of-credits state, or None if it isn't marked or a turn is running."""
    marker = out_of_credits_marker(run) if run is not None else None
    if marker is None or state.status == "processing":
        return None
    return PrIterationOutOfCredits(unfinished_action=_unfinished_action(state, marker))


def take_out_of_credits(*, run_id: int, organization_id: int) -> OutOfCreditsMarker | None:
    """Clear the marker as the next step starts, so only one drain redoes a stranded action."""
    seer_run = get_seer_run(run_id=run_id, organization_id=organization_id)
    if seer_run is None or get_run_extra(seer_run, OUT_OF_CREDITS_EXTRA) is None:
        return None

    try:
        with record_run_extras(seer_run) as extras:
            marker = extras.pop(OUT_OF_CREDITS_EXTRA, None)
    except SeerRun.DoesNotExist:
        return None
    return _parse(marker)
