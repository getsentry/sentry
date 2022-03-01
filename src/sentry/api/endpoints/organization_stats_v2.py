from contextlib import contextmanager
from typing import Any, Dict, List

import sentry_sdk
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.apidocs.constants import RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.decorators import public
from sentry.apidocs.parameters import GLOBAL_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.search.utils import InvalidQuery
from sentry.snuba.outcomes import (
    COLUMN_MAP,
    GROUPBY_MAP,
    QueryDefinition,
    massage_outcomes_result,
    run_outcomes_query_timeseries,
    run_outcomes_query_totals,
)
from sentry.snuba.sessions_v2 import InvalidField, InvalidParams
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.outcomes import Outcome


class OrgStatsQueryParamsSerializer(serializers.Serializer):
    # TODO: refactor endpoint and use this to validate query parameters.
    # TODO: define fields for date parameters for use elsewhere
    # time params
    statsPeriod = serializers.CharField(
        help_text=(
            "This defines the range of the time series, relative to now. "
            "The range is given in a `<number><unit>` format. "
            "For example `1d` for a one day range. Possible units are `m` for minutes, `h` for hours, `d` for days and `w` for weeks."
        ),
        required=False,
    )
    interval = serializers.CharField(
        help_text=(
            "This is the resolution of the time series, given in the same format as `statsPeriod`. "
            "The default resolution is `1h` and the minimum resolution is currently restricted to `1h` as well. "
            "Intervals larger than `1d` are not supported, and the interval has to cleanly divide one day."
        ),
        required=False,
    )
    start = serializers.DateTimeField(
        help_text="This defines the start of the time series range as an explicit datetime.",
        required=False,
    )
    end = serializers.DateTimeField(
        help_text="This defines the end of the time series range as an explicit datetime.",
        required=False,
    )

    groupBy = serializers.MultipleChoiceField(
        list(GROUPBY_MAP.keys()),
        required=True,
        help_text=(
            "can pass multiple groupBy parameters to group by multiple, e.g. `groupBy=project&groupBy=outcome` to group by multiple dimensions. "
            "Note that grouping by project can cause missing rows if the number of projects / interval is large. "
            "If you have a large number of projects, we recommend filtering and querying by them individually."
        ),
    )

    field = serializers.ChoiceField(
        list(COLUMN_MAP.keys()),
        help_text=(
            "the `sum(quantity)` field is bytes for attachments, and all others the 'event' count for those types of events.\n\n"
            "`sum(times_seen)` sums the number of times an event has been seen. "
            "For 'normal' event types, this will be equal to `sum(quantity)` for now. "
            "For sessions, quantity will sum the total number of events seen in a session, while `times_seen` will be the unique number of sessions. "
            "and for attachments, `times_seen` will be the total number of attachments, while quantity will be the total sum of attachment bytes."
        ),
    )

    # filter parameters

    project = serializers.ListField(
        required=False,
        help_text="The ID of the projects to filter by.\n\nUse `-1` to include all accessible projects.",
    )

    category = serializers.ChoiceField(
        ("error", "transaction", "attachment"),
        required=False,
        help_text=(
            "If filtering by attachments, you cannot filter by any other category due to quantity values becoming non-sensical (combining bytes and event counts).\n\n"
            "If filtering by `error`, it will automatically add `default` and `security` as we currently roll those two categories into `error` for displaying."
        ),
    )
    outcome = serializers.ChoiceField(
        [o.name.lower() for o in Outcome],
        required=False,
        help_text="See https://docs.sentry.io/product/stats/ for more information on outcome statuses.",
    )

    reason = serializers.CharField(
        required=False, help_text="The reason field will contain why an event was filtered/dropped."
    )


class _StatsGroup(TypedDict):  # this response is pretty dynamic, leaving generic
    by: Dict[str, Any]
    totals: Dict[str, Any]
    series: Dict[str, Any]


class StatsApiResponse(TypedDict):
    start: str
    end: str
    intervals: List[str]
    groups: List[_StatsGroup]


@public({"GET"})
@extend_schema(tags=["Organizations"])
class OrganizationStatsEndpointV2(OrganizationEventsEndpointBase):
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(20, 1),
            RateLimitCategory.USER: RateLimit(20, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(20, 1),
        }
    }

    @extend_schema(
        operation_id="Retrieve Event Counts for an Organization (v2)",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, OrgStatsQueryParamsSerializer],
        request=None,
        responses={
            200: inline_sentry_response_serializer("Outcomes Response", StatsApiResponse),
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOTFOUND,
        },
        examples=[  # TODO: see if this can go on serializer object instead
            OpenApiExample(
                "Successful response",
                value={
                    "start": "2022-02-14T19:00:00Z",
                    "end": "2022-02-28T18:03:00Z",
                    "intervals": ["2022-02-28T00:00:00Z"],
                    "groups": [
                        {
                            "by": {"outcome": "invalid"},
                            "totals": {"sum(quantity)": 165665},
                            "series": {"sum(quantity)": [165665]},
                        }
                    ],
                },
                status_codes=["200"],
            ),
        ],
    )
    def get(self, request: Request, organization) -> Response:
        """
        Query event counts for your Organization.
        Select a field, define a date range, and group or filter by columns.
        """
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

    def build_outcomes_query(self, request: Request, organization):
        params = {"organization_id": organization.id}
        project_ids = self._get_projects_for_orgstats_query(request, organization)

        if project_ids:
            params["project_id"] = project_ids

        return QueryDefinition(request.GET, params)

    def _get_projects_for_orgstats_query(self, request: Request, organization):
        # look at the raw project_id filter passed in, if its empty
        # and project_id is not in groupBy filter, treat it as an
        # org wide query and don't pass project_id in to QueryDefinition
        req_proj_ids = self.get_requested_project_ids_unchecked(request)
        if self._is_org_total_query(request, req_proj_ids):
            return None
        else:
            projects = self.get_projects(request, organization, project_ids=req_proj_ids)
            if not projects:
                raise NoProjects("No projects available")
            return [p.id for p in projects]

    def _is_org_total_query(self, request: Request, project_ids):
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
