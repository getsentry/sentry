from __future__ import annotations

import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.endpoints.bases.group import GroupAiEndpoint
from sentry.models.group import Group
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.issue_summary import get_issue_summary
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


@region_silo_endpoint
class GroupAiSummaryEndpoint(GroupAiEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=20, window=60),
                RateLimitCategory.USER: RateLimit(limit=20, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-ai-summary"])
    def post(self, request: Request, group: Group) -> Response:
        data = orjson.loads(request.body) if request.body else {}
        force_event_id = data.get("event_id", None)

        summary_data, status_code = get_issue_summary(
            group=group,
            user=request.user,
            force_event_id=force_event_id,
            source=SeerAutomationSource.ISSUE_DETAILS,
        )

        return Response(summary_data, status=status_code)
