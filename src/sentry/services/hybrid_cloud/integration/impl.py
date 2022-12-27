from __future__ import annotations

from typing import Iterable, List

from sentry.services.hybrid_cloud.integration import (
    APIIntegration,
    APIOrganizationIntegration,
    IntegrationService,
)


class DatabaseBackedIntegrationService(IntegrationService):
    def close(self) -> None:
        pass

    def get_many(
        self, *, integration_ids: Iterable[int] | None = None, organization_id: int | None = None
    ) -> List[APIIntegration]:
        from sentry.models.integrations import Integration

        queryset = None
        if integration_ids:
            queryset = Integration.objects.filter(id__in=integration_ids)  # type: ignore
        if organization_id is not None:
            queryset = (
                queryset.filter(organization_id=organization_id)
                if queryset
                else Integration.objects.filter(organization_id=organization_id)
            )

        return (
            [self._serialize_integration(integration) for integration in queryset]
            if queryset
            else []
        )

    def get_integration(
        self,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> APIIntegration | None:
        from sentry.models.integrations import Integration

        # If an integration_id is provided, use that -- otherwise, use the provider and external_id
        integration_kwargs = (
            {"id": integration_id}
            if integration_id
            else {"provider": provider, "external_id": external_id}
        )
        integration = Integration.objects.filter(**integration_kwargs).first()
        return self._serialize_integration(integration) if integration else None

    def get_organization_integrations(
        self, integration_id: int
    ) -> List[APIOrganizationIntegration]:
        from sentry.models.integrations import OrganizationIntegration

        ois = OrganizationIntegration.objects.filter(integration_id=integration_id)

        return [self._serialize_organization_integration(oi) for oi in ois]
