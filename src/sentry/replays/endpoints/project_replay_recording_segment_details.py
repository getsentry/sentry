from __future__ import annotations

from io import BytesIO

import sentry_sdk
import sentry_sdk.tracing
from django.http import StreamingHttpResponse
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, make_filename
from sentry.replays.usecases.reader import download_segment, fetch_segment_metadata


@region_silo_endpoint
class ProjectReplayRecordingSegmentDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project, replay_id, segment_id) -> HttpResponseBase:
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
        span = sentry_sdk.get_current_span()
        if span is None:
            # For type safety only. `span` should never be None here because this method is only called
            # from within the `get` method above, which is auto-instrumented by the Django integration.
            span = sentry_sdk.tracing.NoOpSpan()

        with span.start_child(
            op="download_segment",
            description="ProjectReplayRecordingSegmentDetailsEndpoint.download_segment",
        ) as child_span:
            segment_bytes = download_segment(
                segment, transaction=child_span, current_hub=sentry_sdk.Hub.current
            )
            if segment_bytes is None:
                segment_bytes = b"[]"

            segment_reader = BytesIO(segment_bytes)

            response = StreamingHttpResponse(
                iter(lambda: segment_reader.read(4096), b""),
                content_type="application/json",
            )
            response["Content-Length"] = len(segment_bytes)
            response["Content-Disposition"] = f'attachment; filename="{make_filename(segment)}"'
            return response
