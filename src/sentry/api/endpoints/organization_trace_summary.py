from __future__ import annotations

import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.seer.trace_summary import get_trace_summary
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


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

    def post(self, request: Request, organization: Organization) -> Response:

        if not features.has("organizations:single-trace-summary", organization, actor=request.user):
            return Response({"detail": "Feature flag not enabled"}, status=400)

        data = orjson.loads(request.body) if request.body else {}
        trace_id = data.get("trace_id", None)
        trace_tree = data.get("trace_tree", [])

        if not trace_id:
            return Response({"detail": "Missing trace_id parameter"}, status=400)

        if not trace_tree:
            return Response({"detail": "Missing trace_tree data"}, status=400)

        summary_data, status_code = get_trace_summary(
            traceSlug=trace_id,
            traceTree=trace_tree,
            organization=organization,
            user=request.user,
        )

        return Response(summary_data, status=status_code)
