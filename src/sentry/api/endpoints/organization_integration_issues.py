from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.integrations.mixins import IssueSyncMixin


@region_silo_endpoint
class OrganizationIntegrationIssuesEndpoint(OrganizationIntegrationBaseEndpoint):
    private = True

    def put(self, request: Request, organization, integration_id) -> Response:
        """
        Migrate plugin linked issues to integration linked issues
        `````````````````````````````````````````````````````````
        :pparam string organization: the organization the integration is installed in
        :pparam string integration_id: the id of the integration
        """
        integration = self.get_integration(organization, integration_id)
        install = integration.get_installation(organization.id)
        if isinstance(install, IssueSyncMixin):
            install.migrate_issues()
            return Response(status=204)
        return Response(status=400)
