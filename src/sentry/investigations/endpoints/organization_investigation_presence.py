from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
)
from sentry.investigations.endpoints.validators.presence import PresenceValidator
from sentry.investigations.models import Investigation
from sentry.investigations.presence import HEARTBEAT_INTERVAL, record_visit
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationPresenceEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        """
        Record that the caller is viewing the investigation, and list its other viewers:
        active ones first, then earlier ones, up to `limit`. User ids only, since this is polled.
        """
        validator = PresenceValidator(data=request.GET)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        result = record_visit(
            investigation, require_authenticated_user(request), validator.validated_data["limit"]
        )
        return Response(
            {
                "viewers": [
                    {"userId": str(v.user_id), "lastSeen": v.last_seen, "active": v.active}
                    for v in result.viewers
                ],
                "total": result.total,
                "heartbeatIntervalMs": int(HEARTBEAT_INTERVAL.total_seconds() * 1000),
            }
        )
