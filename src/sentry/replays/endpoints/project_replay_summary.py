import logging
from datetime import datetime
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
from sentry.api.bases.project import ProjectPermission
from sentry.api.utils import default_start_end_dates
from sentry.models.project import Project
from sentry.replays.endpoints.project_replay_endpoint import ProjectReplayEndpoint
from sentry.replays.lib.seer_api import seer_summarization_connection_pool
from sentry.replays.lib.storage import storage
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance
from sentry.seer.seer_setup import has_seer_access
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json

logger = logging.getLogger(__name__)


MAX_SEGMENTS_TO_SUMMARIZE = 150
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
class ProjectReplaySummaryEndpoint(ProjectReplayEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ReplaySummaryPermission,)

    def __init__(self, **kw) -> None:
        storage.initialize_client()
        # Trace sample rates for each method. Uses the default when not set (=0).
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
            custom_sampling_context=(
                {"sample_rate": self.sample_rate_get} if self.sample_rate_get else None
            ),
        ):
            self.check_replay_access(request, project)

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
            custom_sampling_context=(
                {"sample_rate": self.sample_rate_post} if self.sample_rate_post else None
            ),
        ):
            self.check_replay_access(request, project)

            if not self.has_replay_summary_access(project, request):
                return self.respond(
                    {"detail": "Replay summaries are not available for this organization."},
                    status=403,
                )

            # We use the frontend's segment count to keep summaries consistent with the video displayed in the UI.
            num_segments = request.data.get("num_segments", 0)
            temperature = request.data.get("temperature", None)

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
                        "num_segments": num_segments,
                    },
                )
                num_segments = MAX_SEGMENTS_TO_SUMMARIZE

            # Query for replay existence and start/end times, to prevent spawning a Seer task and DB entry for non-existent replays.
            start, end = default_start_end_dates()  # Query last 90d.
            snuba_response = query_replay_instance(
                project_id=project.id,
                replay_id=replay_id,
                start=start,
                end=end,
                organization=project.organization,
            )
            if not snuba_response:
                return self.respond(
                    {"detail": "Replay not found."},
                    status=404,
                )

            # Extract start and end times from the replay (pass None if missing or invalid).
            replay = process_raw_response(snuba_response, fields=[])[0]

            def validate_iso_timestamp(timestamp: str | None) -> str | None:
                """Validate that timestamp is a valid ISO format string, return None if invalid."""
                if not timestamp:
                    return None
                try:
                    datetime.fromisoformat(timestamp)
                    return timestamp
                except (ValueError, TypeError):
                    return None

            replay_start = validate_iso_timestamp(replay.get("started_at"))
            replay_end = validate_iso_timestamp(replay.get("finished_at"))

            if not replay_start or not replay_end:
                logger.warning(
                    "Replay start or end time missing or invalid.",
                    extra={
                        "started_at": replay.get("started_at"),
                        "finished_at": replay.get("finished_at"),
                        "replay_id": replay_id,
                        "organization_id": project.organization.id,
                    },
                )

            return self.make_seer_request(
                SEER_START_TASK_ENDPOINT_PATH,
                {
                    "replay_id": replay_id,
                    "replay_start": replay_start,
                    "replay_end": replay_end,
                    "num_segments": num_segments,
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "temperature": temperature,
                },
            )
