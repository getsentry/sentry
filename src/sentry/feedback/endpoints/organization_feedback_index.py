from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.endpoints.organization_group_index import OrganizationGroupIndexEndpoint
from sentry.feedback.serializers import shim_issue_to_feedback_response
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

        mod = request.GET.copy()
        mod["issue.category"] = "feedback"
        mod["collapse"] = "stats"
        mod["expand"] = ["owners", "inbox"]

        shim_response = request.GET.get("shim_response", True)

        request.GET = mod

        response = super().get(request, organization)

        if shim_response:
            shimmed_data = [shim_issue_to_feedback_response(issue) for issue in response.data]
            response.data = shimmed_data

        return response
