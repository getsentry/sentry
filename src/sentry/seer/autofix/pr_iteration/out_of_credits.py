from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from sentry.seer.autofix.pr_iteration.run_markers import get_run_extra, record_run_extras
from sentry.seer.models.run import SeerRun

# Run-level SeerRun.extras key. No key means that iteration isn't stopped on credits.
OUT_OF_CREDITS_EXTRA = "pr_iteration_out_of_credits"


class StrandedAction(StrEnum):
    """What the drain redoes before it takes new feedback."""

    PUSH = "push"
    BRANCH_MOVED_RETRY = "branch_moved_retry"


@dataclass(frozen=True)
class OutOfCredits:
    stranded_action: StrandedAction | None


def _get_seer_run(run_id: int, organization_id: int) -> SeerRun | None:
    return SeerRun.objects.filter(seer_run_state_id=run_id, organization_id=organization_id).first()


def _parse(marker: Any | None) -> OutOfCredits | None:
    if marker is None:
        return None
    try:
        return OutOfCredits(stranded_action=StrandedAction(marker["stranded_action"]))
    except (KeyError, TypeError, ValueError):
        return OutOfCredits(stranded_action=None)


def mark_out_of_credits(
    *, run_id: int, organization_id: int, stranded_action: StrandedAction | None = None
) -> bool:
    """Mark the run stopped on credits, keeping any stranded action already recorded."""
    seer_run = _get_seer_run(run_id, organization_id)
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


def get_out_of_credits(*, run_id: int, organization_id: int) -> OutOfCredits | None:
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None:
        return None
    return out_of_credits_for_run(seer_run)


def out_of_credits_for_run(seer_run: SeerRun) -> OutOfCredits | None:
    return _parse(get_run_extra(seer_run, OUT_OF_CREDITS_EXTRA))


def take_out_of_credits(*, run_id: int, organization_id: int) -> OutOfCredits | None:
    """Clear the marker as the next step starts, so only one drain redoes a stranded action."""
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None or get_run_extra(seer_run, OUT_OF_CREDITS_EXTRA) is None:
        return None

    try:
        with record_run_extras(seer_run) as extras:
            marker = extras.pop(OUT_OF_CREDITS_EXTRA, None)
    except SeerRun.DoesNotExist:
        return None
    return _parse(marker)
