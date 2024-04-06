import time
import uuid
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_SUCCESS,
)
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import GlobalParams, ReplayParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.replays.post_process import ReplayViewedByResponse, generate_viewed_by_response
from sentry.replays.query import query_replay_viewed_by_ids
from sentry.utils import json


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayViewedByEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "POST": ApiPublishStatus.PUBLIC}

    @extend_schema(
        operation_id="Get list of user who have viewed a replay",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ReplayParams.REPLAY_ID,
        ],  # TODO: use ReplayValidator?
        responses={
            200: inline_sentry_response_serializer("GetReplayViewedBy", ReplayViewedByResponse),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_VIEWED_BY,
    )
    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        try:
            replay_id = str(uuid.UUID(replay_id))
        except ValueError:
            return Response(status=404)

        # query for user ids who viewed the replay
        filter_params = self.get_filter_params(request, project, date_filter_optional=False)
        viewed_by_ids: list[int] = query_replay_viewed_by_ids(
            project_id=project.id,
            replay_id=replay_id,
            start=filter_params["start"],
            end=filter_params["end"],
            organization=project.organization,
        )

        # query + serialize the User objects from postgres
        response = generate_viewed_by_response(
            replay_id=replay_id, viewed_by_ids=viewed_by_ids, request_user=request.user
        )
        return Response({"data": response}, status=200)

    @extend_schema(
        operation_id="Post that the requesting user has viewed a replay",
        parameters=[GlobalParams.ORG_SLUG, GlobalParams.PROJECT_SLUG, ReplayParams.REPLAY_ID],
        responses={
            200: RESPONSE_SUCCESS,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,
    )
    def post(self, request: Request, project: Project, replay_id: str) -> Response:
        """Publishes a replay_viewed event for Snuba processing."""
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        try:
            replay_id = str(uuid.UUID(replay_id))
        except ValueError:
            return Response(status=404)

        publisher = initialize_replays_publisher(is_async=False)
        ts: float = time.time()

        payload: dict[str, Any] = {
            "type": "replay_viewed",
            "viewed_by_id": request.user.id,
            "timestamp": ts,
        }
        publisher.publish(
            "ingest-replay-events",
            json.dumps(
                {
                    "type": "replay_event",
                    "start_time": int(ts),
                    "replay_id": replay_id,
                    "project_id": project.id,
                    "segment_id": None,
                    "retention_days": 30,
                    "payload": list(json.dumps(payload).encode()),
                }
            ),
        )

        return Response(status=200)
