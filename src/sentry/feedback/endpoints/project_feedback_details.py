from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api import serializers
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.feedback.models import Feedback
from sentry.feedback.serializers import FeedbackSerializer
from sentry.models.project import Project


@region_silo_endpoint
class ProjectFeedbackDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PATCH": ApiPublishStatus.EXPERIMENTAL,
    }
    # owner = ApiOwner.

    def get(self, request: Request, project: Project, feedback_id: str) -> Response:
        try:
            feedback = Feedback.objects.get(id=feedback_id, project_id=project.id)
        except Feedback.DoesNotExist:
            raise serializers.ValidationError("Feedback does not exist")

        return Response(
            serialize(
                feedback,
                request.user,
                FeedbackSerializer(),
            )
        )

    def delete(self, request: Request, project: Project, feedback_id: str) -> Response:
        pass

    def patch(self, request: Request, project: Project, feedback_id: str) -> Response:
        pass
