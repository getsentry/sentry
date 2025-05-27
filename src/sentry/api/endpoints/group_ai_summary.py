from __future__ import annotations

import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupAiEndpoint
from sentry.autofix.utils import SeerAutomationSource
from sentry.models.group import Group
from sentry.seer.issue_summary import get_issue_summary
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


@region_silo_endpoint
class GroupAiSummaryEndpoint(GroupAiEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=20, window=60),
            RateLimitCategory.USER: RateLimit(limit=20, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
        }
    }

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
