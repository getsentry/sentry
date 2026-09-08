"""Resolves the iteration a run cares about right now.

At any point a run has at most one untriggered iteration -- the row waiting
for the next drain -- and at most one relevant triggered iteration: the
latest one the agent is or was working on, which is what the completion hook
cares about. Every PR-iteration entry point wants one of these two ids; this
is the one place that knows how to find them, so nothing else parses run
state or claims rows just to learn an id for logging.
"""

from __future__ import annotations

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.autofix_agent import get_iterations
from sentry.seer.autofix.pr_iteration.details_store import untriggered_iteration
from sentry.seer.models.run import SeerRun

_ITERATION_ID_METADATA_KEY = "iteration_id"


def untriggered_iteration_id(*, run_id: int, organization_id: int) -> int | None:
    """The id of the run's waiting iteration, if it has one. Read-only.

    Callers that are about to claim the row still need
    ``trigger_pr_iteration_details`` -- this never claims it.
    """
    seer_run = SeerRun.objects.filter(
        seer_run_state_id=run_id, organization_id=organization_id
    ).first()
    if seer_run is None:
        return None

    iteration = untriggered_iteration(seer_run)
    return iteration.id if iteration is not None else None


def triggered_iteration_id(run_state: SeerRunState) -> int | None:
    """The id of the run's latest triggered iteration, if it has one yet.

    Read straight off the run state's own blocks, so it costs nothing beyond
    what the caller already fetched -- no DB or network access.
    """
    try:
        iterations = get_iterations(run_state)
    except Exception:
        return None

    if not iterations or not iterations[-1].blocks:
        return None

    metadata = iterations[-1].blocks[0].message.metadata or {}
    try:
        # Prompt metadata is a string map; the id goes out stringified.
        return int(metadata[_ITERATION_ID_METADATA_KEY])
    except (KeyError, TypeError, ValueError):
        return None
