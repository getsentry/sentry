from __future__ import annotations

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.integrations.api.bases.organization_repository import OrganizationRepositoryEndpoint
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.github.multi_platform_detection import (
    PlatformDetectionClient,
    detect_platforms_multi,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import (
    ApiConflictError,
    ApiError,
    IntegrationError,
)
from sentry.utils.cache import cache

CACHE_SECONDS = 3600 * 24
DETECTION_VERSION = 1

SUPPORTED_PROVIDERS = frozenset({f"integrations:{IntegrationProviderSlug.GITHUB}"})


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
        if not repo.integration_id or repo.provider not in SUPPORTED_PROVIDERS:
            return Response(
                {"detail": "Platform detection is not supported for this repository."},
                status=400,
            )

        cache_key = f"repo-platforms:{DETECTION_VERSION}:{repo.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response({"platforms": cached})

        integration = integration_service.get_integration(integration_id=repo.integration_id)
        if integration is None:
            return Response({"detail": "Integration not found."}, status=400)

        org_integration = integration_service.get_organization_integration(
            integration_id=repo.integration_id, organization_id=organization.id
        )
        if org_integration is None:
            return Response(
                {"detail": "Integration is not configured for this organization."},
                status=400,
            )

        installation = integration.get_installation(organization_id=organization.id)
        # Seed the cached property with the row already fetched above. Without this
        # get_client() re-fetches it over RPC, and raises if it has since been deleted.
        installation.org_integration = org_integration

        try:
            client: PlatformDetectionClient = installation.get_client()
            platforms = detect_platforms_multi(client, repo.name)["platforms"]
        except ApiConflictError:
            # Empty / unprocessable repo (e.g. empty git tree).
            _capture_detection_exception("empty_repo", repo.id, repo.name)
            cache.set(cache_key, [], CACHE_SECONDS)
            return Response({"platforms": []})
        except (OrganizationIntegrationNotFound, IntegrationError):
            return Response(
                {"detail": "Integration is not configured for this organization."},
                status=400,
            )
        except (ApiError, ValueError):
            _capture_detection_exception("failed", repo.id, repo.name)
            return Response({"detail": "Failed to detect platforms."}, status=502)

        cache.set(cache_key, platforms, CACHE_SECONDS)
        return Response({"platforms": platforms})
