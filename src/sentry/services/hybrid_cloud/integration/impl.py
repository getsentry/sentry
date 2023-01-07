from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, Iterable, List, Mapping, Tuple

from sentry.api.paginator import OffsetPaginator
from sentry.models.integrations import Integration, OrganizationIntegration
from sentry.services.hybrid_cloud import ApiPaginationArgs, ApiPaginationResult
from sentry.services.hybrid_cloud.integration import (
    APIIntegration,
    APIOrganizationIntegration,
    IntegrationService,
)

if TYPE_CHECKING:
    from datetime import datetime


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

    def get_integrations(
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
        # If an integration_id is provided, use that -- otherwise, use the provider and external_id
        integration_kwargs: Mapping[str, Any] = (
            {"id": integration_id}
            if integration_id
            else {"provider": provider, "external_id": external_id}
        )
        integration = Integration.objects.filter(**integration_kwargs).first()
        return self._serialize_integration(integration) if integration else None

    def get_organization_integrations(
        self,
        *,
        integration_id: int | None = None,
        organization_id: int | None = None,
        status: int | None = None,
        providers: List[str] | None = None,
        has_grace_period: bool | None = None,
        limit: int | None = None,
    ) -> List[APIOrganizationIntegration]:
        oi_kwargs: Dict[str, Any] = {}
        if integration_id is not None:
            oi_kwargs["integration_id"] = integration_id
        if organization_id is not None:
            oi_kwargs["organization_id"] = organization_id
        if status is not None:
            oi_kwargs["status"] = status
        if providers is not None:
            oi_kwargs["integration__provider__in"] = providers
        if has_grace_period is not None:
            oi_kwargs["grace_period_end__isnull"] = not has_grace_period

        ois = OrganizationIntegration.objects.filter(**oi_kwargs)

        if limit is not None:
            ois = ois[:limit]

        return [self._serialize_organization_integration(oi) for oi in ois]

    def get_organization_integration(
        self, *, integration_id: int, organization_id: int
    ) -> APIOrganizationIntegration | None:
        organization_integration = OrganizationIntegration.objects.filter(
            integration_id=integration_id, organization_id=organization_id
        ).first()

        return (
            self._serialize_organization_integration(organization_integration)
            if organization_integration
            else None
        )

    def get_organization_context(
        self,
        *,
        organization_id: int,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> Tuple[APIIntegration | None, APIOrganizationIntegration | None]:
        integration = self.get_integration(
            integration_id=integration_id, provider=provider, external_id=external_id
        )
        if not integration:
            return (None, None)
        organization_integration = self.get_organization_integration(
            integration_id=integration.id,
            organization_id=organization_id,
        )
        if not organization_integration:
            return (integration, None)
        return (
            self._serialize_integration(integration),
            self._serialize_organization_integration(organization_integration),
        )

    def update_integration(
        self,
        *,
        integration_id: int,
        name: str,
        metadata: Dict[str, Any],
        status: int,
    ) -> APIIntegration | None:
        integration = Integration.objects.filter(id=integration_id).first()
        if not integration:
            return None
        integration.update(
            name=name,
            metadata=metadata,
            status=status,
        )
        return self._serialize_integration(integration)

    def update_organization_integration(
        self,
        *,
        org_integration_id: int,
        config: Dict[str, Any],
        status: int,
        grace_period_end: datetime | None,
    ) -> APIOrganizationIntegration | None:
        organization_integration = OrganizationIntegration.objects.filter(
            id=org_integration_id
        ).first()
        if not organization_integration:
            return None
        organization_integration.update(
            config=config,
            status=status,
            grace_period_end=grace_period_end,
        )
        return self._serialize_organization_integration(organization_integration)
