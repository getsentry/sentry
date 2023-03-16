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
