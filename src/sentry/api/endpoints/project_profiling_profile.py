from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.utils.profiling import proxy_profiling_service


class ProjectProfilingProfileEndpoint(ProjectEndpoint):
    def get(self, request: Request, project, transaction_id: str) -> Response:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        return proxy_profiling_service("GET", f"/projects/{project.id}/profiles/{transaction_id}")
