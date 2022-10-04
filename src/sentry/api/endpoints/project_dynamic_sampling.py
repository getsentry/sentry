from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List

from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.request import Request as SnubaRequest

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.models import Project
from sentry.search.events.builder import QueryBuilder
from sentry.snuba import discover
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

    def __get_transactions_count(
        self,
        project,
        sample_size,
        query,
        query_time_range,
        extra_query_args=("event.type:transaction",),
    ):
        """
        Run query that gets total count of transactions with these conditions for the specified
        time period
        """
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
            referrer="dynamic-sampling.distribution.fetch-transactions-count",
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
                referrer="dynamic-sampling.distribution.get-most-recent-day-with-transactions",
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
                "trace.parent_span",
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
        groupby = snuba_query.groupby + [
            Column("modulo_num"),
        ]
        snuba_query = snuba_query.set_groupby(groupby)

        data = raw_snql_query(
            SnubaRequest(dataset=Dataset.Discover.value, app_id="default", query=snuba_query),
            referrer="dynamic-sampling.distribution.fetch-transactions",
        )["data"]
        return data

    def parent_project_breakdown_post_processing(
        self, project_id, query_time_range, project_breakdown, parent_trace_ids
    ) -> List:
        if project_breakdown is None:
            return []
        try:
            project = next(item for item in project_breakdown if item["project_id"] == project_id)
        except StopIteration:
            return []
        # Requesting for a single project or already root of distributed trace
        if project["count()"] == project["count_root"] and project["count_non_root"] == 0:
            return []

        # Requesting for a project that is root for some transactions but not root for others and part of distributed trace like sentry
        elif project["count_root"] > 0 and project["count_non_root"] > 0:
            # GET project distribution of this trace_ids (for ONLY parent trace ids)
            parent_project_breakdown = self.__run_discover_query(
                columns=[
                    "project_id",
                    "project",
                    "count()",
                ],
                query=f"event.type:transaction !has:trace.parent_span trace:[{','.join(parent_trace_ids)}]",
                params={
                    "start": query_time_range.start_time,
                    "end": query_time_range.end_time,
                    "organization_id": project.organization.id,
                },
                limit=20,
                referrer="dynamic-sampling.distribution.fetch-parent-project-breakdown",
            )["data"]
            return parent_project_breakdown

        elif project["count()"] == project["count_non_root"] and project["count_root"] == 0:
            return []
        return []

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
            # Fetch X random trace ids group by count_if(trace.parent_span, equals, "")
            transactions = self.__fetch_randomly_sampled_transactions(
                project=project,
                query=query,
                sample_size=requested_sample_size,
                query_time_range=query_time_range,
            )
        except EmptyTransactionDatasetException:
            # TODO: make response keys in same notation (all camelCase)
            return Response(
                {
                    "project_breakdown": None,
                    "sample_size": 0,
                    "startTimestamp": None,
                    "endTimestamp": None,
                    "parentProjectBreakdown": [],
                }
            )
        sample_size = len(transactions)
        project_breakdown = None
        parent_trace_ids = None
        if distributed_trace:
            # If the distributedTrace flag was enabled, then we are also interested in fetching
            # the project breakdown of the projects in the trace of the root transaction

            trace_ids = [transaction.get("trace") for transaction in transactions]
            parent_trace_ids = [
                transaction.get("trace")
                for transaction in transactions
                if transaction.get("count_root", 0) == 1
            ]

            projects_in_org = Project.objects.filter(organization=project.organization).values_list(
                "id", flat=True
            )

            # Discover query to fetch parent projects
            project_breakdown = self.__run_discover_query(
                columns=[
                    "project_id",
                    "project",
                    "count()",
                    'count_if(trace.parent_span, equals, "") as num_root_transaction',
                    'count_if(trace.parent_span, notEquals, "") as non_root',
                ],
                query=f"event.type:transaction trace:[{','.join(trace_ids)}]",
                params={
                    "start": query_time_range.start_time,
                    "end": query_time_range.end_time,
                    "project_id": list(projects_in_org),
                    "organization_id": project.organization.id,
                },
                limit=20,
                referrer="dynamic-sampling.distribution.fetch-project-breakdown",
            )

            # If the number of the projects in the breakdown is greater than 10 projects,
            # then a question needs to be raised on the eligibility of the org for dynamic sampling
            if len(project_breakdown) > 10:
                return Response(
                    status=status.HTTP_400_BAD_REQUEST,
                    data={
                        "detail": "Way too many projects in the distributed trace's project breakdown"
                    },
                )

        parent_project_breakdown = self.parent_project_breakdown_post_processing(
            project.id, query_time_range, project_breakdown, parent_trace_ids
        )

        return Response(
            {
                "project_breakdown": project_breakdown,
                "sample_size": sample_size,
                "startTimestamp": query_time_range.start_time,
                "endTimestamp": query_time_range.end_time,
                "parentProjectBreakdown": parent_project_breakdown,
            }
        )
