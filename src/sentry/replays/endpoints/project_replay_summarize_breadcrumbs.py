import functools
from collections.abc import Generator, Iterator
from typing import Any

import requests
import sentry_sdk
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
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
            on_results=functools.partial(analyze_recording_segments, project.id, replay_id),
        )


@sentry_sdk.trace
def analyze_recording_segments(
    project_id: int, replay_id: str, segments: list[RecordingSegmentStorageMeta]
) -> dict[str, Any]:
    # Get error IDs from the project replay details endpoint
    from sentry.replays.post_process import process_raw_response
    from sentry.replays.query import query_replay_instance

    snuba_response = query_replay_instance(
        project_id=project_id,
        replay_id=replay_id,
        start=None,  # We don't need time filtering for this
        end=None,
        organization=None,  # We don't need org filtering for this
        request_user_id=None,  # We don't need user filtering for this
    )

    response = process_raw_response(snuba_response)
    error_ids = response[0].get("error_ids", []) if response else []

    # Get the breadcrumb data
    request_data = json.dumps(
        {"logs": get_request_data(iter_segment_data(segments)), "error_ids": error_ids}
    )

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
        raise ParseError("A summary could not be produced at this time.")

    return response.content


def get_request_data(iterator: Iterator[tuple[int, memoryview]]) -> list[str]:
    return list(gen_request_data(map(lambda r: r[1], iterator)))


def gen_request_data(segments: Iterator[memoryview]) -> Generator[str]:
    for segment in segments:
        for event in json.loads(segment.tobytes().decode("utf-8")):
            message = as_log_message(event)
            if message:
                yield message

            # Get error information if present
            if "error" in event:
                error = event["error"]
                error_message = f"Error: {error.get('message', '')}"
                if "type" in error:
                    error_message += f" (Type: {error['type']})"
                yield error_message

            # Check for user feedback issues
            if "issue" in event:
                issue = event["issue"]
                if issue.get("title") == "User Feedback":
                    feedback_message = "User Feedback"
                    if "message" in issue:
                        feedback_message += f": {issue['message']}"
                    if "name" in issue:
                        feedback_message += f" (from {issue['name']})"
                    yield feedback_message
