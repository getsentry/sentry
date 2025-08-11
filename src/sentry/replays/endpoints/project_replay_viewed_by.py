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
from sentry.replays.usecases.events import publish_replay_event, viewed_event
from sentry.replays.usecases.replay import get_replay
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

        replay = get_replay(
            project_ids=[project.id],
            replay_id=replay_id,
            timestamp_start=filter_params["start"],
            timestamp_stop=filter_params["end"],
            fields={"viewed_by_ids"},
            requesting_user_id=request.user.id,
            referrer="project.replay_viewed_by.details",
            tenant_ids={"organization_id": project.organization_id},
        )
        if not replay:
            return Response(status=404)

        serialized_users = user_service.serialize_many(
            filter=dict(user_ids=replay["viewed_by_ids"], organization_id=project.organization.id),
            as_user=serialize_generic_user(request.user),
        )

        serialized_users = [_normalize_user(user) for user in serialized_users]

        return Response({"data": {"viewed_by": serialized_users}}, status=200)

    def post(self, request: Request, project: Project, replay_id: str) -> Response:
        """Create a replay-viewed event."""
        if not request.user.is_authenticated:
            return Response(status=400)

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

        replay = get_replay(
            project_ids=[project.id],
            replay_id=replay_id,
            timestamp_start=filter_params["start"],
            timestamp_stop=filter_params["end"],
            requesting_user_id=request.user.id,
            fields={"finished_at"},
            referrer="project.replay.viewed_by.create",
            tenant_ids={"organization_id": project.organization_id},
        )
        if not replay:
            return Response(status=404)

        finished_at = replay["finished_at"]
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
