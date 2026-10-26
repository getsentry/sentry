"""The PR iteration part of the autofix state the Sentry UI polls.

The group autofix endpoint (``GroupAutofixEndpoint``) returns a run's state on
GET, and the UI polls it about once a second. The fields describing PR
iteration (whether it is enabled, what feedback is waiting in the queue,
whether iteration is paused, and which repos are blocked on missing GitHub App
permissions) are built here. This module lives under ``pr_iteration`` so
errors raised here are grouped with the rest of PR iteration.
"""

from __future__ import annotations

from typing import Any

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.pr_iteration.missing_permissions import (
    get_blocked_pr_iteration_permissions,
)
from sentry.seer.autofix.pr_iteration.pause import PAUSED_EXTRA, pause_reason_from_marker
from sentry.seer.autofix.pr_iteration.queue import peek_queued_autofix_feedback
from sentry.seer.autofix.pr_iteration.run_markers import get_run_extra
from sentry.seer.autofix.types import GithubAppPermissionsWarning
from sentry.seer.models.run import SeerRun


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
    queued_feedback = [item.feedback.dict() for item in queued_items]
    # Off the fetched row, not is_pr_iteration_paused: polled every second.
    paused_marker = get_run_extra(run, PAUSED_EXTRA) if run is not None else None
    pause_reason = pause_reason_from_marker(paused_marker)
    return {
        "pr_iteration_enabled": features.has("organizations:autofix-pr-iteration", organization),
        "manual_pr_iteration_enabled": features.has(
            "organizations:autofix-pr-iteration-manual", organization
        ),
        "queued_feedback": queued_feedback,
        "pr_iteration_paused": paused_marker is not None,
        "pr_iteration_pause_reason": pause_reason.value if pause_reason else None,
        "warnings": warnings,
    }
