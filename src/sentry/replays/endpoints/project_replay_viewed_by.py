import uuid
from datetime import datetime
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import GlobalParams, ReplayParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.replays.query import query_replay_viewed_by_ids
from sentry.replays.usecases.events import publish_replay_event, viewed_event
from sentry.replays.usecases.query import execute_query, make_full_aggregation_query
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


class ReplayViewedByResponsePayload(TypedDict):
    viewed_by: list[dict[str, Any]]


class ReplayViewedByResponse(TypedDict):
    data: ReplayViewedByResponsePayload


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayViewedByEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "POST": ApiPublishStatus.PRIVATE}
    permission_classes = (ProjectEventPermission,)

    @extend_schema(
        operation_id="List Users Who Have Viewed a Replay",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
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
        """Return a list of users who have viewed a replay."""
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

        serialized_users = user_service.serialize_many(
            filter=dict(user_ids=viewed_by_ids, organization_id=project.organization.id),
            as_user=serialize_generic_user(request.user),
        )

        serialized_users = [_normalize_user(user) for user in serialized_users]

        return Response({"data": {"viewed_by": serialized_users}}, status=200)

    def post(self, request: Request, project: Project, replay_id: str) -> Response:
        """Create a replay-viewed event."""
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        try:
            replay_id = str(uuid.UUID(replay_id))
        except ValueError:
            return Response(status=404)

        user_orgs = user_service.get_organizations(user_id=request.user.id)
        if project.organization.id not in [org.id for org in user_orgs]:
            # If the user is not in the same organization as the replay, we don't need to do anything.
            return Response(status=204)

        # make a query to avoid overwriting the `finished_at` column
        filter_params = self.get_filter_params(request, project, date_filter_optional=False)
        finished_at_response = execute_query(
            query=make_full_aggregation_query(
                fields=["finished_at"],
                replay_ids=[replay_id],
                project_ids=[project.id],
                period_start=filter_params["start"],
                period_end=filter_params["end"],
                request_user_id=request.user.id,
            ),
            tenant_id={"organization_id": project.organization.id} if project.organization else {},
            referrer="replays.endpoints.viewed_by_post",
        )["data"]
        if not finished_at_response:
            return Response(status=404)

        finished_at = finished_at_response[0]["finished_at"]
        finished_at_ts = datetime.fromisoformat(finished_at).timestamp()

        message = viewed_event(
            project.id,
            replay_id,
            request.user.id,
            finished_at_ts,
        )
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
