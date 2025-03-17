# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from datetime import datetime
from typing import Any

from sentry.hybridcloud.rpc.pagination import RpcPaginationArgs, RpcPaginationResult
from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.integrations.services.integration import RpcIntegration, RpcOrganizationIntegration
from sentry.integrations.services.integration.model import (
    RpcIntegrationExternalProject,
    RpcIntegrationIdentityContext,
    RpcOrganizationContext,
    RpcOrganizationContextList,
)
from sentry.silo.base import SiloMode


class IntegrationService(RpcService):
    key = "integration"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.integrations.services.integration.impl import DatabaseBackedIntegrationService

        return DatabaseBackedIntegrationService()

    @rpc_method
    @abstractmethod
    def page_integration_ids(
        self,
        *,
        provider_keys: list[str],
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
    def get_integrations(
        self,
        *,
        integration_ids: list[int] | None = None,
        organization_id: int | None = None,
        status: int | None = None,
        providers: list[str] | None = None,
        org_integration_status: int | None = None,
        limit: int | None = None,
        organization_integration_id: int | None = None,
    ) -> list[RpcIntegration]:
        """
        Returns all RpcIntegrations matching the provided kwargs.
        """

    @rpc_method
    @abstractmethod
    def get_integration(
        self,
        *,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
        organization_id: int | None = None,
        organization_integration_id: int | None = None,
        status: int | None = None,
    ) -> RpcIntegration | None:
        """
        Returns an RpcIntegration using either the id or a combination of the provider and external_id
        """

    @rpc_method
    @abstractmethod
    def get_organization_integrations(
        self,
        *,
        org_integration_ids: list[int] | None = None,
        integration_id: int | None = None,
        organization_id: int | None = None,
        organization_ids: list[int] | None = None,
        status: int | None = None,
        providers: list[str] | None = None,
        has_grace_period: bool | None = None,
        grace_period_expired: bool | None = None,
        limit: int | None = None,
    ) -> list[RpcOrganizationIntegration]:
        """
        Returns all RpcOrganizationIntegrations from the matching kwargs.
        If providers is set, it will also be filtered by the integration providers set in the list.
        If has_grace_period is set, it will filter by whether the grace_period is null or not.
        """

    @rpc_method
    def get_organization_integration(
        self, *, integration_id: int, organization_id: int
    ) -> RpcOrganizationIntegration | None:
        """
        Returns an RpcOrganizationIntegration from the integration and organization ids.
        """
        ois = self.get_organization_integrations(
            integration_id=integration_id, organization_id=organization_id, limit=1
        )
        return ois[0] if len(ois) > 0 else None

    @rpc_method
    @abstractmethod
    def organization_context(
        self,
        *,
        organization_id: int,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> RpcOrganizationContext:
        """
        Returns a tuple of RpcIntegration and RpcOrganizationIntegration. The integration is selected
        by either integration_id, or a combination of provider and external_id.
        """

    @rpc_method
    @abstractmethod
    def organization_contexts(
        self,
        *,
        organization_id: int | None = None,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> RpcOrganizationContextList:
        """
        Returns a tuple of RpcIntegration and RpcOrganizationIntegrations. The integrations are selected
        by either integration_id, or a combination of provider and external_id.
        """

    @rpc_method
    @abstractmethod
    def update_integrations(
        self,
        *,
        integration_ids: list[int],
        name: str | None = None,
        metadata: dict[str, Any] | None = None,
        status: int | None = None,
    ) -> list[RpcIntegration]:
        """
        Returns a list of RpcIntegrations after updating the fields provided.
        To set a field as null, use the `set_{FIELD}_null` keyword argument.
        """

    @rpc_method
    @abstractmethod
    def add_organization(self, *, integration_id: int, org_ids: list[int]) -> RpcIntegration | None:
        """
        Adds organizations to an existing integration
        """

    @rpc_method
    @abstractmethod
    def update_integration(
        self,
        *,
        integration_id: int,
        name: str | None = None,
        metadata: dict[str, Any] | None = None,
        status: int | None = None,
    ) -> RpcIntegration | None:
        """
        Returns an RpcIntegration after updating the fields provided.
        To set a field as null, use the `set_{FIELD}_null` keyword argument.
        """

    @rpc_method
    @abstractmethod
    def update_organization_integrations(
        self,
        *,
        org_integration_ids: list[int],
        config: dict[str, Any] | None = None,
        status: int | None = None,
        grace_period_end: datetime | None = None,
        set_grace_period_end_null: bool | None = None,
    ) -> list[RpcOrganizationIntegration]:
        """
        Returns a list of RpcOrganizationIntegrations after updating the fields provided.
        To set a field as null, use the `set_{FIELD}_null` keyword argument.
        """

    @rpc_method
    @abstractmethod
    def update_organization_integration(
        self,
        *,
        org_integration_id: int,
        config: dict[str, Any] | None = None,
        status: int | None = None,
        grace_period_end: datetime | None = None,
        set_grace_period_end_null: bool | None = None,
    ) -> RpcOrganizationIntegration | None:
        """
        Returns an RpcOrganizationIntegration after updating the fields provided.
        To set a field as null, use the `set_{FIELD}_null` keyword argument.
        """

    @rpc_method
    @abstractmethod
    def send_incident_alert_notification(
        self,
        *,
        sentry_app_id: int,
        action_id: int,
        incident_id: int,
        new_status: int,
        incident_attachment_json: str,
        organization_id: int,
        metric_value: float,
        notification_uuid: str | None = None,
    ) -> bool:
        pass

    @rpc_method
    @abstractmethod
    def send_msteams_incident_alert_notification(
        self, *, integration_id: int, channel: str, attachment: dict[str, Any]
    ) -> bool:
        raise NotImplementedError

    @rpc_method
    @abstractmethod
    def delete_integration(self, *, integration_id: int) -> None:
        pass

    @rpc_method
    @abstractmethod
    def get_integration_external_project(
        self, *, organization_id: int, integration_id: int, external_id: str
    ) -> RpcIntegrationExternalProject | None:
        pass

    @rpc_method
    @abstractmethod
    def get_integration_external_projects(
        self, *, organization_id: int, integration_id: int, external_id: str | None = None
    ) -> list[RpcIntegrationExternalProject]:
        pass

    @rpc_method
    @abstractmethod
    def get_integration_identity_context(
        self,
        *,
        integration_provider: str | None = None,
        integration_external_id: str | None = None,
        identity_external_id: str | None = None,
        identity_provider_external_id: str | None = None,
    ) -> RpcIntegrationIdentityContext:
        pass


integration_service = IntegrationService.create_delegation()
