from __future__ import annotations

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import logger as sentry_logger

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.integrations.api.bases.organization_repository import (
    OrganizationRepositoryEndpoint,
)
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.github.multi_platform_detection import detect_platforms_multi
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiConflictError

_MULTI_METRICS_PREFIX = "onboarding-scm.platform_detection.multi"


@cell_silo_endpoint
class OrganizationRepositoryPlatformsTestEndpoint(OrganizationRepositoryEndpoint):
    """Measurement-only endpoint for the tree-based multi-platform detector.

    Runs ``detect_platforms_multi`` and emits metrics under
    ``onboarding-scm.platform_detection.multi.*``. Returns 204 No Content;
    the frontend fires this fire-and-forget alongside the live detection
    request.
    """

    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization, repo: Repository) -> Response:
        if not features.has(
            "organizations:integrations-github-platform-detection",
            organization,
            actor=request.user,
        ):
            return Response(status=404)

        if (
            not repo.integration_id
            or repo.provider != f"integrations:{IntegrationProviderSlug.GITHUB}"
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
            detect_platforms_multi(client, repo.name)
        except Exception as e:
            sentry_logger.warning(
                f"{_MULTI_METRICS_PREFIX}.failed",
                attributes={"repo_id": repo.id, "repo_name": repo.name},
            )
            if not isinstance(e, ApiConflictError):
                sentry_sdk.capture_exception()

        return Response(status=204)
