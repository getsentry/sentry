from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.endpoints.group_event_details import GroupEventDetailsEndpoint
from sentry.api.serializers.base import serialize
from sentry.feedback.endpoints.base import ProjectFeedbackEndpoint
from sentry.feedback.models import Feedback
from sentry.feedback.serializers import (
    FeedbackSerializer,
    shim_event_to_feedback_response,
    shim_issue_to_feedback_response,
)
from sentry.models.project import Project

# class ProjectFeedbackDetailsPermission(ProjectPermission):
#     scope_map = {
#         "GET": ["project:read", "project:write", "project:admin"],
#         "DELETE": ["project:read", "project:write", "project:admin"],
#     }


@region_silo_endpoint
class ProjectFeedbackDetailsEndpoint(GroupEventDetailsEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK
    # permission_classes = (ProjectFeedbackDetailsPermission,)

    def get(self, request: Request, group) -> Response:
        response = super().get(request, group, event_id="latest")

        shim_response = request.GET.get("shim_response", True)
        print(response.data)
        if shim_response:
            response.data = shim_event_to_feedback_response(response.data)

        return response
