"""Resolves the iteration a run cares about right now.

there are only 2 iteration rows we care about:
- untriggered (the feedback queued in redis belongs to this)
- triggered (the latest in flight iteration, possibly paused / stuck)

the enqueue / trigger stages care about the untriggered iteration
the consume / completion hook stages usually care about the triggered iteration

you can think of this as a pipeline where we only have one of each of these at a time

the idea is that we only process one batch of feedback in a single iteration at a time
through the consume -> seer -> completion hook
"""

from __future__ import annotations

import logging

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.autofix_agent import get_iterations
from sentry.seer.autofix.pr_iteration.details_store import untriggered_iteration
from sentry.seer.models.run import SeerRun

logger = logging.getLogger(__name__)

_ITERATION_ID_METADATA_KEY = "iteration_id"


def untriggered_iteration_id(*, run_id: int, organization_id: int) -> int | None:
    """The id of the run's waiting iteration, if it has one."""
    try:
        seer_run = SeerRun.objects.filter(
            seer_run_state_id=run_id, organization_id=organization_id
        ).first()
        if seer_run is None:
            return None

        iteration = untriggered_iteration(seer_run)
        return iteration.id if iteration is not None else None
    except Exception:
        logger.warning(
            "autofix.pr_iteration.details.untriggered_lookup_failed",
            extra={"run_id": run_id, "organization_id": organization_id},
            exc_info=True,
        )
        return None


def triggered_iteration_id(run_state: SeerRunState) -> int | None:
    """The id of the run's latest triggered iteration, if it has one yet."""
    try:
        iterations = get_iterations(run_state)
    except Exception:
        logger.warning(
            "autofix.pr_iteration.details.triggered_lookup_failed",
            extra={"run_id": run_state.run_id},
            exc_info=True,
        )
        return None

    if not iterations or not iterations[-1].blocks:
        return None

    metadata = iterations[-1].blocks[0].message.metadata or {}
    try:
        # Prompt metadata is a string map; the id goes out stringified.
        return int(metadata[_ITERATION_ID_METADATA_KEY])
    except (KeyError, TypeError, ValueError):
        return None
