# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Iterable, List, Optional, Tuple, Union, cast

from sentry.constants import ObjectStatus
from sentry.models.integrations import Integration, OrganizationIntegration
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.pagination import RpcPaginationArgs, RpcPaginationResult
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.integrations.base import (
        IntegrationFeatures,
        IntegrationInstallation,
        IntegrationProvider,
    )


class RpcIntegration(RpcModel):
    id: int
    provider: str
    external_id: str
    name: str
    metadata: Dict[str, Any]
    status: int

    def __hash__(self) -> int:
        return hash(self.id)

    def get_provider(self) -> "IntegrationProvider":
        from sentry import integrations

        return integrations.get(self.provider)  # type: ignore

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"


class RpcOrganizationIntegration(RpcModel):
    id: int
    default_auth_id: Optional[int]
    organization_id: int
    integration_id: int
    config: Dict[str, Any]
    status: int  # As ObjectStatus
    grace_period_end: Optional[datetime]

    def __hash__(self) -> int:
        return hash(self.id)

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"


class IntegrationService(RpcService):
    key = "integration"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.integration.impl import DatabaseBackedIntegrationService

        return DatabaseBackedIntegrationService()

    def _serialize_integration(self, integration: Integration) -> RpcIntegration:
        return RpcIntegration(
            id=integration.id,
            provider=integration.provider,
            external_id=integration.external_id,
            name=integration.name,
            metadata=integration.metadata,
            status=integration.status,
        )

    def _serialize_organization_integration(
        self, oi: OrganizationIntegration
    ) -> RpcOrganizationIntegration:
        return RpcOrganizationIntegration(
            id=oi.id,
            default_auth_id=oi.default_auth_id,
            organization_id=oi.organization_id,
            integration_id=oi.integration_id,
            config=oi.config,
            status=oi.status,
            grace_period_end=oi.grace_period_end,
        )

    @rpc_method
    @abstractmethod
    def page_integration_ids(
        self,
        *,
        provider_keys: List[str],
        organization_id: int,
        args: RpcPaginationArgs,
    ) -> RpcPaginationResult:
        pass

    @rpc_method
    @abstractmethod
    def send_message(
        self,
        *,
        integration_id: int,
        organization_id: int,
        channel: str,
        message: str,
    ) -> bool:
        pass

    @rpc_method
    @abstractmethod
    def page_organization_integrations_ids(
        self,
        *,
        organization_id: int,
        statuses: List[int],
        provider_key: Optional[str] = None,
        args: RpcPaginationArgs,
    ) -> RpcPaginationResult:
        pass

    @rpc_method
    @abstractmethod
    def get_integrations(
        self,
        *,
        integration_ids: Optional[Iterable[int]] = None,
        organization_id: Optional[int] = None,
        status: Optional[int] = None,
        providers: Optional[List[str]] = None,
        org_integration_status: Optional[int] = None,
        limit: Optional[int] = None,
    ) -> List[RpcIntegration]:
        """
        Returns all APIIntegrations matching the provided kwargs.
        """
        pass

    @rpc_method
    @abstractmethod
    def get_integration(
        self,
        *,
        integration_id: Optional[int] = None,
        provider: Optional[str] = None,
        external_id: Optional[str] = None,
    ) -> Optional[RpcIntegration]:
        """
        Returns an RpcIntegration using either the id or a combination of the provider and external_id
        """
        pass

    @rpc_method
    @abstractmethod
    def get_organization_integrations(
        self,
        *,
        org_integration_ids: Optional[List[int]] = None,
        integration_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        organization_ids: Optional[List[int]] = None,
        status: Optional[int] = None,
        providers: Optional[List[str]] = None,
        has_grace_period: Optional[bool] = None,
        limit: Optional[int] = None,
    ) -> List[RpcOrganizationIntegration]:
        """
        Returns all APIOrganizationIntegrations from the matching kwargs.
        If providers is set, it will also be filtered by the integration providers set in the list.
        If has_grace_period is set, it will filter by whether the grace_period is null or not.
        """
        pass

    @rpc_method
    def get_organization_integration(
        self, *, integration_id: int, organization_id: int
    ) -> Optional[RpcOrganizationIntegration]:
        """
        Returns an RpcOrganizationIntegration from the integration and organization ids.
        """
        ois = self.get_organization_integrations(
            integration_id=integration_id, organization_id=organization_id, limit=1
        )
        return self._serialize_organization_integration(ois[0]) if len(ois) > 0 else None

    @rpc_method
    @abstractmethod
    def get_organization_context(
        self,
        *,
        organization_id: int,
        integration_id: Optional[int] = None,
        provider: Optional[str] = None,
        external_id: Optional[str] = None,
    ) -> Tuple[Optional[RpcIntegration], Optional[RpcOrganizationIntegration]]:
        """
        Returns a tuple of RpcIntegration and RpcOrganizationIntegration. The integration is selected
        by either integration_id, or a combination of provider and external_id.
        """
        pass

    @rpc_method
    @abstractmethod
    def get_organization_contexts(
        self,
        *,
        organization_id: Optional[int] = None,
        integration_id: Optional[int] = None,
        provider: Optional[str] = None,
        external_id: Optional[str] = None,
    ) -> Tuple[Optional[RpcIntegration], List[RpcOrganizationIntegration]]:
        """
        Returns a tuple of RpcIntegration and RpcOrganizationIntegrations. The integrations are selected
        by either integration_id, or a combination of provider and external_id.
        """
        pass

    @rpc_method
    @abstractmethod
    def update_integrations(
        self,
        *,
        integration_ids: List[int],
        name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        status: Optional[int] = None,
    ) -> List[RpcIntegration]:
        """
        Returns a list of APIIntegrations after updating the fields provided.
        To set a field as null, use the `set_{FIELD}_null` keyword argument.
        """
        pass

    @rpc_method
    @abstractmethod
    def update_integration(
        self,
        *,
        integration_id: int,
        name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        status: Optional[int] = None,
    ) -> Optional[RpcIntegration]:
        """
        Returns an RpcIntegration after updating the fields provided.
        To set a field as null, use the `set_{FIELD}_null` keyword argument.
        """
        pass

    @rpc_method
    @abstractmethod
    def update_organization_integrations(
        self,
        *,
        org_integration_ids: List[int],
        config: Optional[Dict[str, Any]] = None,
        status: Optional[int] = None,
        grace_period_end: Optional[datetime] = None,
        set_grace_period_end_null: Optional[bool] = None,
    ) -> List[RpcOrganizationIntegration]:
        """
        Returns a list of APIOrganizationIntegrations after updating the fields provided.
        To set a field as null, use the `set_{FIELD}_null` keyword argument.
        """
        pass

    @rpc_method
    @abstractmethod
    def update_organization_integration(
        self,
        *,
        org_integration_id: int,
        config: Optional[Dict[str, Any]] = None,
        status: Optional[int] = None,
        grace_period_end: Optional[datetime] = None,
        set_grace_period_end_null: Optional[bool] = None,
    ) -> Optional[RpcOrganizationIntegration]:
        """
        Returns an RpcOrganizationIntegration after updating the fields provided.
        To set a field as null, use the `set_{FIELD}_null` keyword argument.
        """
        pass

    # The following methods replace instance methods of the ORM objects!

    @rpc_method
    def get_installation(
        self,
        *,
        integration: Union[RpcIntegration, Integration],
        organization_id: int,
    ) -> "IntegrationInstallation":
        """
        Returns the IntegrationInstallation class for a given integration.
        Intended to replace calls of `integration.get_installation`.
        See src/sentry/models/integrations/integration.py
        """
        from sentry import integrations

        provider = integrations.get(integration.provider)
        installation: "IntegrationInstallation" = provider.get_installation(
            model=integration,
            organization_id=organization_id,
        )
        return installation

    @rpc_method
    def has_feature(self, *, provider: str, feature: "IntegrationFeatures") -> bool:
        """
        Returns True if the IntegrationProvider subclass contains a given feature
        Intended to replace calls of `integration.has_feature`.
        See src/sentry/models/integrations/integration.py
        """
        from sentry import integrations

        int_provider: "IntegrationProvider" = integrations.get(provider)
        return feature in int_provider.features


integration_service: IntegrationService = cast(
    IntegrationService, IntegrationService.create_delegation()
)
