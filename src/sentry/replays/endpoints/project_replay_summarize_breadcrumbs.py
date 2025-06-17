import functools
from collections.abc import Generator, Iterator
from typing import Any

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
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, storage
from sentry.replays.usecases.ingest.event_parser import as_log_message
from sentry.replays.usecases.reader import fetch_segments_metadata, iter_segment_data
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplaySummarizeBreadcrumbsEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def __init__(self, **options) -> None:
        storage.initialize_client()
        super().__init__(**options)

    def get(self, request: Request, project, replay_id: str) -> Response:
        """Return a collection of replay recording segments."""
        if (
            not features.has(
                "organizations:session-replay", project.organization, actor=request.user
            )
            or not features.has(
                "organizations:replay-ai-summaries", project.organization, actor=request.user
            )
            or not features.has(
                "organizations:gen-ai-features", project.organization, actor=request.user
            )
        ):
            return self.respond(status=404)

        return self.paginate(
            request=request,
            paginator_cls=GenericOffsetPaginator,
            data_fn=functools.partial(fetch_segments_metadata, project.id, replay_id),
            on_results=analyze_recording_segments,
        )


@sentry_sdk.trace
def analyze_recording_segments(segments: list[RecordingSegmentStorageMeta]) -> dict[str, Any]:
    request_data = json.dumps({"logs": get_request_data(iter_segment_data(segments))})

    # XXX: I have to deserialize this request so it can be "automatically" reserialized by the
    # paginate method. This is less than ideal.
    return json.loads(make_seer_request(request_data).decode("utf-8"))


def make_seer_request(request_data: str) -> bytes:
    # XXX: Request isn't streaming. Limitation of Seer authentication. Would be much faster if we
    # could stream the request data since the GCS download will (likely) dominate latency.
    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/replay/breadcrumbs",
        data=request_data,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(request_data.encode()),
        },
    )

    if response.status_code != 200:
        sentry_sdk.logger.warning(
            "Replay: Failed to produce a summary for a replay breadcrumbs request",
            extra={
                "status_code": response.status_code,
                "response": response.text,
                "content": response.content,
            },
        )

    response.raise_for_status()

    return response.content


def get_request_data(iterator: Iterator[tuple[int, memoryview]]) -> list[str]:
    return list(gen_request_data(map(lambda r: r[1], iterator)))


def gen_request_data(segments: Iterator[memoryview]) -> Generator[str]:
    for segment in segments:
        for event in json.loads(segment.tobytes().decode("utf-8")):
            message = as_log_message(event)
            if message:
                yield message
