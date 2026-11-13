"""Pause PR iteration for one Autofix run.

A pause stops every iteration path and empties the feedback queue. The
pause is per run, not per pull request. A queue entry records no repo
name, so a per-repo pause cannot find its own entries.

Only an out-of-credits pause is lifted, when a person asks Seer to iterate
again and the organization can pay. Every other pause is permanent. When the pause stranded unpushed changes, a
second marker records what the drain redoes before it takes new feedback.
"""

from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

from django.utils import timezone

from sentry.models.organization import Organization
from sentry.seer.autofix.pr_iteration.queue import clear_queued_autofix_feedback
from sentry.seer.autofix.pr_iteration.run_markers import get_run_extra, record_run_extras
from sentry.seer.credits import SeerFeature, SeerOperation, can_run_seer_operation
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Run-level SeerRun.extras key. No key means that the run iterates.
PAUSED_EXTRA = "pr_iteration_paused"
# Run-level SeerRun.extras key for work a billing refusal left undone.
STRANDED_EXTRA = "pr_iteration_stranded"


class PauseReason(StrEnum):
    USER_STOP = "user_stop"
    RUN_ERRORED = "run_errored"
    PR_CLOSED = "pr_closed"
    DRAIN_FAILED = "drain_failed"
    OUT_OF_CREDITS = "out_of_credits"


class StrandedAction(StrEnum):
    """What the drain redoes after a credits top-up, before it takes new feedback."""

    PUSH = "push"
    BRANCH_MOVED_RETRY = "branch_moved_retry"


def _get_seer_run(run_id: int, organization_id: int) -> SeerRun | None:
    return SeerRun.objects.filter(seer_run_state_id=run_id, organization_id=organization_id).first()


def record_pause_blocked(gate: str) -> None:
    metrics.incr("autofix.pr_iteration.paused.blocked", tags={"gate": gate})


def is_pr_iteration_paused(*, run_id: int, organization_id: int) -> bool:
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None:
        # Legacy runs from before SeerRun mirroring have no row for the marker.
        return False
    return get_run_extra(seer_run, PAUSED_EXTRA) is not None


def pause_reason_from_marker(marker: Any | None) -> PauseReason | None:
    """Read the reason off a marker a caller already holds, sparing the query.

    Markers written before the reason existed record a user stop.
    """
    if marker is None:
        return None

    try:
        return PauseReason(marker.get("reason", PauseReason.USER_STOP))
    except ValueError:
        return None


def get_pause_reason(*, run_id: int, organization_id: int) -> PauseReason | None:
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None:
        return None

    return pause_reason_from_marker(get_run_extra(seer_run, PAUSED_EXTRA))


def pause_pr_iteration(
    *,
    run_id: int,
    organization_id: int,
    reason: PauseReason,
    actor_user_id: int | None = None,
) -> bool:
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None:
        return False

    try:
        marker = get_run_extra(seer_run, PAUSED_EXTRA)
        # A permanent pause replaces an out-of-credits one, so a later credits top-up can't lift it.
        if marker is None or (
            pause_reason_from_marker(marker) == PauseReason.OUT_OF_CREDITS
            and reason != PauseReason.OUT_OF_CREDITS
        ):
            # Write the marker first, because it stops every later consume.
            with record_run_extras(seer_run) as extras:
                extras[PAUSED_EXTRA] = {
                    "paused_at": timezone.now().isoformat(),
                    "actor_user_id": actor_user_id,
                    "reason": reason.value,
                }
    except SeerRun.DoesNotExist:
        # The run was deleted between the lookup and the marker write.
        return False
    clear_queued_autofix_feedback(run_id)

    metrics.incr("autofix.pr_iteration.paused", tags={"reason": reason.value})
    logger.info(
        "autofix.pr_iteration.paused",
        extra={
            "run_id": run_id,
            "organization_id": organization_id,
            "actor_user_id": actor_user_id,
            "reason": reason.value,
        },
    )
    return True


def pause_for_out_of_credits(
    *, run_id: int, organization_id: int, stranded_action: StrandedAction | None = None
) -> bool:
    """Pause iteration until the organization can pay, recording any work left undone.

    Returns whether the pause was recorded."""
    if stranded_action is not None and not _record_stranded_action(
        run_id=run_id, organization_id=organization_id, stranded_action=stranded_action
    ):
        return False
    return pause_pr_iteration(
        run_id=run_id, organization_id=organization_id, reason=PauseReason.OUT_OF_CREDITS
    )


def _record_stranded_action(
    *, run_id: int, organization_id: int, stranded_action: StrandedAction
) -> bool:
    """Record work a credits refusal left undone, for the drain to redo."""
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None:
        return False

    try:
        with record_run_extras(seer_run) as extras:
            extras[STRANDED_EXTRA] = {"action": stranded_action.value}
    except SeerRun.DoesNotExist:
        return False
    return True


def take_stranded_action(*, run_id: int, organization_id: int) -> StrandedAction | None:
    """Pop the work a credits refusal left undone, so only one drain redoes it."""
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None or get_run_extra(seer_run, STRANDED_EXTRA) is None:
        return None

    try:
        with record_run_extras(seer_run) as extras:
            strandard_extra = extras.pop(STRANDED_EXTRA, None)
    except SeerRun.DoesNotExist:
        return None
    try:
        return StrandedAction(strandard_extra["action"]) if strandard_extra else None
    except (KeyError, ValueError):
        return None


def lift_out_of_credits_pause(*, run_id: int, organization_id: int) -> bool:
    """Clear an out-of-credits pause if the organization can pay for an iteration.

    Returns whether a pause was lifted.
    """
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None or (
        pause_reason_from_marker(get_run_extra(seer_run, PAUSED_EXTRA))
        != PauseReason.OUT_OF_CREDITS
    ):
        return False

    organization = Organization.objects.get_from_cache(id=organization_id)
    if not can_run_seer_operation(
        organization, SeerFeature.AUTOFIX, SeerOperation.AUTOFIX_PR_ITERATION
    ):
        return False

    try:
        with record_run_extras(seer_run) as extras:
            # Re-read under the lock: a permanent pause may have replaced it.
            if pause_reason_from_marker(extras.get(PAUSED_EXTRA)) != PauseReason.OUT_OF_CREDITS:
                return False
            del extras[PAUSED_EXTRA]
    except SeerRun.DoesNotExist:
        return False

    metrics.incr("autofix.pr_iteration.unpaused", tags={"reason": PauseReason.OUT_OF_CREDITS.value})
    logger.info(
        "autofix.pr_iteration.unpaused",
        extra={
            "run_id": run_id,
            "organization_id": organization_id,
            "reason": PauseReason.OUT_OF_CREDITS.value,
        },
    )
    return True
