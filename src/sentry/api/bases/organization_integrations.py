from __future__ import annotations

from typing import Any, Dict, Tuple

from django.http import Http404
from rest_framework.request import Request

from sentry.api.bases.integration import IntegrationEndpoint, RegionIntegrationEndpoint
from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.services.hybrid_cloud.integration import (
    RpcIntegration,
    RpcOrganizationIntegration,
    integration_service,
)


class OrganizationIntegrationBaseEndpoint(IntegrationEndpoint):
    """
    OrganizationIntegrationBaseEndpoints expect both Integration and
    OrganizationIntegration DB entries to exist for a given organization and
    integration_id.
    """

    permission_classes = (OrganizationIntegrationsPermission,)

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


class RegionOrganizationIntegrationBaseEndpoint(RegionIntegrationEndpoint):
    """
    OrganizationIntegrationBaseEndpoints expect both Integration and
    OrganizationIntegration DB entries to exist for a given organization and
    integration_id.
    """

    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(
        self,
        request: Request,
        organization_slug: str | None = None,
        integration_id: str | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> Tuple[Tuple[Any, ...], Dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)

        kwargs["integration_id"] = self.validate_integration_id(integration_id or "")
        return args, kwargs

    @staticmethod
    def validate_integration_id(integration_id: str) -> int:
        try:
            return int(integration_id)
        except ValueError:
            raise Http404

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
        integration, org_integration = integration_service.get_organization_context(
            organization_id=organization_id, integration_id=integration_id
        )
        if not integration or not org_integration:
            raise Http404

        return integration
