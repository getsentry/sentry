from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.endpoints.organization_group_index import OrganizationGroupIndexEndpoint
from sentry.models import Organization


@region_silo_endpoint
class OrganizationFeedbackIndexEndpoint(OrganizationGroupIndexEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK

    referrer = "api.feedback_index"

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:user-feedback-ingest", organization, actor=request.user):
            return Response(status=404)

        return super().get(request, organization)
