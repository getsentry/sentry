from contextlib import contextmanager

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.search.utils import InvalidQuery
from sentry.snuba.outcomes import (
    QueryDefinition,
    massage_outcomes_result,
    run_outcomes_query_timeseries,
    run_outcomes_query_totals,
)
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
                result_totals = run_outcomes_query_totals(query)
                result_timeseries = (
                    None
                    if "project_id" in query.query_groupby
                    else run_outcomes_query_timeseries(query)
                )
            with sentry_sdk.start_span(
                op="outcomes.endpoint", description="massage_outcomes_result"
            ):
                result = massage_outcomes_result(query, result_totals, result_timeseries)
            return Response(result, status=200)

    def build_outcomes_query(self, request, organization):
        params = {"organization_id": organization.id}
        project_ids = self._get_projects_for_orgstats_query(request, organization)

        if project_ids:
            params["project_id"] = project_ids

        return QueryDefinition(request.GET, params)

    def _get_projects_for_orgstats_query(self, request, organization):
        # look at the raw project_id filter passed in, if its empty
        # and project_id is not in groupBy filter, treat it as an
        # org wide query and don't pass project_id in to QueryDefinition
        req_proj_ids = self.get_requested_project_ids(request)
        if self._is_org_total_query(request, req_proj_ids):
            return None
        else:
            projects = self.get_projects(request, organization, project_ids=req_proj_ids)
            if not projects:
                raise NoProjects("No projects available")
            return [p.id for p in projects]

    def _is_org_total_query(self, request, project_ids):
        return all(
            [
                not project_ids or project_ids == ALL_ACCESS_PROJECTS,
                "project" not in request.GET.get("groupBy", []),
            ]
        )

    @contextmanager
    def handle_query_errors(self):
        try:
            # TODO: this context manager should be decoupled from `OrganizationEventsEndpointBase`?
            with super().handle_query_errors():
                yield
        except (InvalidField, NoProjects, InvalidParams, InvalidQuery) as error:
            raise ParseError(detail=str(error))
