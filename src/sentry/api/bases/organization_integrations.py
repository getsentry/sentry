from django.http import Http404
from rest_framework.request import Request

from sentry.api.bases.integration import IntegrationEndpoint
from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.services.hybrid_cloud.integration import (
    APIIntegration,
    APIOrganizationIntegration,
    integration_service,
)


class OrganizationIntegrationBaseEndpoint(IntegrationEndpoint):
    """
    OrganizationIntegrationBaseEndpoints expect both Integration and
    OrganizationIntegration DB entries to exist for a given organization and
    integration_id.
    """

    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(self, request: Request, organization_slug, integration_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)

        self.validate_integration_id(integration_id)

        kwargs["integration_id"] = integration_id
        return (args, kwargs)

    @staticmethod
    def validate_integration_id(integration_id):
        try:
            return int(integration_id)
        except ValueError:
            raise Http404

    @staticmethod
    def get_organization_integration(organization, integration_id) -> APIOrganizationIntegration:
        """
        Get just the cross table entry.
        Note: This will still return organization integrations that are pending deletion.

        :param organization:
        :param integration_id:
        :return:
        """
        org_integration = integration_service.get_organization_integration(
            integration_id=integration_id, organization_id=organization.id
        )
        if not org_integration:
            raise Http404
        return org_integration

    @staticmethod
    def get_integration(organization, integration_id) -> APIIntegration:
        """
        Note: The integration may still exist even when the
        OrganizationIntegration cross table entry has been deleted.

        :param organization:
        :param integration_id:
        :return:
        """
        integration, org_integration = integration_service.get_organization_context(
            organization_id=organization, integration_id=integration_id
        )
        if not integration or not org_integration:
            raise Http404
        return integration
