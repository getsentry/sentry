from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api import serializers
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models.project import Project
from sentry.user_feedback.models import UserFeedback
from sentry.user_feedback.serializers import UserFeedbackSerializer


@region_silo_endpoint
class ProjectUserFeedbackDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PATCH": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project: Project, user_feedback_id: str) -> Response:
        try:
            user_feedback = UserFeedback.objects.get(id=user_feedback_id, project_id=project.id)
        except UserFeedback.DoesNotExist:
            raise serializers.ValidationError("User feedback does not exist")

        return Response(
            serialize(
                user_feedback,
                request.user,
                UserFeedbackSerializer(),
            )
        )

    def delete(self, request: Request, project: Project, user_feedback_id: str) -> Response:
        pass

    def patch(self, request: Request, project: Project, user_feedback_id: str) -> Response:
        pass
