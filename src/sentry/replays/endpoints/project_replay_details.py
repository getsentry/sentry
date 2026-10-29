import uuid

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import GlobalParams, ReplayParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.replays.endpoints.organization_replay_details import GetReplayResponse
from sentry.replays.endpoints.project_replay_endpoint import ProjectReplayEndpoint
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance
from sentry.replays.tasks import delete_replay
from sentry.replays.usecases.reader import has_archived_segment
from sentry.replays.validators import validate_fields


class ReplayDetailsPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:write", "project:admin"],
    }


@cell_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayDetailsEndpoint(ProjectReplayEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (ReplayDetailsPermission,)

    @extend_schema(
        operation_id="getProjectReplay",
        summary="Retrieve a Project's Replay Instance",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReplayParams.REPLAY_ID,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            ReplayParams.FIELD,
        ],
        responses={
            200: inline_sentry_response_serializer("GetProjectReplay", GetReplayResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_DETAILS,
    )
    def get(
        self, request: Request, project: Project, replay_id: str
    ) -> Response[GetReplayResponse]:
        """
        Return details on an individual replay within a project.
        """
        self.check_replay_access(request, project)
        fields = validate_fields(request.query_params.getlist("field"))

        filter_params = self.get_filter_params(request, project)

        replay_id = str(uuid.UUID(replay_id))

        with handle_query_errors():
            snuba_response = query_replay_instance(
                project_id=project.id,
                replay_id=replay_id,
                start=filter_params["start"],
                end=filter_params["end"],
                organization=project.organization,
                request_user_id=request.user.user_id,
            )

        replay_data = process_raw_response(
            snuba_response,
            fields=fields,
        )

        if len(replay_data) == 0:
            return Response(status=404)
        else:
            return Response({"data": replay_data[0]}, status=200)

    @extend_schema(
        operation_id="deleteProjectReplay",
        summary="Delete a Replay Instance",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReplayParams.REPLAY_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,
    )
    def delete(self, request: Request, project: Project, replay_id: str) -> Response[None]:
        """
        Delete a replay.
        """
        self.check_replay_access(request, project)

        with handle_query_errors():
            is_archived = has_archived_segment(project.id, replay_id)
        if is_archived:
            return Response(status=404)

        # We don't check Seer features because an org may have previously had them on, then turned them off.
        has_seer_data = features.has("organizations:replay-ai-summaries", project.organization)
        organization_id = project.organization.id

        delete_replay.delay(
            organization_id=organization_id,
            project_id=project.id,
            replay_id=replay_id,
            has_seer_data=has_seer_data,
        )

        return Response(status=204)
