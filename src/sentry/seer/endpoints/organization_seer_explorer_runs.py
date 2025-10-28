from __future__ import annotations

import logging

import orjson
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.net.http import connection_from_url
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

autofix_connection_pool = connection_from_url(
    settings.SEER_SCORING_URL,
    timeout=settings.SEER_FIXABILITY_TIMEOUT,
)


class OrganizationSeerExplorerRunsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
    }


@region_silo_endpoint
class OrganizationSeerExplorerRunsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=100, window=60),
                RateLimitCategory.USER: RateLimit(limit=100, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=1000, window=60),
            },
        }
    )
    permission_classes = (OrganizationSeerExplorerRunsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get the current state of a Seer Explorer session.
        """
        user = request.user
        if not features.has("organizations:seer-explorer", organization, actor=user):
            return Response({"detail": "Feature flag not enabled"}, status=403)

        has_seer_access, detail = has_seer_access_with_detail(organization, actor=user)
        if not has_seer_access:
            return Response({"detail": detail}, status=403)

        limit = request.GET.get("limit")
        if limit is not None:
            if not limit.isdigit():
                return Response({"detail": "Invalid limit"}, status=400)
            limit = int(limit)

        path = "/v1/automation/explorer/runs"
        body = orjson.dumps(
            {
                "organization_id": organization.id,
                "user_id": user.id,
                **({"limit": limit} if limit is not None else {}),
            },
            option=orjson.OPT_NON_STR_KEYS,
        )

        response = make_signed_seer_api_request(autofix_connection_pool, path, body)
        if response.status < 200 or response.status >= 300:
            logger.error(
                "Seer explorer runs endpoint failed",
                extra={
                    "path": path,
                    "status_code": response.status,
                    "response_data": response.data,
                },
            )
            return Response({"detail": "Internal Server Error"}, status=502)

        return Response(response.json(), status=response.status)
