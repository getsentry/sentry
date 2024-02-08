import uuid

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.apidocs.constants import RESPONSE_NO_CONTENT, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams, ReplayParams
from sentry.models.project import Project
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance
from sentry.replays.tasks import delete_recording_segments
from sentry.replays.usecases.reader import has_archived_segment


class ReplayDetailsPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:read", "project:write", "project:admin"],
    }


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (ReplayDetailsPermission,)

    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        filter_params = self.get_filter_params(request, project)

        try:
            replay_id = str(uuid.UUID(replay_id))
        except ValueError:
            return Response(status=404)

        snuba_response = query_replay_instance(
            project_id=project.id,
            replay_id=replay_id,
            start=filter_params["start"],
            end=filter_params["end"],
            organization=project.organization,
        )

        response = process_raw_response(
            snuba_response,
            fields=request.query_params.getlist("field"),
        )

        if len(response) == 0:
            return Response(status=404)
        else:
            return Response({"data": response[0]}, status=200)

    @extend_schema(
        operation_id="Delete a Replay Instance",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ReplayParams.REPLAY_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,
    )
    def delete(self, request: Request, project: Project, replay_id: str) -> Response:
        """
        Delete a replay
        """

        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        if has_archived_segment(project.id, replay_id):
            return Response(status=404)

        delete_recording_segments.delay(project_id=project.id, replay_id=replay_id)
        return Response(status=204)
