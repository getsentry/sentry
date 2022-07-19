from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance


class ProjectReplayDetailsEndpoint(ProjectEndpoint):
    private = True

    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        snuba_response = query_replay_instance(
            project_id=project.id,
            replay_id=replay_id,
            stats_period=request.query_args.get("statsPeriod"),
        )

        response = process_raw_response(
            snuba_response,
            fields=request.query_params.getlist("field"),
        )

        return Response(response, status=200)
