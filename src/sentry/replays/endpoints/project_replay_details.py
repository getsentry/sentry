from django.http import StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.replays.utils import proxy_replays_service


class ProjectReplayDetailsEndpoint(ProjectEndpoint):
    private = True

    def get(self, request: Request, project: Project, replay_id: str) -> StreamingHttpResponse:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        return proxy_replays_service("GET", f"/api/v1/projects/{project.id}/replays/{replay_id}")
