import functools
import logging
from collections.abc import Generator, Iterator
from datetime import datetime
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
from sentry.api.utils import default_start_end_dates
from sentry.constants import ObjectStatus
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, storage
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance, query_replays_segment_count
from sentry.replays.usecases.ingest.event_parser import (
    EventType,
    parse_network_content_lengths,
    which,
)
from sentry.replays.usecases.reader import fetch_segments_metadata, iter_segment_data
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils import json
from sentry.utils.cache import cache
from sentry.utils.snuba import bulk_snuba_queries

logger = logging.getLogger(__name__)


class GroupEvent(TypedDict):
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

        start, end = default_start_end_dates()

        seg_count_response = query_replays_segment_count(
            project_ids=[project.id],
            start=start,
            end=end,
            replay_ids=[replay_id],
            tenant_ids={"organization_id": project.organization_id},
        )
        if not seg_count_response["data"] or seg_count_response["data"][0]["is_archived"]:
            # TODO: delete cache key. Should this be done in delete endpoint?
            return self.respond(status=404)
        num_segments = seg_count_response["data"][0]["segment_count"]

        disable_error_fetching = (
            request.query_params.get("enable_error_context", "true").lower() == "false"
        )

        per_page = self.get_per_page(request)
        cursor = request.GET.get(self.cursor_name) or ""
        cache_key = f"replay_summarize_breadcrumbs:{project.id}:{replay_id}:{per_page}:{cursor}:{disable_error_fetching}"

        # TODO: refactor to be neater?
        if not request.query_params.get("regenerate", "false").lower() == "true":
            cache_lookup_result: tuple[Response, int] | None = cache.get(cache_key)
            if cache_lookup_result:
                cached_response, prev_num_segments = cache_lookup_result
                if num_segments == prev_num_segments:
                    return cached_response

        # Fetch the replay's error IDs from the replay_id.
        snuba_response = query_replay_instance(
            project_id=project.id,
            replay_id=replay_id,
            start=start,
            end=end,
            organization=project.organization,
            request_user_id=request.user.id,
        )
        replay_details_response = process_raw_response(
            snuba_response,
            fields=request.query_params.getlist("field"),
        )

        error_ids = (
            replay_details_response[0].get("error_ids", []) if replay_details_response else []
        )
        trace_ids = (
            replay_details_response[0].get("trace_ids", []) if replay_details_response else []
        )

        if disable_error_fetching:
            error_events = []
        else:
            replay_errors = fetch_error_details(project_id=project.id, error_ids=error_ids)
            trace_connected_errors = fetch_trace_connected_errors(
                project=project,
                trace_ids=trace_ids,
                start=start,
                end=end,
            )
            error_events = replay_errors + trace_connected_errors

        response = self.paginate(
            request=request,
            paginator_cls=GenericOffsetPaginator,
            data_fn=functools.partial(fetch_segments_metadata, project.id, replay_id),
            on_results=functools.partial(
                analyze_recording_segments, error_events, replay_id, project.id
            ),
        )
        cache.set(cache_key, (response, num_segments), timeout=7 * 24 * 60 * 60)
        return response


def fetch_error_details(project_id: int, error_ids: list[str]) -> list[GroupEvent]:
    """Fetch error details given error IDs and return a list of GroupEvent objects."""
    try:
        if not error_ids:
            return []

        node_ids = [Event.generate_node_id(project_id, event_id=id) for id in error_ids]
        events = nodestore.backend.get_multi(node_ids)

        return [
            GroupEvent(
                category="error",
                id=event_id,
                title=data.get("title", ""),
                timestamp=data.get("timestamp") * 1000,  # convert to milliseconds
                message=data.get("message", ""),
            )
            for event_id, data in zip(error_ids, events.values())
            if data is not None and data.get("timestamp") is not None
        ]
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return []


def parse_timestamp_ms(value: str | float | None) -> float:
    """
    Parse a str or float timestamp to milliseconds.
    None and ill-formatted date strings default to 0.0.
    """
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt.timestamp() * 1000
        except (ValueError, AttributeError):
            return 0.0

    return value or 0.0


