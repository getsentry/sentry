import logging
from collections.abc import Generator, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any, TypedDict
from urllib.parse import urlparse

import sentry_sdk

from sentry import nodestore
from sentry.api.utils import default_start_end_dates
from sentry.constants import ObjectStatus
from sentry.issues.grouptype import FeedbackGroup
from sentry.models.project import Project
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance, query_trace_connected_events
from sentry.replays.usecases.ingest.event_parser import EventType
from sentry.replays.usecases.ingest.event_parser import (
    get_timestamp_ms as get_replay_event_timestamp_ms,
)
from sentry.replays.usecases.ingest.event_parser import parse_network_content_lengths, which
from sentry.replays.usecases.reader import fetch_segments_metadata, iter_segment_data
from sentry.search.events.types import SnubaParams
from sentry.services.eventstore.models import Event
from sentry.snuba.referrer import Referrer
from sentry.utils import json, metrics
from sentry.utils.platform_categories import MOBILE

logger = logging.getLogger(__name__)


class EventDict(TypedDict):
    id: str
    title: str
    message: str
    timestamp: float  # this should be in milliseconds
    category: str


@sentry_sdk.trace
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


def _parse_iso_timestamp_to_ms(timestamp: str | None) -> float:
    """
    Parses a nullable ISO timestamp to float milliseconds. Errors default to 0.
    """
    if not timestamp:
        return 0.0

    try:
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        return dt.timestamp() * 1000
    except (ValueError, AttributeError):
        return 0.0


