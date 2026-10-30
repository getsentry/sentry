from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
)
from sentry.investigations.endpoints.serializers.responses import InvestigationPresenceResponse
from sentry.investigations.endpoints.validators.presence import PresenceValidator
from sentry.investigations.presence import HEARTBEAT_INTERVAL, record_visit
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationPresenceEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Record Investigation Viewer Presence",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            PresenceValidator,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationPresenceResponse", InvestigationPresenceResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, organization: Organization, investigation: Notebook
    ) -> Response:
        """
        Internal UI heartbeat. Record the authenticated user as viewing this investigation and
        return other viewers, active first, then earlier visitors. Returns user IDs, lastSeen
        timestamps, active flags, total viewer count, and heartbeatIntervalMs. No request body
        is required. Requires the organizations:investigations feature and open organization
        membership.
        """
        validator = PresenceValidator(data=request.GET)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        result = record_visit(
            investigation, require_authenticated_user(request), validator.validated_data["limit"]
        )
        response_data: InvestigationPresenceResponse = {
            "viewers": [
                {"userId": str(v.user_id), "lastSeen": v.last_seen, "active": v.active}
                for v in result.viewers
            ],
            "total": result.total,
            "heartbeatIntervalMs": int(HEARTBEAT_INTERVAL.total_seconds() * 1000),
        }
        return Response(response_data)
