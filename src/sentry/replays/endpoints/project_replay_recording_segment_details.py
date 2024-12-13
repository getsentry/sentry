from __future__ import annotations

from io import BytesIO

import sentry_sdk
import sentry_sdk.tracing
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
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, make_recording_filename
from sentry.replays.types import ReplayRecordingSegment
from sentry.replays.usecases.reader import download_segment, fetch_segment_metadata


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayRecordingSegmentDetailsEndpoint(ProjectEndpoint):
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
                "GetReplayRecordingSegment", ReplayRecordingSegment
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_SEGMENT,
    )
    def get(self, request: Request, project, replay_id, segment_id) -> HttpResponseBase:
        """Return a replay recording segment."""
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return self.respond(status=404)

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
