from __future__ import annotations

import logging

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.models.organization import Organization
from sentry.seer.page_web_vitals_summary import get_page_web_vitals_summary
from sentry.snuba.trace import query_trace_data
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class PageWebVitalsSummaryRequestSerializer(serializers.Serializer):
    traceSlugs = serializers.ListField(child=serializers.CharField())


class OrganizationPageWebVitalsSummaryPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


@region_silo_endpoint
class OrganizationPageWebVitalsSummaryEndpoint(OrganizationEventsV2EndpointBase):
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

        serializer = PageWebVitalsSummaryRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        trace_ids = data.get("traceSlugs", None)

        snuba_params = self.get_snuba_params(request, organization)
        trace_trees = [query_trace_data(snuba_params, trace_id) for trace_id in trace_ids]

        if (
            not trace_trees
            or len(trace_trees) != len(trace_ids)
            or any(trace_tree is None or len(trace_tree) == 0 for trace_tree in trace_trees)
        ):
            return Response({"detail": "Missing trace_trees data"}, status=400)

        summary_data, status_code = get_page_web_vitals_summary(
            traceSlugs=trace_ids,
            traceTrees=trace_trees,
            organization=organization,
            user=request.user,
        )
        return Response(summary_data, status=status_code)
