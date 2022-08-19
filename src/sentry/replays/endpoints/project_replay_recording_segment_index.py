import io
import zlib

from django.http import HttpRequest, HttpResponse, StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.file import File
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.serializers import ReplayRecordingSegmentSerializer


class ProjectReplayRecordingSegmentIndexEndpoint(ProjectEndpoint):
    private = True

    def segment_generator(self, recording_segments):
        yield "["

        for i, file in enumerate(recording_segments):
            yield self.deflate(file)
            if i < len(recording_segments) - 1:
                yield ","

        yield "]"

    def deflate(self, blob):
        if blob.read(1) == b"{":
            blob.seek(0)
            return blob.read()
        blob.seek(0)
        return zlib.decompress(blob.read()).decode("utf-8")

    def on_results(self, results):
        # can do prefetch_related? hm
        files = File.objects.filter(id__in=[r.file_id for r in results])
        blobs = []
        for file in files:
            blobs.append(file.getfile())

        return iter(self.segment_generator(blobs))

    def get(self, request: Request, project, replay_id: str) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        if request.GET.get("download") is not None:
            return self.paginate(
                request=request,
                queryset=ReplayRecordingSegment.objects.filter(
                    project_id=project.id,
                    replay_id=replay_id.replace("-", ""),
                ),
                order_by="segment_id",
                on_results=self.on_results,
                response_type=StreamingHttpResponse,
                response_type_kwargs={"content_type": "application_json"},
                paginator_cls=OffsetPaginator,
            )
            # segments = ReplayRecordingSegment.objects.filter(
            #     project_id=project.id,
            #     replay_id=replay_id.replace("-", ""),
            # ).order_by("segment_id")
            # return self.on_results(segments)

        else:
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
