from __future__ import annotations

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
)
from sentry.investigations.models import Investigation, InvestigationSeen
from sentry.investigations.presence import record_heartbeat
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationPresenceEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        """
        Record that the caller is viewing the investigation, and list who is viewing it.
        Returns user ids only: this is polled, and the frontend caches the users.
        """
        viewer_id = require_authenticated_user(request)
        heartbeat = record_heartbeat(investigation.id, viewer_id)
        if not heartbeat.was_present:
            InvestigationSeen.objects.update_or_create(
                investigation=investigation,
                user_id=viewer_id,
                defaults={"last_seen": timezone.now()},
            )
        return Response({"viewerIds": [str(uid) for uid in heartbeat.viewer_ids]})
