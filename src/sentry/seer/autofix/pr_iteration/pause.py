"""Pause and resume PR iteration for one Autofix run.

A pause stops every iteration path and empties the feedback queue. The
pause is per run, not per pull request. A queue entry records no repo
name, so a per-repo pause cannot find its own entries.
"""

from __future__ import annotations

import logging

from django.utils import timezone

from sentry.seer.autofix.pr_iteration.queue import clear_queued_autofix_feedback
from sentry.seer.autofix.pr_iteration.run_markers import (
    clear_run_extra,
    get_run_extra,
    record_run_extra,
)
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Run-level SeerRun.extras key. No key means that the run iterates.
PAUSED_EXTRA = "pr_iteration_paused"


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


def pause_pr_iteration(
    *, run_id: int, organization_id: int, actor_user_id: int | None = None
) -> bool:
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None:
        return False

    if get_run_extra(seer_run, PAUSED_EXTRA) is None:
        # Marker first, because it stops every later enqueue.
        record_run_extra(
            seer_run,
            PAUSED_EXTRA,
            {"paused_at": timezone.now().isoformat(), "actor_user_id": actor_user_id},
        )
    clear_queued_autofix_feedback(run_id)

    logger.info(
        "autofix.pr_iteration.paused",
        extra={
            "run_id": run_id,
            "organization_id": organization_id,
            "actor_user_id": actor_user_id,
        },
    )
    return True


def resume_pr_iteration(*, run_id: int, organization_id: int) -> bool:
    seer_run = _get_seer_run(run_id, organization_id)
    if seer_run is None:
        return False

    # Queue first, to remove an item that an enqueue added during the pause.
    clear_queued_autofix_feedback(run_id)
    clear_run_extra(seer_run, PAUSED_EXTRA)

    logger.info(
        "autofix.pr_iteration.resumed",
        extra={"run_id": run_id, "organization_id": organization_id},
    )
    return True
