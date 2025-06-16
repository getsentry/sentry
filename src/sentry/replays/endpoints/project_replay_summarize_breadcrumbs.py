import functools
from collections.abc import Generator, Iterable, Iterator
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
from sentry.eventstore import backend as eventstore
from sentry.models.project import Project
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

        return self.paginate(
            request=request,
            paginator_cls=GenericOffsetPaginator,
            data_fn=functools.partial(fetch_segments_metadata, project.id, replay_id),
            on_results=functools.partial(
                analyze_recording_segments, project, replay_id, request, filter_params
            ),
        )


def fetch_error_details(project_id: int, error_ids: list[str]) -> list[dict[str, Any]]:
    """Fetch error details given error IDs."""
    error_details = []
    for error_id in error_ids:
        try:
            event = eventstore.get_event_by_id(project_id, error_id)
            if event:
                # Create a derived error event with a few choice fields,
                # similar to the other breadcrumb events, so that it can be passed
                # into as_log_message to be included in the LLM context.

                # See create_feedback.py
                is_feedback = event.title == "User Feedback"
                error_category = "feedback" if is_feedback else "error"
                error_message = (
                    event.data.get("contexts", {}).get("feedback", {}).get("message", "")
                    if is_feedback
                    else event.message or ""
                )

                error_details.append(
                    {
                        "category": error_category,
                        "id": error_id,
                        "title": event.title or "",
                        "timestamp": event.datetime.isoformat() if event.datetime else "",
                        "message": error_message,
                    }
                )
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue
    return error_details


def get_request_data(
    iterator: Iterator[tuple[int, memoryview]], error_ids: list[str], project_id: int
) -> list[str]:
    # Fetch error details
    error_events = fetch_error_details(project_id, error_ids)

    # Combine and sort all events
    all_events = []
    for segment in map(lambda r: r[1], iterator):
        for event in json.loads(segment.tobytes().decode("utf-8")):
            all_events.append(event)

    all_events.extend(error_events)
    all_events.sort(key=lambda x: x.get("timestamp", 0))

    # Process all events in chronological order
    return list(gen_request_data(all_events))


def gen_request_data(events: Iterable[dict[str, Any]]) -> Generator[str]:
    """Generate log messages from events in chronological order."""
    for event in events:
        if message := as_log_message(event):
            yield message


@sentry_sdk.trace
def analyze_recording_segments(
    project: Project,
    replay_id: str,
    request: Request,
    filter_params: dict[str, Any],
    segments: list[RecordingSegmentStorageMeta],
) -> dict[str, Any]:
    from sentry.replays.post_process import process_raw_response
    from sentry.replays.query import query_replay_instance

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

    # Combine breadcrumbs and error details
    request_data = json.dumps(
        {"logs": get_request_data(iter_segment_data(segments), error_ids, project_id=project.id)}
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
