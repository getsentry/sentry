from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_integrations import RegionOrganizationIntegrationBaseEndpoint
from sentry.integrations.mixins import IssueSyncMixin
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.organization import RpcUserOrganizationContext


@region_silo_endpoint
class OrganizationIntegrationIssuesEndpoint(RegionOrganizationIntegrationBaseEndpoint):
    def put(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        """
        Migrate plugin linked issues to integration linked issues
        `````````````````````````````````````````````````````````
        :pparam string organization: the organization the integration is installed in
        :pparam string integration_id: the id of the integration
        """
        integration = self.get_integration(organization_context.organization.id, integration_id)
        install = integration_service.get_installation(
            integration=integration, organization_id=organization_context.organization.id
        )
        if isinstance(install, IssueSyncMixin):
            install.migrate_issues()
            return Response(status=204)
        return Response(status=400)
