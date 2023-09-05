from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api import serializers
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.models.project import Project
from sentry.userfeedback.models import UserFeedback
from sentry.userfeedback.serializers import UserFeedbackSerializer


class UserFeedbackDetailsPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:read", "project:write", "project:admin"],
    }


@region_silo_endpoint
class ProjectUserFeedbackDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    permission_classes = (UserFeedbackDetailsPermission,)

    def get(self, request: Request, project: Project, userfeedback_id: str) -> Response:
        try:
            userfeedback = UserFeedback.objects.get(id=userfeedback_id, project_id=project.id)
        except UserFeedback.DoesNotExist:
            raise serializers.ValidationError("Rule does not exist")

        return Response(
            serialize(
                userfeedback,
                request.user,
                UserFeedbackSerializer(),
            )
        )

    def delete(self, request: Request, project: Project, userfeedback_id: str) -> Response:
        pass