def fetch_trace_connected_errors(
    project: Project,
    trace_ids: list[str],
    start: datetime | None,
    end: datetime | None,
) -> list[GroupEvent]:
    """Fetch error details given trace IDs and return a list of GroupEvent objects."""
    try:
        if not trace_ids:
            return []

        # Get projects in the organization that the user has access to
        org_projects = list(
            Project.objects.filter(organization=project.organization, status=ObjectStatus.ACTIVE)
        )

        queries = []
        for trace_id in trace_ids:
            snuba_params = SnubaParams(
                projects=org_projects,
                start=start,
                end=end,
                organization=project.organization,
            )

            # Generate a query for each trace ID. This will be executed in bulk.
            error_query = DiscoverQueryBuilder(
                Dataset.Events,
                params={},
                snuba_params=snuba_params,
                query=f"trace:{trace_id}",
                selected_columns=[
                    "id",
                    "timestamp_ms",
                    "timestamp",
                    "title",
                    "message",
                ],
                orderby=["id"],
                limit=100,
                config=QueryBuilderConfig(
                    auto_fields=False,
                ),
            )
            queries.append(error_query)

        if not queries:
            return []

        # Execute all queries
        results = bulk_snuba_queries(
            [query.get_snql_query() for query in queries],
            referrer=Referrer.API_REPLAY_SUMMARIZE_BREADCRUMBS.value,
        )

        # Process results and convert to GroupEvent objects
        error_events = []
        for result, query in zip(results, queries):
            error_data = query.process_results(result)["data"]

            for event in error_data:
                timestamp = parse_timestamp_ms(event.get("timestamp_ms")) or parse_timestamp_ms(
                    event.get("timestamp")
                )

                if timestamp:
                    error_events.append(
                        GroupEvent(
                            category="error",
                            id=event["id"],
                            title=event.get("title", ""),
                            timestamp=timestamp,
                            message=event.get("message", ""),
                        )
                    )

        return error_events

    except Exception as e:
        sentry_sdk.capture_exception(e)
        return []


def fetch_feedback_details(feedback_id: str | None, project_id):
    """
    Fetch user feedback associated with a specific feedback event ID.
    """
    if feedback_id is None:
        return None

    try:
        node_id = Event.generate_node_id(project_id, event_id=feedback_id)
        event = nodestore.backend.get(node_id)

        return (
            GroupEvent(
                category="feedback",
                id=feedback_id,
                title="User Feedback",
                timestamp=event.get("timestamp") * 1000,  # convert to milliseconds
                message=event.get("contexts", {}).get("feedback", {}).get("message", ""),
            )
            if event and event.get("timestamp") is not None
            else None
        )

    except Exception as e:
        sentry_sdk.capture_exception(e)
        return None


def generate_error_log_message(error: GroupEvent) -> str:
    title = error["title"]
    message = error["message"]
    timestamp = error["timestamp"]

    return f"User experienced an error: '{title}: {message}' at {timestamp}"


def generate_feedback_log_message(feedback: GroupEvent) -> str:
    title = feedback["title"]
    message = feedback["message"]
    timestamp = feedback["timestamp"]

    return f"User submitted feedback: '{title}: {message}' at {timestamp}"


def get_request_data(
    iterator: Iterator[tuple[int, memoryview]],
    error_events: list[GroupEvent],
    project_id: int,
) -> list[str]:
    # Sort error events by timestamp
    error_events.sort(key=lambda x: x["timestamp"])
    return list(gen_request_data(iterator, error_events, project_id))


