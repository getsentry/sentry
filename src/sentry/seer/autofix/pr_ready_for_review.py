"""Emitting the "Seer's PR is ready for a human" signal.

Unlike the other Seer step signals, this one has two triggers and so cannot live
in the completion hook alone:

* the PR was opened undrafted (no CI access, or the green-CI flow is off), in
  which case opening it *is* the ready moment — emitted from
  ``on_completion_hook`` alongside ``pr_created``;
* the PR was opened as a draft and CI later went green, in which case the
  undraft in ``pr_iteration.ready_for_review`` is the moment.

Both go through ``emit_pr_ready_for_review`` so the activity, the entrypoint
fan-out, and the public webhook stay identical whichever way we got here.
"""

from __future__ import annotations

import logging

from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def format_pull_requests_payload(state: SeerRunState) -> list[dict]:
    return [
        {
            "provider": pull_request.provider or "unknown",
            "repo_name": pull_request.repo_name,
            "pull_request": {
                "pr_id": pull_request.pr_id,
                "pr_number": pull_request.pr_number,
                "pr_url": pull_request.pr_url,
            },
        }
        for pull_request in state.repo_pr_states.values()
    ]


def emit_pr_ready_for_review(
    *,
    organization: Organization,
    group: Group,
    run_id: int,
    sentry_run_id: str | None,
    state: SeerRunState,
) -> None:
    """Record the ready-for-review activity and broadcast the public webhook.

    Never raises: this runs as a side effect of undrafting a PR, and a failure
    here must not undo work we already did on the SCM.
    """
    # Lazy: ``operator`` pulls in the notification templates, which cycle back
    # through the SCM integration handlers when imported at module scope.
    from sentry.seer.entrypoints.operator import (
        SeerAutofixOperator,
        process_autofix_updates,
        record_seer_activity,
    )
    from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization

    payload = {
        "run_id": run_id,
        "sentry_run_id": sentry_run_id,
        "group_id": group.id,
        "pull_requests": format_pull_requests_payload(state),
    }
    log_extra = {
        "run_id": run_id,
        "group_id": group.id,
        "organization_id": organization.id,
    }

    try:
        if SeerAutofixOperator.has_access(organization=organization):
            metrics.incr(
                "autofix.pr_ready_for_review.process_autofix_updates",
                tags={"event_type": str(SentryAppEventType.SEER_PR_READY_FOR_REVIEW)},
            )
            record_seer_activity(
                group=group,
                event_type=SentryAppEventType.SEER_PR_READY_FOR_REVIEW,
                event_payload=payload,
            )
            process_autofix_updates.apply_async(
                kwargs={
                    "event_type": SentryAppEventType.SEER_PR_READY_FOR_REVIEW,
                    "event_payload": payload,
                    "organization_id": organization.id,
                    "activity_already_recorded": True,
                }
            )
    except Exception:
        logger.exception("autofix.pr_ready_for_review.activity_failed", extra=log_extra)

    try:
        broadcast_webhooks_for_organization.delay(
            resource_name="seer",
            event_name=SeerActionType.PR_READY_FOR_REVIEW.value,
            organization_id=organization.id,
            payload=payload,
        )
    except Exception:
        logger.exception("autofix.pr_ready_for_review.webhook_failed", extra=log_extra)
