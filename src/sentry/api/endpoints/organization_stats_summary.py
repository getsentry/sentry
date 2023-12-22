import csv
from contextlib import contextmanager
from io import StringIO
from typing import Any, Dict, List

import sentry_sdk
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.apidocs.constants import RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.search.utils import InvalidQuery
from sentry.snuba.outcomes import COLUMN_MAP, QueryDefinition, run_outcomes_query_totals
from sentry.snuba.sessions_v2 import InvalidField, massage_sessions_result_summary
from sentry.utils.outcomes import Outcome


class OrgStatsSummaryQueryParamsSerializer(serializers.Serializer):
    # time params
    statsPeriod = serializers.CharField(
        help_text=(
            "This defines the range of the time series, relative to now. "
            "The range is given in a `<number><unit>` format. "
            "For example `1d` for a one day range. Possible units are `m` for minutes, `h` for hours, `d` for days and `w` for weeks."
            "You must either provide a `statsPeriod`, or a `start` and `end`."
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
        help_text="This defines the start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds."
        "Use along with `end` instead of `statsPeriod`.",
        required=False,
    )
    end = serializers.DateTimeField(
        help_text=(
            "This defines the inclusive end of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds."
            "Use along with `start` instead of `statsPeriod`."
        ),
        required=False,
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
        help_text="The ID of the projects to filter by.",
    )

    category = serializers.ChoiceField(
        ("error", "transaction", "attachment", "replays", "profiles"),
        required=False,
        help_text=(
            "If filtering by attachments, you cannot filter by any other category due to quantity values becoming nonsensical (combining bytes and event counts).\n\n"
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

    # download the file
    download = serializers.BooleanField(
        help_text=("Download the API response in as a csv file"),
        required=False,
    )


class _ProjectSummaryStats(TypedDict):  # this response is pretty dynamic, leaving generic
    id: str
    slug: str
    stats: List[Dict[str, Any]]


class StatsSummaryApiResponse(TypedDict):
    start: str
    end: str
    projects: List[_ProjectSummaryStats]


@extend_schema(tags=["Organizations"])
@region_silo_endpoint
class OrganizationStatsSummaryEndpoint(OrganizationEventsEndpointBase):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    owner = ApiOwner.ENTERPRISE

    @extend_schema(
        operation_id="Retrieve an Organization's Events Count by Project",
        parameters=[GlobalParams.ORG_SLUG, OrgStatsSummaryQueryParamsSerializer],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationStatsSummaryResponse", StatsSummaryApiResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationExamples.RETRIEVE_SUMMARY_EVENT_COUNT,
    )
    def get(self, request: Request, organization) -> HttpResponse:
        """
        Query summarized event counts by project for your Organization. Also see https://docs.sentry.io/api/organizations/retrieve-event-counts-for-an-organization-v2/ for reference.
        """
        with self.handle_query_errors():
            tenant_ids = {"organization_id": organization.id}
            with sentry_sdk.start_span(op="outcomes.endpoint", description="build_outcomes_query"):
                query = self.build_outcomes_query(
                    request,
                    organization,
                )
            with sentry_sdk.start_span(op="outcomes.endpoint", description="run_outcomes_query"):
                result_totals = run_outcomes_query_totals(query, tenant_ids=tenant_ids)
            with sentry_sdk.start_span(
                op="outcomes.endpoint", description="massage_outcomes_result"
            ):
                projects, result = massage_sessions_result_summary(
                    query, result_totals, request.GET.getlist("outcome")
                )

            if request.GET.get("download"):
                csv_content = self._generate_csv(projects)
                response = HttpResponse(content_type="text/csv", status=200)
                response["Content-Disposition"] = 'attachment; filename="stats_summary.csv"'
                response.write(csv_content)
                return response

            return Response(result, status=200)

    def build_outcomes_query(self, request: Request, organization):
        params = {"organization_id": organization.id}
        project_ids = self._get_projects_for_orgstats_query(request, organization)

        query_dict = request.GET.copy()
        group_by = ["project", "outcome", "category"]
        if query_dict.get("reason"):
            group_by.append("reason")

        query_dict.setlist("groupBy", group_by)

        if project_ids:
            params["project_id"] = project_ids

        return QueryDefinition.from_query_dict(query_dict, params)

    def _get_projects_for_orgstats_query(self, request: Request, organization):
        req_proj_ids = self.get_requested_project_ids_unchecked(request)

        # the projects table always filters by project
        # the projects in the table should be those the user has access to

        projects = self.get_projects(request, organization, project_ids=req_proj_ids)
        if not projects:
            raise NoProjects("No projects available")
        return [p.id for p in projects]

    def _is_org_total_query(self, project_ids):
        return all([not project_ids or project_ids == ALL_ACCESS_PROJECTS])

    def _generate_csv(self, projects):
        if not len(projects):
            return

        output = StringIO()
        csv_writer = csv.writer(output)

        longest_key = None
        max_length = 0
        for key, value in projects.items():
            if len(value) > max_length:
                max_length = len(value)
                longest_key = key

        headers = ["project_id", "project_slug"]
        longest_key_project = projects[longest_key]
        for category_stats in longest_key_project.values():
            for category, stats in category_stats.items():
                for outcome in stats["outcomes"]:
                    headers.append(outcome + "_" + category + "s")
                for total in stats["totals"]:
                    headers.append(total + "_" + category + "s")

        csv_writer.writerow(headers)

        ids = projects.keys()
        project_id_to_slug = dict(Project.objects.filter(id__in=ids).values_list("id", "slug"))

        for project_id, project_stats in projects.items():
            slug = project_id_to_slug[project_id]
            row = {"project_id": project_id, "project_slug": slug}
            for category_stats in project_stats.values():
                for category, stats in category_stats.items():
                    for outcome, val in stats["outcomes"].items():
                        header_name = outcome + "_" + category + "s"
                        if header_name in headers:
                            row[header_name] = val
                        else:
                            row[header_name] = 0
                    for total, val in stats["totals"].items():
                        header_name = total + "_" + category + "s"
                        if header_name in headers:
                            row[header_name] = val
                        else:
                            row[header_name] = 0
            formatted_row = []
            for header in headers:
                if header in row:
                    formatted_row.append(row[header])
                else:
                    formatted_row.append(0)

            csv_writer.writerow(formatted_row)

        return output.getvalue()

    @contextmanager
    def handle_query_errors(self):
        try:
            # TODO: this context manager should be decoupled from `OrganizationEventsEndpointBase`?
            with super().handle_query_errors():
                yield
        except (InvalidField, NoProjects, InvalidParams, InvalidQuery) as error:
            raise ParseError(detail=str(error))
