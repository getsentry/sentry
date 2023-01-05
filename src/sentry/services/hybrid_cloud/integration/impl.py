from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Iterable, List, Mapping, Tuple

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
        oi_kwargs: Mapping[str, Any] = {}
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
    ) -> Tuple(APIIntegration, APIOrganizationIntegration):
        integration = self.get_integration(
            integration_id=integration_id, provider=provider, external_id=external_id
        )
        organization_integration = self.get_organization_integration(
            integration_id=integration.id,
            organization_id=organization_id,
        )
        return (
            self._serialize_integration(integration),
            self._serialize_organization_integration(organization_integration),
        )

    def update_config(
        self, *, org_integration_id: int, config: Mapping[str, Any], should_clear: bool = False
    ) -> APIOrganizationIntegration | None:
        oi = OrganizationIntegration.objects.filter(id=org_integration_id).first()
        if not oi:
            return None
        if should_clear:
            oi.config.clear()
        oi.config.update(config)
        oi.save()
        return self._serialize_organization_integration(oi)

    def update_status(
        self, *, org_integration_id: int, status: int
    ) -> APIOrganizationIntegration | None:
        oi = OrganizationIntegration.objects.filter(id=org_integration_id).first()
        if not oi:
            return None
        oi.update(status=status)
        return self._serialize_organization_integration(oi)

    def update_grace_period_end(
        self,
        *,
        org_integration_id: int,
        grace_period_end: datetime | None,
    ) -> APIOrganizationIntegration | None:
        oi = OrganizationIntegration.objects.filter(id=org_integration_id).first()
        if not oi:
            return None
        oi.update(grace_period_end=grace_period_end)
        return self._serialize_organization_integration(oi)
