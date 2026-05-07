from __future__ import annotations

from typing import Any

from django.http import Http404
from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.integrations.api.bases.integration import CellIntegrationEndpoint, IntegrationEndpoint
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import (
    RpcIntegration,
    RpcOrganizationIntegration,
    integration_service,
)
from sentry.workflow_engine.endpoints.utils.ids import to_valid_int_id


class OrganizationIntegrationBaseEndpoint(IntegrationEndpoint):
    """
    OrganizationIntegrationBaseEndpoints expect both Integration and
    OrganizationIntegration DB entries to exist for a given organization and
    integration_id.
    """

    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str | None = None,
        integration_id: str | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        if integration_id is not None:
            kwargs["integration_id"] = to_valid_int_id(
                "integration_id", integration_id, raise_404=True
            )
        return args, kwargs

    @staticmethod
    def get_organization_integration(
        organization_id: int, integration_id: int
    ) -> OrganizationIntegration:
        """
        Get just the cross table entry.
        Note: This will still return organization integrations that are pending deletion.

        :param organization:
        :param integration_id:
        :return:
        """
        try:
            return OrganizationIntegration.objects.get(
                integration_id=integration_id,
                organization_id=organization_id,
            )
        except OrganizationIntegration.DoesNotExist:
            raise Http404

    @staticmethod
    def get_integration(organization_id: int, integration_id: int) -> Integration:
        """
        Note: The integration may still exist even when the
        OrganizationIntegration cross table entry has been deleted.

        :param organization:
        :param integration_id:
        :return:
        """
        try:
            return Integration.objects.get(
                id=integration_id, organizationintegration__organization_id=organization_id
            )
        except Integration.DoesNotExist:
            raise Http404


class CellOrganizationIntegrationBaseEndpoint(CellIntegrationEndpoint):
    """
    OrganizationIntegrationBaseEndpoints expect both Integration and
    OrganizationIntegration DB entries to exist for a given organization and
    integration_id.
    """

    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str | None = None,
        integration_id: str | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        if integration_id is not None:
            kwargs["integration_id"] = to_valid_int_id(
                "integration_id", integration_id, raise_404=True
            )
        return args, kwargs

    @staticmethod
    def get_organization_integration(
        organization_id: int, integration_id: int
    ) -> RpcOrganizationIntegration:
        """
        Get just the cross table entry.
        Note: This will still return organization integrations that are pending deletion.

        :param organization:
        :param integration_id:
        :return:
        """
        org_integration = integration_service.get_organization_integration(
            integration_id=integration_id, organization_id=organization_id
        )
        if not org_integration:
            raise Http404
        return org_integration

    @staticmethod
    def get_integration(organization_id: int, integration_id: int) -> RpcIntegration:
        """
        Note: The integration may still exist even when the
        OrganizationIntegration cross table entry has been deleted.

        :param organization:
        :param integration_id:
        :return:
        """
        result = integration_service.organization_context(
            organization_id=organization_id, integration_id=integration_id
        )
        if not result.integration or not result.organization_integration:
            raise Http404

        return result.integration
