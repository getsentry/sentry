import logging
from collections.abc import Generator, Iterator
from datetime import datetime
from typing import Any, TypedDict
from urllib.parse import urlparse

import sentry_sdk

from sentry import nodestore
from sentry.constants import ObjectStatus
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.replays.usecases.ingest.event_parser import (
    EventType,
    parse_network_content_lengths,
    which,
)
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils import json
from sentry.utils.snuba import bulk_snuba_queries

logger = logging.getLogger(__name__)


class EventDict(TypedDict):
    id: str
    title: str
    message: str
    timestamp: float
    category: str


def fetch_error_details(project_id: int, error_ids: list[str]) -> list[EventDict]:
    """Fetch error details given error IDs and return a list of EventDict objects."""
    try:
        if not error_ids:
            return []

        node_ids = [Event.generate_node_id(project_id, event_id=id) for id in error_ids]
        events = nodestore.backend.get_multi(node_ids)

        return [
            EventDict(
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


def parse_timestamp(timestamp_value: Any, unit: str) -> float:
    """Parse a timestamp input to a float value.
    The argument timestamp value can be string, float, or None.
    The returned unit will be the same as the input unit.
    """
    if timestamp_value is not None:
        if isinstance(timestamp_value, str):
            try:
                dt = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
                return dt.timestamp() * 1000 if unit == "ms" else dt.timestamp()
            except (ValueError, AttributeError):
                return 0.0
        else:
            return float(timestamp_value)
    return 0.0


def fetch_trace_connected_errors(
    project: Project,
    trace_ids: list[str],
    start: datetime | None,
    end: datetime | None,
) -> list[EventDict]:
    """Fetch error details given trace IDs and return a list of EventDict objects."""
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

        # Process results and convert to EventDict objects
        error_events = []
        for result, query in zip(results, queries):
            error_data = query.process_results(result)["data"]

            for event in error_data:
                timestamp_ms = parse_timestamp(event.get("timestamp_ms"), "ms")
                timestamp_s = parse_timestamp(event.get("timestamp"), "s")
                timestamp = timestamp_ms or timestamp_s * 1000

                if timestamp:
                    error_events.append(
                        EventDict(
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


def fetch_feedback_details(feedback_id: str | None, project_id) -> EventDict | None:
    """
    Fetch user feedback associated with a specific feedback event ID.
    """
    if feedback_id is None:
        return None

    try:
        node_id = Event.generate_node_id(project_id, event_id=feedback_id)
        event = nodestore.backend.get(node_id)

        return (
            EventDict(
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


def generate_error_log_message(error: EventDict) -> str:
    title = error["title"]
    message = error["message"]
    timestamp = error["timestamp"]

    return f"User experienced an error: '{title}: {message}' at {timestamp}"


def generate_feedback_log_message(feedback: EventDict) -> str:
    message = feedback["message"]
    timestamp = feedback["timestamp"]

    return f"User submitted feedback: '{message}' at {timestamp}"


@sentry_sdk.trace
def get_summary_logs(
    segment_data: Iterator[tuple[int, memoryview]],
    error_events: list[EventDict],
    project_id: int,
) -> list[str]:
    # Sort error events by timestamp
    error_events.sort(key=lambda x: x["timestamp"])
    return list(generate_summary_logs(segment_data, error_events, project_id))


def generate_summary_logs(
    segment_data: Iterator[tuple[int, memoryview]],
    error_events: list[EventDict],
    project_id,
) -> Generator[str]:
    """Generate log messages from events and errors in chronological order."""
    error_idx = 0

    # Process segments
    for _, segment in segment_data:
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
                # timestamp_ms = timestamp * 1000
                return None
            case EventType.UI_FOCUS:
                # timestamp_ms = timestamp * 1000
                return None
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
