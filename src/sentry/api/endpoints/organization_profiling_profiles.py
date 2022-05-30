from abc import ABC, abstractmethod
from typing import Any, Dict

from django.http import StreamingHttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Organization
from sentry.utils.profiling import (
    get_from_profiling_service,
    parse_profile_filters,
    proxy_profiling_service,
)


class OrganizationProfilingBaseEndpoint(OrganizationEndpoint):  # type: ignore
    private = True

    def get_profiling_params(self, request: Request, organization: Organization) -> Dict[str, Any]:
        try:
            params: Dict[str, Any] = parse_profile_filters(request.query_params.get("query", ""))
        except InvalidSearchQuery as err:
            raise ParseError(detail=str(err))

        params.update(
            {
                key: value.isoformat() if key in {"start", "end"} else value
                for key, value in self.get_filter_params(request, organization).items()
            }
        )

        return params


class OrganizationProfilingPaginatedBaseEndpoint(OrganizationProfilingBaseEndpoint, ABC):
    profiling_feature = "organizations:profiling"

    @abstractmethod
    def get_data_fn(self, organization: Organization, kwargs: Dict[str, Any]) -> Any:
        raise NotImplementedError

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(self.profiling_feature, organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_profiling_params(request, organization)
        except NoProjects:
            return Response([])

        kwargs = {"params": params}
        if "Accept-Encoding" in request.headers:
            kwargs["headers"] = {"Accept-Encoding": request.headers.get("Accept-Encoding")}

        return self.paginate(
            request,
            paginator=GenericOffsetPaginator(data_fn=self.get_data_fn(organization, kwargs)),
            default_per_page=50,
            max_per_page=500,
        )


class OrganizationProfilingTransactionsEndpoint(OrganizationProfilingPaginatedBaseEndpoint):
    def get_data_fn(self, organization: Organization, kwargs: Dict[str, Any]) -> Any:
        def data_fn(offset: int, limit: int) -> Any:
            kwargs["params"]["offset"] = offset
            kwargs["params"]["limit"] = limit

            response = get_from_profiling_service(
                "GET",
                f"/organizations/{organization.id}/transactions",
                **kwargs,
            )

            return response.json().get("transactions", [])

        return data_fn


class OrganizationProfilingProfilesEndpoint(OrganizationProfilingPaginatedBaseEndpoint):
    def get_data_fn(self, organization: Organization, kwargs: Dict[str, Any]) -> Any:
        def data_fn(offset: int, limit: int) -> Any:
            kwargs["params"]["offset"] = offset
            kwargs["params"]["limit"] = limit

            response = get_from_profiling_service(
                "GET",
                f"/organizations/{organization.id}/profiles",
                **kwargs,
            )

            return response.json().get("profiles", [])

        return data_fn


class OrganizationProfilingFiltersEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> StreamingHttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_profiling_params(request, organization)
        except NoProjects:
            return Response([])

        kwargs = {"params": params}
        if "Accept-Encoding" in request.headers:
            kwargs["headers"] = {"Accept-Encoding": request.headers.get("Accept-Encoding")}

        return proxy_profiling_service("GET", f"/organizations/{organization.id}/filters", **kwargs)
