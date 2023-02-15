from django.http import StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.usecases.reader import fetch_segments_data


@region_silo_endpoint
class ProjectReplayRecordingSegmentIndexEndpoint(ProjectEndpoint):
    private = True

    def get(self, request: Request, project, replay_id: str) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        return self.paginate(
            request=request,
            queryset=ReplayRecordingSegment.objects.filter(
                project_id=project.id, replay_id=replay_id
            ),
            order_by="segment_id",
            on_results=fetch_segments_data,
            response_cls=StreamingHttpResponse,
            response_kwargs={"content_type": "application/json"},
            paginator_cls=OffsetPaginator,
        )
