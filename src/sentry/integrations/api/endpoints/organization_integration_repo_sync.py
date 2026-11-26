from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.integrations.api.bases.organization_integrations import (
    OrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.source_code_management.repo_sync_status import (
    FEATURE,
    RepoSyncFailed,
    RepoSyncTrigger,
    get_status,
    record_sync_requested,
)
from sentry.integrations.source_code_management.sync_repos import (
    SCM_SYNC_PROVIDERS,
    sync_repos_for_org,
)
from sentry.models.organization import Organization

SYNC_NOT_SUPPORTED = "Repository sync is not supported for this integration."


@control_silo_endpoint
class OrganizationIntegrationRepoSyncEndpoint(OrganizationIntegrationBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CODING_WORKFLOWS

    def get(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        # Only organizations with the feature record a status, and only its popup reads it.
        if not features.has(FEATURE, organization, actor=request.user):
            raise ResourceDoesNotExist

        integration = self.get_integration(organization.id, integration_id)
        if integration.provider not in SCM_SYNC_PROVIDERS:
            return self.respond({"detail": SYNC_NOT_SUPPORTED}, status=400)

        status = get_status(organization.id, integration.id)
        return self.respond(
            {
                "status": status.state if status else None,
                "trigger": status.trigger if status else None,
                "reason": status.reason if isinstance(status, RepoSyncFailed) else None,
            }
        )

    def post(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        integration = self.get_integration(organization.id, integration_id)

        if integration.provider not in SCM_SYNC_PROVIDERS:
            return self.respond({"detail": SYNC_NOT_SUPPORTED}, status=400)

        org_integration = self.get_organization_integration(organization.id, integration_id)

        record_sync_requested(organization.id, integration.id, RepoSyncTrigger.MANUAL)
        sync_repos_for_org.apply_async(
            kwargs={"organization_integration_id": org_integration.id},
        )

        return self.respond(status=202)
