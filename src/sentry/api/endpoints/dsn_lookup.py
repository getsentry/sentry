from urllib.parse import urlparse

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus, UseCase
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class DsnLookupEndpoint(OrganizationEndpoint):
    """Resolve a DSN to its project and key metadata within an organization.

    Used by the command palette to let users paste a DSN and quickly navigate
    to the corresponding project. Gated behind the organizations:cmd-k-dsn-lookup
    feature flag.
    """

    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.USER: RateLimit(limit=5, window=1),
            }
        }
    )

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:cmd-k-dsn-lookup", organization):
            return Response(status=404)

        dsn = request.GET.get("dsn")
        if not dsn:
            return Response({"detail": "Missing required parameter: dsn"}, status=400)

        parsed = urlparse(dsn)
        public_key = parsed.username
        if not public_key:
            return Response({"detail": "Invalid DSN"}, status=404)

        try:
            project_key = ProjectKey.objects.select_related("project").get(
                public_key=public_key,
                project__organization_id=organization.id,
                project__status=ObjectStatus.ACTIVE,
                status=ProjectKeyStatus.ACTIVE,
                use_case=UseCase.USER.value,
            )
        except ProjectKey.DoesNotExist:
            return Response({"detail": "DSN not found"}, status=404)

        return Response(
            {
                "organizationSlug": organization.slug,
                "projectSlug": project_key.project.slug,
                "projectId": str(project_key.project.id),
                "projectName": project_key.project.name,
                "projectPlatform": project_key.project.platform,
                "keyLabel": project_key.label,
                "keyId": str(project_key.id),
            }
        )
