from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.integrations.cursor_origin.authors import get_or_create_commit_author
from sentry.integrations.cursor_origin.handlers import WebhookEventHandler
from sentry.integrations.cursor_origin.repository import active_repositories
from sentry.integrations.cursor_origin.webhook_types import PullRequestEvent
from sentry.integrations.services.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationWebhookEventType
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.pr_metrics.lifecycle_mapping import update_pull_request_from_scm_snapshot
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.cursor_origin")


def lifecycle_state(event: PullRequestEvent) -> str:
    if event.pull_request.merged:
        return PullRequestLifecycleState.MERGED
    if event.pull_request.state == "closed":
        return PullRequestLifecycleState.CLOSED
    return PullRequestLifecycleState.OPEN


class PullRequestLifecycleHandler(WebhookEventHandler):
    """Record a pull request from any of Origin's snapshot events."""

    EVENT_TYPE = IntegrationWebhookEventType.MERGE_REQUEST

    def __call__(
        self,
        payload: Mapping[str, Any],
        delivery_id: str,
        integration: RpcIntegration,
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        event = PullRequestEvent.from_payload(payload)

        repositories = active_repositories(event.repository_id, org_integrations)
        if not repositories:
            logger.info(
                "cursor_origin.pull_request.unknown_repository",
                extra={"delivery_id": delivery_id, "external_id": event.repository_id},
            )
            metrics.incr("cursor_origin.pull_request.unknown_repository", sample_rate=1.0)
            return

        for repo in repositories:
            self._record(repo, event, delivery_id)

    def _record(self, repo: Repository, event: PullRequestEvent, delivery_id: str) -> None:
        pull_request = event.pull_request
        state = lifecycle_state(event)
        email, name = pull_request.author.email_and_name()
        author = get_or_create_commit_author(repo.organization_id, email, name)

        _, created = update_pull_request_from_scm_snapshot(
            provider=IntegrationProviderSlug.CURSOR_ORIGIN.value,
            organization_id=repo.organization_id,
            repository_id=repo.id,
            key=pull_request.number,
            defaults={
                "organization_id": repo.organization_id,
                "title": pull_request.title,
                "author": author,
                "message": pull_request.body,
                "merge_commit_sha": pull_request.merge_commit_sha or None,
                "head_commit_sha": pull_request.head.sha,
                "opened_at": pull_request.created_at,
                "closed_at": pull_request.closed_at,
                "merged_at": pull_request.merged_at,
                "provider_updated_at": pull_request.updated_at,
                "state": state,
                "draft": pull_request.draft,
            },
            event_state=state,
            event_updated_at=pull_request.updated_at,
        )

        if created:
            logger.info(
                "cursor_origin.pull_request.created",
                extra={
                    "delivery_id": delivery_id,
                    "repository_id": repo.id,
                    "key": pull_request.number,
                },
            )
