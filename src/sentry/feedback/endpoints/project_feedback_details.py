from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.fields.actor import ActorField
from sentry.api.serializers.base import serialize
from sentry.feedback.endpoints.base import ProjectFeedbackEndpoint
from sentry.feedback.models import Feedback
from sentry.feedback.serializers import FeedbackSerializer
from sentry.models.project import Project


class FeedbackUpdateValidator(serializers.Serializer):
    assignee = ActorField(
        required=False,
        allow_null=True,
        as_actor=True,
    )


@region_silo_endpoint
class ProjectFeedbackDetailsEndpoint(ProjectFeedbackEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK

    def get(self, request: Request, project: Project, feedback: Feedback) -> Response:
        return self.respond(serialize(feedback, request.user, FeedbackSerializer()))

    def delete(self, request: Request, project: Project, feedback: Feedback) -> Response:
        feedback.delete()
        return Response(status=204)

    def put(self, request: Request, project: Project, feedback: Feedback) -> Response:
        serializer = FeedbackUpdateValidator(
            data=request.data, context={"project": project, "organization": project.organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        feedback.assignee = serializer.validated_data.get("assignee", feedback.assignee)
        feedback.save()
        return self.respond(serialize(feedback, request.user, FeedbackSerializer()))