def gen_request_data(
    iterator: Iterator[tuple[int, memoryview]],
    error_events: list[GroupEvent],
    project_id,
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
            event_type = which(event)
            if event_type == EventType.FEEDBACK:
                feedback_id = event["data"]["payload"].get("data", {}).get("feedbackId")
                feedback = fetch_feedback_details(feedback_id, project_id)
                if feedback:
                    yield generate_feedback_log_message(feedback)

            elif message := as_log_message(event):
                yield message

    # Yield any remaining error messages
    while error_idx < len(error_events):
        error = error_events[error_idx]
        yield generate_error_log_message(error)
        error_idx += 1


@sentry_sdk.trace
def analyze_recording_segments(
    error_events: list[GroupEvent],
    replay_id: str,
    project_id: int,
    segments: list[RecordingSegmentStorageMeta],
) -> dict[str, Any]:
    # Combine breadcrumbs and error details
    request_data = json.dumps(
        {"logs": get_request_data(iter_segment_data(segments), error_events, project_id)}
    )

    # Log when the input string is too large. This is potential for timeout.
    if len(request_data) > 100000:
        logger.info(
            "Replay AI summary: input length exceeds 100k.",
            extra={"request_len": len(request_data), "replay_id": replay_id},
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

    try:
        match event_type:
            case EventType.CLICK:
                message = event["data"]["payload"]["message"]
                return f"User clicked on {message} at {timestamp}"
            case EventType.DEAD_CLICK:
                message = event["data"]["payload"]["message"]
                return f"User clicked on {message} but the triggered action was slow to complete at {timestamp}"
            case EventType.RAGE_CLICK:
                message = event["data"]["payload"]["message"]
                return f"User rage clicked on {message} but the triggered action was slow to complete at {timestamp}"
            case EventType.NAVIGATION:
                to = event["data"]["payload"]["data"]["to"]
                return f"User navigated to: {to} at {timestamp}"
            case EventType.CONSOLE:
                message = event["data"]["payload"]["message"]
                return f"Logged: {message} at {timestamp}"
            case EventType.UI_BLUR:
                timestamp_ms = timestamp * 1000
                return f"User looked away from the tab at {timestamp_ms}"
            case EventType.UI_FOCUS:
                timestamp_ms = timestamp * 1000
                return f"User returned to tab at {timestamp_ms}"
            case EventType.RESOURCE_FETCH:
                timestamp_ms = timestamp * 1000
                payload = event["data"]["payload"]
                method = payload["data"]["method"]
                status_code = payload["data"]["statusCode"]
                description = payload["description"]
                duration = payload["endTimestamp"] - payload["startTimestamp"]

                # Parse URL path
                parsed_url = urlparse(description)
                path = f"{parsed_url.path}?{parsed_url.query}"

                # Check if the tuple is valid and response size exists
                sizes_tuple = parse_network_content_lengths(event)
                response_size = None
                if sizes_tuple and sizes_tuple[1] is not None:
                    response_size = str(sizes_tuple[1])

                # Skip successful requests
                if status_code and str(status_code).startswith("2"):
                    return None

                if response_size is None:
                    return f'Application initiated request: "{method} {path} HTTP/2.0" with status code {status_code}; took {duration} milliseconds at {timestamp_ms}'
                else:
                    return f'Application initiated request: "{method} {path} HTTP/2.0" with status code {status_code} and response size {response_size}; took {duration} milliseconds at {timestamp_ms}'
            case EventType.LCP:
                timestamp_ms = timestamp * 1000
                duration = event["data"]["payload"]["data"]["size"]
                rating = event["data"]["payload"]["data"]["rating"]
                return f"Application largest contentful paint: {duration} ms and has a {rating} rating at {timestamp_ms}"
            case EventType.FCP:
                timestamp_ms = timestamp * 1000
                duration = event["data"]["payload"]["data"]["size"]
                rating = event["data"]["payload"]["data"]["rating"]
                return f"Application first contentful paint: {duration} ms and has a {rating} rating at {timestamp_ms}"
            case EventType.HYDRATION_ERROR:
                return f"There was a hydration error on the page at {timestamp}"
            case EventType.RESOURCE_XHR:
                return None
            case EventType.MUTATIONS:
                return None
            case EventType.UNKNOWN:
                return None
            case EventType.CANVAS:
                return None
            case EventType.OPTIONS:
                return None
            case EventType.FEEDBACK:
                return None  # the log message is processed before this method is called
    except (KeyError, ValueError):
        logger.exception(
            "Error parsing event in replay AI summary",
            extra={
                "event": json.dumps(event),
            },
        )
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
