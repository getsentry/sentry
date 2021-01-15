from __future__ import absolute_import

from contextlib import contextmanager

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

import six
import sentry_sdk

from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.snuba.sessions_v2 import (
    InvalidField,
    QueryDefinition,
    run_sessions_query,
    massage_sessions_result,
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
        # validate and default all `project` params.
        projects = self.get_projects(request, organization)
        project_ids = [p.id for p in projects]

        return QueryDefinition(request.GET, project_ids)

    @contextmanager
    def handle_query_errors(self):
        try:
            # TODO: this context manager should be decoupled from `OrganizationEventsEndpointBase`?
            with super(OrganizationSessionsEndpoint, self).handle_query_errors():
                yield
        except InvalidField as error:
            raise ParseError(detail=six.text_type(error))
