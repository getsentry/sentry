from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models import Organization
from sentry.utils.profiling import get_from_profiling_service, proxy_profiling_service

PROFILE_FILTERS = [
    "android_api_level",
    "device_classification",
    "device_locale",
    "device_manufacturer",
    "device_model",
    "device_os_build_number",
    "device_os_name",
    "device_os_version",
    "environment",
    "error_code",
    "statsPeriod",
    "transaction_name",
    "version",
]


class OrganizationProfilingProfilesEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        params = {
            p: request.query_params.getlist(p) for p in PROFILE_FILTERS if p in request.query_params
        }
        projects = self.get_projects(request, organization)

        if len(projects) > 0:
            params["project"] = [p.id for p in projects]

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

        params = {}
        projects = self.get_projects(request, organization)

        if len(projects) > 0:
            params["project"] = [p.id for p in projects]

        return proxy_profiling_service(
            "GET", f"/organizations/{organization.id}/filters", params=params
        )
