"""
Handler for GitHub issue_comment webhook events.
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from typing import Any

from sentry import options
from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository

from ..metrics import (
    CodeReviewErrorType,
    CodeReviewFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_handler_error,
    record_webhook_received,
)
from ..permissions import has_code_review_enabled

logger = logging.getLogger(__name__)


class Log(enum.StrEnum):
    MISSING_INTEGRATION = "github.webhook.issue_comment.missing-integration"
    REACTION_FAILED = "github.webhook.issue_comment.reaction-failed"
    WRONG_ACTION = "github.webhook.issue_comment.wrong-action"
    NOT_ENABLED = "github.webhook.issue_comment.not-enabled"
    NOT_REVIEW_COMMAND = "github.webhook.issue_comment.not-review-command"


class GitHubIssueCommentAction(enum.StrEnum):
    CREATED = "created"
    EDITED = "edited"
    DELETED = "deleted"


SENTRY_REVIEW_COMMAND = "@sentry review"


def is_pr_review_command(comment_body: str | None) -> bool:
    if comment_body is None:
        return False
    return SENTRY_REVIEW_COMMAND in comment_body.lower()


def _add_eyes_reaction_to_comment(
    github_event: GithubWebhookType,
    github_event_action: str,
    integration: RpcIntegration | None,
    organization: Organization,
    repo: Repository,
    comment_id: str,
) -> None:
    """Add 👀 reaction to acknowledge a review command. Errors are logged/added to metrics but not raised."""
    extra = {
        "organization_id": organization.id,
        "repo": repo.name,
        "comment_id": comment_id,
        "github_event": github_event,
        "github_event_action": github_event_action,
    }

    if integration is None:
        record_webhook_handler_error(
            github_event,
            github_event_action,
            CodeReviewErrorType.MISSING_INTEGRATION,
        )
        logger.warning(Log.MISSING_INTEGRATION.value, extra=extra)
        return

    try:
        client = integration.get_installation(organization_id=organization.id).get_client()
        client.create_comment_reaction(repo.name, comment_id, GitHubReaction.EYES)
    except Exception:
        record_webhook_handler_error(
            github_event,
            github_event_action,
            CodeReviewErrorType.REACTION_FAILED,
        )
        logger.exception(Log.REACTION_FAILED.value, extra=extra)


def handle_issue_comment_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle issue_comment webhook events for PR review commands.
    """
    github_event_action = event.get("action", "")
    extra = {
        "organization_id": organization.id,
        "repo": repo.name,
        "github_event": github_event,
        "github_event_action": github_event_action,
    }
    record_webhook_received(github_event, github_event_action)

    if github_event_action != GitHubIssueCommentAction.CREATED:
        record_webhook_filtered(
            github_event, github_event_action, CodeReviewFilteredReason.WRONG_ACTION
        )
        logger.info(Log.WRONG_ACTION.value, extra=extra)
        return

    comment = event.get("comment", {})
    comment_id = comment.get("id")
    comment_body = comment.get("body")

    if not has_code_review_enabled(organization):
        record_webhook_filtered(
            github_event, github_event_action, CodeReviewFilteredReason.NOT_ENABLED
        )
        logger.info(Log.NOT_ENABLED.value, extra=extra)
        return

    if not is_pr_review_command(comment_body or ""):
        record_webhook_filtered(
            github_event, github_event_action, CodeReviewFilteredReason.NOT_REVIEW_COMMAND
        )
        logger.info(Log.NOT_REVIEW_COMMAND.value, extra=extra)
        return

    if not options.get("github.webhook.issue-comment"):
        if comment_id:
            _add_eyes_reaction_to_comment(
                github_event, github_event_action, integration, organization, repo, str(comment_id)
            )

        from .task import schedule_task

        schedule_task(
            github_event=github_event,
            github_event_action=github_event_action,
            event=event,
            organization=organization,
            repo=repo,
        )
        record_webhook_enqueued(github_event, github_event_action)
