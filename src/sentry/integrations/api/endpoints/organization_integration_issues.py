from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.integrations.api.bases.organization_integrations import (
    RegionOrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.mixins.issues import IssueSyncIntegration
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationIntegrationIssuesEndpoint(RegionOrganizationIntegrationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }

    def put(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        """
        Migrate plugin linked issues to integration linked issues
        `````````````````````````````````````````````````````````
        :pparam string organization: the organization the integration is installed in
        :pparam string integration_id: the id of the integration
        """
        integration = self.get_integration(organization.id, integration_id)
        install = integration.get_installation(organization_id=organization.id)
        if isinstance(install, IssueSyncIntegration):
            install.migrate_issues()
            return Response(status=204)
        return Response(status=400)
