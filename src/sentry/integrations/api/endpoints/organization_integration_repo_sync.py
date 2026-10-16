from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.integrations.api.bases.organization_integrations import (
    OrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.source_code_management.sync_repos import (
    SCM_SYNC_PROVIDERS,
    sync_repos_for_org,
)
from sentry.models.organization import Organization


@extend_schema(tags=["Integrations"])
@control_silo_endpoint
class OrganizationIntegrationRepoSyncEndpoint(OrganizationIntegrationBaseEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.CODING_WORKFLOWS

    @extend_schema(
        operation_id="syncOrganizationIntegrationRepositories",
        summary="Sync an Integration's Repositories",
        description="Start a background sync of repositories for an installed integration.",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.INTEGRATION_ID],
        request=None,
        responses={
            202: RESPONSE_ACCEPTED,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response[None] | Response[DetailResponse]:
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
