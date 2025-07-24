import logging
from typing import TypedDict

import requests
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.replays.lib.storage import storage
from sentry.replays.lib.summarize import (
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


MAX_SEGMENTS_TO_SUMMARIZE = 100


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplaySummarizeBreadcrumbsAsyncEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    def __init__(self, **options) -> None:
        storage.initialize_client()
        super().__init__(**options)
        self.features = [
            "organizations:session-replay",
            "organizations:replay-ai-summaries",
            "organizations:gen-ai-features",
        ]

    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        """Poll for the status of a replay summary task in Seer."""
        if not all(
            features.has(feature, project.organization, actor=request.user)
            for feature in self.features
        ):
            return self.respond(status=404)

        seer_request = json.dumps(
            {
                "replay_id": replay_id,
            }
        )

        # Request Seer for the state of the summary task.
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/replay/breadcrumbs/state",
            data=seer_request,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(seer_request.encode()),
            },
        )
        if response.status_code != 200:
            logger.warning(
                "Replay: Seer returned error when polling for replay breadcrumbs summary",
                extra={
                    "status_code": response.status_code,
                    "response": response.text,
                    "content": response.content,
                },
            )
        response.raise_for_status()
        return response

    def post(self, request: Request, project: Project, replay_id: str) -> Response:
        """Start a replay summary task in Seer."""
        if not all(
            features.has(feature, project.organization, actor=request.user)
            for feature in self.features
        ):
            return self.respond(status=404)

        filter_params = self.get_filter_params(request, project)

        # Fetch the replay's error and trace IDs from the replay_id.
        snuba_response = query_replay_instance(
            project_id=project.id,
            replay_id=replay_id,
            start=filter_params["start"],
            end=filter_params["end"],
            organization=project.organization,
            request_user_id=request.user.id,
        )
        processed_response = process_raw_response(
            snuba_response,
            fields=request.query_params.getlist("field"),
        )
        error_ids = processed_response[0].get("error_ids", []) if processed_response else []
        trace_ids = processed_response[0].get("trace_ids", []) if processed_response else []

        # Fetch error details.
        replay_errors = fetch_error_details(project_id=project.id, error_ids=error_ids)
        trace_connected_errors = fetch_trace_connected_errors(
            project=project,
            trace_ids=trace_ids,
            start=filter_params["start"],
            end=filter_params["end"],
        )
        error_events = replay_errors + trace_connected_errors

        # Download segment data.
        # XXX: For now this is capped to 100 and blocking. DD shows no replays with >25 segments, but we should still stress test and figure out how to deal with large replays.
        segment_md = fetch_segments_metadata(project.id, replay_id, 0, MAX_SEGMENTS_TO_SUMMARIZE)
        segment_data = iter_segment_data(segment_md)

        # Combine replay and error data and parse into logs.
        logs = get_summary_logs(segment_data, error_events, project.id)

        # Post to Seer to start a summary task.
        seer_request = json.dumps(
            {
                "logs": logs,
                "num_segments": len(segment_md),
                "replay_id": replay_id,
                "organization_id": project.organization.id,
                "project_id": project.id,
            }
        )

        # XXX: Request isn't streaming. Limitation of Seer authentication. Would be much faster if we
        # could stream the request data since the GCS download will (likely) dominate latency.
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/replay/breadcrumbs/start",
            data=seer_request,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(seer_request.encode()),
            },
        )
        if response.status_code != 200:
            logger.warning(
                "Replay: Seer returned error when starting a replay breadcrumbs summary",
                extra={
                    "status_code": response.status_code,
                    "response": response.text,
                    "content": response.content,
                },
            )
        response.raise_for_status()
        return response
