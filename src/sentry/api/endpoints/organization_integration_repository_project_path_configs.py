from __future__ import absolute_import


from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.models import RepositoryProjectPathConfig
from sentry.utils.compat import map


class OrganizationIntegrationRepositoryProjectPathConfigEndpoint(
    OrganizationIntegrationBaseEndpoint
):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request, organization, integration_id):
        """
        Get the list of repository project path configs in an integration
        """
        org_integration = self.get_organization_integration(organization, integration_id)

        repository_project_path_configs = RepositoryProjectPathConfig.objects.filter(
            organization_integration=org_integration
        )

        # TODO: Add pagination
        data = map(lambda x: serialize(x, request.user), repository_project_path_configs)
        return self.respond(data)
