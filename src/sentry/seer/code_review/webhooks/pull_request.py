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
from ..utils import _get_target_commit_sha

logger = logging.getLogger(__name__)


class Log(enum.StrEnum):
    MISSING_INTEGRATION = "github.webhook.pull_request.missing-integration"
    REACTION_FAILED = "github.webhook.pull_request.reaction-failed"
    MISSING_PULL_REQUEST = "github.webhook.pull_request.missing-pull-request"
    MISSING_ACTION = "github.webhook.pull_request.missing-action"
    UNSUPPORTED_ACTION = "github.webhook.pull_request.unsupported-action"
    DRAFT_PR = "github.webhook.pull_request.draft-pr"


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


def _add_eyes_reaction_to_pull_request(
    github_event: GithubWebhookType,
    github_event_action: PullRequestAction,
    integration: RpcIntegration | None,
    organization: Organization,
    repo: Repository,
    pr_number: str,
) -> None:
    """
    Add 👀 reaction to acknowledge PR opening, ready for review, or new commits. Errors are logged/added to metrics but not raised.
    This function is idempotent--ie, we skip adding another reaction if Sentry bot has already reacted with eyes, or if the call to get the existing reactions fails.
    """
    extra = {
        "organization_id": organization.id,
        "repo": repo.name,
        "pr_number": pr_number,
        "github_event": github_event,
        "github_event_action": github_event_action.value,
    }

    if integration is None:
        record_webhook_handler_error(
            github_event,
            github_event_action.value,
            CodeReviewErrorType.MISSING_INTEGRATION,
        )
        logger.warning(Log.MISSING_INTEGRATION.value, extra=extra)
        return

    try:
        client = integration.get_installation(organization_id=organization.id).get_client()

        existing_reactions = client.get_issue_reactions(repo.name, str(pr_number))
        for reaction in existing_reactions:
            if (
                reaction.get("content") == GitHubReaction.EYES.value
                and reaction.get("user", {}).get("login") == "sentry[bot]"
            ):
                return

        client.create_issue_reaction(repo.name, str(pr_number), GitHubReaction.EYES)
    except Exception:
        record_webhook_handler_error(
            github_event,
            github_event_action.value,
            CodeReviewErrorType.REACTION_FAILED,
        )
        logger.exception(Log.REACTION_FAILED.value, extra=extra)


def handle_pull_request_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    org_code_review_settings: CodeReviewSettings | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle pull_request webhook events for code review.

    This handler processes PR events and sends them directly to Seer
    """
    extra = {"organization_id": organization.id, "repo": repo.name}

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
    extra["action"] = action_value

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

    if pull_request.get("draft") is True:
        return

    pr_number = pull_request.get("number")
    if pr_number and action in {
        PullRequestAction.READY_FOR_REVIEW,
        PullRequestAction.OPENED,
        PullRequestAction.SYNCHRONIZE,
    }:
        _add_eyes_reaction_to_pull_request(
            github_event,
            action,
            integration,
            organization,
            repo,
            str(pr_number),
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
