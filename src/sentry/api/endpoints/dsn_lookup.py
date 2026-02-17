from urllib.parse import urlparse

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.models.organizationmember import OrganizationMember
from sentry.models.projectkey import ProjectKey
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class DsnLookupEndpoint(Endpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SentryIsAuthenticated,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.USER: RateLimit(limit=5, window=1),
            }
        }
    )

    def get(self, request: Request) -> Response:
        dsn = request.GET.get("dsn")
        if not dsn:
            return Response({"detail": "Missing required parameter: dsn"}, status=400)

        try:
            parsed = urlparse(dsn)
        except Exception:
            return Response({"detail": "Invalid DSN"}, status=404)

        public_key = parsed.username
        if not public_key:
            return Response({"detail": "Invalid DSN"}, status=404)

        try:
            project_key = ProjectKey.objects.select_related("project__organization").get(
                public_key=public_key,
            )
        except ProjectKey.DoesNotExist:
            return Response({"detail": "DSN not found"}, status=404)

        organization = project_key.project.organization

        is_member = OrganizationMember.objects.filter(
            organization_id=organization.id,
            user_id=request.user.id,
        ).exists()
        if not is_member:
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
