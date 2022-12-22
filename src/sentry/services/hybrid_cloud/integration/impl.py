from __future__ import annotations

from typing import TYPE_CHECKING, Sequence

from sentry.services.hybrid_cloud.integration import (
    APIIntegration,
    APIOrganizationIntegration,
    IntegrationService,
)

if TYPE_CHECKING:
    from sentry.models.integrations import Integration, OrganizationIntegration


class DatabaseBackedIntegrationService(IntegrationService):
    def close(self) -> None:
        pass

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
            id=oi.id, organization_id=oi.organization_id, integration_id=oi.integration_id
        )

    def get_by_provider_id(self, provider: str, external_id: str) -> APIIntegration | None:
        from sentry.models.integrations import Integration

        integration = Integration.objects.filter(provider=provider, external_id=external_id).first()

        if not integration:
            return None

        return self._serialize_integration(integration)

    def get_organization_integrations(
        self, integration_id: int
    ) -> Sequence[APIOrganizationIntegration]:
        from sentry.models.integrations import OrganizationIntegration

        ois = OrganizationIntegration.objects.filter(integration_id=integration_id)
        return [self._serialize_organization_integration(oi) for oi in ois]
