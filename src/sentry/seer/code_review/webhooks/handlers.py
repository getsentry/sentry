from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from contextlib import nullcontext
from typing import Any

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.utils.locking import UnableToAcquireLock

from ..metrics import record_webhook_filtered
from ..preflight import CodeReviewPreflightService
from ..utils import extract_github_info
from .check_run import handle_check_run_event
from .issue_comment import handle_issue_comment_event
from .pull_request import handle_pull_request_event

logger = logging.getLogger(__name__)

DEDUPE_WEBHOOK_EVENT_LOCK_SECONDS = 30


EVENT_TYPE_TO_HANDLER: dict[GithubWebhookType, Callable[..., None]] = {
    GithubWebhookType.CHECK_RUN: handle_check_run_event,
    GithubWebhookType.ISSUE_COMMENT: handle_issue_comment_event,
    GithubWebhookType.PULL_REQUEST: handle_pull_request_event,
}


def handle_webhook_event(
    *,
    github_event: GithubWebhookType,
    github_delivery_id: str | None = None,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle GitHub webhook events.

    Args:
        github_event: The GitHub webhook event type (e.g., GithubWebhookType.CHECK_RUN)
        github_delivery_id: The GitHub delivery ID (unique identifier for the webhook event)
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
    extra["github_delivery_id"] = github_delivery_id

    handler = EVENT_TYPE_TO_HANDLER.get(github_event)
    if handler is None:
        logger.warning("github.webhook.handler.not_found", extra=extra)
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
                github_event_action=event.get("action", "unknown"),
                reason=preflight.denial_reason,
            )
        return

    # Dedupe concurrent deliveries with the same webhook event X-GitHub-Delivery ID
    if github_delivery_id:
        lock = locks.get(
            f"github:code_review:webhook:{github_delivery_id}",
            duration=DEDUPE_WEBHOOK_EVENT_LOCK_SECONDS,
            name="github_code_review_webhook_id",
        )
        try:
            lock_ctx = lock.acquire()
        except UnableToAcquireLock:
            logger.warning("github.webhook.code_review.webhook_dupe_skipped", extra=extra)
            return
    else:
        lock_ctx = nullcontext()

    with lock_ctx:
        handler(
            github_event=github_event,
            event=event,
            organization=organization,
            repo=repo,
            integration=integration,
            org_code_review_settings=preflight.settings,
            extra=extra,
        )
