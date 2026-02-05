from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from typing import Any

from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.utils.redis import redis_clusters

from ..metrics import record_webhook_filtered
from ..preflight import CodeReviewPreflightService
from ..utils import extract_github_info
from .check_run import handle_check_run_event
from .issue_comment import handle_issue_comment_event
from .pull_request import handle_pull_request_event

logger = logging.getLogger(__name__)

WEBHOOK_SEEN_TTL_SECONDS = 20
WEBHOOK_SEEN_KEY_PREFIX = "webhook:github:delivery:"


def _get_webhook_seen_cluster() -> RedisCluster[str] | StrictRedis[str]:
    return redis_clusters.get("default")


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

    # Ensure only one request per delivery_id within the TTL window: skip if already processed
    if github_delivery_id:
        try:
            cluster = _get_webhook_seen_cluster()
            seen_key = f"{WEBHOOK_SEEN_KEY_PREFIX}{github_delivery_id}"
            is_first_time_seen = cluster.set(seen_key, "1", ex=WEBHOOK_SEEN_TTL_SECONDS, nx=True)
        except Exception as e:
            logger.warning(
                "github.webhook.code_review.mark_seen_failed",
                extra={**extra, "error": str(e)},
            )
            # Keep going if error (e.g. Redis down) since we'd rather process twice than never
        else:
            if not is_first_time_seen:
                logger.warning("github.webhook.code_review.duplicate_delivery_skipped", extra=extra)
                return

    handler(
        github_event=github_event,
        event=event,
        organization=organization,
        repo=repo,
        integration=integration,
        org_code_review_settings=preflight.settings,
        extra=extra,
    )
