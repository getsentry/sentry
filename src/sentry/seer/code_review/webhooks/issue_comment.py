"""
Handler for GitHub issue_comment webhook events.
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
from sentry.seer.webhooks import SentryReviewCommand, sentry_command
from sentry.utils.redis import redis_clusters

from ..metrics import (
    WebhookFilteredReason,
    record_review_request_denied,
    record_webhook_filtered,
    record_webhook_received,
)
from ..preflight import PreflightDenialReason
from ..utils import _get_target_commit_sha, delete_existing_reactions_and_add_reaction

logger = logging.getLogger(__name__)

REVIEW_UNAVAILABLE_REPLY = "Sentry code review isn't available for this repository."
# Anyone who can comment on a public repo can send the command, so cap our replies per PR.
REVIEW_UNAVAILABLE_REPLY_TTL_SECONDS = 24 * 60 * 60
REVIEW_UNAVAILABLE_REPLY_KEY_PREFIX = "code_review:unavailable_reply:"


class Log(enum.StrEnum):
    UNSUPPORTED_ACTION = "github.webhook.issue_comment.unsupported-action"
    NOT_ENABLED = "github.webhook.issue_comment.not-enabled"
    NOT_REVIEW_COMMAND = "github.webhook.issue_comment.not-review-command"
    NOT_PR_COMMENT = "github.webhook.issue_comment.not-pr-comment"
    UNAVAILABLE_REPLY_FAILED = "github.webhook.issue_comment.unavailable-reply-failed"


class GitHubIssueCommentAction(enum.StrEnum):
    CREATED = "created"
    EDITED = "edited"
    DELETED = "deleted"


def is_review_request(event: Mapping[str, Any]) -> bool:
    return (
        event.get("action") == GitHubIssueCommentAction.CREATED
        and bool(event.get("issue", {}).get("pull_request"))
        and isinstance(sentry_command(event.get("comment", {}).get("body")), SentryReviewCommand)
    )


def reply_review_unavailable(
    *,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration,
    denial_reason: PreflightDenialReason | None,
) -> None:
    """
    Tell the user who asked for a review that it won't happen, so a denied request
    doesn't look like a broken integration. The reply doesn't say why, because the
    reason can reveal the organization's billing state to anyone on a public repo.
    """
    record_review_request_denied(GithubWebhookType.ISSUE_COMMENT, denial_reason)

    pr_number = event.get("issue", {}).get("number")
    if not pr_number:
        return

    try:
        is_first_reply = redis_clusters.get("default").set(
            f"{REVIEW_UNAVAILABLE_REPLY_KEY_PREFIX}{repo.id}:{pr_number}",
            "1",
            ex=REVIEW_UNAVAILABLE_REPLY_TTL_SECONDS,
            nx=True,
        )
        if not is_first_reply:
            return

        client = integration.get_installation(organization_id=organization.id).get_client()
        client.create_comment(repo.name, str(pr_number), {"body": REVIEW_UNAVAILABLE_REPLY})
    except Exception:
        logger.warning(Log.UNAVAILABLE_REPLY_FAILED.value, exc_info=True)


def handle_issue_comment_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    tags: Mapping[str, Any],
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle issue_comment webhook events for PR review commands.
    """
    github_event_action = event.get("action", "")
    record_webhook_received(github_event, github_event_action)

    if github_event_action != GitHubIssueCommentAction.CREATED:
        record_webhook_filtered(
            github_event, github_event_action, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        logger.info(Log.UNSUPPORTED_ACTION.value)
        return

    comment = event.get("comment", {})
    comment_id = comment.get("id")
    comment_body = comment.get("body")
    pr_number = event.get("issue", {}).get("number")

    issue = event.get("issue", {})
    if not issue.get("pull_request"):
        record_webhook_filtered(
            github_event, github_event_action, WebhookFilteredReason.NOT_PR_COMMENT
        )
        logger.info(Log.NOT_PR_COMMENT.value)
        return

    if not isinstance(sentry_command(comment_body), SentryReviewCommand):
        record_webhook_filtered(
            github_event, github_event_action, WebhookFilteredReason.NOT_REVIEW_COMMAND
        )
        logger.info(Log.NOT_REVIEW_COMMAND.value)
        return

    if comment_id:
        # We shouldn't ever need to delete :eyes: from the PR description unless Seer fails to do so.
        # But if we're already deleting :tada: we might as well delete :eyes: if we come across it.
        reactions_to_delete = [GitHubReaction.HOORAY, GitHubReaction.EYES]
        if is_github_rate_limit_sensitive(organization.slug):
            reactions_to_delete = []

        delete_existing_reactions_and_add_reaction(
            github_event=github_event,
            github_event_action=github_event_action,
            integration=integration,
            organization_id=organization.id,
            repo=repo,
            pr_number=str(pr_number) if pr_number else None,
            comment_id=str(comment_id),
            reactions_to_delete=reactions_to_delete,
            reaction_to_add=GitHubReaction.EYES,
        )

    target_commit_sha = _get_target_commit_sha(github_event, event, repo, integration)

    from .task import schedule_task

    schedule_task(
        github_event=github_event,
        github_event_action=github_event_action,
        event=event,
        organization=organization,
        repo=repo,
        target_commit_sha=target_commit_sha,
        tags=tags,
    )
