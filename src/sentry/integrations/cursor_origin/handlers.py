from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_WEB_BASE_URL
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcOrganizationIntegration
from sentry.integrations.services.repository import repository_service
from sentry.integrations.source_code_management.sync_repos import sync_repos_for_org
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationWebhookEventType

logger = logging.getLogger("sentry.integrations.cursor_origin")

PROVIDER = IntegrationProviderSlug.CURSOR_ORIGIN.value


class InstallationEventHandler:
    EVENT_TYPE = IntegrationWebhookEventType.INSTALLATION

    def __call__(self, payload: Mapping[str, Any], delivery_id: str) -> None:
        installation = payload.get("installation") or {}
        external_id = installation.get("id")
        if not external_id:
            logger.warning(
                "cursor_origin.webhook.installation_missing", extra={"delivery_id": delivery_id}
            )
            return

        result = integration_service.organization_contexts(
            provider=PROVIDER, external_id=external_id
        )
        if result.integration is None:
            logger.info(
                "cursor_origin.webhook.unknown_installation",
                extra={"delivery_id": delivery_id, "installation_id": external_id},
            )
            return

        self.handle(
            result.integration.id, result.organization_integrations, installation, delivery_id
        )

    def handle(
        self,
        integration_id: int,
        org_integrations: Sequence[RpcOrganizationIntegration],
        installation: Mapping[str, Any],
        delivery_id: str,
    ) -> None:
        raise NotImplementedError


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

    def handle(
        self,
        integration_id: int,
        org_integrations: Sequence[RpcOrganizationIntegration],
        installation: Mapping[str, Any],
        delivery_id: str,
    ) -> None:
        logger.info(
            "cursor_origin.webhook.disabling_integration",
            extra={
                "delivery_id": delivery_id,
                "integration_id": integration_id,
                "organization_ids": [oi.organization_id for oi in org_integrations],
            },
        )
        integration_service.update_integration(
            integration_id=integration_id, status=ObjectStatus.DISABLED
        )
        for org_integration in org_integrations:
            repository_service.disable_repositories_for_integration(
                organization_id=org_integration.organization_id,
                integration_id=integration_id,
                provider=f"integrations:{PROVIDER}",
            )


class InstallationRestoredHandler(InstallationEventHandler):
    """Unsuspended on Origin's side"""

    def handle(
        self,
        integration_id: int,
        org_integrations: Sequence[RpcOrganizationIntegration],
        installation: Mapping[str, Any],
        delivery_id: str,
    ) -> None:
        logger.info(
            "cursor_origin.webhook.restoring_integration",
            extra={"delivery_id": delivery_id, "integration_id": integration_id},
        )
        integration_service.update_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        _sync_repositories(org_integrations, delivery_id)


class InstallationUpdatedHandler(InstallationEventHandler):
    """Scopes, repository selection or the owner slug changed."""

    def handle(
        self,
        integration_id: int,
        org_integrations: Sequence[RpcOrganizationIntegration],
        installation: Mapping[str, Any],
        delivery_id: str,
    ) -> None:
        target = installation.get("target") or {}
        name = target.get("slug")
        metadata = {
            "installation_id": installation["id"],
            "target": target,
            "scopes": installation.get("scopes") or [],
            "repo_selection_mode": installation.get("repoSelectionMode"),
        }
        if name:
            metadata["domain_name"] = f"{CURSOR_ORIGIN_WEB_BASE_URL}/{name}"

        logger.info(
            "cursor_origin.webhook.updating_integration",
            extra={"delivery_id": delivery_id, "integration_id": integration_id},
        )
        integration_service.update_integration(
            integration_id=integration_id, name=name, metadata=metadata
        )
        _sync_repositories(org_integrations, delivery_id)


HANDLERS: dict[str, type[InstallationEventHandler]] = {
    "installation.deleted": InstallationRemovedHandler,
    "installation.suspended": InstallationRemovedHandler,
    "installation.unsuspended": InstallationRestoredHandler,
    "installation.updated": InstallationUpdatedHandler,
}
