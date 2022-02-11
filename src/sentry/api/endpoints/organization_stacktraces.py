from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.http import safe_urlopen

STACKTRACE_FILTERS = [
    "android_api_level",
    "device_classification",
    "device_locale",
    "device_manufacturer",
    "device_model",
    "device_os_build_number",
    "device_os_name",
    "device_os_version",
    "error_code",
    "transaction_name",
    "version",
]


class OrganizationStacktracesEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization) -> Response:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        params = {p: request.params[p] for p in STACKTRACE_FILTERS if p in request.params}
        projects = self.get_projects(request, organization)

        if len(projects) > 0:
            params["project_id"] = [p.id for p in projects]

        return safe_urlopen(
            f"{settings.SENTRY_PROFILING_SERVICE_URL}/organizations/{organization.id}/stacktraces",
            method="GET",
            params=params,
        )


class OrganizationStacktraceFiltersEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization) -> Response:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        params = {}
        projects = self.get_projects(request, organization)

        if len(projects) > 0:
            params["project_id"] = [p.id for p in projects]

        return safe_urlopen(
            f"{settings.SENTRY_PROFILING_SERVICE_URL}/organizations/{organization.id}/stacktrace_filters",
            method="GET",
            params=params,
        )
