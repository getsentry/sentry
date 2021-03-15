from rest_framework.response import Response
from sentry.snuba.outcomes import (
    run_outcomes_query,
    QueryDefinition,
    massage_outcomes_result,
    InvalidField,
)

from rest_framework.exceptions import ParseError
from sentry.api.bases import OrganizationEventsEndpointBase, NoProjects
from sentry.api.utils import InvalidParams

from contextlib import contextmanager


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
}


class OrganizationStatsEndpointV2(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        with self.handle_query_errors():
            query = self.build_outcomes_query(request, organization)
            result_totals, result_timeseries = run_outcomes_query(query)
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

        return QueryDefinition(request.GET, params)

    @contextmanager
    def handle_query_errors(self):
        try:
            # TODO: this context manager should be decoupled from `OrganizationEventsEndpointBase`?
            with super().handle_query_errors():
                yield
        except (InvalidField, NoProjects, InvalidParams) as error:
            raise ParseError(detail=str(error))
