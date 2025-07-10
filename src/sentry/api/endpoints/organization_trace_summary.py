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
from sentry.seer.trace_summary import get_trace_summary
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class OrganizationTraceSummaryPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


@region_silo_endpoint
class OrganizationTraceSummaryEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    # Keeping same rate limits as GroupAISummary endpoint for now
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=10, window=60),
            RateLimitCategory.USER: RateLimit(limit=10, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=30, window=60),
        }
    }

    permission_classes = (OrganizationTraceSummaryPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:single-trace-summary", organization, actor=request.user
        ) and not features.has(
            "organizations:trace-spans-format", organization, actor=request.user
        ):
            return Response({"detail": "Feature flag not enabled"}, status=400)

        data: dict = orjson.loads(request.body) if request.body else {}
        trace_id = data.get("traceSlug", None)
        only_transaction = data.get("onlyTransaction", False)
        if not trace_id:
            return Response({"detail": "Missing traceSlug parameter"}, status=400)

        # Get the trace tree
        try:
            trace_endpoint = OrganizationTraceEndpoint()
            snuba_params = trace_endpoint.get_snuba_params(request, organization)
            trace_tree = trace_endpoint.query_trace_data(snuba_params, trace_id, [])
        except Exception:
            return Response({"detail": "Error fetching trace"}, status=400)

        if not trace_tree:
            return Response({"detail": "Missing trace_tree data"}, status=400)

        summary_data, status_code = get_trace_summary(
            traceSlug=trace_id,
            traceTree=trace_tree,
            organization=organization,
            user=request.user,
            onlyTransaction=only_transaction,
        )
        return Response(summary_data, status=status_code)
