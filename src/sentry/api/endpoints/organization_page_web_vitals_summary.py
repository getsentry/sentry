from __future__ import annotations

import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.endpoints.organization_trace import OrganizationTraceEndpoint
from sentry.models.organization import Organization
from sentry.seer.web_vitals_summary import get_page_web_vitals_summary
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class OrganizationPageWebVitalsSummaryPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


@region_silo_endpoint
class OrganizationPageWebVitalsSummaryEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.PERFORMANCE
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=10, window=60),
            RateLimitCategory.USER: RateLimit(limit=10, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=30, window=60),
        }
    }

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has(
            "organizations:performance-web-vitals-seer-suggestions",
            organization,
            actor=request.user,
        )

    def post(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        data: dict = orjson.loads(request.body) if request.body else {}
        trace_ids = data.get("traceSlugs", None)
        if not trace_ids:
            return Response({"detail": "Missing traceSlugs parameter"}, status=400)

        try:
            trace_endpoint = OrganizationTraceEndpoint()
            snuba_params = trace_endpoint.get_snuba_params(request, organization)
            trace_trees = [
                trace_endpoint.query_trace_data(snuba_params, trace_id) for trace_id in trace_ids
            ]

        except Exception:
            return Response({"detail": "Error fetching trace"}, status=400)

        if not trace_trees:
            return Response({"detail": "Missing trace_trees data"}, status=400)

        summary_data, status_code = get_page_web_vitals_summary(
            traceSlugs=trace_ids,
            traceTrees=trace_trees,
            organization=organization,
            user=request.user,
        )
        return Response(summary_data, status=status_code)
