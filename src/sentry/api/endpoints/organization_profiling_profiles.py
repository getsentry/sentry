from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Organization
from sentry.utils.profiling import (
    get_from_profiling_service,
    parse_profile_filters,
    proxy_profiling_service,
)


class OrganizationProfilingProfilesEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        try:
            params = parse_profile_filters(request.query_params.get("query", ""))
        except InvalidSearchQuery as err:
            return Response(str(err), status=400)

        params.update(
            {
                key: value.isoformat() if key in {"start", "end"} else value
                for key, value in self.get_filter_params(request, organization).items()
            }
        )

        def data_fn(offset: int, limit: int) -> Any:
            params["offset"] = offset
            params["limit"] = limit
            response = get_from_profiling_service(
                "GET", f"/organizations/{organization.id}/profiles", params=params
            )
            return response.json().get("profiles", [])

        return self.paginate(
            request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            default_per_page=50,
            max_per_page=500,
        )


class OrganizationProfilingFiltersEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        try:
            params = parse_profile_filters(request.query_params.get("query", ""))
        except InvalidSearchQuery as err:
            return Response(str(err), status=400)

        params.update(
            {
                key: value.isoformat() if key in {"start", "end"} else value
                for key, value in self.get_filter_params(request, organization).items()
            }
        )

        return proxy_profiling_service(
            "GET", f"/organizations/{organization.id}/filters", params=params
        )
