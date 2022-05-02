from typing import Any, Dict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.utils.profiling import proxy_profiling_service


class ProjectProfilingProfileEndpoint(ProjectEndpoint):
    def get(self, request: Request, project, profile_id: str) -> Response:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        kwargs: Dict[str, Any] = {
            "method": "GET",
            "path": f"/organizations/{project.organization.id}/projects/{project.id}/profiles/{profile_id}",
        }
        if "Accept-Encoding" in request.headers:
            kwargs["headers"] = {"Accept-Encoding": request.headers.get("Accept-Encoding")}
        return proxy_profiling_service(**kwargs)
