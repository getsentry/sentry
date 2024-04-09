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
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import GlobalParams, ReplayParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.replays.post_process import ReplayViewedByResponse
from sentry.replays.query import query_replay_viewed_by_ids
from sentry.replays.usecases.events import publish_replay_event, viewed_event
from sentry.services.hybrid_cloud.user.serial import serialize_generic_user
from sentry.services.hybrid_cloud.user.service import user_service


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
        ],
        responses={
            200: inline_sentry_response_serializer("GetReplayViewedBy", ReplayViewedByResponse),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_VIEWED_BY,
    )
    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        """Gets the users who have viewed the given replay. The result is a list of serialized Sentry user objects."""
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        try:
            uuid.UUID(replay_id)
        except ValueError:
            return Response(status=404)

        # query for user ids who viewed the replay
        filter_params = self.get_filter_params(request, project, date_filter_optional=False)

        # If no rows were found then the replay does not exist and a 404 is returned.
        viewed_by_ids_response: list[dict[str, Any]] = query_replay_viewed_by_ids(
            project_id=project.id,
            replay_id=replay_id,
            start=filter_params["start"],
            end=filter_params["end"],
            request_user_id=request.user.id,
            organization=project.organization,
        )
        if not viewed_by_ids_response:
            return Response(status=404)

        viewed_by_ids = viewed_by_ids_response[0]["viewed_by_ids"]
        if viewed_by_ids == []:
            return Response({"data": {"viewed_by": []}}, status=200)

        # Note: in the rare/error case where Snuba returns non-existent user ids, this fx will filter them out.
        serialized_users = user_service.serialize_many(
            filter=dict(user_ids=viewed_by_ids),
            as_user=serialize_generic_user(request.user),
        )
        serialized_users = [_normalize_user(user) for user in serialized_users]

        return Response({"data": {"viewed_by": serialized_users}}, status=200)

    @extend_schema(
        operation_id="Post that the requesting user has viewed a replay",
        parameters=[GlobalParams.ORG_SLUG, GlobalParams.PROJECT_SLUG, ReplayParams.REPLAY_ID],
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,
    )
    def post(self, request: Request, project: Project, replay_id: str) -> Response:
        """Publishes a replay_viewed event with the requesting user's id, for Snuba processing."""
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        try:
            replay_id = str(uuid.UUID(replay_id))
        except ValueError:
            return Response(status=404)

        message = viewed_event(project.id, replay_id, request.user.id)
        publish_replay_event(message, is_async=False)

        return Response(status=204)


def _normalize_user(user: dict[str, Any]) -> dict[str, Any]:
    """Return a normalized user dictionary.

    The viewed-by resource is expected to return a subset of the user_service's
    response output.
    """
    return {
        "avatar": {
            "avatarType": user["avatar"]["avatarType"],
            "avatarUuid": user["avatar"]["avatarUuid"],
            "avatarUrl": user["avatar"]["avatarUrl"],
        },
        "avatarUrl": user["avatarUrl"],
        "dateJoined": user["dateJoined"],
        "email": user["email"],
        "emails": [
            {
                "id": email["id"],
                "email": email["email"],
                "is_verified": email["is_verified"],
            }
            for email in user["emails"]
        ],
        "experiments": user["experiments"],
        "has2fa": user["has2fa"],
        "hasPasswordAuth": user["hasPasswordAuth"],
        "id": user["id"],
        "isActive": user["isActive"],
        "isManaged": user["isManaged"],
        "isStaff": user["isStaff"],
        "isSuperuser": user["isSuperuser"],
        "lastActive": user["lastActive"],
        "lastLogin": user["lastLogin"],
        "name": user["name"],
        "type": "user",
        "username": user["username"],
    }
