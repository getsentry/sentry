from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Iterable, List, Mapping

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models.integrations import Integration, OrganizationIntegration


@dataclass(frozen=True)
class APIIntegration:
    id: int
    provider: str
    external_id: str
    name: str
    metadata: Mapping[str, Any]


@dataclass(frozen=True)
class APIOrganizationIntegration:
    id: int
    organization_id: int
    integration_id: int
    config: Mapping[str, Any]


class IntegrationService(InterfaceWithLifecycle):
    def _serialize_integration(self, integration: Integration) -> APIIntegration:
        return APIIntegration(
            id=integration.id,
            provider=integration.provider,
            external_id=integration.external_id,
            name=integration.name,
            metadata=integration.metadata,
        )

    def _serialize_organization_integration(
        self, oi: OrganizationIntegration
    ) -> APIOrganizationIntegration:
        return APIOrganizationIntegration(
            id=oi.id,
            organization_id=oi.organization_id,
            integration_id=oi.integration_id,
            config=oi.config,
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
    def get_integration(
        self,
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
        self, integration_id: int
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
