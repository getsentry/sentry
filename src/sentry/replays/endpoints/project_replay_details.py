import uuid

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
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
from sentry.replays.post_process import ReplayDetailsResponse, process_raw_response
from sentry.replays.query import query_replay_instance
from sentry.replays.tasks import delete_recording_segments
from sentry.replays.usecases.reader import has_archived_segment
from sentry.replays.validators import ReplayValidator


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
    """
    The same data as OrganizationReplayDetailsEndpoint, except project is required.
    Query for a specific replay to fetch or to deleted.
    """

    owner = ApiOwner.REPLAY
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
    }

    permission_classes = (ReplayDetailsPermission,)

    @extend_schema(
        operation_id="Retrieve a Replay Instance",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ReplayParams.REPLAY_ID,
            ReplayValidator,
        ],
        responses={
            200: inline_sentry_response_serializer("GetReplay", ReplayDetailsResponse),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_DETAILS,
    )
    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        """
        Return details on an individual replay within a project.
        """

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
        operation_id="Retrieve a Replay Instance",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ReplayParams.REPLAY_ID,
            ReplayValidator,
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
