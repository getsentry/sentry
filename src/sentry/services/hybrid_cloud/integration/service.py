# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from datetime import datetime
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple, Union, cast

from sentry.integrations.base import (
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationProvider,
)
from sentry.models.integrations import Integration
from sentry.services.hybrid_cloud.integration import RpcIntegration, RpcOrganizationIntegration
from sentry.services.hybrid_cloud.integration.serial import serialize_organization_integration
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary
from sentry.services.hybrid_cloud.pagination import RpcPaginationArgs, RpcPaginationResult
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class IntegrationService(RpcService):
    key = "integration"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.integration.impl import DatabaseBackedIntegrationService

        return DatabaseBackedIntegrationService()

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
        organization_integration_id: Optional[int] = None,
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
        organization_integration_id: Optional[int] = None,
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
        return serialize_organization_integration(ois[0]) if len(ois) > 0 else None

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

    def get_installation(
        self,
        *,
        integration: Union[RpcIntegration, Integration],
        organization_id: int,
    ) -> IntegrationInstallation:
        """
        Returns the IntegrationInstallation class for a given integration.
        Intended to replace calls of `integration.get_installation`.
        See src/sentry/models/integrations/integration.py
        """
        from sentry import integrations

        provider = integrations.get(integration.provider)
        installation: IntegrationInstallation = provider.get_installation(
            model=integration,
            organization_id=organization_id,
        )
        return installation

    def has_feature(self, *, provider: str, feature: IntegrationFeatures) -> bool:
        """
        Returns True if the IntegrationProvider subclass contains a given feature
        Intended to replace calls of `integration.has_feature`.
        See src/sentry/models/integrations/integration.py
        """
        from sentry import integrations

        int_provider: IntegrationProvider = integrations.get(provider)
        return feature in int_provider.features

    @rpc_method
    @abstractmethod
    def send_incident_alert_notification(
        self,
        *,
        sentry_app_id: int,
        action_id: int,
        incident_id: int,
        organization: RpcOrganizationSummary,
        new_status: int,
        incident_attachment: Mapping[str, str],
        metric_value: Optional[str] = None,
    ) -> None:
        pass

    @rpc_method
    @abstractmethod
    def send_msteams_incident_alert_notification(
        self, *, integration_id: int, channel: Optional[str], attachment: Dict[str, Any]
    ) -> None:
        raise NotImplementedError


integration_service: IntegrationService = cast(
    IntegrationService, IntegrationService.create_delegation()
)
