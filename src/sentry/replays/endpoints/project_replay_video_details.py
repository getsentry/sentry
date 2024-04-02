from __future__ import annotations

from collections.abc import Iterator
from io import BytesIO

from django.http import StreamingHttpResponse
from django.http.response import HttpResponseBase
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import GlobalParams, ReplayParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.replays.lib.http import RangeProtocol, parse_range_header
from sentry.replays.lib.storage import make_video_filename
from sentry.replays.usecases.reader import download_video, fetch_segment_metadata


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayVideoDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="Fetch Replay Video",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ReplayParams.REPLAY_ID,
            ReplayParams.SEGMENT_ID,
        ],
        responses={
            200: inline_sentry_response_serializer("GetReplayVideo", bytes),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_VIDEO,
    )
    def get(self, request: Request, project, replay_id, segment_id) -> HttpResponseBase:
        """Return a replay video."""
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        segment = fetch_segment_metadata(project.id, replay_id, int(segment_id))
        if not segment:
            return self.respond({"detail": "Replay recording segment not found."}, status=404)

        video = download_video(segment)
        if video is None:
            return self.respond({"detail": "Replay recording segment not found."}, status=404)

        video_io = BytesIO(video)

        if range_header := request.headers.get("Range"):
            ranges = parse_range_header(range_header)

            iterator = iter_from_range(ranges, video_io)
            status_code = 206

            headers = {}
            if len(ranges) == 1:
                positions = ranges[0].make_range(len(video) - 1)
                if positions is None:
                    length = 0
                    byte_range = "*"
                else:
                    length = positions[1] - positions[0] + 1
                    byte_range = f"{positions[0]}-{positions[1]}"

                headers["Content-Length"] = length
                headers["Content-Range"] = f"bytes {byte_range}/{len(video)}"
            else:
                headers["Content-Length"] = len(video)
        else:
            iterator = iter(lambda: video_io.read(4096), b"")
            status_code = 200
            headers = {
                "Content-Length": len(video),
                "Content-Range": f"0-{len(video)-1}",
            }

        response = StreamingHttpResponse(
            iterator,
            content_type="application/octet-stream",
            status=status_code,
        )
        response["Accept-Ranges"] = "bytes"
        response["Content-Disposition"] = f'attachment; filename="{make_video_filename(segment)}"'
        for key, value in headers.items():
            response[key] = value
        return response


def iter_from_range(ranges: list[RangeProtocol], video_io: BytesIO) -> Iterator[bytes]:
    for range_ in ranges:
        yield range_.read_range(video_io)


def get_index_position(range: RangeProtocol, last_index: int) -> str:
    positions = range.make_range(last_index)
    if positions is None:
        return "*"
    else:
        return f"{positions[0]}-{positions[1]}"
