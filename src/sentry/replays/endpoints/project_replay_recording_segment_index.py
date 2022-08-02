from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.serializers import ReplayRecordingSegmentSerializer


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
                project_id=project.id,
                replay_id=replay_id.replace("-", ""),
            ),
            order_by="segment_id",
            on_results=lambda x: {
                "data": serialize(x, request.user, ReplayRecordingSegmentSerializer())
            },
            paginator_cls=OffsetPaginator,
        )
