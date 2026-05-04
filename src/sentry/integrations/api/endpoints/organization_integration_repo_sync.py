from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.api.bases.organization_integrations import (
    OrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.source_code_management.sync_repos import (
    SCM_SYNC_PROVIDERS,
    sync_repos_for_org,
)
from sentry.models.organization import Organization


@control_silo_endpoint
class OrganizationIntegrationRepoSyncEndpoint(OrganizationIntegrationBaseEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.INTEGRATIONS

    def post(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        integration = self.get_integration(organization.id, integration_id)

        if integration.provider not in SCM_SYNC_PROVIDERS:
            return self.respond(
                {"detail": "Repository sync is not supported for this integration."}, status=400
            )

        org_integration = self.get_organization_integration(organization.id, integration_id)

        sync_repos_for_org.apply_async(
            kwargs={"organization_integration_id": org_integration.id},
        )

        return self.respond(status=202)
