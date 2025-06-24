import functools
import logging
from collections.abc import Generator, Iterator
from typing import Any, TypedDict
from urllib.parse import urlparse

import requests
import sentry_sdk
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, nodestore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, storage
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance
from sentry.replays.usecases.ingest.event_parser import (
    EventType,
    parse_network_content_lengths,
    which,
)
from sentry.replays.usecases.reader import fetch_segments_metadata, iter_segment_data
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json

logger = logging.getLogger(__name__)


class ErrorEvent(TypedDict):
    id: str
    title: str
    message: str
    timestamp: float
    category: str


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

        # Check if error fetching should be disabled
        disable_error_fetching = (
            request.query_params.get("enable_error_context", "true").lower() == "false"
        )

        if disable_error_fetching:
            error_events = []
        else:
            error_events = fetch_error_details(project_id=project.id, error_ids=error_ids)

        return self.paginate(
            request=request,
            paginator_cls=GenericOffsetPaginator,
            data_fn=functools.partial(fetch_segments_metadata, project.id, replay_id),
            on_results=functools.partial(analyze_recording_segments, error_events),
        )


def fetch_error_details(project_id: int, error_ids: list[str]) -> list[ErrorEvent]:
    """Fetch error details given error IDs and return a list of ErrorEvent objects."""
    try:
        node_ids = [Event.generate_node_id(project_id, event_id=id) for id in error_ids]
        events = nodestore.backend.get_multi(node_ids)

        return [
            ErrorEvent(
                category="error",
                id=event_id,
                title=data.get("title", ""),
                timestamp=data.get("timestamp", 0.0) * 1000,  # error timestamp is in seconds
                message=data.get("message", ""),
            )
            for event_id, data in zip(error_ids, events.values())
            if data is not None
        ]
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return []


def generate_error_log_message(error: ErrorEvent) -> str:
    title = error["title"]
    message = error["message"]
    timestamp = error["timestamp"]

    return f"User experienced an error: '{title}: {message}' at {timestamp}"


def get_request_data(
    iterator: Iterator[tuple[int, memoryview]], error_events: list[ErrorEvent]
) -> list[str]:
    # Sort error events by timestamp
    error_events.sort(key=lambda x: x["timestamp"])
    return list(gen_request_data(iterator, error_events))


def gen_request_data(
    iterator: Iterator[tuple[int, memoryview]], error_events: list[ErrorEvent]
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
    error_events: list[ErrorEvent],
    segments: list[RecordingSegmentStorageMeta],
) -> dict[str, Any]:
    # Combine breadcrumbs and error details
    request_data = json.dumps({"logs": get_request_data(iter_segment_data(segments), error_events)})

    # Log when the input tokens are too large. This is potential for timeout.
    tokens = len(request_data) / 4
    if tokens > 100000:
        logger.info(
            "Replay AI summary: input tokens exceeded 100k.",
            extra={"request_len": len(request_data), "num_tokens": len(request_data) / 4},
        )

    # XXX: I have to deserialize this request so it can be "automatically" reserialized by the
    # paginate method. This is less than ideal.
    return json.loads(make_seer_request(request_data).decode("utf-8"))


def as_log_message(event: dict[str, Any]) -> str | None:
    """Return an event as a log message.

    Useful in AI contexts where the event's structure is an impediment to the AI's understanding
    of the interaction log. Not every event produces a log message. This function is overly coupled
    to the AI use case. In later iterations, if more or all log messages are desired, this function
    should be forked.
    """
    event_type = which(event)
    timestamp = event.get("timestamp", 0.0)

    match event_type:
        case EventType.CLICK:
            return f"User clicked on {event["data"]["payload"]["message"]} at {timestamp}"
        case EventType.DEAD_CLICK:
            return f"User clicked on {event["data"]["payload"]["message"]} but the triggered action was slow to complete at {timestamp}"
        case EventType.RAGE_CLICK:
            return f"User rage clicked on {event["data"]["payload"]["message"]} but the triggered action was slow to complete at {timestamp}"
        case EventType.NAVIGATION:
            return f"User navigated to: {event["data"]["payload"]["data"]["to"]} at {timestamp}"
        case EventType.CONSOLE:
            return f"Logged: {event["data"]["payload"]["message"]} at {timestamp}"
        case EventType.UI_BLUR:
            return f"User looked away from the tab at {timestamp}"
        case EventType.UI_FOCUS:
            return f"User returned to tab at {timestamp}"
        case EventType.RESOURCE_FETCH:
            payload = event["data"]["payload"]
            parsed_url = urlparse(payload["description"])

            path = f"{parsed_url.path}?{parsed_url.query}"

            # Safely get (request_size, response_size)
            sizes_tuple = parse_network_content_lengths(event)
            response_size = None

            # Check if the tuple is valid and response size exists
            if sizes_tuple and sizes_tuple[1] is not None:
                response_size = str(sizes_tuple[1])

            status_code = payload["data"]["statusCode"]
            duration = payload["endTimestamp"] - payload["startTimestamp"]
            method = payload["data"]["method"]

            # if status code is successful, ignore it
            if str(status_code).startswith("2"):
                return None

            if response_size is None:
                return f'Application initiated request: "{method} {path} HTTP/2.0" with status code {status_code}; took {duration} milliseconds at {timestamp}'
            else:
                return f'Application initiated request: "{method} {path} HTTP/2.0" with status code {status_code} and response size {response_size}; took {duration} milliseconds at {timestamp}'
        case EventType.RESOURCE_XHR:
            return None
        case EventType.LCP:
            duration = event["data"]["payload"]["data"]["size"]
            rating = event["data"]["payload"]["data"]["rating"]
            return f"Application largest contentful paint: {duration} ms and has a {rating} rating at {timestamp}"
        case EventType.FCP:
            duration = event["data"]["payload"]["data"]["size"]
            rating = event["data"]["payload"]["data"]["rating"]
            return f"Application first contentful paint: {duration} ms and has a {rating} rating at {timestamp}"
        case EventType.HYDRATION_ERROR:
            return f"There was a hydration error on the page at {timestamp}"
        case EventType.MUTATIONS:
            return None
        case EventType.UNKNOWN:
            return None
        case EventType.CANVAS:
            return None
        case EventType.OPTIONS:
            return None


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
        logger.warning(
            "Replay: Failed to produce a summary for a replay breadcrumbs request",
            extra={
                "status_code": response.status_code,
                "response": response.text,
                "content": response.content,
            },
        )

    response.raise_for_status()

    return response.content
