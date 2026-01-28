from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from typing import Any

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository

from ..metrics import (
    CodeReviewErrorType,
    WebhookFilteredReason,
    record_webhook_filtered,
    record_webhook_handler_error,
    record_webhook_received,
)
from ..preflight import CodeReviewPreflightService
from ..utils import extract_github_info
from .check_run import GitHubCheckRunAction, handle_check_run_event
from .issue_comment import GitHubIssueCommentAction, handle_issue_comment_event
from .pull_request import PullRequestAction, handle_pull_request_event
from .types import GithubWebhookAction

logger = logging.getLogger(__name__)


EVENT_TYPE_TO_HANDLER: dict[GithubWebhookType, Callable[..., None]] = {
    GithubWebhookType.CHECK_RUN: handle_check_run_event,
    GithubWebhookType.ISSUE_COMMENT: handle_issue_comment_event,
    GithubWebhookType.PULL_REQUEST: handle_pull_request_event,
}


def _validate_and_extract_action(
    event: Mapping[str, Any],
    github_event: GithubWebhookType,
    extra: Mapping[str, str | None],
) -> GithubWebhookAction | None:
    """
    Extract and validate the action field from webhook event.

    Returns the validated action enum, or None if invalid/missing.
    Records appropriate metrics on failure.
    """
    action_str = event.get("action")

    if action_str is None:
        logger.error(
            "github.webhook.%s.missing-action",
            github_event.value,
            extra=extra,
        )
        record_webhook_handler_error(
            github_event,
            "",
            CodeReviewErrorType.MISSING_ACTION,
        )
        return None

    # Try to parse action based on event type
    try:
        if github_event == GithubWebhookType.PULL_REQUEST:
            return PullRequestAction(action_str)
        elif github_event == GithubWebhookType.CHECK_RUN:
            return GitHubCheckRunAction(action_str)
        elif github_event == GithubWebhookType.ISSUE_COMMENT:
            return GitHubIssueCommentAction(action_str)
        else:
            logger.warning(
                "github.webhook.unknown-event-type",
                extra={**extra, "github_event": github_event.value, "action": action_str},
            )
            return None
    except ValueError:
        # Invalid action value for this event type - treat as unknown
        logger.debug(
            "github.webhook.%s.unknown-action",
            github_event.value,
            extra={**extra, "action": action_str},
        )
        # Still return the string so metrics can track it, but wrapped in a way handlers can check
        return None


def handle_webhook_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle GitHub webhook events.

    Validates action field and runs preflight checks before dispatching to specific handlers.

    Args:
        github_event: The GitHub webhook event type (e.g., GithubWebhookType.CHECK_RUN)
        event: The webhook event payload
        organization: The Sentry organization that the webhook event belongs to
        repo: The repository that the webhook event is for
        integration: The GitHub integration
        **kwargs: Additional keyword arguments
    """
    # Skip GitHub Enterprise on-prem - code review is only supported for GitHub Cloud
    if integration and integration.provider == IntegrationProviderSlug.GITHUB_ENTERPRISE:
        return

    # The extracted important key values are used for debugging with logs
    extra = extract_github_info(event, github_event=github_event.value)
    extra["organization_slug"] = organization.slug

    # Validate and extract action before any other processing
    action = _validate_and_extract_action(event, github_event, extra)
    if action is None:
        return

    # Record that webhook was received with valid action
    record_webhook_received(github_event, action.value)

    handler = EVENT_TYPE_TO_HANDLER.get(github_event)
    if handler is None:
        logger.warning("github.webhook.handler.not-found", extra=extra)
        record_webhook_filtered(
            github_event=github_event,
            github_event_action=action.value,
            reason=WebhookFilteredReason.HANDLER_NOT_FOUND,
        )
        return

    from ..utils import get_pr_author_id

    preflight = CodeReviewPreflightService(
        organization=organization,
        repo=repo,
        integration_id=integration.id if integration else None,
        pr_author_external_id=get_pr_author_id(event),
    ).check()

    if not preflight.allowed:
        if preflight.denial_reason:
            record_webhook_filtered(
                github_event=github_event,
                github_event_action=action.value,
                reason=preflight.denial_reason,
            )
        return

    handler(
        github_event=github_event,
        event=event,
        organization=organization,
        repo=repo,
        integration=integration,
        org_code_review_settings=preflight.settings,
        action=action,
        extra=extra,
    )
