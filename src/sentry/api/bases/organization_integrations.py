from django.http import Http404

from sentry.api.bases.integration import IntegrationEndpoint
from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.models import Integration, OrganizationIntegration


class OrganizationIntegrationBaseEndpoint(IntegrationEndpoint):
    """
    OrganizationIntegrationBaseEndpoints expect both Integration and
    OrganizationIntegration DB entries to exist for a given organization and
    integration_id.
    """

    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(self, request, organization_slug, integration_id, *args, **kwargs):
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
    def get_organization_integration(organization, integration_id):
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
                organization=organization,
            )
        except OrganizationIntegration.DoesNotExist:
            raise Http404

    @staticmethod
    def get_integration(organization, integration_id):
        """
        Note: The integration may still exist even when the
        OrganizationIntegration cross table entry has been deleted.

        :param organization:
        :param integration_id:
        :return:
        """
        try:
            return Integration.objects.get(id=integration_id, organizations=organization)
        except Integration.DoesNotExist:
            raise Http404
