from django.http import StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import File
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.serializers import ReplayRecordingSegmentSerializer
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class ProjectReplayRecordingSegmentDetailsEndpoint(ProjectEndpoint):
    private = True

    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(1000, 1),
            RateLimitCategory.USER: RateLimit(200, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(1000, 1),
        }
    }

    def get(self, request: Request, project, replay_id, segment_id) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        try:
            segment = ReplayRecordingSegment.objects.filter(
                project_id=project.id,
                replay_id=replay_id.replace("-", ""),
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
            iter(lambda: blob.read(4096), b""),
            content_type=file.headers.get("content-type", "application/octet-stream"),
        )
        response["Content-Length"] = file.size
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
