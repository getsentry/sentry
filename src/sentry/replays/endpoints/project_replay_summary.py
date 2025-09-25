import logging
from typing import Any

import sentry_sdk
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.utils import default_start_end_dates
from sentry.models.project import Project
from sentry.replays.lib.seer_api import seer_summarization_connection_pool
from sentry.replays.lib.storage import storage
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import get_replay_range, query_replay_instance
from sentry.replays.usecases.reader import fetch_segments_metadata, iter_segment_data
from sentry.replays.usecases.summarize import (
    fetch_error_details,
    fetch_trace_connected_errors,
    get_summary_logs,
)
from sentry.seer.seer_setup import has_seer_access
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


MAX_SEGMENTS_TO_SUMMARIZE = 100
SEER_REQUEST_SIZE_LOG_THRESHOLD = 1e5  # Threshold for logging large Seer requests.

SEER_START_TASK_ENDPOINT_PATH = "/v1/automation/summarize/replay/breadcrumbs/start"
SEER_POLL_STATE_ENDPOINT_PATH = "/v1/automation/summarize/replay/breadcrumbs/state"


class ReplaySummaryPermission(ProjectPermission):
    scope_map = {
        "GET": ["event:read", "event:write", "event:admin"],
        "POST": ["event:read", "event:write", "event:admin"],
        "PUT": [],
        "DELETE": [],
    }


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplaySummaryEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ReplaySummaryPermission,)

    def __init__(self, **kw) -> None:
        storage.initialize_client()
        self.sample_rate_post = options.get(
            "replay.endpoints.project_replay_summary.trace_sample_rate_post"
        )
        self.sample_rate_get = options.get(
            "replay.endpoints.project_replay_summary.trace_sample_rate_get"
        )
        super().__init__(**kw)

    def make_seer_request(self, path: str, post_body: dict[str, Any]) -> Response:
        """Make a POST request to a Seer endpoint with retry logic. Raises HTTPError and logs non-200 status codes."""
        data = json.dumps(post_body)

        if len(data) > SEER_REQUEST_SIZE_LOG_THRESHOLD:
            logger.warning(
                "Replay Summary: large Seer request.",
                extra={
                    "num_chars": len(data),
                    "threshold": SEER_REQUEST_SIZE_LOG_THRESHOLD,
                    "replay_id": post_body.get("replay_id"),
                    "organization_id": post_body.get("organization_id"),
                    "project_id": post_body.get("project_id"),
                },
            )

        try:
            response = make_signed_seer_api_request(
                connection_pool=seer_summarization_connection_pool,
                path=path,
                body=data.encode("utf-8"),
                timeout=getattr(settings, "SEER_DEFAULT_TIMEOUT", 5),
                retries=0,
            )
        except Exception:
            logger.exception(
                "Seer replay breadcrumbs summary endpoint failed after retries",
                extra={"path": path},
            )
            return self.respond("Internal Server Error", status=500)

        if response.status < 200 or response.status >= 300:
            logger.error(
                "Seer replay breadcrumbs summary endpoint failed",
                extra={
                    "path": path,
                    "status_code": response.status,
                    "response_data": response.data,
                },
            )
            return self.respond("Internal Server Error", status=500)

        # Note any headers in the Seer response aren't returned.
        return Response(data=response.json(), status=response.status)

    def has_replay_summary_access(self, project: Project, request: Request) -> bool:
        return (
            features.has("organizations:session-replay", project.organization, actor=request.user)
            and features.has(
                "organizations:replay-ai-summaries", project.organization, actor=request.user
            )
            and has_seer_access(project.organization, actor=request.user)
        )

    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        """Poll for the status of a replay summary task in Seer."""

        with sentry_sdk.start_transaction(
            name="replays.endpoints.project_replay_summary.get",
            op="replays.endpoints.project_replay_summary.get",
            custom_sampling_context={"sample_rate": self.sample_rate_get},
        ):

            if not self.has_replay_summary_access(project, request):
                return self.respond(
                    {"detail": "Replay summaries are not available for this organization."},
                    status=403,
                )

            # We skip checking Seer permissions here for performance, and because summaries can't be created without them anyway.

            # Request Seer for the state of the summary task.
            return self.make_seer_request(
                SEER_POLL_STATE_ENDPOINT_PATH,
                {
                    "replay_id": replay_id,
                },
            )

    def post(self, request: Request, project: Project, replay_id: str) -> Response:
        """Download replay segment data and parse it into logs. Then post to Seer to start a summary task."""

        with sentry_sdk.start_transaction(
            name="replays.endpoints.project_replay_summary.post",
            op="replays.endpoints.project_replay_summary.post",
            custom_sampling_context={"sample_rate": self.sample_rate_post},
        ):

            if not self.has_replay_summary_access(project, request):
                return self.respond(
                    {"detail": "Replay summaries are not available for this organization."},
                    status=403,
                )

            num_segments = request.data.get("num_segments", 0)
            temperature = request.data.get("temperature", None)
            start, end = default_start_end_dates()

            # Limit data with the frontend's segment count, to keep summaries consistent with the video displayed in the UI.
            # While the replay is live, the FE and BE may have different counts.
            if num_segments > MAX_SEGMENTS_TO_SUMMARIZE:
                logger.warning(
                    "Replay Summary: hit max segment limit.",
                    extra={
                        "replay_id": replay_id,
                        "project_id": project.id,
                        "organization_id": project.organization.id,
                        "segment_limit": MAX_SEGMENTS_TO_SUMMARIZE,
                    },
                )
                num_segments = MAX_SEGMENTS_TO_SUMMARIZE

            if features.has(
                "organizations:replay-ai-summaries-rpc", project.organization, actor=request.user
            ):
                snuba_response = query_replay_instance(
                    project_id=project.id,
                    replay_id=replay_id,
                    start=start,
                    end=end,
                    organization=project.organization,
                    request_user_id=request.user.id,
                )
                if not snuba_response:
                    return self.respond(
                        {"detail": "Replay not found."},
                        status=404,
                    )

                return self.make_seer_request(
                    SEER_START_TASK_ENDPOINT_PATH,
                    {
                        "logs": [],
                        "use_rpc": True,
                        "num_segments": num_segments,
                        "replay_id": replay_id,
                        "organization_id": project.organization.id,
                        "project_id": project.id,
                        "temperature": temperature,
                    },
                )

            # Fetch the replay's error and trace IDs from the replay_id.
            snuba_response = query_replay_instance(
                project_id=project.id,
                replay_id=replay_id,
                start=start,
                end=end,
                organization=project.organization,
                request_user_id=request.user.id,
            )
            processed_response = process_raw_response(
                snuba_response,
                fields=[],  # Defaults to all fields.
            )

            if not processed_response:
                return self.respond(
                    {"detail": "Replay not found."},
                    status=404,
                )

            error_ids = processed_response[0].get("error_ids", [])
            trace_ids = processed_response[0].get("trace_ids", [])

            result = get_replay_range(
                organization_id=project.organization.id, project_id=project.id, replay_id=replay_id
            )

            if result is not None:
                start, end = result

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
            # XXX: For now this is capped to 100 and blocking. DD shows no replays with >25 segments, but we should still stress test and figure out how to deal with large replays.
            segment_md = fetch_segments_metadata(project.id, replay_id, 0, num_segments)
            segment_data = iter_segment_data(segment_md)

            # Combine replay and error data and parse into logs.
            logs = get_summary_logs(segment_data, error_events, project.id)

            # Post to Seer to start a summary task.
            # XXX: Request isn't streaming. Limitation of Seer authentication. Would be much faster if we
            # could stream the request data since the GCS download will (likely) dominate latency.
            return self.make_seer_request(
                SEER_START_TASK_ENDPOINT_PATH,
                {
                    "logs": logs,
                    "num_segments": num_segments,
                    "replay_id": replay_id,
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "temperature": temperature,
                },
            )
