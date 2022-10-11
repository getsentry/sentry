from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Sequence

from django.http import StreamingHttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint

# from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.snuba import calculate_time_frame
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Organization
from sentry.profiles.utils import (
    get_from_profiling_service,
    parse_profile_filters,
    proxy_profiling_service,
)
from sentry.utils import json
from sentry.utils.dates import get_interval_from_range, get_rollup_from_request, parse_stats_period


class OrganizationProfilingBaseEndpoint(OrganizationEventsV2EndpointBase):  # type: ignore
    private = True

    def get_profiling_params(self, request: Request, organization: Organization) -> Dict[str, Any]:
        try:
            params: Dict[str, Any] = parse_profile_filters(request.query_params.get("query", ""))
        except InvalidSearchQuery as err:
            raise ParseError(detail=str(err))

        params.update(self.get_filter_params(request, organization))

        return params

    def get_granularity(self, request: Request, params: Dict[str, Any]) -> int:
        try:
            return get_rollup_from_request(
                request,
                params,
                default_interval=None,
                error=InvalidSearchQuery(),
            )
        except InvalidSearchQuery:
            date_range = params["end"] - params["start"]
            stats_period = parse_stats_period(get_interval_from_range(date_range, False))
            return int(stats_period.total_seconds()) if stats_period is not None else 3600


class OrganizationProfilingPaginatedBaseEndpoint(OrganizationProfilingBaseEndpoint, ABC):
    profiling_feature = "organizations:profiling"

    @abstractmethod
    def get_data_fn(
        self, request: Request, organization: Organization, kwargs: Dict[str, Any]
    ) -> Any:
        raise NotImplementedError

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(self.profiling_feature, organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_profiling_params(request, organization)
        except NoProjects:
            return Response([])

        kwargs = {"params": params}

        return self.paginate(
            request,
            paginator=GenericOffsetPaginator(
                data_fn=self.get_data_fn(request, organization, kwargs)
            ),
            default_per_page=50,
            max_per_page=500,
        )


@region_silo_endpoint
class OrganizationProfilingTransactionsEndpoint(OrganizationProfilingPaginatedBaseEndpoint):
    def get_data_fn(
        self, request: Request, organization: Organization, kwargs: Dict[str, Any]
    ) -> Any:
        def data_fn(offset: int, limit: int) -> Any:
            sort = request.query_params.get("sort", None)
            if sort is None:
                raise ParseError(detail="Invalid query: Missing value for sort")
            kwargs["params"]["sort"] = sort

            kwargs["params"]["offset"] = offset
            kwargs["params"]["limit"] = limit

            response = get_from_profiling_service(
                "GET",
                f"/organizations/{organization.id}/transactions",
                **kwargs,
            )
            data = json.loads(response.data)

            return data.get("transactions", [])

        return data_fn


@region_silo_endpoint
class OrganizationProfilingProfilesEndpoint(OrganizationProfilingPaginatedBaseEndpoint):
    def get_data_fn(
        self, request: Request, organization: Organization, kwargs: Dict[str, Any]
    ) -> Any:
        def data_fn(offset: int, limit: int) -> Any:
            kwargs["params"]["offset"] = offset
            kwargs["params"]["limit"] = limit

            response = get_from_profiling_service(
                "GET",
                f"/organizations/{organization.id}/profiles",
                **kwargs,
            )
            data = json.loads(response.data)

            return data.get("profiles", [])

        return data_fn


@region_silo_endpoint
class OrganizationProfilingFiltersEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> StreamingHttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_profiling_params(request, organization)
        except NoProjects:
            return Response([])

        kwargs = {"params": params}

        return proxy_profiling_service("GET", f"/organizations/{organization.id}/filters", **kwargs)


@region_silo_endpoint
class OrganizationProfilingStatsEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> StreamingHttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_profiling_params(request, organization)
        except NoProjects:
            # even when there are no projects, we should at least return a response
            # of the same shape
            start, end = get_date_range_from_params(request.GET)
            rollup = self.get_granularity(request, {"start": start, "end": end})
            return Response(
                {
                    "data": [],
                    "meta": {
                        "dataset": "profiles",
                        **calculate_time_frame(start, end, rollup),
                    },
                    "timestamps": [],
                }
            )

        kwargs = {"params": params}

        return proxy_profiling_service("GET", f"/organizations/{organization.id}/stats", **kwargs)

    def get_filter_params(
        self,
        request: Request,
        organization: Organization,
        date_filter_optional: bool = False,
        project_ids: Optional[Sequence[int]] = None,
    ) -> Dict[str, Any]:
        params = super().get_filter_params(
            request,
            organization,
            date_filter_optional=date_filter_optional,
            project_ids=project_ids,
        )
        params["granularity"] = self.get_granularity(request, params)
        return params
