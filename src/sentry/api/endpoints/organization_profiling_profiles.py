from typing import Any, Dict

from django.http import HttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint

# from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Organization
from sentry.profiles.flamegraph import get_profiles_id
from sentry.profiles.utils import parse_profile_filters, proxy_profiling_service


class OrganizationProfilingBaseEndpoint(OrganizationEventsV2EndpointBase):  # type: ignore
    def get_profiling_params(self, request: Request, organization: Organization) -> Dict[str, Any]:
        try:
            params: Dict[str, Any] = parse_profile_filters(request.query_params.get("query", ""))
        except InvalidSearchQuery as err:
            raise ParseError(detail=str(err))

        params.update(self.get_filter_params(request, organization))

        return params


@region_silo_endpoint
class OrganizationProfilingFiltersEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_profiling_params(request, organization)
        except NoProjects:
            return Response([])

        kwargs = {"params": params}

        return proxy_profiling_service("GET", f"/organizations/{organization.id}/filters", **kwargs)


@region_silo_endpoint
class OrganizationProfilingFlamegraphEndpoint(OrganizationProfilingBaseEndpoint):
    def get(self, request: Request, organization: Organization) -> HttpResponse:
        if not features.has("organizations:profiling", organization, actor=request.user):
            return Response(status=404)

        params = self.get_snuba_params(request, organization, check_global_views=False)
        project_ids = params["project_id"]
        if len(project_ids) > 1:
            raise ParseError(detail="You cannot get a flamegraph from multiple projects.")
        profile_ids = get_profiles_id(params, request.query_params.get("query", None))
        kwargs: Dict[str, Any] = {
            "method": "POST",
            "path": f"/organizations/{organization.id}/projects/{project_ids[0]}/flamegraph",
            "json_data": profile_ids,
        }
        return proxy_profiling_service(**kwargs)
