from dataclasses import dataclass
from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Function
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.request import Request as SnubaRequest

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.models import Project
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.constants import TRACE_PARENT_SPAN_CONTEXT
from sentry.snuba import discover
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import Dataset, parse_snuba_datetime, raw_snql_query


class EmptyTransactionDatasetException(Exception):
    ...


@dataclass
class QueryTimeRange:
    """
    Dataclass that stores start and end time for a query.
    """

    start_time: datetime
    end_time: datetime


class DynamicSamplingPermission(ProjectPermission):
    scope_map = {"GET": ["project:write"]}


@region_silo_endpoint
class ProjectDynamicSamplingDistributionEndpoint(ProjectEndpoint):
    private = True
    permission_classes = (DynamicSamplingPermission,)

    @staticmethod
    def __run_discover_query(columns, query: str, params, limit, referrer: str, orderby=None):
        if orderby is None:
            orderby = []

        return discover.query(
            selected_columns=columns,
            query=query,
            params=params,
            orderby=orderby,
            offset=0,
            limit=limit,
            equations=[],
            auto_fields=True,
            auto_aggregations=True,
            allow_metric_aggregates=True,
            use_aggregate_conditions=True,
            transform_alias_to_input_format=True,
            functions_acl=None,
            referrer=referrer,
        )["data"]

    def __project_stats_query(self, query, projects_in_org, org_id, query_time_range, trace_ids):
        """
        Smart query to get:
        counts as count,
        countIf(trace.parent_span_id == "") as root_count,
        group by project_id

        returns: [{'project': 'fire', 'project_id': 4, 'count': 21, 'root_count': 19}]
        """
        builder = QueryBuilder(
            Dataset.Discover,
            params={
                "start": query_time_range.start_time,
                "end": query_time_range.end_time,
                "project_id": projects_in_org,
                "organization_id": org_id,
            },
            query=f"{query} event.type:transaction trace:[{','.join(trace_ids)}]",
            selected_columns=[
                "project_id",
                "project",
                "count()",
            ],
            equations=[],
            orderby=None,
            auto_fields=True,
            auto_aggregations=True,
            use_aggregate_conditions=True,
            limit=20,
            offset=0,
            equation_config={"auto_add": False},
        )
        snuba_query = builder.get_snql_query().query
        extra_select = [
            Function(
                "countIf",
                [
                    Function(
                        "not",
                        [Function("has", [Column("contexts.key"), TRACE_PARENT_SPAN_CONTEXT])],
                    )
                ],
                alias="root_count",
            )
        ]
        snuba_query = snuba_query.set_select(snuba_query.select + extra_select)
        data = raw_snql_query(
            SnubaRequest(dataset=Dataset.Discover.value, app_id="default", query=snuba_query),
            referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_STATS.value,
        )
        return builder.process_results(data)["data"]

    def __get_transactions_count(self, project, query, sample_size, query_time_range):
        # Run query that gets total count of transactions with these conditions for the specified
        # time period
        return self.__run_discover_query(
            columns=[
                "count()",
            ],
            query=f"{query} event.type:transaction",
            params={
                "start": query_time_range.start_time,
                "end": query_time_range.end_time,
                "project_id": [project.id],
                "organization_id": project.organization.id,
            },
            limit=sample_size,
            referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_TRANSACTIONS_COUNT.value,
        )[0]["count()"]

    def __generate_transactions_sampling_factor(
        self, project, query, sample_size, query_time_range
    ):
        """
        Generate a sampling factor representative of the total transactions count, that is
        divisible by 10 (for simplicity). Essentially the logic here does the following:
        If we have total count of n = 50000 then, we want the `normalized_transactions_count` to be
        10000 as long as the n value doesn't exceed the 75% threshold between 10000 and 100000 else,
        we default to 100000. The reason we do this is because falling back to 10000 will
        yield more results as more numbers will be divisible by 10000 than 100000 for example.
        We add a 75% threshold that is an arbitrary threshold just to limit the number of returned
        results when dealing with values of n like 90,000 (In this case, we probably want the
        `normalized_transactions_coun`t to be 100,000 rather than 10,000)
        """
        transactions_count = self.__get_transactions_count(
            project=project, query=query, sample_size=sample_size, query_time_range=query_time_range
        )
        if transactions_count == 0:
            # If the last hour has no transactions, then it might indicate that either this
            # transaction traffic for this project is low or that the org has run out of their
            # transactions' quota, and in that case we need to expand the query time bounds to the
            # most recent 24 hours with transactions. We do that by looking for transactions in
            # the last 30 days and grouping them by day.

            # Round up to end of the current day
            end_bound_time = query_time_range.end_time.replace(
                hour=0, minute=0, second=0, microsecond=0
            ) + timedelta(days=1)
            start_bound_time = end_bound_time - timedelta(days=30)

            transaction_count_month = self.__run_discover_query(
                columns=["count()", "timestamp.to_day"],
                query=f"{query} event.type:transaction",
                params={
                    "start": start_bound_time,
                    "end": end_bound_time,
                    "project_id": [project.id],
                    "organization_id": project.organization.id,
                },
                orderby=["-timestamp.to_day"],
                limit=1,
                referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_GET_MOST_RECENT_DAY_WITH_TRANSACTIONS.value,
            )
            if len(transaction_count_month) == 0:
                # If no data is found in the last 30 days, raise an exception
                raise EmptyTransactionDatasetException()

            # Re-define the time bounds for the logic of this endpoint
            query_time_range.start_time = parse_snuba_datetime(
                transaction_count_month[0]["timestamp.to_day"]
            )
            query_time_range.end_time = query_time_range.start_time + timedelta(days=1)

            # Set the transactions count that will be used to determine the sampling factor to
            # the most recent day with transactions count
            transactions_count = transaction_count_month[0]["count()"]

        if sample_size % 10 == 0:
            normalized_sample_count = sample_size
        else:
            sample_digit_count = len(str(sample_size))
            normalized_sample_count = 10**sample_digit_count

        digit_count = len(str(transactions_count))
        normalized_transactions_count = (
            10 ** (digit_count - 1)
            if (transactions_count <= 0.75 * 10**digit_count)
            else 10**digit_count
        )
        return max(normalized_transactions_count / (10 * normalized_sample_count), 1)

    def __fetch_randomly_sampled_transactions(self, project, query, sample_size, query_time_range):
        """
        Fetches a random sample of transactions of size `sample_size` in the last period
        defined by `stats_period`. The random sample is fetched by generating a random number by
        for every row, and then doing a modulo operation on it, and if that number is divisible
        by the sampling factor then its kept, otherwise is discarded. This is an alternative to
        sampling the query before applying the conditions. The goal here is to fetch the
        transaction ids, their sample rates and their trace ids.
        """
        sampling_factor = self.__generate_transactions_sampling_factor(
            project=project,
            query=query,
            sample_size=sample_size,
            query_time_range=query_time_range,
        )
        builder = QueryBuilder(
            Dataset.Discover,
            params={
                "start": query_time_range.start_time,
                "end": query_time_range.end_time,
                "project_id": [project.id],
                "organization_id": project.organization.id,
            },
            query=f"{query} event.type:transaction",
            selected_columns=[
                "id",
                "trace",
                "random_number() as rand_num",
                f"modulo(rand_num, {sampling_factor}) as modulo_num",
            ],
            equations=[],
            orderby=None,
            auto_fields=True,
            auto_aggregations=True,
            use_aggregate_conditions=True,
            functions_acl=["random_number", "modulo"],
            limit=sample_size,
            offset=0,
            equation_config={"auto_add": False},
        )
        builder.add_conditions([Condition(lhs=Column("modulo_num"), op=Op.EQ, rhs=0)])
        snuba_query = builder.get_snql_query().query

        snuba_query = snuba_query.set_select(
            snuba_query.select
            + [
                Function(
                    "not",
                    [Function("has", [Column("contexts.key"), TRACE_PARENT_SPAN_CONTEXT])],
                    alias="is_root",
                )
            ]
        )
        snuba_query = snuba_query.set_groupby(
            snuba_query.groupby + [Column("modulo_num"), Column("contexts.key")]
        )

        data = raw_snql_query(
            SnubaRequest(dataset=Dataset.Discover.value, app_id="default", query=snuba_query),
            referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_TRANSACTIONS.value,
        )["data"]
        return data

    def get(self, request: Request, project) -> Response:
        """
        Generates distribution function values for client sample rates from a random sample of
        root transactions, and provides the projects breakdown for these transaction when
        creating a dynamic sampling rule for distributed traces.
        ``````````````````````````````````````````````````

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :qparam string query: If set, this parameter is used to filter root transactions.
        :qparam string sampleSize: If set, specifies the sample size of random root transactions.
        :qparam string distributedTrace: Set to distinguish the dynamic sampling creation rule
                                    whether it is for distributed trace or single transactions.
        :qparam string statsPeriod: an optional stat period (can be one of
                                    ``"24h"``, ``"14d"``, and ``""``).
        :auth: required
        """
        if not features.has(
            "organizations:server-side-sampling", project.organization, actor=request.user
        ):
            return Response(
                {
                    "detail": [
                        "Dynamic sampling feature flag needs to be enabled before you can perform "
                        "this action."
                    ]
                },
                status=404,
            )

        query = request.GET.get("query", "")
        requested_sample_size = min(int(request.GET.get("sampleSize", 100)), 1000)
        distributed_trace = request.GET.get("distributedTrace", "1") == "1"
        stats_period = timedelta(hours=1)

        time_now = timezone.now()
        query_time_range: QueryTimeRange = QueryTimeRange(time_now - stats_period, time_now)

        try:
            transactions = self.__fetch_randomly_sampled_transactions(
                project=project,
                query=query,
                sample_size=requested_sample_size,
                query_time_range=query_time_range,
            )
        except EmptyTransactionDatasetException:
            return Response(
                {
                    "projectBreakdown": None,
                    "sampleSize": 0,
                    "startTimestamp": None,
                    "endTimestamp": None,
                    "parentProjectBreakdown": [],
                }
            )
        sample_size = len(transactions)
        project_breakdown = None
        parent_project_breakdown = []
        if distributed_trace:
            # If the distributedTrace flag was enabled, then we are also interested in fetching
            # the project breakdown of the projects in the trace of the root transaction
            trace_ids = [transaction.get("trace") for transaction in transactions]
            projects_in_org = Project.objects.filter(organization=project.organization).values_list(
                "id", flat=True
            )

            # Discover query to fetch parent projects (smart query)
            projects_counts = self.__project_stats_query(
                query, list(projects_in_org), project.organization.id, query_time_range, trace_ids
            )

            # If the number of the projects in the breakdown is greater than 10 projects,
            # then a question needs to be raised on the eligibility of the org for dynamic sampling
            if len(projects_counts) > 10:
                return Response(
                    status=status.HTTP_400_BAD_REQUEST,
                    data={
                        "detail": "Way too many projects in the distributed trace's project breakdown"
                    },
                )

            # Calculating the count of projects that started a distributed trace
            # in the fetched randomly sampled transactions
            root_projects_count = len(
                [project for project in projects_counts if project["root_count"] > 0]
            )
            # get requested project id in projects_count dataset
            requested_project = next(
                item for item in projects_counts if item["project_id"] == project.id
            )

            if root_projects_count >= 1:
                parent_project_breakdown = []
                # ToDo(): revisit this logic with count if necessary in the future
                total_root_count = sum(
                    _project["root_count"]
                    for _project in projects_counts
                    if _project["root_count"] > 0
                )
                for _project in projects_counts:
                    if _project["root_count"] > 0:
                        parent_project_breakdown.append(
                            {
                                "project": _project["project"],
                                "projectId": _project["project_id"],
                                "percentage": _project["root_count"] / total_root_count,
                            }
                        )

            project_breakdown = []

            parent_project_ids = {p["projectId"] for p in parent_project_breakdown}

            if requested_project["project_id"] in parent_project_ids:
                if len(parent_project_breakdown) > 1:

                    # Build list of all head traces based io is_root column
                    # from Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_TRANSACTIONS query
                    parent_trace_ids = [
                        transaction.get("trace")
                        for transaction in transactions
                        if transaction["is_root"]
                    ]
                    # Run extra query to build project_breakdown,
                    # because in this case (project is the head of trace in some distributed trace
                    # and non-root in others) we can't create it based on parent_project_breakdown
                    project_breakdown_response = self.__run_discover_query(
                        columns=[
                            "project_id",
                            "project",
                            "count()",
                        ],
                        query=f"{query} event.type:transaction trace:[{','.join(parent_trace_ids)}]",
                        params={
                            "start": query_time_range.start_time,
                            "end": query_time_range.end_time,
                            "project_id": list(projects_in_org),
                            "organization_id": project.organization.id,
                        },
                        limit=20,
                        referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_BREAKDOWN.value,
                    )
                    project_breakdown = [
                        {
                            "projectId": _project["project_id"],
                            "project": _project["project"],
                            "count()": _project["count()"],
                        }
                        for _project in project_breakdown_response
                    ]

                elif len(parent_project_breakdown) == 1:
                    project_breakdown = [
                        {
                            "projectId": _project["project_id"],
                            "project": _project["project"],
                            "count()": _project["count"],
                        }
                        for _project in projects_counts
                    ]

        return Response(
            {
                "projectBreakdown": project_breakdown,
                "sampleSize": sample_size,
                "startTimestamp": query_time_range.start_time,
                "endTimestamp": query_time_range.end_time,
                "parentProjectBreakdown": parent_project_breakdown,
            }
        )
