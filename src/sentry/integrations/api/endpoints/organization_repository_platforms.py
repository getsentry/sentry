from __future__ import annotations

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.integrations.api.bases.organization_repository import OrganizationRepositoryEndpoint
from sentry.integrations.github.multi_platform_detection import (
    PlatformDetectionClient,
    detect_platforms_multi,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiConflictError, ApiError

# Providers whose client can serve platform detection: it needs a GitHub-shaped
# recursive git tree and Linguist-style language byte counts. Cursor Origin has
# neither natively -- its client adapts both -- which is why membership here is a
# property of the client, not of the provider being "GitHub-like".
SUPPORTED_PROVIDERS = frozenset(
    {
        IntegrationProviderSlug.GITHUB.value,
        IntegrationProviderSlug.CURSOR_ORIGIN.value,
    }
)


def _capture_detection_exception(type: str, repo_id: int, repo_name: str) -> None:
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("scm_platform_detection", type)
        scope.set_tag("repo_id", repo_id)
        scope.set_tag("repo_name", repo_name)
        sentry_sdk.capture_exception()


@cell_silo_endpoint
class OrganizationRepositoryPlatformsEndpoint(OrganizationRepositoryEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization, repo: Repository) -> Response:
        provider = (repo.provider or "").removeprefix("integrations:")
        if not repo.integration_id or provider not in SUPPORTED_PROVIDERS:
            return Response(
                {"detail": "Platform detection is not supported for this repository."},
                status=400,
            )

        integration = integration_service.get_integration(integration_id=repo.integration_id)
        if integration is None:
            return Response({"detail": "Integration not found."}, status=400)

        org_integration = integration_service.get_organization_integration(
            integration_id=repo.integration_id, organization_id=organization.id
        )
        if org_integration is None:
            return Response(
                {"detail": "Integration is not configured for this organization."}, status=400
            )

        installation = integration.get_installation(organization_id=organization.id)
        client = installation.get_client()
        assert isinstance(client, PlatformDetectionClient)

        try:
            platforms = detect_platforms_multi(client, repo.name)["platforms"]
        except ApiConflictError:
            # Empty / unprocessable repo (e.g. empty git tree).
            _capture_detection_exception("empty_repo", repo.id, repo.name)
            return Response({"platforms": []})
        except (ApiError, ValueError):
            _capture_detection_exception("failed", repo.id, repo.name)
            return Response({"detail": "Failed to detect platforms."}, status=502)

        return Response({"platforms": platforms})
