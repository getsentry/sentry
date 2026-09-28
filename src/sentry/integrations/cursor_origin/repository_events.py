from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_WEB_BASE_URL
from sentry.integrations.cursor_origin.handlers import WebhookEventHandler
from sentry.integrations.cursor_origin.repository import active_repositories
from sentry.integrations.cursor_origin.webhook_types import (
    RepositoryDeletedEvent,
    RepositoryMetadataEvent,
    RepositorySnapshot,
)
from sentry.integrations.services.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.integrations.services.repository import repository_service
from sentry.integrations.source_code_management.repo_audit import log_repo_change
from sentry.integrations.source_code_management.sync_repos import DISABLE_ACTIVITY_CUTOFF_DAYS
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationWebhookEventType
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.plugins.providers.integration_repository import get_integration_repository_provider
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.cursor_origin")

PROVIDER = f"integrations:{IntegrationProviderSlug.CURSOR_ORIGIN.value}"


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


def _active_org_integrations(
    integration: RpcIntegration,
    org_integrations: Sequence[RpcOrganizationIntegration],
    delivery_id: str,
) -> list[RpcOrganizationIntegration]:
    if integration.status != ObjectStatus.ACTIVE:
        logger.info(
            "cursor_origin.repository.inactive_integration",
            extra={"delivery_id": delivery_id, "integration_id": integration.id},
        )
        return []
    return [oi for oi in org_integrations if oi.status == ObjectStatus.ACTIVE]


class RepositoryCreatedHandler(WebhookEventHandler):
    EVENT_TYPE = IntegrationWebhookEventType.INBOUND_SYNC

    def __call__(
        self,
        payload: Mapping[str, Any],
        delivery_id: str,
        integration: RpcIntegration,
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        snapshot = RepositoryMetadataEvent.from_payload(payload).repository
        provider = get_integration_repository_provider(integration)
        config = {
            "name": snapshot.full_name,
            "external_id": snapshot.id,
            "default_branch": snapshot.default_branch,
            "integration_id": integration.id,
        }

        org_integrations = _active_org_integrations(integration, org_integrations, delivery_id)
        for organization in Organization.objects.filter(
            id__in=[oi.organization_id for oi in org_integrations]
        ):
            created, reactivated, _ = provider.create_repositories(
                configs=[config], organization=serialize_rpc_organization(organization)
            )
            if created:
                repository_service.auto_link_repos_by_name(
                    organization_id=organization.id, repo_ids=[repo.id for repo in created]
                )
            for repo in created:
                log_repo_change(
                    event_name="REPO_ADDED",
                    organization_id=organization.id,
                    repo=repo,
                    source="Cursor Origin webhook",
                    provider=integration.provider,
                )
            for repo in reactivated:
                log_repo_change(
                    event_name="REPO_ENABLED",
                    organization_id=organization.id,
                    repo=repo,
                    source="Cursor Origin webhook",
                    provider=integration.provider,
                )


class RepositoryDeletedHandler(WebhookEventHandler):
    EVENT_TYPE = IntegrationWebhookEventType.INBOUND_SYNC

    def __call__(
        self,
        payload: Mapping[str, Any],
        delivery_id: str,
        integration: RpcIntegration,
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        external_id = RepositoryDeletedEvent.from_payload(payload).repository.id
        for org_integration in _active_org_integrations(integration, org_integrations, delivery_id):
            organization_id = org_integration.organization_id
            if repository_service.find_recently_active_repo_external_ids(
                organization_id=organization_id,
                integration_id=integration.id,
                provider=PROVIDER,
                external_ids=[external_id],
                cutoff_days=DISABLE_ACTIVITY_CUTOFF_DAYS,
            ):
                logger.info(
                    "cursor_origin.repository.disable_skipped_due_to_activity",
                    extra={
                        "delivery_id": delivery_id,
                        "organization_id": organization_id,
                        "external_id": external_id,
                        "cutoff_days": DISABLE_ACTIVITY_CUTOFF_DAYS,
                    },
                )
                metrics.incr(
                    "cursor_origin.repository.disable_skipped_due_to_activity", sample_rate=1.0
                )
                continue

            active = [
                repo
                for repo in repository_service.get_repositories(
                    organization_id=organization_id,
                    integration_id=integration.id,
                    providers=[PROVIDER],
                    external_id=external_id,
                )
                if repo.status == ObjectStatus.ACTIVE
            ]
            repository_service.disable_repositories_by_external_ids(
                organization_id=organization_id,
                integration_id=integration.id,
                provider=PROVIDER,
                external_ids=[external_id],
            )
            for repo in active:
                log_repo_change(
                    event_name="REPO_DISABLED",
                    organization_id=organization_id,
                    repo=repo,
                    source="Cursor Origin webhook",
                    provider=integration.provider,
                )
