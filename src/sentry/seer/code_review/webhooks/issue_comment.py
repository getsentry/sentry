"""
Handler for GitHub issue_comment webhook events.
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

from ..logging import debug_log
from ..metrics import (
    CodeReviewErrorType,
    WebhookFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_handler_error,
    record_webhook_received,
)
from ..utils import SeerCodeReviewTrigger, _get_target_commit_sha
from .config import get_direct_to_seer_gh_orgs

logger = logging.getLogger(__name__)


class Log(enum.StrEnum):
    MISSING_INTEGRATION = "github.webhook.issue_comment.missing-integration"
    REACTION_FAILED = "github.webhook.issue_comment.reaction-failed"
    UNSUPPORTED_ACTION = "github.webhook.issue_comment.unsupported-action"
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
    github_event_action: GitHubIssueCommentAction,
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
        client.create_comment_reaction(repo.name, comment_id, GitHubReaction.EYES)
    except Exception:
        record_webhook_handler_error(
            github_event,
            github_event_action.value,
            CodeReviewErrorType.REACTION_FAILED,
        )
        logger.exception(Log.REACTION_FAILED.value, extra=extra)


def handle_issue_comment_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    github_org: str,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle issue_comment webhook events for PR review commands.
    """
    github_event_action = event.get("action", "")
    comment = event.get("comment", {})
    comment_id = comment.get("id")
    comment_body = comment.get("body")
    issue = event.get("issue", {})
    pr_number = issue.get("number")

    base_extra = {
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "repo": repo.name,
        "github_org": github_org,
        "github_event": github_event.value if hasattr(github_event, "value") else str(github_event),
        "github_event_action": github_event_action,
        "comment_id": comment_id,
        "pr_number": pr_number,
    }

    debug_log("code_review.issue_comment.entry", extra=base_extra)

    record_webhook_received(github_event, github_event_action)

    if github_event_action != GitHubIssueCommentAction.CREATED:
        debug_log(
            "code_review.issue_comment.action_not_created",
            extra={**base_extra, "expected_action": "created"},
        )
        record_webhook_filtered(
            github_event, github_event_action, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        logger.info(Log.UNSUPPORTED_ACTION.value, extra=base_extra)
        return

    is_review_command = is_pr_review_command(comment_body or "")

    debug_log(
        "code_review.issue_comment.command_check",
        extra={
            **base_extra,
            "comment_body_preview": (comment_body or "")[:100] if comment_body else None,
            "is_review_command": is_review_command,
        },
    )

    if not is_review_command:
        debug_log(
            "code_review.issue_comment.not_review_command",
            extra={**base_extra, "reason": "comment_does_not_contain_sentry_review"},
        )
        record_webhook_filtered(
            github_event, github_event_action, WebhookFilteredReason.NOT_REVIEW_COMMAND
        )
        logger.info(Log.NOT_REVIEW_COMMAND.value, extra=base_extra)
        return

    direct_to_seer_orgs = get_direct_to_seer_gh_orgs()
    is_direct_to_seer = github_org in direct_to_seer_orgs

    debug_log(
        "code_review.issue_comment.routing_check",
        extra={
            **base_extra,
            "direct_to_seer_orgs": direct_to_seer_orgs,
            "is_direct_to_seer": is_direct_to_seer,
        },
    )

    if is_direct_to_seer:
        if comment_id:
            debug_log(
                "code_review.issue_comment.adding_reaction",
                extra={**base_extra, "reaction": "eyes"},
            )
            _add_eyes_reaction_to_comment(
                github_event,
                GitHubIssueCommentAction(github_event_action),
                integration,
                organization,
                repo,
                str(comment_id),
            )

        target_commit_sha = _get_target_commit_sha(github_event, event, repo, integration)

        debug_log(
            "code_review.issue_comment.scheduling_task",
            extra={
                **base_extra,
                "trigger": SeerCodeReviewTrigger.ON_COMMAND_PHRASE.value,
                "target_commit_sha": target_commit_sha,
            },
        )

        from .task import schedule_task

        schedule_task(
            github_event=github_event,
            github_event_action=github_event_action,
            event=event,
            organization=organization,
            repo=repo,
            target_commit_sha=target_commit_sha,
            trigger=SeerCodeReviewTrigger.ON_COMMAND_PHRASE,
        )
        record_webhook_enqueued(github_event, github_event_action)

        debug_log("code_review.issue_comment.task_scheduled", extra=base_extra)
    else:
        debug_log(
            "code_review.issue_comment.not_direct_to_seer",
            extra={**base_extra, "reason": "github_org_not_in_direct_to_seer_list"},
        )
