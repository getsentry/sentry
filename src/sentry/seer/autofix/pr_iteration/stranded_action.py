"""Work Sentry still owes a PR iteration run after a credits refusal.

When Sentry refuses an iteration's push or branch-moved retry turn because the
organization is out of Seer credits, or Seer's own push runs out of credits,
the iteration's changes stay unpushed and no completion hook comes to drain the
queue. The run records what was left undone, and the next drain redoes it
before it takes new feedback.
"""

from __future__ import annotations

from enum import StrEnum

from sentry.seer.autofix.pr_iteration.run_markers import get_run_extra, record_run_extras
from sentry.seer.models.run import SeerRun

# Run-level SeerRun.extras key. No key means that nothing is owed.
STRANDED_ACTION_EXTRA = "pr_iteration_stranded_action"


class StrandedAction(StrEnum):
    """What the drain redoes before it takes new feedback."""

    PUSH = "push"
    BRANCH_MOVED_RETRY = "branch_moved_retry"


def _get_seer_run(run_id: int, organization_id: int) -> SeerRun | None:
    return SeerRun.objects.filter(seer_run_state_id=run_id, organization_id=organization_id).first()


def record_stranded_action(
    *, run_id: int, organization_id: int, stranded_action: StrandedAction
) -> bool:
    """Record work a credits refusal left undone, for the drain to redo."""
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None:
        return False

    try:
        with record_run_extras(seer_run) as extras:
            extras[STRANDED_ACTION_EXTRA] = {"action": stranded_action.value}
    except SeerRun.DoesNotExist:
        return False
    return True


def take_stranded_action(*, run_id: int, organization_id: int) -> StrandedAction | None:
    """Pop the work a credits refusal left undone, so only one drain redoes it."""
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None or get_run_extra(seer_run, STRANDED_ACTION_EXTRA) is None:
        return None

    try:
        with record_run_extras(seer_run) as extras:
            marker = extras.pop(STRANDED_ACTION_EXTRA, None)
    except SeerRun.DoesNotExist:
        return None
    try:
        return StrandedAction(marker["action"]) if marker else None
    except (KeyError, ValueError):
        return None
