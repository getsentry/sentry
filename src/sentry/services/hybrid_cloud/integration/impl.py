from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, Iterable, List, Optional, Tuple

from sentry.api.paginator import OffsetPaginator
from sentry.integrations.mixins import NotifyBasicMixin
from sentry.models.integrations import Integration, OrganizationIntegration
from sentry.services.hybrid_cloud.integration import (
    IntegrationService,
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.services.hybrid_cloud.pagination import RpcPaginationArgs, RpcPaginationResult

if TYPE_CHECKING:
    from datetime import datetime


logger = logging.getLogger(__name__)


class DatabaseBackedIntegrationService(IntegrationService):
    def send_message(
        self, *, integration_id: int, organization_id: int, channel: str, message: str
    ) -> bool:
        integration = Integration.objects.filter(id=integration_id).first()
        if integration is None:
            return False
        install = self.get_installation(integration=integration, organization_id=organization_id)
        if isinstance(install, NotifyBasicMixin):
            install.send_message(channel_id=channel, message=message)
            return True

        return False

    def close(self) -> None:
        pass

    def page_integration_ids(
        self,
        *,
        provider_keys: List[str],
        organization_id: int,
        args: RpcPaginationArgs,
    ) -> RpcPaginationResult:
        return args.do_hybrid_cloud_pagination(
            description="page_integration_ids",
            paginator_cls=OffsetPaginator,
            order_by="name",
            queryset=Integration.objects.filter(
                organizationintegration__organization_id=organization_id,
                provider__in=provider_keys,
            ),
        )

    def page_organization_integrations_ids(
        self,
        *,
        organization_id: int,
        statuses: List[int],
        provider_key: str | None = None,
        args: RpcPaginationArgs,
    ) -> RpcPaginationResult:
        queryset = OrganizationIntegration.objects.filter(
            organization_id=organization_id,
            status__in=statuses,
        )

        if provider_key:
            queryset = queryset.filter(integration__provider=provider_key.lower())

        return args.do_hybrid_cloud_pagination(
            description="page_organization_integrations_ids",
            paginator_cls=OffsetPaginator,
            order_by="integration__name",
            queryset=queryset,
        )

    def get_integrations(
        self,
        *,
        integration_ids: Iterable[int] | None = None,
        organization_id: int | None = None,
        status: int | None = None,
        providers: List[str] | None = None,
        org_integration_status: int | None = None,
        organization_integration_id: Optional[int] = None,
        limit: int | None = None,
    ) -> List[RpcIntegration]:
        integration_kwargs: Dict[str, Any] = {}
        if integration_ids is not None:
            integration_kwargs["id__in"] = integration_ids
        if organization_id is not None:
            integration_kwargs["organizationintegration__organization_id"] = organization_id
        if status is not None:
            integration_kwargs["status"] = status
        if providers is not None:
            integration_kwargs["provider__in"] = providers
        if org_integration_status is not None:
            integration_kwargs["organizationintegration__status"] = org_integration_status
        if organization_integration_id is not None:
            integration_kwargs["organizationintegration__id"] = organization_integration_id

        if not integration_kwargs:
            return []

        integrations = Integration.objects.filter(**integration_kwargs)

        if limit is not None:
            integrations = integrations[:limit]

        return [self._serialize_integration(integration) for integration in integrations]

    def get_integration(
        self,
        *,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
        organization_id: int | None = None,
        organization_integration_id: Optional[int] = None,
    ) -> RpcIntegration | None:
        integration_kwargs: Dict[str, Any] = {}
        if integration_id is not None:
            integration_kwargs["id"] = integration_id
        if provider is not None:
            integration_kwargs["provider"] = provider
        if external_id is not None:
            integration_kwargs["external_id"] = external_id
        if organization_id is not None:
            integration_kwargs["organizationintegration__organization_id"] = organization_id
        if organization_integration_id is not None:
            integration_kwargs["organizationintegration__id"] = organization_integration_id

        if not integration_kwargs:
            return None

        integration = Integration.objects.filter(**integration_kwargs).first()
        return self._serialize_integration(integration) if integration else None

    def get_organization_integrations(
        self,
        *,
        org_integration_ids: List[int] | None = None,
        integration_id: int | None = None,
        organization_id: int | None = None,
        organization_ids: Optional[List[int]] = None,
        status: int | None = None,
        providers: List[str] | None = None,
        has_grace_period: bool | None = None,
        limit: int | None = None,
    ) -> List[RpcOrganizationIntegration]:
        oi_kwargs: Dict[str, Any] = {}
        if org_integration_ids is not None:
            oi_kwargs["id__in"] = org_integration_ids
        if integration_id is not None:
            oi_kwargs["integration_id"] = integration_id
        if organization_id is not None:
            organization_ids = [organization_id]
        if organization_ids is not None:
            oi_kwargs["organization_id__in"] = organization_ids
        if status is not None:
            oi_kwargs["status"] = status
        if providers is not None:
            oi_kwargs["integration__provider__in"] = providers
        if has_grace_period is not None:
            oi_kwargs["grace_period_end__isnull"] = not has_grace_period

        if not oi_kwargs:
            return []

        ois = OrganizationIntegration.objects.filter(**oi_kwargs)

        if limit is not None:
            ois = ois[:limit]

        return [self._serialize_organization_integration(oi) for oi in ois]

    def get_organization_context(
        self,
        *,
        organization_id: int,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> Tuple[RpcIntegration | None, RpcOrganizationIntegration | None]:
        integration, installs = self.get_organization_contexts(
            organization_id=organization_id,
            integration_id=integration_id,
            provider=provider,
            external_id=external_id,
        )

        return integration, installs[0] if installs else None

    def get_organization_contexts(
        self,
        *,
        organization_id: int | None = None,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> Tuple[RpcIntegration | None, List[RpcOrganizationIntegration]]:
        integration = self.get_integration(
            organization_id=organization_id,
            integration_id=integration_id,
            provider=provider,
            external_id=external_id,
        )
        if not integration:
            return (None, [])
        organization_integrations = self.get_organization_integrations(
            integration_id=integration.id,
            organization_id=organization_id,
        )
        return (
            self._serialize_integration(integration),
            [self._serialize_organization_integration(oi) for oi in organization_integrations],
        )

    def update_integrations(
        self,
        *,
        integration_ids: List[int],
        name: str | None = None,
        metadata: Dict[str, Any] | None = None,
        status: int | None = None,
    ) -> List[RpcIntegration]:
        integrations = Integration.objects.filter(id__in=integration_ids)
        if not integrations.exists():
            return []

        integration_kwargs: Dict[str, Any] = {}
        if name is not None:
            integration_kwargs["name"] = name
        if metadata is not None:
            integration_kwargs["metadata"] = metadata
        if status is not None:
            integration_kwargs["status"] = status

        if not integration_kwargs:
            return []

        integrations.update(**integration_kwargs)

        return [self._serialize_integration(integration) for integration in integrations]

    def update_integration(
        self,
        *,
        integration_id: int,
        name: str | None = None,
        metadata: Dict[str, Any] | None = None,
        status: int | None = None,
    ) -> RpcIntegration | None:
        integrations = self.update_integrations(
            integration_ids=[integration_id],
            name=name,
            status=status,
            metadata=metadata,
        )
        return self._serialize_integration(integrations[0]) if len(integrations) > 0 else None

    def update_organization_integrations(
        self,
        *,
        org_integration_ids: List[int],
        config: Dict[str, Any] | None = None,
        status: int | None = None,
        grace_period_end: datetime | None = None,
        set_grace_period_end_null: bool | None = None,
    ) -> List[RpcOrganizationIntegration]:
        ois = OrganizationIntegration.objects.filter(id__in=org_integration_ids)
        if not ois.exists():
            return []

        oi_kwargs: Dict[str, Any] = {}

        if config is not None:
            oi_kwargs["config"] = config
        if status is not None:
            oi_kwargs["status"] = status
        if grace_period_end is not None or set_grace_period_end_null:
            gpe_value = grace_period_end if not set_grace_period_end_null else None
            oi_kwargs["grace_period_end"] = gpe_value

        if not oi_kwargs:
            return []

        ois.update(**oi_kwargs)

        return [self._serialize_organization_integration(oi) for oi in ois]

    def update_organization_integration(
        self,
        *,
        org_integration_id: int,
        config: Dict[str, Any] | None = None,
        status: int | None = None,
        grace_period_end: datetime | None = None,
        set_grace_period_end_null: bool | None = None,
    ) -> RpcOrganizationIntegration | None:
        ois = self.update_organization_integrations(
            org_integration_ids=[org_integration_id],
            config=config,
            status=status,
            grace_period_end=grace_period_end,
            set_grace_period_end_null=set_grace_period_end_null,
        )
        return self._serialize_organization_integration(ois[0]) if len(ois) > 0 else None
