import functools
from collections.abc import Generator, Iterator

import requests
import sentry_sdk
from django.conf import settings
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
from sentry.replays.usecases.ingest.event_parser import as_log_message
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
def analyze_recording_segments(segments: list[RecordingSegmentStorageMeta]) -> bytes:
    # Data is serialized into its final format and submitted to Seer for processing.
    #
    # Seer expects the request_data to be signed so we can't stream the data as we download it. We
    # would need to collect the data, sign it, and then stream it. Which maybe there's some benefit
    # to but the main benefit of streaming from GCS to Seer is long gone. I'm not making too much
    # of a fuss about it right now because I think for this to work properly we'll probably have
    # small segment ranges being requested anyway.
    #
    # Leaving it in the iterator form in the hopes one day we can stream it.
    request_data = get_request_data(iter_segment_data(segments))

    # Moving the Seer code to another function to make mocking easier :\
    return make_seer_request(request_data)


def make_seer_request(request_data: str) -> bytes:
    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/replay/breadcrumbs",
        data=request_data,
        headers={
            "content-type": "text/plain;charset=utf-8",
            **sign_with_seer_secret(request_data),
        },
    )

    # We're not streaming the response. Should we? The total size should be small.
    return response.content


def get_request_data(iterator: Iterator[tuple[int, bytes]]) -> str:
    return "".join(gen_request_data(map(lambda r: r[1], iterator)))


def gen_request_data(segments: Iterator[bytes]) -> Generator[str]:
    yield PROMPT
    for segment in segments:
        for event in json.loads(segment):
            message = as_log_message(event)
            if message:
                yield message + "\n"
