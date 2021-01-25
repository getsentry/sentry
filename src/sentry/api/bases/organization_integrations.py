from django.http import Http404

from sentry.api.bases.integration import IntegrationEndpoint
from sentry.models import Integration, OrganizationIntegration


class OrganizationIntegrationBaseEndpoint(IntegrationEndpoint):
    """
    OrganizationIntegrationBaseEndpoints expect both Integration and
    OrganizationIntegration DB entries to exist for a given organization and
    integration_id.
    """

    @staticmethod
    def get_organization_integration(organization, integration_id):
        """
        Get just the cross table entry.
        Note: This will still return migrations that are pending deletion.

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
