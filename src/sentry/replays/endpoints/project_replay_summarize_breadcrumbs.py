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

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models.project import Project
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, storage
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance
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

    def get(self, request: Request, project: Project, replay_id: str) -> Response:
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

        filter_params = self.get_filter_params(request, project)

        # Fetch the replay's error IDs from the replay_id.
        snuba_response = query_replay_instance(
            project_id=project.id,
            replay_id=replay_id,
            start=filter_params["start"],
            end=filter_params["end"],
            organization=project.organization,
            request_user_id=request.user.id,
        )

        response = process_raw_response(
            snuba_response,
            fields=request.query_params.getlist("field"),
        )

        error_ids = response[0].get("error_ids", []) if response else []
        error_events = fetch_error_details(project_id=project.id, error_ids=error_ids)

        return self.paginate(
            request=request,
            paginator_cls=GenericOffsetPaginator,
            data_fn=functools.partial(fetch_segments_metadata, project.id, replay_id),
            on_results=functools.partial(analyze_recording_segments, error_events),
        )


def fetch_error_details(project_id: int, error_ids: list[str]) -> list[dict[str, Any]]:
    """Fetch error details given error IDs."""
    try:
        events = eventstore.get_events(
            filter=eventstore.Filter(
                project_ids=[project_id],
                event_ids=error_ids,
            ),
            referrer="replay.summarize_breadcrumbs",
        )
        return [
            {
                "category": "error",
                "id": event.event_id,
                "title": event.title or "",
                "timestamp": event.datetime.timestamp() if event.datetime else 0.0,
                "message": event.message or "",
            }
            for event in events
        ]
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return []


def generate_error_log_message(error: dict[str, Any]) -> str:
    title = error.get("title", "")
    message = error.get("message", "")
    timestamp = error.get("timestamp", 0)

    return f"User experienced an error: '{title}: {message}' at {timestamp}"


def get_request_data(
    iterator: Iterator[tuple[int, memoryview]], error_events: list[dict[str, Any]]
) -> list[str]:
    # Sort error events by timestamp
    error_events.sort(key=lambda x: x.get("timestamp", 0))
    return list(gen_request_data(iterator, error_events))


def gen_request_data(
    iterator: Iterator[tuple[int, memoryview]], error_events: list[dict[str, Any]]
) -> Generator[str]:
    """Generate log messages from events and errors in chronological order."""
    error_idx = 0

    # Process segments
    for _, segment in iterator:
        events = json.loads(segment.tobytes().decode("utf-8"))
        for event in events:
            # Check if we need to yield any error messages that occurred before this event
            while error_idx < len(error_events) and error_events[error_idx][
                "timestamp"
            ] < event.get("timestamp", 0):
                error = error_events[error_idx]
                yield generate_error_log_message(error)
                error_idx += 1

            # Yield the current event's log message
            if message := as_log_message(event):
                yield message

    # Yield any remaining error messages
    while error_idx < len(error_events):
        error = error_events[error_idx]
        yield generate_error_log_message(error)
        error_idx += 1


@sentry_sdk.trace
def analyze_recording_segments(
    error_events: list[dict[str, Any]],
    segments: list[RecordingSegmentStorageMeta],
) -> dict[str, Any]:
    # Combine breadcrumbs and error details
    request_data = json.dumps({"logs": get_request_data(iter_segment_data(segments), error_events)})

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
