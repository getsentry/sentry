from contextlib import contextmanager

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.snuba.sessions_v2 import (
    InvalidField,
    InvalidParams,
    QueryDefinition,
    massage_sessions_result,
    run_sessions_query,
)


# NOTE: this currently extends `OrganizationEventsEndpointBase` for `handle_query_errors` only, which should ideally be decoupled from the base class.
class OrganizationSessionsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        with self.handle_query_errors():
            with sentry_sdk.start_span(op="sessions.endpoint", description="build_sessions_query"):
                query = self.build_sessions_query(request, organization)

            with sentry_sdk.start_span(op="sessions.endpoint", description="run_sessions_query"):
                result_totals, result_timeseries = run_sessions_query(query)

            with sentry_sdk.start_span(
                op="sessions.endpoint", description="massage_sessions_result"
            ):
                result = massage_sessions_result(query, result_totals, result_timeseries)
            return Response(result, status=200)

    def build_sessions_query(self, request, organization):
        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            raise NoProjects("No projects available")  # give it a description

        allow_minute_resolution = features.has(
            "organizations:minute-resolution-sessions", organization, actor=request.user
        )
        return QueryDefinition(request.GET, params, allow_minute_resolution=allow_minute_resolution)

    @contextmanager
    def handle_query_errors(self):
        try:
            # TODO: this context manager should be decoupled from `OrganizationEventsEndpointBase`?
            with super().handle_query_errors():
                yield
        except (InvalidField, InvalidParams, NoProjects) as error:
            raise ParseError(detail=str(error))
