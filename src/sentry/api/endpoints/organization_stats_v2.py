from contextlib import contextmanager

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.search.utils import InvalidQuery
from sentry.snuba.outcomes import QueryDefinition, massage_outcomes_result, run_outcomes_query
from sentry.snuba.sessions_v2 import InvalidField, InvalidParams


class OrganizationStatsEndpointV2(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        with self.handle_query_errors():
            with sentry_sdk.start_span(op="outcomes.endpoint", description="build_outcomes_query"):
                query = self.build_outcomes_query(
                    request,
                    organization,
                )
            with sentry_sdk.start_span(op="outcomes.endpoint", description="run_outcomes_query"):
                result_totals, result_timeseries = run_outcomes_query(query)
            with sentry_sdk.start_span(
                op="outcomes.endpoint", description="massage_outcomes_result"
            ):
                result = massage_outcomes_result(query, result_totals, result_timeseries)
            return Response(result, status=200)

    def build_outcomes_query(self, request, organization):
        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            raise NoProjects("No projects available")

        return QueryDefinition(
            request.GET,
            params,
        )

    @contextmanager
    def handle_query_errors(self):
        try:
            # TODO: this context manager should be decoupled from `OrganizationEventsEndpointBase`?
            with super().handle_query_errors():
                yield
        except (InvalidField, NoProjects, InvalidParams, InvalidQuery) as error:
            raise ParseError(detail=str(error))
