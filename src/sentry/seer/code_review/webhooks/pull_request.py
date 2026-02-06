"""
Handler for GitHub pull_request webhook events.
https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from typing import Any

from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.utils import is_github_rate_limit_sensitive
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewSettings, CodeReviewTrigger

from ..metrics import (
    CodeReviewErrorType,
    WebhookFilteredReason,
    record_webhook_filtered,
    record_webhook_handler_error,
    record_webhook_received,
)
from ..utils import _get_target_commit_sha, delete_existing_reactions_and_add_reaction

logger = logging.getLogger(__name__)


class Log(enum.StrEnum):
    MISSING_PULL_REQUEST = "github.webhook.pull_request.missing-pull-request"
    MISSING_ACTION = "github.webhook.pull_request.missing-action"
    UNSUPPORTED_ACTION = "github.webhook.pull_request.unsupported-action"


class PullRequestAction(enum.StrEnum):
    """
    GitHub pull_request webhook actions.
    https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
    """

    ASSIGNED = "assigned"
    AUTO_MERGE_DISABLED = "auto_merge_disabled"
    AUTO_MERGE_ENABLED = "auto_merge_enabled"
    CLOSED = "closed"
    CONVERTED_TO_DRAFT = "converted_to_draft"
    DEMILESTONED = "demilestoned"
    DEQUEUED = "dequeued"
    EDITED = "edited"
    ENQUEUED = "enqueued"
    LABELED = "labeled"
    LOCKED = "locked"
    MILESTONED = "milestoned"
    OPENED = "opened"
    READY_FOR_REVIEW = "ready_for_review"
    REOPENED = "reopened"
    REVIEW_REQUEST_REMOVED = "review_request_removed"
    REVIEW_REQUESTED = "review_requested"
    # New commits are pushed to the PR
    SYNCHRONIZE = "synchronize"
    UNASSIGNED = "unassigned"
    UNLABELED = "unlabeled"
    UNLOCKED = "unlocked"


WHITELISTED_ACTIONS = {
    PullRequestAction.CLOSED,
    PullRequestAction.OPENED,
    PullRequestAction.READY_FOR_REVIEW,
    PullRequestAction.SYNCHRONIZE,
}

ACTIONS_REQUIRING_TRIGGER_CHECK: dict[PullRequestAction, CodeReviewTrigger] = {
    PullRequestAction.OPENED: CodeReviewTrigger.ON_READY_FOR_REVIEW,
    PullRequestAction.READY_FOR_REVIEW: CodeReviewTrigger.ON_READY_FOR_REVIEW,
    PullRequestAction.SYNCHRONIZE: CodeReviewTrigger.ON_NEW_COMMIT,
}

ACTIONS_ELIGIBLE_FOR_EYES_REACTION: set[PullRequestAction] = {
    PullRequestAction.OPENED,
    PullRequestAction.READY_FOR_REVIEW,
    PullRequestAction.SYNCHRONIZE,
}


def handle_pull_request_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    org_code_review_settings: CodeReviewSettings | None = None,
    extra: Mapping[str, str | None],
    **kwargs: Any,
) -> None:
    """
    Handle pull_request webhook events for code review.

    This handler processes PR events and sends them directly to Seer
    """
    pull_request = event.get("pull_request")
    if not pull_request:
        logger.warning(Log.MISSING_PULL_REQUEST.value, extra=extra)
        record_webhook_handler_error(
            github_event, "unknown", CodeReviewErrorType.MISSING_PULL_REQUEST
        )
        return

    action_value = event.get("action")
    if not action_value or not isinstance(action_value, str):
        logger.warning(Log.MISSING_ACTION.value, extra=extra)
        record_webhook_handler_error(github_event, "unknown", CodeReviewErrorType.MISSING_ACTION)
        return

    record_webhook_received(github_event, action_value)

    try:
        action = PullRequestAction(action_value)
    except ValueError:
        logger.warning(Log.UNSUPPORTED_ACTION.value, extra=extra)
        record_webhook_filtered(
            github_event, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    if action not in WHITELISTED_ACTIONS:
        logger.warning(Log.UNSUPPORTED_ACTION.value, extra=extra)
        record_webhook_filtered(
            github_event, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    action_requires_trigger_permission = ACTIONS_REQUIRING_TRIGGER_CHECK.get(action)
    if action_requires_trigger_permission is not None and (
        org_code_review_settings is None
        or action_requires_trigger_permission not in org_code_review_settings.triggers
    ):
        record_webhook_filtered(github_event, action_value, WebhookFilteredReason.TRIGGER_DISABLED)
        return

    # Skip draft check for CLOSED actions to ensure Seer receives cleanup notifications
    # even if the PR was converted to draft before closing
    if action != PullRequestAction.CLOSED and pull_request.get("draft") is True:
        return

    pr_number = pull_request.get("number")
    if pr_number and action in ACTIONS_ELIGIBLE_FOR_EYES_REACTION:
        # We don't ever need to delete :eyes: since we later add it back to the PR description idempotently.
        reactions_to_delete = [GitHubReaction.HOORAY]
        if is_github_rate_limit_sensitive(organization.slug):
            reactions_to_delete = []

        delete_existing_reactions_and_add_reaction(
            github_event=github_event,
            github_event_action=action_value,
            integration=integration,
            organization_id=organization.id,
            repo=repo,
            pr_number=str(pr_number),
            comment_id=None,
            reactions_to_delete=reactions_to_delete,
            reaction_to_add=GitHubReaction.EYES,
            extra=extra,
        )

    from .task import schedule_task

    schedule_task(
        github_event=github_event,
        github_event_action=action_value,
        event=event,
        organization=organization,
        repo=repo,
        target_commit_sha=_get_target_commit_sha(github_event, event, repo, integration),
    )
