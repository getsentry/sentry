from __future__ import absolute_import

from rest_framework.response import Response

import sentry_sdk

from sentry.api.bases import OrganizationEndpoint
from sentry.snuba.sessions_v2 import (
    QueryDefinition,
    run_sessions_query,
    massage_sessions_result,
)


class OrganizationSessionsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        # with self.handle_query_errors():
        query = self.build_sessions_query(request, organization)

        with sentry_sdk.start_span(op="sessions.endpoint", description="run_sessions_query"):
            result_totals, result_timeseries = run_sessions_query(query)

        with sentry_sdk.start_span(op="sessions.endpoint", description="massage_sessions_result"):
            result = massage_sessions_result(query, result_totals, result_timeseries)
        return Response(result, status=200)

    def build_sessions_query(self, request, organization):
        with sentry_sdk.start_span(op="sessions.endpoint", description="build_sessions_query"):
            # validate and default all `project` params.
            projects = self.get_projects(request, organization)
            project_ids = [p.id for p in projects]

            return QueryDefinition(request.GET, project_ids)
