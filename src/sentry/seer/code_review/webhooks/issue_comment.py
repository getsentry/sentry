"""
Handler for GitHub issue_comment webhook events.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry import features
from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.utils import metrics

from ..permissions import has_code_review_enabled

logger = logging.getLogger(__name__)

SENTRY_REVIEW_COMMAND = "@sentry review"


def is_pr_review_command(comment_body: str | None) -> bool:
    if comment_body is None:
        return False
    return SENTRY_REVIEW_COMMAND in comment_body.lower()


def _add_eyes_reaction_to_comment(
    integration: RpcIntegration | None,
    organization: Organization,
    repo: Repository,
    comment_id: str,
) -> None:
    if integration is None:
        metrics.incr("seer.code_review.webhook.issue_comment.reaction_missing_integration")
        logger.warning(
            "github.webhook.issue_comment.missing_integration",
            extra={"organization_id": organization.id, "repo": repo.name},
        )
        return

    try:
        client = integration.get_installation(organization_id=organization.id).get_client()
        client.create_comment_reaction(repo.name, comment_id, GitHubReaction.EYES)
        metrics.incr("seer.code_review.webhook.issue_comment.reaction_added")
    except Exception:
        metrics.incr("seer.code_review.webhook.issue_comment.reaction_failed")
        logger.exception(
            "github.webhook.issue_comment.reaction_failed",
            extra={
                "organization_id": organization.id,
                "repo": repo.name,
                "comment_id": comment_id,
            },
        )


def handle_issue_comment_event(
    *,
    event_type: str,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle issue_comment webhook events for PR review commands.
    """
    if not features.has("organizations:code-review-comment-command", organization):
        return

    if not has_code_review_enabled(organization):
        return

    comment = event.get("comment", {})
    comment_body = comment.get("body")

    if not is_pr_review_command(comment_body):
        return

    comment_id = comment.get("id")
    if comment_id:
        _add_eyes_reaction_to_comment(integration, organization, repo, str(comment_id))

    # Import here to avoid circular dependency with handlers
    from .handlers import _forward_to_seer

    _forward_to_seer(event_type, event, organization, repo)
