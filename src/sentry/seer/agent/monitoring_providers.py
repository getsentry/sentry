from __future__ import annotations

import abc
import logging

from sentry import features
from sentry.hybridcloud.rpc.service import RpcException
from sentry.identity import default_manager as identity_manager
from sentry.identity.mcp import McpIdentityProvider
from sentry.identity.oauth2 import OAuth2Provider
from sentry.identity.services.identity import identity_service
from sentry.integrations.types import MONITORING_PROVIDERS
from sentry.models.organization import Organization
from sentry.seer.sentry_data_models import MonitoringProviderConnectionData
from sentry.seer.utils import encrypt_access_token_for_seer
from sentry.utils.registry import Registry

logger = logging.getLogger(__name__)


class OrgMonitoringProvider(abc.ABC):
    """An org-level (shared) monitoring integration Seer can connect to."""

    provider_key: str

    @abc.abstractmethod
    def build_connection(
        self, organization: Organization
    ) -> MonitoringProviderConnectionData | None:
        """Build the Seer connection for this org's integration, or None if unconfigured."""


org_monitoring_provider_registry = Registry[type[OrgMonitoringProvider]]()


def _org_monitoring_providers() -> list[OrgMonitoringProvider]:
    return [
        provider_cls() for provider_cls in org_monitoring_provider_registry.registrations.values()
    ]


def provider_family(provider_key: str) -> str:
    """Resolve a provider key to its monitoring family"""
    if identity_manager.exists(provider_key):
        provider = identity_manager.get(provider_key)
        if isinstance(provider, McpIdentityProvider) and provider.monitoring_family:
            return provider.monitoring_family
    return provider_key


def get_org_monitoring_connections(
    organization: Organization,
) -> list[MonitoringProviderConnectionData]:
    """Build connections from all registered org-level (shared) monitoring integrations.

    Monitoring providers are optional enrichment. Building a connection hits the control silo,
    so a transient RPC failure must not propagate--it would fail (or, from the SEER_RUN_CREATE
    outbox handler, stall) a Seer run. Log and skip that provider instead, mirroring the
    per-user path in ``_get_personal_monitoring_connections``.
    """
    connections: list[MonitoringProviderConnectionData] = []
    for provider in _org_monitoring_providers():
        try:
            connection = provider.build_connection(organization)
        except RpcException:
            logger.warning(
                "seer.monitoring_providers.org_fetch_failed",
                extra={
                    "organization_id": organization.id,
                    "provider": provider.provider_key,
                },
                exc_info=True,
            )
            continue
        if connection is not None:
            connections.append(connection)
    return connections


def _get_personal_monitoring_connections(
    organization: Organization, user_id: int
) -> list[MonitoringProviderConnectionData]:
    """Build connections from the user's connected monitoring-provider identities."""
    connections: list[MonitoringProviderConnectionData] = []
    for provider_type in MONITORING_PROVIDERS:
        provider = identity_manager.get(provider_type)
        is_oauth_provider = isinstance(provider, OAuth2Provider)
        if not isinstance(provider, McpIdentityProvider):
            continue

        try:
            identities = identity_service.get_org_user_identities_by_provider_type(
                organization_id=organization.id, user_id=user_id, provider_type=provider_type
            )
        except RpcException:
            # Monitoring providers are optional enrichment. A control-silo RPC failure
            # shouldn't fail a run--just move on to the next provider.
            logger.warning(
                "seer.monitoring_providers.fetch_failed",
                extra={
                    "organization_id": organization.id,
                    "user_id": user_id,
                    "provider": provider_type,
                },
                exc_info=True,
            )
            continue

        for identity in identities:
            access_token = identity.data.get("access_token")
            if not access_token:
                continue
            urls = provider.build_mcp_urls(identity.data)
            if not urls:
                continue
            encrypted_auth_header = encrypt_access_token_for_seer(f"Bearer {access_token}")
            if not encrypted_auth_header:
                continue
            auth_method = "oauth" if is_oauth_provider else "pat"
            for url in urls:
                connections.append(
                    MonitoringProviderConnectionData(
                        provider_key=provider_type,
                        url=url,
                        encrypted_auth_headers={"Authorization": encrypted_auth_header},
                        identity_id=identity.id,
                        auth_method=auth_method,
                        refreshable=is_oauth_provider,
                    )
                )

    return connections


def get_monitoring_provider_connections(
    organization: Organization, user_id: int | None
) -> list[MonitoringProviderConnectionData]:
    """Build monitoring-provider connections for Seer.

    Combines the user's personal provider identities with org-level integrations.
    Personal identities take priority over org level for the same provider.
    """
    if not features.has("organizations:seer-infra-telemetry", organization):
        return []

    personal_connections = (
        _get_personal_monitoring_connections(organization, user_id) if user_id is not None else []
    )
    connected_families = {provider_family(c.provider_key) for c in personal_connections}
    org_connections = [
        connection
        for connection in get_org_monitoring_connections(organization)
        if provider_family(connection.provider_key) not in connected_families
    ]

    return personal_connections + org_connections
