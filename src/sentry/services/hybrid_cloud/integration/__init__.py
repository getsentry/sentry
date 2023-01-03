from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Iterable, List, Mapping

from sentry.constants import ObjectStatus
from sentry.services.hybrid_cloud import (
    ApiPaginationArgs,
    ApiPaginationResult,
    InterfaceWithLifecycle,
    silo_mode_delegation,
    stubbed,
)
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.integrations.base import (
        IntegrationFeatures,
        IntegrationInstallation,
        IntegrationProvider,
    )
    from sentry.models.integrations import Integration, OrganizationIntegration


@dataclass(frozen=True)
class APIIntegration:
    id: int
    provider: str
    external_id: str
    name: str
    metadata: Mapping[str, Any]
    status: int

    def __hash__(self) -> int:
        return hash(self.id)

    def get_provider(self) -> IntegrationProvider:
        from sentry import integrations

        return integrations.get(self.provider)  # type: ignore

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"


@dataclass(frozen=True)
class APIOrganizationIntegration:
    id: int
    default_auth_id: int
    organization_id: int
    integration_id: int
    config: dict[str, Any]
    status: int  # As ObjectStatus


class IntegrationService(InterfaceWithLifecycle):
    def _serialize_integration(self, integration: Integration) -> APIIntegration:
        return APIIntegration(
            id=integration.id,
            provider=integration.provider,
            external_id=integration.external_id,
            name=integration.name,
            metadata=integration.metadata,
            status=integration.status,
        )

    def _serialize_organization_integration(
        self, oi: OrganizationIntegration
    ) -> APIOrganizationIntegration:
        return APIOrganizationIntegration(
            id=oi.id,
            default_auth_id=oi.default_auth_id,
            organization_id=oi.organization_id,
            integration_id=oi.integration_id,
            config=oi.config,
            status=oi.status,
        )

    @abstractmethod
    def get_many(
        self, *, integration_ids: Iterable[int] | None = None, organization_id: int | None = None
    ) -> List[APIIntegration]:
        """
        Returns a list of APIIntegrations filtered either by a list of integration ids, or a single organization id
        """
        pass

    @abstractmethod
    def page_integration_ids(
        self,
        *,
        provider_keys: List[str],
        organization_id: int,
        args: ApiPaginationArgs,
    ) -> ApiPaginationResult:
        pass

    @abstractmethod
    def get_integration(
        self,
        *,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> APIIntegration | None:
        """
        Returns an APIIntegration using either the id or a combination of the provider and external_id
        """
        pass

    @abstractmethod
    def get_organization_integrations(
        self, *, integration_id: int
    ) -> List[APIOrganizationIntegration]:
        """
        Returns all APIOrganizationIntegrations associated with a given integration.
        """
        pass

    def get_organization_integration(
        self, integration_id: int, organization_id: int
    ) -> APIOrganizationIntegration | None:
        """
        Returns an APIOrganizationIntegration from the integration and organization ids.
        """
        all_ois = self.get_organization_integrations(integration_id=integration_id)
        organization_integration = next(
            (oi for oi in all_ois if oi.organization_id == organization_id), None
        )

        return (
            self._serialize_organization_integration(organization_integration)
            if organization_integration
            else None
        )

    def update_config(
        self, *, org_integration_id: int, config: Mapping[str, Any], should_clear: bool = False
    ) -> APIOrganizationIntegration | None:
        """
        Returns an APIOrganizationIntegration if the associated org_integration.config value
        was successfully updated, otherwise returns None.
        If should_clear is True, runs dict.clear() first, otherwise just uses dict.update()
        """

    def get_installation(
        self, *, integration_id: int, organization_id: int, **kwargs: Mapping[str, Any]
    ) -> IntegrationInstallation | None:
        """
        Returns the IntegrationInstallation class for a given integration.
        Intended to replace calls of `integration.get_installation`.
        See src/sentry/models/integrations/integration.py
        """
        from sentry import integrations

        # Validate the integration_id first, since we're not using instances
        integration = self.get_integration(integration_id=integration_id)
        if not integration:
            return None

        provider = integrations.get(integration.provider)
        installation: IntegrationInstallation = provider.get_installation(
            integration, organization_id, **kwargs
        )
        return installation

    def has_feature(self, *, provider: str, feature: IntegrationFeatures) -> bool | None:
        """
        Returns True if the IntegrationProvider subclass contains a given feature
        Intended to replace calls of `integration.has_feature`.
        See src/sentry/models/integrations/integration.py
        """
        from sentry import integrations

        int_provider: IntegrationProvider = integrations.get(provider)
        return feature in int_provider.features


def impl_with_db() -> IntegrationService:
    from sentry.services.hybrid_cloud.integration.impl import DatabaseBackedIntegrationService

    return DatabaseBackedIntegrationService()


integration_service: IntegrationService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
