from django.http import StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import File
from sentry.models.project import Project
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.serializers import ReplayRecordingSegmentSerializer


@region_silo_endpoint
class ProjectReplayRecordingSegmentDetailsEndpoint(ProjectEndpoint):  # type:ignore
    private = True

    def get(self, request: Request, project: Project, replay_id: str, segment_id: int) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        try:
            segment = ReplayRecordingSegment.objects.filter(
                project_id=project.id,
                replay_id=replay_id,
                segment_id=segment_id,
            ).get()
        except ReplayRecordingSegment.DoesNotExist:
            return self.respond({"detail": "Replay recording segment not found."}, status=404)

        if request.GET.get("download") is not None:
            return self.download(segment)
        else:
            return self.respond(
                {"data": serialize(segment, request.user, ReplayRecordingSegmentSerializer())}
            )

    def download(self, recording_segment: ReplayRecordingSegment) -> StreamingHttpResponse:
        file = File.objects.get(id=recording_segment.file_id)
        filename = f"{recording_segment.replay_id}-{recording_segment.segment_id}"

        blob = file.getfile()

        response = StreamingHttpResponse(
            iter(lambda: blob.read(4096), b""),  # type:ignore
            content_type=file.headers.get("content-type", "application/octet-stream"),
        )
        response["Content-Length"] = file.size
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
