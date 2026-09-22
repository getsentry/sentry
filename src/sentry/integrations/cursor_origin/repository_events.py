from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_WEB_BASE_URL
from sentry.integrations.cursor_origin.handlers import WebhookEventHandler
from sentry.integrations.cursor_origin.repository import active_repositories
from sentry.integrations.cursor_origin.webhook_types import (
    RepositoryMetadataEvent,
    RepositorySnapshot,
)
from sentry.integrations.services.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.integrations.utils.metrics import IntegrationWebhookEventType
from sentry.models.repository import Repository

logger = logging.getLogger("sentry.integrations.cursor_origin")


class RepositoryMetadataUpdatedHandler(WebhookEventHandler):
    """Apply a rename or a default-branch change."""

    EVENT_TYPE = IntegrationWebhookEventType.INBOUND_SYNC

    def __call__(
        self,
        payload: Mapping[str, Any],
        delivery_id: str,
        integration: RpcIntegration,
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        snapshot = RepositoryMetadataEvent.from_payload(payload).repository
        for repo in active_repositories(snapshot.id, org_integrations):
            reconcile_repository(repo, snapshot, delivery_id)


def reconcile_repository(repo: Repository, snapshot: RepositorySnapshot, delivery_id: str) -> None:
    """Bring one row back in step with Origin."""
    url = f"{CURSOR_ORIGIN_WEB_BASE_URL}/{snapshot.full_name}"
    config = {
        **repo.config,
        "name": snapshot.full_name,
        "default_branch": snapshot.default_branch,
    }

    if repo.name == snapshot.full_name and repo.url == url and repo.config == config:
        return

    logger.info(
        "cursor_origin.repository.reconciled",
        extra={
            "delivery_id": delivery_id,
            "repository_id": repo.id,
            "previous_name": repo.name,
            "new_name": snapshot.full_name,
            "previous_default_branch": repo.config.get("default_branch"),
            "new_default_branch": snapshot.default_branch,
        },
    )
    repo.update(name=snapshot.full_name, url=url, config=config)
