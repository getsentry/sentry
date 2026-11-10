"""The PR iteration part of the autofix state the Sentry UI polls.

The group autofix endpoint (``GroupAutofixEndpoint``) returns a run's state on
GET, and the UI polls it about once a second. The fields describing PR
iteration (what feedback is waiting in the queue, whether iteration is paused,
and which repos are blocked on missing GitHub App permissions) are built here. This module lives under ``pr_iteration`` so
errors raised here are grouped with the rest of PR iteration.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.pr_iteration.feedback import Feedback, blocks_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.missing_permissions import (
    get_blocked_pr_iteration_permissions,
)
from sentry.seer.autofix.pr_iteration.pause import PAUSED_EXTRA, pause_reason_from_marker
from sentry.seer.autofix.pr_iteration.queue import (
    QueuedAutofixFeedback,
    peek_in_flight_autofix_feedback,
    peek_queued_autofix_feedback,
)
from sentry.seer.autofix.pr_iteration.run_markers import get_run_extra
from sentry.seer.autofix.types import GithubAppPermissionsWarning
from sentry.seer.models.run import SeerRun


def _feedback_key(feedback: Feedback) -> tuple[str, str]:
    # Paired with the type because ids from different sources can collide.
    source = feedback.source
    if isinstance(source, CheckSuiteFeedbackSource):
        # A re-run keeps the suite id, so an earlier attempt in a block must not
        # hide it. Same attempt key as the consume dedupe.
        return (source.type, str(source.check_suite_attempt_key()))
    return (source.type, feedback.feedback_id)


def _in_flight_items(
    state: SeerRunState, queued_items: Sequence[QueuedAutofixFeedback]
) -> list[QueuedAutofixFeedback]:
    """Drained feedback that this response would otherwise show nowhere.

    ``state`` was read from Seer before Redis, so a drain can finish between the
    two reads. Showing the in-flight copy keeps the item on screen; anything
    already in the queue or a block is skipped so it isn't shown twice.
    """
    in_flight = peek_in_flight_autofix_feedback(state.run_id)
    if not in_flight:
        return []

    shown = {_feedback_key(item.feedback) for item in queued_items}
    shown.update(_feedback_key(feedback) for feedback in blocks_feedback(state.blocks))
    return [item for item in in_flight if _feedback_key(item.feedback) not in shown]


def get_pr_iteration_state_fields(
    organization: Organization, state: SeerRunState, run: SeerRun | None
) -> dict[str, Any]:
    """The PR iteration fields of the autofix GET response, keyed as the
    response expects them.

    ``run`` is the run's SeerRun row, or None for a legacy run that has none.
    """
    queued_items = peek_queued_autofix_feedback(state.run_id)

    missing_perms = get_blocked_pr_iteration_permissions(
        organization,
        state,
        has_actionable_feedback=any(
            item.feedback.source.should_consume(state).ok for item in queued_items
        ),
    )

    warnings = [
        GithubAppPermissionsWarning(
            repo_name=repo_name,
            installation_id=info.installation_id,
            installation_url=info.installation_url,
        ).dict()
        for repo_name, info in missing_perms.items()
    ]
    queued_feedback = [
        item.feedback.dict() for item in [*_in_flight_items(state, queued_items), *queued_items]
    ]
    # Off the fetched row, not is_pr_iteration_paused: polled every second.
    paused_marker = get_run_extra(run, PAUSED_EXTRA) if run is not None else None
    pause_reason = pause_reason_from_marker(paused_marker)
    return {
        "queued_feedback": queued_feedback,
        "pr_iteration_paused": paused_marker is not None,
        "pr_iteration_pause_reason": pause_reason.value if pause_reason else None,
        "warnings": warnings,
    }
