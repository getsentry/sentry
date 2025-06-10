import functools
from collections.abc import Generator, Iterator
from urllib.parse import urlparse

import requests
import sentry_sdk
from django.conf import settings
from django.http import StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, ReplayParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, storage
from sentry.replays.types import ReplayRecordingSegment
from sentry.replays.usecases.reader import fetch_segments_metadata, iter_segment_data
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayRecordingSegmentIndexEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    def __init__(self, **options) -> None:
        storage.initialize_client()
        super().__init__(**options)

    @extend_schema(
        operation_id="List Recording Segments",
        parameters=[
            CursorQueryParam,
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReplayParams.REPLAY_ID,
            VisibilityParams.PER_PAGE,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListReplayRecordingSegments", list[ReplayRecordingSegment]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_SEGMENTS,
    )
    def get(self, request: Request, project, replay_id: str) -> Response:
        """Return a collection of replay recording segments."""
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        return self.paginate(
            request=request,
            response_cls=StreamingHttpResponse,
            response_kwargs={"content_type": "application/json"},
            paginator_cls=GenericOffsetPaginator,
            data_fn=functools.partial(fetch_segments_metadata, project.id, replay_id),
            on_results=analyze_recording_segments,
        )


PROMPT = (
    "I have a series of logs I've collected from a Javascript application running in a web "
    "browser. Please summarize the logs and give an overview of what happened. The logs are "
    "sequential and happened in order.  Shorten the summary to contain only the most salient "
    "information. Don't explain the application to me. Explain the user journey and what issues "
    "they encountered. Your summary should be bullet points of only the most salient information. "
    "I only care about the most salient information with the highest magnitude. Its fine to ignore "
    "ranges in the replay which don't matter.\n\n"
)


@sentry_sdk.trace
def analyze_recording_segments(segments: list[RecordingSegmentStorageMeta]) -> Iterator[bytes]:
    # Data is serialized into its final format and submitted to Seer for processing.
    #
    # Seer expects the request_data to be signed so we can't stream the data as we download it. We
    # would need to collect the data, sign it, and then stream it. Which maybe there's some benefit
    # to but the main benefit of streaming from GCS to Seer is long gone.
    #
    # Leaving it in the iterator form in the hopes one day we can stream it.
    request_data = "".join(_gen_request_data(segments))

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/replay/breadcrumbs",
        data=_gen_request_data(segments),
        headers={
            "content-type": "text/plain;charset=utf-8",
            **sign_with_seer_secret(request_data),
        },
    )

    # We're not streaming the response. Should we? The total size should be small.
    yield response.content


def _gen_request_data(segments: list[RecordingSegmentStorageMeta]) -> Generator[str]:
    yield PROMPT

    # Segment data needs to be pre-processed prior to being submitted for analysis. Data is sent
    # in its prompt format. Seer is treated as a proxy for AI providers.
    for _, segment_data in iter_segment_data(segments):
        segment = json.loads(segment_data)
        for event in filter(lambda e: e["type"] == 5, segment):
            if event["data"]["tag"] == "breadcrumb":
                payload = event["data"]["payload"]
                category = payload["category"]
                timestamp = payload["timestamp"]
                if category == "ui.click":
                    yield f"User clicked on {payload['message']} at {timestamp}"
                elif category == "navigation":
                    yield f'User navigated to: {payload["data"]["to"]} at {timestamp}'
                elif category == "console":
                    yield f'Logged: {payload["message"]} at {timestamp}'
                elif category == "ui.blur":
                    yield f"User looked away from the tab at {timestamp}."
                elif category == "ui.focus":
                    yield f"User returned to tab at {timestamp}."
            elif event["data"]["tag"] == "performanceSpan":
                payload = event["data"]["payload"]
                op = payload["op"]
                if op == "resource.fetch":
                    duration = payload["endTimestamp"] - payload["startTimestamp"]
                    method = payload["data"]["method"]
                    status_code = payload["data"]["statusCode"]
                    size = payload["data"]["response"]["size"]

                    parsed_url = urlparse(payload["description"])
                    path = f"{parsed_url.path}?{parsed_url.query}"
                    yield f'Application initiated request: "{method} {path} HTTP/2.0" {status_code} {size}; took {duration} milliseconds at {event["timestamp"]}'
                elif op == "web-vital":
                    if payload["description"] == "largest-contentful-paint":
                        duration = payload["data"]["size"]
                        rating = payload["data"]["rating"]
                        yield f"Application largest contentful paint: {duration} ms and has a {rating} rating"
                    elif payload["description"] == "first-contentful-paint":
                        duration = payload["data"]["size"]
                        rating = payload["data"]["rating"]
                        yield f"Application first contentful paint: {duration} ms and has a {rating} rating"

            # Log lines are new-line delimited.
            yield "\n"
