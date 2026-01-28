"""
Handler for GitHub issue_comment webhook events.
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from typing import Any

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository

from ..metrics import WebhookFilteredReason, record_webhook_enqueued, record_webhook_filtered
from ..utils import _get_target_commit_sha, delete_existing_reactions_and_add_eyes_reaction

logger = logging.getLogger(__name__)


class Log(enum.StrEnum):
    UNSUPPORTED_ACTION = "github.webhook.issue_comment.unsupported-action"
    NOT_ENABLED = "github.webhook.issue_comment.not-enabled"
    NOT_REVIEW_COMMAND = "github.webhook.issue_comment.not-review-command"
    NOT_PR_COMMENT = "github.webhook.issue_comment.not-pr-comment"


class GitHubIssueCommentAction(enum.StrEnum):
    CREATED = "created"
    EDITED = "edited"
    DELETED = "deleted"


SENTRY_REVIEW_COMMAND = "@sentry review"


def is_pr_review_command(comment_body: str | None) -> bool:
    if comment_body is None:
        return False
    return SENTRY_REVIEW_COMMAND in comment_body.lower()


def handle_issue_comment_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    action: GitHubIssueCommentAction,
    integration: RpcIntegration | None = None,
    extra: Mapping[str, str | None],
    **kwargs: Any,
) -> None:
    """
    Handle issue_comment webhook events for PR review commands.
    """
    if action != GitHubIssueCommentAction.CREATED:
        record_webhook_filtered(
            github_event, action.value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        logger.info(Log.UNSUPPORTED_ACTION.value, extra=extra)
        return

    comment = event.get("comment", {})
    comment_id = comment.get("id")
    comment_body = comment.get("body")
    pr_number = event.get("issue", {}).get("number")

    issue = event.get("issue", {})
    if not issue.get("pull_request"):
        record_webhook_filtered(github_event, action.value, WebhookFilteredReason.NOT_PR_COMMENT)
        logger.info(Log.NOT_PR_COMMENT.value, extra=extra)
        return

    if not is_pr_review_command(comment_body or ""):
        record_webhook_filtered(
            github_event, action.value, WebhookFilteredReason.NOT_REVIEW_COMMAND
        )
        logger.info(Log.NOT_REVIEW_COMMAND.value, extra=extra)
        return

    if comment_id:
        delete_existing_reactions_and_add_eyes_reaction(
            github_event=github_event,
            github_event_action=action.value,
            integration=integration,
            organization_id=organization.id,
            repo=repo,
            pr_number=str(pr_number) if pr_number else None,
            comment_id=str(comment_id),
            extra=extra,
        )

    target_commit_sha = _get_target_commit_sha(github_event, event, repo, integration)

    from .task import schedule_task

    enqueued = schedule_task(
        github_event=github_event,
        github_event_action=action.value,
        event=event,
        organization=organization,
        repo=repo,
        target_commit_sha=target_commit_sha,
    )

    if enqueued:
        record_webhook_enqueued(github_event, action.value)
