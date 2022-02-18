from typing import Any

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.http import safe_urlopen
from sentry.models import Organization

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
    "project",
    "statsPeriod",
    "transaction_name",
    "version",
]


class OrganizationProfilingProfilesEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        def data_fn(offset: int, limit: int) -> Any:
            params = {
                p: request.query_params.getlist(p)
                for p in PROFILE_FILTERS
                if p in request.query_params
            }
            params["offset"] = offset
            params["limit"] = limit
            response = safe_urlopen(
                f"{settings.SENTRY_PROFILING_SERVICE_URL}/organizations/{organization.id}/profiles",
                method="GET",
                params=params,
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
            params["project_id"] = [p.id for p in projects]

        response = safe_urlopen(
            f"{settings.SENTRY_PROFILING_SERVICE_URL}/organizations/{organization.id}/filters",
            method="GET",
            params=params,
        )
        return Response(response.json(), status=200)
