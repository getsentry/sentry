import functools
import logging
from typing import Any, TypedDict

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
from sentry.models.project import Project
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, storage
from sentry.replays.lib.summarize import (
    EventDict,
    fetch_error_details,
    fetch_trace_connected_errors,
    get_summary_logs,
)
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance
from sentry.replays.usecases.reader import fetch_segments_metadata, iter_segment_data
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json

logger = logging.getLogger(__name__)


class SeerRequest(TypedDict):
    """Corresponds to SummarizeReplayBreadcrumbsRequest in Seer."""

    logs: list[str]
    replay_id: str
    organization_id: int
    project_id: int


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplaySummarizeBreadcrumbsEndpoint(ProjectEndpoint):
    """Deprecated. TODO: Delete in favor of ProjectReplaySummaryEndpoint."""

    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def __init__(self, **options) -> None:
        storage.initialize_client()
        super().__init__(**options)

    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        """Return a summary of the replay and ordered time ranges ("chapters") describing the user's journey through the application."""
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
        trace_ids = response[0].get("trace_ids", []) if response else []

        # Check if error fetching should be disabled
        disable_error_fetching = (
            request.query_params.get("enable_error_context", "true").lower() == "false"
        )

        if disable_error_fetching:
            error_events = []
        else:
            replay_errors = fetch_error_details(project_id=project.id, error_ids=error_ids)
            trace_connected_errors = fetch_trace_connected_errors(
                project=project,
                trace_ids=trace_ids,
                start=filter_params["start"],
                end=filter_params["end"],
            )
            error_events = replay_errors + trace_connected_errors
        return self.paginate(
            request=request,
            paginator_cls=GenericOffsetPaginator,
            data_fn=functools.partial(fetch_segments_metadata, project.id, replay_id),
            on_results=functools.partial(
                analyze_recording_segments,
                error_events,
                replay_id,
                project.organization.id,
                project.id,
            ),
        )


@sentry_sdk.trace
def analyze_recording_segments(
    error_events: list[EventDict],
    replay_id: str,
    organization_id: int,
    project_id: int,
    segments: list[RecordingSegmentStorageMeta],
) -> dict[str, Any]:
    # Combine breadcrumbs and error details
    logs = get_summary_logs(iter_segment_data(segments), error_events, project_id)
    request = SeerRequest(
        logs=logs,
        replay_id=replay_id,
        organization_id=organization_id,
        project_id=project_id,
    )

    # XXX: I have to deserialize this response so it can be "automatically" reserialized by the
    # paginate method. This is less than ideal.
    return json.loads(make_seer_request(request).decode("utf-8"))


def make_seer_request(request: SeerRequest) -> bytes:
    serialized_request = json.dumps(request)

    # Log when the input string is too large. This is potential for timeout.
    request_len_threshold = 1e5
    if len(serialized_request) > request_len_threshold:
        logger.info(
            "Replay AI summary: input length exceeds threshold.",
            extra={
                "request_len": len(serialized_request),
                "request_len_threshold": request_len_threshold,
                "replay_id": request["replay_id"],
                "organization_id": request["organization_id"],
                "project_id": request["project_id"],
            },
        )

    # XXX: Request isn't streaming. Limitation of Seer authentication. Would be much faster if we
    # could stream the request data since the GCS download will (likely) dominate latency.
    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/replay/breadcrumbs",
        data=serialized_request,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(serialized_request.encode()),
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
