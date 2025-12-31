from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository

if TYPE_CHECKING:
    from sentry.integrations.github.webhook import WebhookProcessor

from .check_run import handle_check_run_event
from .issue_comment import handle_issue_comment_event

logger = logging.getLogger(__name__)

METRICS_PREFIX = "seer.code_review.webhook"


def _get_target_commit_sha(
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    repo: Repository,
    integration: RpcIntegration | None,
) -> str | None:
    """
    Get the target commit SHA for the PR from the event or GitHub API.

    For pull_request events, the target commit SHA is in the payload (head.sha).
    For issue_comment events, we need to fetch it from the GitHub API.
    """
    if github_event == GithubWebhookType.PULL_REQUEST:
        return event.get("pull_request", {}).get("head", {}).get("sha")

    if github_event == GithubWebhookType.ISSUE_COMMENT:
        if integration is None:
            return None
        pr_number = event.get("issue", {}).get("number")
        if not pr_number:
            return None

        client = GitHubApiClient(integration=integration)
        try:
            pr_data = client.get_pullrequest(repo.name, pr_number)
            return pr_data.get("head", {}).get("sha")
        except Exception:
            return None

    return None


EVENT_TYPE_TO_HANDLER: dict[GithubWebhookType, WebhookProcessor] = {
    GithubWebhookType.CHECK_RUN: handle_check_run_event,
    GithubWebhookType.ISSUE_COMMENT: handle_issue_comment_event,
}


def handle_webhook_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """
    Handle GitHub webhook events.

    Args:
        github_event: The GitHub webhook event type from X-GitHub-Event header (e.g., "check_run", "pull_request")
        event: The webhook event payload
        organization: The Sentry organization that the webhook event belongs to
        repo: The repository that the webhook event is for
        **kwargs: Additional keyword arguments including integration
    """
    handler = EVENT_TYPE_TO_HANDLER.get(github_event)
    if handler is None:
        logger.warning(
            "github.webhook.handler.not_found",
            extra={"github_event": github_event.value},
        )
        return

    handler(
        github_event=github_event,
        event=event,
        organization=organization,
        repo=repo,
        **kwargs,
    )
