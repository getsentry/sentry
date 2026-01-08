from io import BytesIO
from typing import Any

import sentry_sdk
from django.http import StreamingHttpResponse
from django.http.response import HttpResponseBase
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import GlobalParams, ReplayParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.replays.endpoints.project_replay_endpoint import ProjectReplayEndpoint
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, make_recording_filename
from sentry.replays.usecases.reader import download_segment, fetch_segment_metadata


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayRecordingSegmentDetailsEndpoint(ProjectReplayEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve a Recording Segment",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReplayParams.REPLAY_ID,
            ReplayParams.SEGMENT_ID,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "GetReplayRecordingSegment", list[dict[str, Any]]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_SEGMENT,
    )
    def get(self, request: Request, project, replay_id, segment_id) -> HttpResponseBase:
        """Return a replay recording segment."""
        self.check_replay_access(request, project)

        segment = fetch_segment_metadata(project.id, replay_id, int(segment_id))
        if not segment:
            return self.respond({"detail": "Replay recording segment not found."}, status=404)

        if request.GET.get("download") is not None:
            return self.download(segment)
        else:
            return self.respond(
                {
                    "data": {
                        "replayId": segment.replay_id,
                        "segmentId": segment.segment_id,
                        "projectId": str(segment.project_id),
                        "dateAdded": (
                            segment.date_added.replace(microsecond=0).isoformat()
                            if segment.date_added
                            else None
                        ),
                    }
                }
            )

    def download(self, segment: RecordingSegmentStorageMeta) -> StreamingHttpResponse:
        with sentry_sdk.start_span(
            op="download_segment",
            name="ProjectReplayRecordingSegmentDetailsEndpoint.download_segment",
        ) as child_span:
            segment_bytes = download_segment(segment, span=child_span)
            segment_reader = BytesIO(segment_bytes)

            response = StreamingHttpResponse(
                iter(lambda: segment_reader.read(4096), b""),
                content_type="application/json",
            )
            response["Content-Length"] = len(segment_bytes)
            response["Content-Disposition"] = (
                f'attachment; filename="{make_recording_filename(segment)}"'
            )
            return response
