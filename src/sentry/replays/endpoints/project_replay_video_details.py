from __future__ import annotations

import logging
from io import BytesIO
from subprocess import PIPE, Popen

from django.http import HttpResponse, StreamingHttpResponse
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
from sentry.replays.lib.http import (
    MalformedRangeHeader,
    UnsatisfiableRange,
    content_length,
    content_range,
    parse_range_header,
)
from sentry.replays.lib.storage import make_video_filename
from sentry.replays.usecases.reader import download_video, fetch_segment_metadata

logger = logging.getLogger()


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
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
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

        if range_header := request.headers.get("Range"):
            response = handle_range_response(range_header, video)
        else:
            video_io = BytesIO(video)
            iterator = iter(lambda: video_io.read(4096), b"")
            response = StreamingHttpResponse(iterator, content_type="application/octet-stream")
            response["Content-Length"] = len(video)

        response["Accept-Ranges"] = "bytes"
        response["Content-Disposition"] = f'attachment; filename="{make_video_filename(segment)}"'
        return response

    def getAsWebM(self, request: Request, project, replay_id, segment_id) -> HttpResponseBase:
        """Return a replay video in a webm format."""
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

        input_video = BytesIO(video)  # Create a BytesIO buffer for the video
        output_video = BytesIO()  # Output buffer for the transcoded video

        # FFmpeg command to transcode video from MP4 (or other formats) to WebM
        command = ["ffmpeg -i pipe:0 -c:v libvpx-vp9 -crf 4 -b:v 0 -f webm pipe:1"]

        # Run the FFmpeg command using subprocess
        process = Popen(command, stdin=PIPE, stdout=PIPE, stderr=PIPE)

        # Write the video data to the stdin of the FFmpeg process
        process.stdin.write(input_video.read())
        process.stdin.close()

        # Read the transcoded WebM video from stdout of the FFmpeg process
        transcoded_video = process.stdout.read()

        # Write the transcoded video to the output buffer
        output_video.write(transcoded_video)
        output_video.seek(0)

        if range_header := request.headers.get("Range"):
            response = handle_range_response(range_header, output_video.getvalue())
        else:
            video_io = output_video
            iterator = iter(lambda: video_io.read(4096), b"")
            response = StreamingHttpResponse(iterator, content_type="application/octet-stream")
            response["Content-Length"] = len(output_video.getvalue())

        response["Accept-Ranges"] = "bytes"
        response["Content-Disposition"] = f'attachment; filename="{make_video_filename(segment)}"'
        return response


def handle_range_response(range_header: str, video: bytes) -> HttpResponseBase:
    try:
        ranges = parse_range_header(range_header)
        offsets = [range.make_range(len(video) - 1) for range in ranges]

        # For now we're going to raise an exception if more than one range is specified. This
        # stackoverflow post shows how to use a multi-part response to enable multiple byte
        # range responses.
        #
        # https://stackoverflow.com/questions/18315787/http-1-1-response-to-multiple-range
        if len(ranges) > 1:
            raise MalformedRangeHeader("Too many ranges specified.")
    except (MalformedRangeHeader, UnsatisfiableRange):
        logger.exception("Malformed range request.")

        # Malformed ranges receive an empty 416 status response which includes a
        # header to demonstrate the correct range format.
        response = HttpResponse(b"", content_type="application/octet-stream", status=416)
        response["Content-Range"] = f"bytes */{len(video)}"
        return response

    # Hard-coded single byte-range handling. These assertions should be impossible to fail
    # due to the validation above.
    assert len(ranges) == 1
    assert len(offsets) == 1

    video_range = BytesIO(ranges[0].read_range(BytesIO(video)))
    response_iterator = iter(lambda: video_range.read(4096), b"")

    range_response = StreamingHttpResponse(
        response_iterator,
        content_type="application/octet-stream",
        status=206,
    )
    range_response["Content-Length"] = content_length(offsets)
    range_response["Content-Range"] = content_range(offsets[0], resource_size=len(video))
    return range_response
