from __future__ import annotations

from uuid import UUID

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.feedback.models import Feedback
from sentry.feedback.serializers import FeedbackSerializer
from sentry.models.project import Project


@region_silo_endpoint
class ProjectFeedbackDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK

    def get(self, request: Request, project: Project, feedback_id: UUID) -> Response:
        if not features.has(
            "organizations:user-feedback-ingest", project.organization, actor=request.user
        ):
            return Response(status=404)

        feedback = Feedback.objects.filter(feedback_id=feedback_id)

        if len(feedback) == 0:
            return Response(status=404)

        return self.paginate(
            request=request,
            queryset=feedback,
            on_results=lambda x: serialize(x, request.user, FeedbackSerializer()),
            paginator_cls=OffsetPaginator,
        )
