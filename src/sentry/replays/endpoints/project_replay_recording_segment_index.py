import zlib
from concurrent.futures import ThreadPoolExecutor

from django.http import StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.file import File
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.serializers import ReplayRecordingSegmentSerializer

CHUNKSIZE = 4096
FILE_FETCH_THREADPOOL_SIZE = 4


class ProjectReplayRecordingSegmentIndexEndpoint(ProjectEndpoint):
    private = True

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
                on_results=self.on_download_results,
                response_cls=StreamingHttpResponse,
                response_kwargs={"content_type": "application/json"},
                paginator_cls=OffsetPaginator,
            )

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

    def on_download_results(self, results):
        """
        get the files associated with the segment range requested. prefetch the files
        in a threadpool.
        """
        recording_segment_files = File.objects.filter(id__in=[r.file_id for r in results])
        # TODO: deflate files as theyre fetched, instead of having
        # to wait untill all of them are complete before starting work.
        with ThreadPoolExecutor(max_workers=4) as exe:
            file_objects = exe.map(
                lambda file: file.getfile(prefetch=True), recording_segment_files
            )

        return iter(self.segment_generator(list(file_objects)))

    def segment_generator(self, recording_segments):
        """
        streams a JSON object made of replay recording segments.
        the segments are individual json objects, and we build a list around them.
        they are also default compressed, so deflate them if needed.
        """
        yield "["

        for i, file in enumerate(recording_segments):
            if self.is_compressed(file):
                yield from self.decompress_blob_stream(file)
            else:
                yield file.read().decode("utf-8")

            if i < len(recording_segments) - 1:
                yield ","

        yield "]"

    @staticmethod
    def is_compressed(blob):
        first_char = blob.read(1)
        blob.seek(0)
        if first_char == b"{":
            return False
        return True

    @staticmethod
    def decompress_blob_stream(blob):
        decompressobj = zlib.decompressobj()
        buffer = blob.read(CHUNKSIZE)
        while buffer:
            yield decompressobj.decompress(buffer).decode("utf-8")
            buffer = blob.read(CHUNKSIZE)