@sentry_sdk.trace
def fetch_trace_connected_errors(
    project: Project,
    trace_ids: list[str],
    limit: int,
    start: datetime,
    end: datetime,
) -> list[EventDict]:
    """Fetch same-trace events from both errors and issuePlatform datasets."""
    if not trace_ids:
        return []

    # Get projects in the organization that the user has access to
    org_projects = list(
        Project.objects.filter(organization=project.organization, status=ObjectStatus.ACTIVE)
    )

    snuba_params = SnubaParams(
        projects=org_projects,
        start=start,
        end=end,
        organization=project.organization,
    )

    trace_ids_query = f"trace:[{','.join(trace_ids)}]"

    # Query for errors dataset
    try:
        error_query_results = query_trace_connected_events(
            dataset_label="errors",
            selected_columns=[
                "id",
                "timestamp_ms",
                "timestamp",
                "title",
                "message",
            ],
            query=trace_ids_query,
            snuba_params=snuba_params,
            orderby=["-timestamp"],
            limit=limit,
            referrer=Referrer.API_REPLAY_SUMMARIZE_BREADCRUMBS.value,
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
        error_query_results = {"data": []}

    # Query for issuePlatform dataset
    try:
        issue_query_results = query_trace_connected_events(
            dataset_label="issuePlatform",
            selected_columns=[
                "event_id",
                "title",
                "subtitle",
                "timestamp",
                "timestamp_ms",
                "occurrence_type_id",
            ],
            query=trace_ids_query,
            snuba_params=snuba_params,
            orderby=["-timestamp"],
            limit=limit,
            referrer=Referrer.API_REPLAY_SUMMARIZE_BREADCRUMBS.value,
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
        issue_query_results = {"data": []}

    # Process results and convert to EventDict objects
    events = []

    # Process error query results
    for event in error_query_results["data"]:
        timestamp = _parse_iso_timestamp_to_ms(
            event.get("timestamp_ms")
        ) or _parse_iso_timestamp_to_ms(event.get("timestamp"))
        message = event.get("message", "")

        if timestamp:
            events.append(
                EventDict(
                    category="error",
                    id=event.get("id"),
                    title=event.get("title", ""),
                    timestamp=timestamp,
                    message=message,
                )
            )

    # Process issuePlatform query results
    for event in issue_query_results["data"]:
        timestamp = _parse_iso_timestamp_to_ms(
            event.get("timestamp_ms")
        ) or _parse_iso_timestamp_to_ms(event.get("timestamp"))
        message = event.get("subtitle", "") or event.get("message", "")

        if event.get("occurrence_type_id") == FeedbackGroup.type_id:
            category = "feedback"
        else:
            category = "error"

        # NOTE: The issuePlatform dataset query can return feedback.
        # We also fetch feedback from nodestore in fetch_feedback_details
        # for feedback breadcrumbs.
        # We avoid creating duplicate feedback logs
        # by filtering for unique feedback IDs during log generation.
        if timestamp:
            events.append(
                EventDict(
                    category=category,
                    id=event.get("event_id"),
                    title=event.get("title", ""),
                    timestamp=timestamp,
                    message=message,
                )
            )

    return events


@sentry_sdk.trace
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
    timestamp = float(error["timestamp"])

    return f"User experienced an error: '{title}: {message}' at {timestamp}"


def generate_feedback_log_message(feedback: EventDict) -> str:
    message = feedback["message"]
    timestamp = float(feedback["timestamp"])

    return f"User submitted feedback: '{message}' at {timestamp}"


@sentry_sdk.trace
def get_summary_logs(
    segment_data: Iterator[tuple[int, memoryview]],
    error_events: list[EventDict],
    project_id: int,
    is_mobile_replay: bool = False,
    replay_start: str | None = None,
) -> list[str]:
    # Sort error events by timestamp. This list includes all feedback events still.
    error_events.sort(key=lambda x: x["timestamp"])
    return list(
        generate_summary_logs(
            segment_data,
            error_events,
            project_id,
            is_mobile_replay=is_mobile_replay,
            replay_start=replay_start,
        )
    )


def generate_summary_logs(
    segment_data: Iterator[tuple[int, memoryview]],
    error_events: list[EventDict],
    project_id,
    is_mobile_replay: bool = False,
    replay_start: str | None = None,
) -> Generator[str]:
    """
    Generate log messages from events and errors in chronological order.
    Avoid processing duplicate feedback events.
    """
    error_idx = 0
    seen_feedback_ids = {error["id"] for error in error_events if error["category"] == "feedback"}
    replay_start_ms = _parse_iso_timestamp_to_ms(replay_start) if replay_start else 0.0

    # Skip errors that occurred before replay start
    while error_idx < len(error_events) and error_events[error_idx]["timestamp"] < replay_start_ms:
        error_idx += 1

    # Process segments
    for _, segment in segment_data:
        events = json.loads(segment.tobytes().decode("utf-8"))
        for event in events:
            event_type = which(event)
            timestamp = get_replay_event_timestamp_ms(event, event_type)
            if timestamp < replay_start_ms:
                continue

            # Check if we need to yield any error messages that occurred before this event
            while (
                error_idx < len(error_events) and error_events[error_idx]["timestamp"] < timestamp
            ):
                error = error_events[error_idx]
                if error["category"] == "error":
                    yield generate_error_log_message(error)
                elif error["category"] == "feedback":
                    yield generate_feedback_log_message(error)

                error_idx += 1

            # Yield the current event's log message
            if event_type == EventType.FEEDBACK:
                feedback_id = event["data"]["payload"].get("data", {}).get("feedbackId")
                # Filter out duplicate feedback events.
                if feedback_id not in seen_feedback_ids:
                    feedback = fetch_feedback_details(feedback_id, project_id)

                    if feedback:
                        yield generate_feedback_log_message(feedback)

            elif message := as_log_message(event, is_mobile_replay):
                yield message

    # Yield any remaining error messages
    while error_idx < len(error_events):
        error = error_events[error_idx]
        if error["category"] == "error":
            yield generate_error_log_message(error)
        elif error["category"] == "feedback":
            yield generate_feedback_log_message(error)

        error_idx += 1


def as_log_message(event: dict[str, Any], is_mobile_replay: bool = False) -> str | None:
    """Return an event as a log message.

    Useful in AI contexts where the event's structure is an impediment to the AI's understanding
    of the interaction log. Not every event produces a log message. This function is overly coupled
    to the AI use case. In later iterations, if more or all log messages are desired, this function
    should be forked.
    """
    event_type = which(event)
    timestamp = get_replay_event_timestamp_ms(event, event_type)

    trunc_length = 200  # used for CONSOLE logs and RESOURCE_* urls.

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
            case EventType.NAVIGATION_SPAN:
                # for web replays, we favor NAVIGATION_SPAN
                # since the frontend favors navigation span events in the breadcrumb tab
                # for mobile replays, we only have access to NAVIGATION events.
                if not is_mobile_replay:
                    to = event["data"]["payload"]["description"]
                    return f"User navigated to: {to} at {timestamp}"
                else:
                    return None
            case EventType.CONSOLE:
                message = str(event["data"]["payload"]["message"])
                if len(message) > trunc_length:
                    message = message[:trunc_length] + " [truncated]"
                return f"Logged: '{message}' at {timestamp}"
            case EventType.RESOURCE_FETCH:
                payload = event["data"]["payload"]
                method = payload["data"]["method"]
                status_code = payload["data"]["statusCode"]
                description = payload["description"]

                # Format URL
                url = _parse_url(description, trunc_length)

                # Check if the tuple is valid and response size exists
                sizes_tuple = parse_network_content_lengths(event)
                response_size = None
                if sizes_tuple and sizes_tuple[1] is not None:
                    response_size = str(sizes_tuple[1])

                # Skip successful requests
                if status_code and str(status_code).startswith("2"):
                    return None

                if response_size is None:
                    return (
                        f'Fetch request "{method} {url}" failed with {status_code} at {timestamp}'
                    )
                else:
                    return f'Fetch request "{method} {url}" failed with {status_code} ({response_size} bytes) at {timestamp}'
            case EventType.RESOURCE_XHR:
                payload = event["data"]["payload"]
                method = payload["data"]["method"]
                status_code = payload["data"]["statusCode"]
                description = payload["description"]

                # Format URL
                url = _parse_url(description, trunc_length)

                # Check if the tuple is valid and response size exists
                sizes_tuple = parse_network_content_lengths(event)
                response_size = None
                if sizes_tuple and sizes_tuple[1] is not None:
                    response_size = str(sizes_tuple[1])

                # Skip successful requests
                if status_code and str(status_code).startswith("2"):
                    return None

                if response_size is None:
                    return f'XHR request "{method} {url}" failed with {status_code} at {timestamp}'
                else:
                    return f'XHR request "{method} {url}" failed with {status_code} ({response_size} bytes) at {timestamp}'
            case EventType.LCP:
                duration = event["data"]["payload"]["data"]["size"]
                rating = event["data"]["payload"]["data"]["rating"]
                return f"Application largest contentful paint: {duration} ms and has a {rating} rating at {timestamp}"
            case EventType.HYDRATION_ERROR:
                return f"There was a hydration error on the page at {timestamp}"
            case EventType.TAP:
                message = event["data"]["payload"].get("message")
                if message:
                    return f"User tapped on {message} at {timestamp}"
                else:
                    return None
            case EventType.DEVICE_BATTERY:
                charging = event["data"]["payload"]["data"]["charging"]
                level = event["data"]["payload"]["data"]["level"]
                return f"Device battery was {level}% and {'charging' if charging else 'not charging'} at {timestamp}"
            case EventType.DEVICE_ORIENTATION:
                position = event["data"]["payload"]["data"]["position"]
                return f"Device orientation was changed to {position} at {timestamp}"
            case EventType.DEVICE_CONNECTIVITY:
                state = event["data"]["payload"]["data"]["state"]
                return f"Device connectivity was changed to {state} at {timestamp}"
            case EventType.SCROLL:
                view_id = event["data"]["payload"]["data"].get("view.id", "")
                direction = event["data"]["payload"]["data"].get("direction", "")
                return f"User scrolled {view_id} {direction} at {timestamp}"
            case EventType.SWIPE:
                view_id = event["data"]["payload"]["data"].get("view.id", "")
                direction = event["data"]["payload"]["data"].get("direction", "")
                return f"User swiped {view_id} {direction} at {timestamp}"
            case EventType.BACKGROUND:
                return f"User moved the app to the background at {timestamp}"
            case EventType.FOREGROUND:
                return f"User moved the app to the foreground at {timestamp}"
            case EventType.MUTATIONS:
                return None
            case EventType.UNKNOWN:
                return None
            case EventType.CANVAS:
                return None
            case EventType.OPTIONS:
                return None
            case EventType.MEMORY:
                return None
            case EventType.FEEDBACK:
                return None  # the log message is processed before this method is called
            case EventType.SLOW_CLICK:
                return None
            case EventType.UI_BLUR:
                return None
            case EventType.UI_FOCUS:
                return None
            case EventType.RESOURCE_IMAGE:
                return None
            case EventType.RESOURCE_SCRIPT:
                return None
            case EventType.CLS:
                return None
            case EventType.NAVIGATION:
                if is_mobile_replay:
                    to = event["data"]["payload"]["data"]["to"]
                    return f"User navigated to: {to} at {timestamp}"
                else:
                    return None
            case EventType.MULTI_CLICK:
                return None
    except (KeyError, ValueError, TypeError):
        logger.exception(
            "Error parsing event in replay AI summary",
            extra={
                "event": json.dumps(event),
            },
        )
        return None


def _parse_url(s: str, trunc_length: int) -> str:
    """
    Attempt to validate and return a formatted URL from a string (netloc/path?query).
    If validation fails, return the raw string truncated to trunc_length.
    """
    try:
        parsed_url = urlparse(s)
        if parsed_url.netloc:
            path = parsed_url.path.lstrip("/")
            url = f"{parsed_url.netloc}/{path}"
            if parsed_url.query:
                url += f"?{parsed_url.query}"
            return url

    except ValueError:
        pass

    if len(s) > trunc_length:
        return s[:trunc_length] + " [truncated]"
    return s


@sentry_sdk.trace
def rpc_get_replay_summary_logs(
    project_id: int,
    replay_id: str,
    num_segments: int,
) -> dict[str, Any]:
    """
    RPC call for Seer. Downloads a replay's segment data, queries associated errors, and parses this into summary logs.
    """

    project = Project.objects.get(id=project_id)

    # Look for the replay in the last 90 days.
    start, end = default_start_end_dates()

    # Fetch the replay's error and trace IDs from the replay_id, as well as the start and end times.
    snuba_response = query_replay_instance(
        project_id=project.id,
        replay_id=replay_id,
        start=start,
        end=end,
        organization=project.organization,
        request_user_id=None,  # This is for the viewed_by_me field which is unused for summaries.
    )
    processed_response = process_raw_response(
        snuba_response,
        fields=[],  # Defaults to all fields.
    )

    # 404s should be handled in the originating Sentry endpoint.
    # If the replay is missing here just return an empty response.
    if not processed_response:
        return {"logs": []}

    error_ids = processed_response[0].get("error_ids", [])
    trace_ids = processed_response[0].get("trace_ids", [])
    platform = processed_response[0].get("platform")
    is_mobile_replay = platform in MOBILE if platform else False

    # Use the replay's start and end times to clamp the error queries. Fuzz 10s for clockskew.
    replay_start = processed_response[0].get("started_at")
    replay_end = processed_response[0].get("finished_at")
    if replay_start:
        start = max(
            datetime.fromisoformat(replay_start) - timedelta(seconds=10),
            datetime.now(UTC) - timedelta(days=90),
        )
    if replay_end:
        end = min(datetime.fromisoformat(replay_end) + timedelta(seconds=10), datetime.now(UTC))

    # Fetch same-trace errors.
    trace_connected_errors = fetch_trace_connected_errors(
        project=project,
        trace_ids=trace_ids,
        start=start,
        end=end,
        limit=100,
    )
    trace_connected_error_ids = {x["id"] for x in trace_connected_errors}

    # Fetch directly linked errors, if they weren't returned by the trace query.
    direct_errors = fetch_error_details(
        project_id=project.id,
        error_ids=[x for x in error_ids if x not in trace_connected_error_ids],
    )

    error_events = direct_errors + trace_connected_errors

    # Metric names kept for backwards compatibility.
    metrics.distribution(
        "replays.endpoints.project_replay_summary.direct_errors",
        value=len(direct_errors),
    )
    metrics.distribution(
        "replays.endpoints.project_replay_summary.trace_connected_errors",
        value=len(trace_connected_errors),
    )
    metrics.distribution(
        "replays.endpoints.project_replay_summary.num_trace_ids",
        value=len(trace_ids),
    )

    # Download segment data.
    segment_md = fetch_segments_metadata(project.id, replay_id, 0, num_segments)
    segment_data = iter_segment_data(segment_md)

    # Combine replay and error data and parse into logs.
    logs = get_summary_logs(
        segment_data,
        error_events,
        project.id,
        is_mobile_replay=is_mobile_replay,
        replay_start=replay_start,
    )
    return {"logs": logs}
