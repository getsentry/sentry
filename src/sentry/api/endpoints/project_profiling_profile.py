from abc import ABC, abstractmethod
from typing import Any, Dict

from django.http import StreamingHttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project
from sentry.profiles.utils import (
    get_from_profiling_service,
    parse_profile_filters,
    proxy_profiling_service,
)
from sentry.utils import json


class ProjectProfilingBaseEndpoint(ProjectEndpoint):  # type: ignore
    private = True

    def get_profiling_params(self, request: Request, project: Project) -> Dict[str, Any]:
        try:
            params: Dict[str, Any] = parse_profile_filters(request.query_params.get("query", ""))
        except InvalidSearchQuery as err:
            raise ParseError(detail=str(err))

        params.update(self.get_filter_params(request, project))

        return params


class ProjectProfilingPaginatedBaseEndpoint(ProjectProfilingBaseEndpoint, ABC):
    DEFAULT_PER_PAGE = 50
    MAX_PER_PAGE = 500

    @abstractmethod
    def get_data_fn(self, request: Request, project: Project, kwargs: Dict[str, Any]) -> Any:
        raise NotImplementedError

    def get_on_result(self) -> Any:
        return None

    def get(self, request: Request, project: Project) -> Response:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(404)

        params = self.get_profiling_params(request, project)

        kwargs = {"params": params}

        return self.paginate(
            request,
            paginator=GenericOffsetPaginator(data_fn=self.get_data_fn(request, project, kwargs)),
            default_per_page=self.DEFAULT_PER_PAGE,
            max_per_page=self.MAX_PER_PAGE,
            on_results=self.get_on_result(),
        )


@region_silo_endpoint
class ProjectProfilingTransactionIDProfileIDEndpoint(ProjectProfilingBaseEndpoint):
    def get(self, request: Request, project: Project, transaction_id: str) -> StreamingHttpResponse:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        kwargs: Dict[str, Any] = {
            "method": "GET",
            "path": f"/organizations/{project.organization.id}/projects/{project.id}/transactions/{transaction_id}",
        }
        return proxy_profiling_service(**kwargs)


@region_silo_endpoint
class ProjectProfilingProfileEndpoint(ProjectProfilingBaseEndpoint):
    def get(self, request: Request, project: Project, profile_id: str) -> StreamingHttpResponse:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        kwargs: Dict[str, Any] = {
            "method": "GET",
            "path": f"/organizations/{project.organization.id}/projects/{project.id}/profiles/{profile_id}",
        }
        return proxy_profiling_service(**kwargs)


@region_silo_endpoint
class ProjectProfilingRawProfileEndpoint(ProjectProfilingBaseEndpoint):
    def get(self, request: Request, project: Project, profile_id: str) -> StreamingHttpResponse:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        kwargs: Dict[str, Any] = {
            "method": "GET",
            "path": f"/organizations/{project.organization.id}/projects/{project.id}/raw_profiles/{profile_id}",
        }
        return proxy_profiling_service(**kwargs)


@region_silo_endpoint
class ProjectProfilingFunctionsEndpoint(ProjectProfilingPaginatedBaseEndpoint):
    DEFAULT_PER_PAGE = 5
    MAX_PER_PAGE = 50

    def get_data_fn(self, request: Request, project: Project, kwargs: Dict[str, Any]) -> Any:
        def data_fn(offset: int, limit: int) -> Any:
            is_application = request.query_params.get("is_application", None)
            if is_application is not None:
                if is_application == "1":
                    kwargs["params"]["is_application"] = "1"
                elif is_application == "0":
                    kwargs["params"]["is_application"] = "0"
                else:
                    raise ParseError(detail="Invalid query: Illegal value for is_application")

            sort = request.query_params.get("sort", None)
            if sort is None:
                raise ParseError(detail="Invalid query: Missing value for sort")
            kwargs["params"]["sort"] = sort

            kwargs["params"]["offset"] = offset
            kwargs["params"]["limit"] = limit

            response = get_from_profiling_service(
                "GET",
                f"/organizations/{project.organization.id}/projects/{project.id}/functions",
                **kwargs,
            )

            data = json.loads(response.data)

            return data.get("functions", [])

        return data_fn

    def get_on_result(self) -> Any:
        return lambda results: {"functions": results}
