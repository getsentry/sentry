import functools
import zlib
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings
from django.db.models import Prefetch
from django.http import StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import GenericOffsetPaginator, OffsetPaginator
from sentry.models.file import File, FileBlobIndex, get_storage
from sentry.replays.lib.segment_file import get_chunked_blob_from_indexes, replays_storage_options
from sentry.replays.models import ReplayRecordingSegment

FILE_FETCH_THREADPOOL_SIZE = 4


@region_silo_endpoint
class ProjectReplayRecordingSegmentIndexEndpoint(ProjectEndpoint):
    private = True

    def get(self, request: Request, project, replay_id: str) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        queryset = ReplayRecordingSegment.objects.filter(
            project_id=project.id,
            replay_id=replay_id,
        )
        queryset_count = queryset.count()

        if (
            project.organization.id in settings.SENTRY_REPLAYS_DIRECT_FILESTORE_ORGS
            and queryset_count == 0
        ):
            storage = get_storage(replays_storage_options())
            # TODO: look at using threadpool to optimize download
            return self.paginate(
                request=request,
                on_results=functools.partial(download_files_direct, storage, project.id, replay_id),
                response_cls=StreamingHttpResponse,
                response_kwargs={"content_type": "application/json"},
                paginator_cls=GenericOffsetPaginator,
                data_fn=functools.partial(get_files_direct, storage, project.id, replay_id),
            )

        else:
            if queryset_count == 0:
                return self.respond(status=404)

            return self.paginate(
                request=request,
                queryset=queryset,
                order_by="segment_id",
                on_results=get_files_file_model,
                response_cls=StreamingHttpResponse,
                response_kwargs={"content_type": "application/json"},
                paginator_cls=OffsetPaginator,
            )


def get_files_direct(storage, project_id, replay_id, offset, limit):
    replay_files = storage.listdir(f"{project_id}/{replay_id}/")[1]

    start_index = min(offset, len(replay_files))
    end_index = min(offset + limit, len(replay_files))

    pagination_subset = replay_files[start_index:end_index]

    return pagination_subset


def download_files_direct(storage, project_id, replay_id, results):
    yield "["
    for i, replay_segment_file in enumerate(results):
        file = storage.open(f"{project_id}/{replay_id}/{replay_segment_file}")
        if is_compressed(file):
            buffer = file.read()
            yield zlib.decompress(buffer, zlib.MAX_WBITS | 32)
        else:
            yield file.read().decode("utf-8")
        file.close()

        if i < len(results) - 1:
            yield ","
    yield "]"


def get_files_file_model(results):
    """
    get the files associated with the segment range requested. prefetch the files
    in a threadpool.
    """

    # TODO: deflate files as theyre fetched, instead of having
    # to wait untill all of them are complete before starting work.

    recording_segment_files = File.objects.filter(
        id__in=[r.file_id for r in results]
    ).prefetch_related(
        Prefetch(
            "blobs",
            queryset=FileBlobIndex.objects.select_related("blob").order_by("offset"),
            to_attr="file_blob_indexes",
        )
    )
    with ThreadPoolExecutor(max_workers=4) as exe:

        file_objects = exe.map(
            lambda file: get_chunked_blob_from_indexes(file.file_blob_indexes),
            recording_segment_files,
        )

    return iter(segment_generator(list(file_objects)))


def segment_generator(recording_segments):
    """
    streams a JSON object made of replay recording segments.
    the segments are individual json objects, and we build a list around them.
    they are also default compressed, so deflate them if needed.
    """
    yield "["

    for i, file in enumerate(recording_segments):
        if is_compressed(file):
            buffer = file.read()
            yield zlib.decompress(buffer, zlib.MAX_WBITS | 32)
        else:
            yield file.read().decode("utf-8")

        if i < len(recording_segments) - 1:
            yield ","

    yield "]"


def is_compressed(blob):
    first_char = blob.read(1)
    blob.seek(0)
    if first_char == b"[":
        return False
    return True
