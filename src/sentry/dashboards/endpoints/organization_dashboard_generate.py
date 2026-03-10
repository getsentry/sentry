from __future__ import annotations

import logging
from typing import Any

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.dashboards.models.generate_dashboard_artifact import GeneratedDashboard
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.models import SeerPermissionError
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class DashboardGenerateSerializer(serializers.Serializer[dict[str, Any]]):
    prompt = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="Natural language description of the dashboard to generate.",
    )


class OrganizationDashboardGeneratePermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


@region_silo_endpoint
class OrganizationDashboardGenerateEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.DASHBOARDS
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=10, window=60),
                RateLimitCategory.USER: RateLimit(limit=10, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=60, window=60 * 60),
            },
        }
    )
    permission_classes = (OrganizationDashboardGeneratePermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:dashboards-ai-generate", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        has_access, error = has_seer_access_with_detail(organization, request.user)
        if not has_access:
            raise PermissionDenied(error)

        serializer = DashboardGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        prompt = serializer.validated_data["prompt"]

        try:
            client = SeerExplorerClient(organization, request.user)
            run_id = client.start_run(
                prompt=prompt,
                artifact_key="dashboard",
                artifact_schema=GeneratedDashboard,
                request=request,
            )
            return Response({"run_id": run_id})
        except SeerPermissionError as e:
            raise PermissionDenied(e.message) from e
