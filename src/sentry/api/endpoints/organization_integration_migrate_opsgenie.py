from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_integrations import RegionOrganizationIntegrationBaseEndpoint
from sentry.integrations.opsgenie.integration import OpsgenieIntegration
from sentry.models.organization import Organization
from sentry.utils import metrics


@region_silo_endpoint
class OrganizationIntegrationMigrateOpsgenieEndpoint(RegionOrganizationIntegrationBaseEndpoint):
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE

    def put(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        """
        Migrate API keys and alert rules from plugin to integration
        ```````````````````````````````````````````````````````````
        :pparam string organization: the organization the integration is installed in
        :pparam string integration_id: the id of the integration
        """
        integration = self.get_integration(organization.id, integration_id)
        installation = integration.get_installation(organization_id=organization.id)
        if isinstance(installation, OpsgenieIntegration):
            metrics.incr("opsgenie.migration_attempt", skip_internal=False)
            installation.schedule_migrate_opsgenie_plugin()
            return Response(status=202)
        return Response(status=400)
