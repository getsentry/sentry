from contextlib import contextmanager

import sentry_sdk
from django.utils.datastructures import MultiValueDict
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, release_health
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.snuba.sessions_v2 import AllowedResolution, InvalidField, InvalidParams, QueryDefinition


# NOTE: this currently extends `OrganizationEventsEndpointBase` for `handle_query_errors` only, which should ideally be decoupled from the base class.
class OrganizationSessionsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request: Request, organization) -> Response:
        with self.handle_query_errors():
            with sentry_sdk.start_span(op="sessions.endpoint", description="build_sessions_query"):
                query = self.build_sessions_query(request, organization)

            result = release_health.run_sessions_query(
                organization.id, query, span_op="sessions.endpoint"
            )

        return Response(result, status=200)

    def build_sessions_query(self, request: Request, organization):
        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            raise NoProjects("No projects available")  # give it a description

        # HACK to prevent front-end crash when release health is sessions-based:
        query_params = MultiValueDict(request.GET)
        if not release_health.is_metrics_based() and request.GET.get("interval") == "10s":
            query_params["interval"] = "1m"

        if release_health.is_metrics_based():
            allowed_resolution = AllowedResolution.ten_seconds
        elif features.has(
            "organizations:minute-resolution-sessions", organization, actor=request.user
        ):
            allowed_resolution = AllowedResolution.one_minute
        else:
            allowed_resolution = AllowedResolution.one_hour

        return QueryDefinition(query_params, params, allowed_resolution=allowed_resolution)

    @contextmanager
    def handle_query_errors(self):
        try:
            # TODO: this context manager should be decoupled from `OrganizationEventsEndpointBase`?
            with super().handle_query_errors():
                yield
        except (InvalidField, InvalidParams, NoProjects) as error:
            raise ParseError(detail=str(error))
