from __future__ import annotations

import logging
from typing import Any, Iterable, List, Mapping

from sentry.api.paginator import OffsetPaginator
from sentry.models.integrations import Integration
from sentry.services.hybrid_cloud import ApiPaginationArgs, ApiPaginationResult
from sentry.services.hybrid_cloud.integration import (
    APIIntegration,
    APIOrganizationIntegration,
    IntegrationService,
)

logger = logging.getLogger(__name__)


class DatabaseBackedIntegrationService(IntegrationService):
    def close(self) -> None:
        pass

    def page_integration_ids(
        self,
        *,
        provider_keys: List[str],
        organization_id: int,
        args: ApiPaginationArgs,
    ) -> ApiPaginationResult:
        return args.do_hybrid_cloud_pagination(
            description="page_integration_ids",
            paginator_cls=OffsetPaginator,
            order_by="name",
            queryset=Integration.objects.filter(
                organizations=organization_id,
                provider__in=provider_keys,
            ),
        )

    def get_many(
        self, *, integration_ids: Iterable[int] | None = None, organization_id: int | None = None
    ) -> List[APIIntegration]:
        queryset = None
        if integration_ids:
            queryset = Integration.objects.filter(id__in=integration_ids)
        if organization_id is not None:
            queryset = (
                queryset.filter(organizations=organization_id)
                if queryset
                else Integration.objects.filter(organizations=organization_id)
            )
        return (
            [self._serialize_integration(integration) for integration in queryset]
            if queryset
            else []
        )

    def get_integration(
        self,
        *,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> APIIntegration | None:
        from sentry.models.integrations import Integration

        # If an integration_id is provided, use that -- otherwise, use the provider and external_id
        integration_kwargs: Mapping[str, Any] = (
            {"id": integration_id}
            if integration_id
            else {"provider": provider, "external_id": external_id}
        )
        integration = Integration.objects.filter(**integration_kwargs).first()
        return self._serialize_integration(integration) if integration else None

    def get_organization_integrations(
        self, *, integration_id: int
    ) -> List[APIOrganizationIntegration]:
        from sentry.models.integrations import OrganizationIntegration

        ois = OrganizationIntegration.objects.filter(integration_id=integration_id)

        return [self._serialize_organization_integration(oi) for oi in ois]

    def update_config(
        self, *, org_integration_id: int, config: Mapping[str, Any], should_clear: bool = False
    ) -> APIOrganizationIntegration | None:
        from sentry.models.integrations import OrganizationIntegration

        oi = OrganizationIntegration.objects.filter(id=org_integration_id).first()
        if not oi:
            return None
        if should_clear:
            oi.config.clear()
        oi.config.update(config)
        oi.save()
        return self._serialize_organization_integration(oi)
