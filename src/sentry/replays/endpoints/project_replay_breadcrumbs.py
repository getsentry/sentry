import uuid

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayBreadcrumbsEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

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
            request_user_id=request.user.id,
        )

        response = process_raw_response(
            snuba_response,
            fields=request.query_params.getlist("field"),
        )

        if len(response) == 0:
            return Response(status=404)
        else:
            return Response({"data": response[0]}, status=200)
