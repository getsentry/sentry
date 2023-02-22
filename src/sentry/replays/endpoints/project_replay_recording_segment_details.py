from io import BytesIO

from django.http import StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, make_filename
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.serializers import ReplayRecordingSegmentSerializer
from sentry.replays.usecases.reader import download_segment, fetch_segment_metadata


@region_silo_endpoint
class ProjectReplayRecordingSegmentDetailsEndpoint(ProjectEndpoint):
    private = True

    def get(self, request: Request, project, replay_id, segment_id) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        try:
            segment = fetch_segment_metadata(project.id, replay_id, segment_id)
            if not segment:
                raise ReplayRecordingSegment.DoesNotExist
        except ReplayRecordingSegment.DoesNotExist:
            return self.respond({"detail": "Replay recording segment not found."}, status=404)

        if request.GET.get("download") is not None:
            return self.download(segment)
        else:
            return self.respond(
                {"data": serialize(segment, request.user, ReplayRecordingSegmentSerializer())}
            )

    def download(self, segment: RecordingSegmentStorageMeta) -> StreamingHttpResponse:
        segment_bytes = download_segment(segment)
        segment_reader = BytesIO(segment_bytes)

        response = StreamingHttpResponse(
            iter(lambda: segment_reader.read(4096), b""),
            content_type="application/json",
        )
        response["Content-Length"] = len(segment_bytes)
        response["Content-Disposition"] = f'attachment; filename="{make_filename(segment)}"'
        return response
