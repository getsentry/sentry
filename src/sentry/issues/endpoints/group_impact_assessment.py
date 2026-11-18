from __future__ import annotations

from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.issues.endpoints.bases.group import GroupAiEndpoint
from sentry.issues.impact.assessment import (
    ImpactAssessmentDisabled,
    ImpactAssessmentEventNotFound,
    assess_impact_for_group,
)
from sentry.models.group import Group
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class GroupImpactAssessmentResponse(TypedDict):
    runId: str


@extend_schema(tags=["Events"])
@cell_silo_endpoint
class GroupImpactAssessmentEndpoint(GroupAiEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {"POST": ApiPublishStatus.EXPERIMENTAL}
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=5, window=60),
                RateLimitCategory.USER: RateLimit(limit=5, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=20, window=60),
            }
        }
    )

    @extend_schema(
        operation_id="createOrganizationIssueImpactAssessment",
        summary="Start an Issue Impact Assessment",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, IssueParams.ISSUE_ID],
        request=None,
        responses={
            202: inline_sentry_response_serializer(
                "GroupImpactAssessmentResponse", GroupImpactAssessmentResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, group: Group) -> Response:
        try:
            run = assess_impact_for_group(group=group, user=request.user)
        except ImpactAssessmentDisabled:
            return Response(
                {"detail": "Seer Impact assessment is not enabled for this organization"},
                status=status.HTTP_403_FORBIDDEN,
            )
        except ImpactAssessmentEventNotFound:
            return Response(
                {"detail": "Issue has no event available for Impact assessment"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"runId": str(run.uuid)}, status=status.HTTP_202_ACCEPTED)
