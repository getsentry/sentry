from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from typing import Any

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository

from ..logging import debug_log
from ..metrics import record_webhook_filtered
from ..preflight import CodeReviewPreflightService
from .check_run import handle_check_run_event
from .issue_comment import handle_issue_comment_event
from .pull_request import handle_pull_request_event

logger = logging.getLogger(__name__)


EVENT_TYPE_TO_HANDLER: dict[GithubWebhookType, Callable[..., None]] = {
    GithubWebhookType.CHECK_RUN: handle_check_run_event,
    GithubWebhookType.ISSUE_COMMENT: handle_issue_comment_event,
    GithubWebhookType.PULL_REQUEST: handle_pull_request_event,
}


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

    Args:
        github_event: The GitHub webhook event type from X-GitHub-Event header (e.g., "check_run", "pull_request")
        event: The webhook event payload
        organization: The Sentry organization that the webhook event belongs to
        repo: The repository that the webhook event is for
        integration: The GitHub integration
        **kwargs: Additional keyword arguments
    """
    base_extra = {
        "github_event": github_event.value if hasattr(github_event, "value") else str(github_event),
        "action": event.get("action"),
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "repo_name": repo.name,
        "repo_id": repo.id,
        "integration_id": integration.id if integration else None,
        "integration_provider": integration.provider if integration else None,
    }

    debug_log("code_review.handler.entry", extra=base_extra)

    # Skip GitHub Enterprise on-prem - code review is only supported for GitHub Cloud
    if integration and integration.provider == IntegrationProviderSlug.GITHUB_ENTERPRISE:
        debug_log(
            "code_review.handler.skipped_github_enterprise",
            extra={**base_extra, "reason": "github_enterprise_not_supported"},
        )
        return

    handler = EVENT_TYPE_TO_HANDLER.get(github_event)
    if handler is None:
        debug_log(
            "code_review.handler.no_handler_found",
            extra={**base_extra, "available_handlers": list(EVENT_TYPE_TO_HANDLER.keys())},
        )
        logger.warning(
            "github.webhook.handler.not_found",
            extra={"github_event": github_event.value},
        )
        return

    debug_log(
        "code_review.handler.handler_found",
        extra={**base_extra, "handler_name": handler.__name__},
    )

    from ..utils import get_pr_author_id

    pr_author_id = get_pr_author_id(event)
    debug_log(
        "code_review.handler.preflight_check_start",
        extra={**base_extra, "pr_author_external_id": pr_author_id},
    )

    preflight = CodeReviewPreflightService(
        organization=organization,
        repo=repo,
        integration_id=integration.id if integration else None,
        pr_author_external_id=pr_author_id,
    ).check()

    debug_log(
        "code_review.handler.preflight_check_result",
        extra={
            **base_extra,
            "preflight_allowed": preflight.allowed,
            "preflight_denial_reason": (
                preflight.denial_reason.value if preflight.denial_reason else None
            ),
        },
    )

    if not preflight.allowed:
        if preflight.denial_reason:
            record_webhook_filtered(
                github_event=github_event,
                github_event_action=event.get("action", "unknown"),
                reason=preflight.denial_reason,
            )
        debug_log(
            "code_review.handler.preflight_denied",
            extra={**base_extra, "denial_reason": preflight.denial_reason},
        )
        return

    github_org = event.get("repository", {}).get("owner", {}).get("login")
    from .config import get_direct_to_seer_gh_orgs

    gh_orgs_to_only_send_to_seer = get_direct_to_seer_gh_orgs()

    debug_log(
        "code_review.handler.dispatch_to_handler",
        extra={
            **base_extra,
            "github_org": github_org,
            "direct_to_seer_orgs": gh_orgs_to_only_send_to_seer,
            "is_direct_to_seer": (
                github_org in gh_orgs_to_only_send_to_seer if github_org else False
            ),
            "handler_name": handler.__name__,
        },
    )

    handler(
        github_event=github_event,
        event=event,
        organization=organization,
        github_org=github_org,
        repo=repo,
        integration=integration,
    )

    debug_log("code_review.handler.dispatch_complete", extra=base_extra)
