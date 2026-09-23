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
    """Apply a default-branch change. The name is repaired for every event."""

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
            store_default_branch(repo, snapshot, delivery_id)


def refresh_repository_name(
    payload: Mapping[str, Any],
    org_integrations: Sequence[RpcOrganizationIntegration],
    delivery_id: str,
) -> None:
    """Repair a stored name from any event that names the repository."""
    reference = payload.get("repository") or {}
    owner = (reference.get("owner") or {}).get("slug")
    if not (reference.get("id") and owner and reference.get("name")):
        return

    full_name = f"{owner}/{reference['name']}"
    for repo in active_repositories(reference["id"], org_integrations):
        if repo.name == full_name:
            continue

        logger.info(
            "cursor_origin.repository.name_refreshed",
            extra={
                "delivery_id": delivery_id,
                "repository_id": repo.id,
                "previous_name": repo.name,
                "new_name": full_name,
            },
        )
        repo.update(
            name=full_name,
            url=f"{CURSOR_ORIGIN_WEB_BASE_URL}/{full_name}",
            config={**repo.config, "name": full_name},
        )


def store_default_branch(repo: Repository, snapshot: RepositorySnapshot, delivery_id: str) -> None:
    if repo.config.get("default_branch") == snapshot.default_branch:
        return

    logger.info(
        "cursor_origin.repository.default_branch_changed",
        extra={
            "delivery_id": delivery_id,
            "repository_id": repo.id,
            "previous_default_branch": repo.config.get("default_branch"),
            "new_default_branch": snapshot.default_branch,
        },
    )
    repo.update(config={**repo.config, "default_branch": snapshot.default_branch})
