from rest_framework.response import Response
from sentry.snuba.outcomes import (
    run_outcomes_query,
    QueryDefinition,
    InvalidField,
    massage_outcomes_result,
)

from rest_framework.exceptions import ParseError
from sentry.api.bases import OrganizationEventsEndpointBase, NoProjects
from sentry.api.utils import InvalidParams
from sentry.search.utils import InvalidQuery
from contextlib import contextmanager
import sentry_sdk


# TODO: see if there's a better way to do parameter validation, or just not?
VALID_PARAMETERS = {
    "project",
    "statsPeriod",
    "interval",
    "field",
    "start",
    "end",
    "outcome",
    "category",
    "reason",
    "groupBy",
    # "key_id", # TODO: add functionality for key_id
}


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
            with sentry_sdk.start_span(op="sessions.endpoint", description="run_sessions_query"):
                result = massage_outcomes_result(query, result_totals, result_timeseries)
            return Response(result, status=200)

    def build_outcomes_query(self, request, organization):
        for param in request.GET:
            if param not in VALID_PARAMETERS:
                raise InvalidParams(f'Invalid parameter: "{param}"')
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
