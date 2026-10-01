from __future__ import annotations

import logging

import orjson
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.issues.endpoints.bases.group import GroupAiEndpoint
from sentry.models.group import Group
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.exceptions import (
    IssueSummaryEventNotFound,
    IssueSummaryHidden,
    IssueSummarySelfHosted,
)
from sentry.seer.autofix.issue_summary import get_issue_summary
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class GroupAiSummaryEndpoint(GroupAiEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
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

    def post(self, request: Request, group: Group) -> Response:
        data = orjson.loads(request.body) if request.body else {}
        force_event_id = data.get("event_id", None)

        try:
            summary_data = get_issue_summary(
                group=group,
                user=request.user,
                force_event_id=force_event_id,
                source=SeerAutomationSource.ISSUE_DETAILS,
            )
        except IssueSummaryEventNotFound:
            return Response(
                {"detail": "Could not find an event for the issue"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except IssueSummarySelfHosted:
            return Response(
                {"detail": "Seer is not available on this installation."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except IssueSummaryHidden:
            return Response(
                {"detail": "AI features are disabled for this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )
        except UnableToAcquireLock:
            return Response(
                {"detail": "Timeout waiting for summary generation lock"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(convert_dict_key_case(summary_data.dict(), snake_to_camel_case))
