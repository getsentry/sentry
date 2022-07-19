from typing import Any, Dict

from django.http import StreamingHttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project
from sentry.utils.profiling import parse_profile_filters, proxy_profiling_service


class ProjectProfilingBaseEndpoint(ProjectEndpoint):  # type: ignore
    private = True

    def get_profiling_params(self, request: Request, project: Project) -> Dict[str, Any]:
        try:
            params: Dict[str, Any] = parse_profile_filters(request.query_params.get("query", ""))
        except InvalidSearchQuery as err:
            raise ParseError(detail=str(err))

        params.update(
            {
                key: value.isoformat() if key in {"start", "end"} else value
                for key, value in self.get_filter_params(request, project).items()
            }
        )

        return params


class ProjectProfilingTransactionIDProfileIDEndpoint(ProjectProfilingBaseEndpoint):
    def get(self, request: Request, project: Project, transaction_id: str) -> StreamingHttpResponse:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        kwargs: Dict[str, Any] = {
            "method": "GET",
            "path": f"/organizations/{project.organization.id}/projects/{project.id}/transactions/{transaction_id}",
        }
        if "Accept-Encoding" in request.headers:
            kwargs["headers"] = {"Accept-Encoding": request.headers.get("Accept-Encoding")}
        return proxy_profiling_service(**kwargs)


class ProjectProfilingProfileEndpoint(ProjectProfilingBaseEndpoint):
    def get(self, request: Request, project: Project, profile_id: str) -> StreamingHttpResponse:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        kwargs: Dict[str, Any] = {
            "method": "GET",
            "path": f"/organizations/{project.organization.id}/projects/{project.id}/profiles/{profile_id}",
        }
        if "Accept-Encoding" in request.headers:
            kwargs["headers"] = {"Accept-Encoding": request.headers.get("Accept-Encoding")}
        return proxy_profiling_service(**kwargs)


class ProjectProfilingFunctionsEndpoint(ProjectProfilingBaseEndpoint):
    def get(self, request: Request, project: Project) -> StreamingHttpResponse:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(404)

        params = self.get_profiling_params(request, project)

        headers = {}

        if "Accept-Encoding" in request.headers:
            headers["Accept-Encoding"] = request.headers.get("Accept-Encoding")

        return proxy_profiling_service(
            "GET",
            f"/organizations/{project.organization.id}/projects/{project.id}/functions_versions",
            params=params,
            headers=headers,
        )
