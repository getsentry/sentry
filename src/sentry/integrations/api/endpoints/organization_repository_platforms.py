from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.integrations.api.bases.organization_repository import OrganizationRepositoryEndpoint
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.github.platform_detection import detect_platforms
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationRepositoryPlatformsEndpoint(OrganizationRepositoryEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization, repo: Repository) -> Response:
        if (
            not repo.integration_id
            or not repo.provider
            or IntegrationProviderSlug.GITHUB not in repo.provider
        ):
            return Response(
                {"detail": "Platform detection is only supported for GitHub repositories."},
                status=400,
            )

        integration = integration_service.get_integration(integration_id=repo.integration_id)
        if integration is None:
            return Response({"detail": "GitHub integration not found."}, status=400)

        org_integration = integration_service.get_organization_integration(
            integration_id=repo.integration_id, organization_id=organization.id
        )
        if org_integration is None:
            return Response(
                {"detail": "GitHub integration is not configured for this organization."},
                status=400,
            )

        client = GitHubApiClient(integration=integration, org_integration_id=org_integration.id)

        try:
            platforms = detect_platforms(client=client, repo=repo.name)
        except ApiError:
            logger.exception(
                "integrations.github.platform_detection_failed",
                extra={"repo_id": repo.id, "repo_name": repo.name},
            )
            return Response({"detail": "Failed to detect platforms from GitHub."}, status=502)

        return Response({"platforms": platforms})
