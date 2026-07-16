from __future__ import annotations

import abc

from sentry.identity import default_manager as identity_manager
from sentry.identity.mcp import McpIdentityProvider
from sentry.models.organization import Organization
from sentry.seer.sentry_data_models import MonitoringProviderConnectionData
from sentry.utils.registry import Registry


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
    """Build connections from all registered org-level (shared) monitoring integrations."""
    built = (provider.build_connection(organization) for provider in _org_monitoring_providers())
    return [connection for connection in built if connection is not None]
