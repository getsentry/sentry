from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_WEB_BASE_URL
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.integrations.services.repository import repository_service
from sentry.integrations.source_code_management.sync_repos import sync_repos_for_org
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationWebhookEventType

logger = logging.getLogger("sentry.integrations.cursor_origin")

PROVIDER = IntegrationProviderSlug.CURSOR_ORIGIN.value


class WebhookEventHandler:
    """An Origin event type, handled by the silo that owns its writes.

    The endpoint resolves the delivery's installation, so every handler is given the
    integration and its organizations rather than reading them out of the envelope.
    """

    EVENT_TYPE: IntegrationWebhookEventType

    def __call__(
        self,
        payload: Mapping[str, Any],
        delivery_id: str,
        integration: RpcIntegration,
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        raise NotImplementedError


class InstallationEventHandler(WebhookEventHandler):
    EVENT_TYPE = IntegrationWebhookEventType.INSTALLATION


def _sync_repositories(
    org_integrations: Sequence[RpcOrganizationIntegration], delivery_id: str
) -> None:
    for org_integration in org_integrations:
        logger.info(
            "cursor_origin.webhook.syncing_repositories",
            extra={"delivery_id": delivery_id, "organization_id": org_integration.organization_id},
        )
        sync_repos_for_org.apply_async(kwargs={"organization_integration_id": org_integration.id})


class InstallationRemovedHandler(InstallationEventHandler):
    """Uninstalled or suspended on Origin's side"""

    def __call__(
        self,
        payload: Mapping[str, Any],
        delivery_id: str,
        integration: RpcIntegration,
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        logger.info(
            "cursor_origin.webhook.disabling_integration",
            extra={
                "delivery_id": delivery_id,
                "integration_id": integration.id,
                "organization_ids": [oi.organization_id for oi in org_integrations],
            },
        )
        integration_service.update_integration(
            integration_id=integration.id, status=ObjectStatus.DISABLED
        )
        for org_integration in org_integrations:
            repository_service.disable_repositories_for_integration(
                organization_id=org_integration.organization_id,
                integration_id=integration.id,
                provider=f"integrations:{PROVIDER}",
            )


class InstallationRestoredHandler(InstallationEventHandler):
    """Unsuspended on Origin's side"""

    def __call__(
        self,
        payload: Mapping[str, Any],
        delivery_id: str,
        integration: RpcIntegration,
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        logger.info(
            "cursor_origin.webhook.restoring_integration",
            extra={"delivery_id": delivery_id, "integration_id": integration.id},
        )
        integration_service.update_integration(
            integration_id=integration.id, status=ObjectStatus.ACTIVE
        )
        _sync_repositories(org_integrations, delivery_id)


class InstallationUpdatedHandler(InstallationEventHandler):
    """Scopes, repository selection or the owner slug changed."""

    def __call__(
        self,
        payload: Mapping[str, Any],
        delivery_id: str,
        integration: RpcIntegration,
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        installation = payload.get("installation") or {}
        target = installation.get("target") or {}
        name = target.get("slug")
        changed: dict[str, Any] = {
            "installation_id": integration.external_id,
            "target": target,
            "scopes": installation.get("scopes") or [],
            "repo_selection_mode": installation.get("repoSelectionMode"),
        }
        if name:
            changed["domain_name"] = f"{CURSOR_ORIGIN_WEB_BASE_URL}/{name}"

        # `update_integration` replaces metadata rather than merging it, which would
        # drop the cached access token and, without a slug, `domain_name`. Read the row
        # again rather than merging onto the copy the endpoint resolved: a token refresh
        # between the two would be overwritten with the stale token.
        stored = integration_service.get_integration(integration_id=integration.id)
        metadata = {**(stored.metadata if stored else integration.metadata), **changed}

        logger.info(
            "cursor_origin.webhook.updating_integration",
            extra={"delivery_id": delivery_id, "integration_id": integration.id},
        )
        integration_service.update_integration(
            integration_id=integration.id, name=name or None, metadata=metadata
        )
        _sync_repositories(org_integrations, delivery_id)


HANDLERS: dict[str, type[InstallationEventHandler]] = {
    "installation.deleted": InstallationRemovedHandler,
    "installation.suspended": InstallationRemovedHandler,
    "installation.unsuspended": InstallationRestoredHandler,
    "installation.updated": InstallationUpdatedHandler,
}
