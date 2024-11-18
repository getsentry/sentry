import dataclasses
import math
from collections import defaultdict
from collections.abc import Callable, Generator, Mapping, MutableMapping, Sequence
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Literal, NotRequired, TypedDict

import sentry_sdk
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import And, BooleanCondition, BooleanOp, Column, Condition, Function, Op, Or
from urllib3.exceptions import ReadTimeoutError

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.spans_indexed import (
    SpansEAPQueryBuilder,
    SpansIndexedQueryBuilder,
    TimeseriesSpanEAPIndexedQueryBuilder,
    TimeseriesSpanIndexedQueryBuilder,
)
from sentry.search.events.constants import TIMEOUT_SPAN_ERROR_MESSAGE
from sentry.search.events.types import QueryBuilderConfig, SnubaParams, WhereType
from sentry.sentry_metrics.querying.samples_list import SpanKey, get_sample_list_executor_cls
from sentry.snuba import discover, spans_indexed
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.iterators import chunked
from sentry.utils.numbers import clip
from sentry.utils.sdk import set_measurement
from sentry.utils.snuba import SnubaTSResult, bulk_snuba_queries, bulk_snuba_queries_with_referrers

MAX_SNUBA_RESULTS = 10_000

CANDIDATE_SPAN_OPS = {"pageload", "navigation"}
MATCHING_COUNT_ALIAS = "matching_count"
MATCHING_SPAN_LABEL = "matching_label"


def is_trace_name_candidate(span):
    return span["span.op"] in CANDIDATE_SPAN_OPS


class TraceInterval(TypedDict):
    project: str | None
    sdkName: str | None
    start: int
    end: int
    sliceStart: int
    sliceEnd: int
    sliceWidth: int
    kind: Literal["project", "missing", "other"]
    duration: int
    isRoot: bool
    components: NotRequired[list[tuple[int, int]]]


class TraceResult(TypedDict):
    trace: str
    numErrors: int
    numOccurrences: int
    numSpans: int
    matchingSpans: int
    project: str | None
    name: str | None
    rootDuration: float | None
    duration: int
    start: int
    end: int
    breakdowns: list[TraceInterval]


class OrganizationTracesSerializer(serializers.Serializer):
    dataset = serializers.ChoiceField(
        ["spans", "spansIndexed"], required=False, default="spansIndexed"
    )
    metricsMax = serializers.FloatField(required=False)
    metricsMin = serializers.FloatField(required=False)
    metricsOp = serializers.CharField(required=False)
    metricsQuery = serializers.CharField(required=False)
    mri = serializers.CharField(required=False)

    breakdownSlices = serializers.IntegerField(default=40, min_value=1, max_value=100)
    query = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField(allow_blank=True)
    )
    sort = serializers.CharField(required=False)

    def validate_dataset(self, value):
        if value == "spans":
            return Dataset.EventsAnalyticsPlatform
        if value == "spansIndexed":
            return Dataset.SpansIndexed
        raise ParseError(detail=f"Unsupported dataset: {value}")

    def validate(self, data):
        if data["dataset"] == Dataset.EventsAnalyticsPlatform:
            sort = data.get("sort")
            if sort is not None:
                sort_field = sort[1:] if sort.startswith("-") else sort

                if sort_field not in {"timestamp"}:
                    raise ParseError(detail=f"Unsupported sort: {sort}")
        return data


@contextmanager
def handle_span_query_errors() -> Generator[None, None, None]:
    with handle_query_errors():
        try:
            yield
        except ReadTimeoutError:
            raise InvalidSearchQuery(TIMEOUT_SPAN_ERROR_MESSAGE)


class OrganizationTracesEndpointBase(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.PERFORMANCE


@region_silo_endpoint
class OrganizationTracesEndpoint(OrganizationTracesEndpointBase):
    snuba_methods = ["GET"]

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        buffer = options.get("performance.traces.trace-explorer-skip-recent-seconds")
        now = timezone.now() - timedelta(seconds=buffer)
        assert snuba_params.end is not None
        snuba_params.end = min(snuba_params.end, now)

        serializer = OrganizationTracesSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        executor = TracesExecutor(
            dataset=serialized["dataset"],
            snuba_params=snuba_params,
            user_queries=serialized.get("query", []),
            sort=serialized.get("sort"),
            metrics_max=serialized.get("metricsMax"),
            metrics_min=serialized.get("metricsMin"),
            metrics_operation=serialized.get("metricsOp"),
            metrics_query=serialized.get("metricsQuery"),
            mri=serialized.get("mri"),
            limit=self.get_per_page(request),
            breakdown_slices=serialized["breakdownSlices"],
            get_all_projects=lambda: self.get_projects(
                request,
                organization,
                project_ids={-1},
                project_slugs=None,
                include_all_accessible=True,
            ),
        )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=executor.execute),
            on_results=lambda results: self.handle_results_with_meta(
                request,
                organization,
                snuba_params.project_ids,
                results,
                standard_meta=True,
                dataset=Dataset.SpansIndexed,
            ),
        )


class OrganizationTraceSpansSerializer(serializers.Serializer):
    dataset = serializers.ChoiceField(
        ["spans", "spansIndexed"], required=False, default="spansIndexed"
    )
    metricsMax = serializers.FloatField(required=False)
    metricsMin = serializers.FloatField(required=False)
    metricsOp = serializers.CharField(required=False)
    metricsQuery = serializers.CharField(required=False)
    mri = serializers.CharField(required=False)

    field = serializers.ListField(required=True, allow_empty=False, child=serializers.CharField())
    sort = serializers.ListField(required=False, allow_empty=True, child=serializers.CharField())
    query = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField(allow_blank=True)
    )

    def validate_dataset(self, value):
        if value == "spans":
            return Dataset.EventsAnalyticsPlatform
        if value == "spansIndexed":
            return Dataset.SpansIndexed
        raise ParseError(detail=f"Unsupported dataset: {value}")


@region_silo_endpoint
class OrganizationTraceSpansEndpoint(OrganizationTracesEndpointBase):
    snuba_methods = ["GET"]

    def get(self, request: Request, organization: Organization, trace_id: str) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = OrganizationTraceSpansSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        executor = TraceSpansExecutor(
            dataset=serialized["dataset"],
            snuba_params=snuba_params,
            trace_id=trace_id,
            fields=serialized["field"],
            user_queries=serialized.get("query", []),
            sort=serialized.get("sort"),
            metrics_max=serialized.get("metricsMax"),
            metrics_min=serialized.get("metricsMin"),
            metrics_operation=serialized.get("metricsOp"),
            metrics_query=serialized.get("metricsQuery"),
            mri=serialized.get("mri"),
        )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=executor.execute),
            on_results=lambda results: self.handle_results_with_meta(
                request,
                organization,
                snuba_params.project_ids,
                results,
                standard_meta=True,
                dataset=Dataset.SpansIndexed,
            ),
        )


class OrganizationTracesStatsSerializer(serializers.Serializer):
    dataset = serializers.ChoiceField(
        ["spans", "spansIndexed"], required=False, default="spansIndexed"
    )
    query = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField(allow_blank=True)
    )
    yAxis = serializers.ListField(required=True, child=serializers.CharField())

    def validate_dataset(self, value):
        if value == "spans":
            return Dataset.EventsAnalyticsPlatform
        if value == "spansIndexed":
            return Dataset.SpansIndexed
        raise ParseError(detail=f"Unsupported dataset: {value}")


@region_silo_endpoint
class OrganizationTracesStatsEndpoint(OrganizationTracesEndpointBase):
    snuba_methods = ["GET"]

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = OrganizationTracesStatsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        # The partial parameter determines whether or not partial buckets are allowed.
        # The last bucket of the time series can potentially be a partial bucket when
        # the start of the bucket does not align with the rollup.
        allow_partial_buckets = request.GET.get("partial") == "1"

        zerofill = not (
            request.GET.get("withoutZerofill") == "1"
            and features.get(
                "organizations:performance-chart-interpolation", organization, actor=request.user
            )
        )

        def get_event_stats(
            _columns: Sequence[str],
            _query: str,
            snuba_params: SnubaParams,
            rollup: int,
            zerofill_results: bool,
            comparison_delta: timedelta | None,
        ) -> SnubaTSResult:
            executor = TraceStatsExecutor(
                dataset=serialized["dataset"],
                snuba_params=snuba_params,
                columns=serialized["yAxis"],
                user_queries=serialized.get("query", []),
                rollup=rollup,
                zerofill_results=zerofill_results,
            )
            return executor.execute()

        try:
            return Response(
                self.get_event_stats_data(
                    request,
                    organization,
                    get_event_stats,
                    snuba_params=snuba_params,
                    allow_partial_buckets=allow_partial_buckets,
                    zerofill_results=zerofill,
                    dataset=spans_indexed,
                ),
                status=200,
            )
        except ValidationError:
            return Response({"detail": "Comparison period is outside retention window"}, status=400)


class TracesExecutor:
    def __init__(
        self,
        *,
        dataset: Dataset,
        snuba_params: SnubaParams,
        user_queries: list[str],
        sort: str | None,
        metrics_max: float | None,
        metrics_min: float | None,
        metrics_operation: str | None,
        metrics_query: str | None,
        mri: str | None,
        limit: int,
        breakdown_slices: int,
        get_all_projects: Callable[[], list[Project]],
    ):
        self.dataset = dataset
        self.snuba_params = snuba_params
        self.user_queries = process_user_queries(snuba_params, user_queries, dataset)
        self.sort = sort
        self.metrics_max = metrics_max
        self.metrics_min = metrics_min
        self.metrics_operation = metrics_operation
        self.metrics_query = metrics_query
        self.mri = mri
        self.offset = 0
        self.limit = limit
        self.breakdown_slices = breakdown_slices
        self.get_all_projects = get_all_projects

    def params_with_all_projects(self) -> SnubaParams:
        all_projects_snuba_params = dataclasses.replace(
            self.snuba_params, projects=self.get_all_projects()
        )

        return all_projects_snuba_params

    def execute(self, offset: int, limit: int):
        # To support pagination on only EAP, we use the offset/limit
        # values from the paginator here.
        if self.dataset == Dataset.EventsAnalyticsPlatform:
            self.offset = offset
            self.limit = limit

        return {"data": self._execute()}

    def _execute(self):
        with handle_span_query_errors():
            min_timestamp, max_timestamp, trace_ids = self.get_traces_matching_conditions(
                self.snuba_params,
            )

        if not trace_ids:
            return []

        self.refine_params(min_timestamp, max_timestamp)

        with handle_span_query_errors():
            snuba_params = self.params_with_all_projects()

            all_queries = self.get_all_queries(
                snuba_params,
                trace_ids,
            )

            all_raw_results = bulk_snuba_queries_with_referrers(
                [(query.get_snql_query(), referrer.value) for query, referrer in all_queries]
            )

            all_results = [
                query.process_results(result)
                for (query, _), result in zip(all_queries, all_raw_results)
            ]

            # the order of these results is defined by the order
            # of the queries in `get_all_meta_data_queries`

            idx = 0

            traces_metas_results = all_results[idx]
            idx += 1

            traces_errors_results = all_results[idx]
            idx += 1

            traces_occurrences_results = all_results[idx]
            idx += 1

            traces_breakdown_projects_results = all_results[idx]
            idx += 1

            data = self.process_final_results(
                traces_metas_results=traces_metas_results,
                traces_errors_results=traces_errors_results,
                traces_occurrences_results=traces_occurrences_results,
                traces_breakdown_projects_results=traces_breakdown_projects_results,
            )

        # We now sort the traces in the order we expect from the initial query.
        # This is because the queries to populate the trace metadata does not
        # guarantee any kind of ordering.
        ordering = {trace_id: i for i, trace_id in enumerate(trace_ids)}
        data.sort(key=lambda trace: ordering[trace["trace"]])

        if self.dataset == Dataset.EventsAnalyticsPlatform and self.sort in {
            "timestamp",
            "-timestamp",
        }:
            # Due to pagination, we try to fetch 1 additional trace. So if the
            # number of traces matches the limit, then this means 1 of the traces
            # is there to indicate there is a next page. This last item is not
            # actually returned.
            #
            # To correctly sort the traces, we must preserve the position of this
            # last trace and sort the rest.
            preserve_last_item_index = len(data) >= self.limit
            last_item = data.pop() if preserve_last_item_index else None

            # The traces returned are sorted by the timestamps of the matching span.
            # This results in a list that's approximately sorted by most recent but
            # some items may be out of order due to the trace's timestamp being different.
            #
            # To create the illusion that traces are sorted by most recent, apply
            # an additional sort here so the traces are sorted by most recent.
            data.sort(key=lambda trace: trace["end"], reverse=self.sort == "-timestamp")

            if last_item is not None:
                data.append(last_item)

        return data

    def refine_params(self, min_timestamp: datetime, max_timestamp: datetime):
        """
        Once we have a min/max timestamp for all the traces in the query,
        refine the params so that it selects a time range that is as small as possible.
        """

        # TODO: move to use `update_snuba_params_with_timestamp`
        time_buffer = options.get("performance.traces.trace-explorer-buffer-hours")
        buffer = timedelta(hours=time_buffer)

        self.snuba_params.start = min_timestamp - buffer
        self.snuba_params.end = max_timestamp + buffer

    def get_traces_matching_conditions(
        self,
        snuba_params: SnubaParams,
    ) -> tuple[datetime, datetime, list[str]]:
        if self.mri is not None:
            sentry_sdk.set_tag("mri", self.mri)
            return self.get_traces_matching_metric_conditions(snuba_params)

        return self.get_traces_matching_span_conditions(snuba_params)

    def get_traces_matching_metric_conditions(
        self,
        snuba_params: SnubaParams,
    ) -> tuple[datetime, datetime, list[str]]:
        assert self.mri is not None

        executor_cls = get_sample_list_executor_cls(self.mri)
        if executor_cls is None:
            raise ParseError(detail=f"Unsupported MRI: {self.mri}")

        executor = executor_cls(
            mri=self.mri,
            snuba_params=snuba_params,
            fields=["trace"],
            max=self.metrics_max,
            min=self.metrics_min,
            operation=self.metrics_operation,
            query=self.metrics_query,
            referrer=Referrer.API_TRACE_EXPLORER_METRICS_SPANS_LIST,
        )

        trace_ids, timestamps = executor.get_matching_traces(MAX_SNUBA_RESULTS)

        min_timestamp = snuba_params.end
        max_timestamp = snuba_params.start
        assert min_timestamp is not None
        assert max_timestamp is not None

        for timestamp in timestamps:
            min_timestamp = min(min_timestamp, timestamp)
            max_timestamp = max(max_timestamp, timestamp)

        if not trace_ids or min_timestamp > max_timestamp:
            return min_timestamp, max_timestamp, []

        self.refine_params(min_timestamp, max_timestamp)

        if self.user_queries:
            # If there are user queries, further refine the trace ids by applying them
            # leaving us with only traces where the metric exists and matches the user
            # queries.
            (
                min_timestamp,
                max_timestamp,
                trace_ids,
            ) = self.get_traces_matching_span_conditions_in_traces(snuba_params, trace_ids)

            if not trace_ids:
                return min_timestamp, max_timestamp, []
        else:
            # No user queries so take the first N trace ids as our list
            min_timestamp = snuba_params.end
            max_timestamp = snuba_params.start
            assert min_timestamp is not None
            assert max_timestamp is not None

            trace_ids = trace_ids[: self.limit]
            timestamps = timestamps[: self.limit]
            for timestamp in timestamps:
                min_timestamp = min(min_timestamp, timestamp)
                max_timestamp = max(max_timestamp, timestamp)

        return min_timestamp, max_timestamp, trace_ids

    def get_traces_matching_span_conditions(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str] | None = None,
    ) -> tuple[datetime, datetime, list[str]]:
        query, timestamp_column = self.get_traces_matching_span_conditions_query(
            snuba_params,
        )

        results = query.run_query(
            referrer=Referrer.API_TRACE_EXPLORER_SPANS_LIST.value,
        )
        results = query.process_results(results)

        matching_trace_ids: list[str] = []
        min_timestamp = self.snuba_params.end
        max_timestamp = self.snuba_params.start
        assert min_timestamp is not None
        assert max_timestamp is not None

        for row in results["data"]:
            matching_trace_ids.append(row["trace"])
            timestamp = datetime.fromisoformat(row[timestamp_column])
            min_timestamp = min(min_timestamp, timestamp)
            max_timestamp = max(max_timestamp, timestamp)

            # early escape once we have enough results
            if len(matching_trace_ids) >= self.limit:
                return min_timestamp, max_timestamp, matching_trace_ids

        return min_timestamp, max_timestamp, matching_trace_ids

    def get_traces_matching_span_conditions_in_traces(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[datetime, datetime, list[str]]:
        all_queries: list[BaseQueryBuilder] = []
        timestamp_column: str | None = None

        # Putting all the trace ids into a single query will likely encounter the
        # max query size limit in ClickHouse. This tries to spread the trace ids
        # out evenly across N queries up to some limit per query.
        max_trace_ids_per_chunk = options.get(
            "performance.traces.trace-explorer-max-trace-ids-per-chunk"
        )
        num_chunks = math.ceil(len(trace_ids) / max_trace_ids_per_chunk)
        chunk_size = math.ceil(len(trace_ids) / num_chunks)

        for chunk in chunked(trace_ids, chunk_size):
            query, timestamp_column = self.get_traces_matching_span_conditions_query(
                snuba_params,
            )

            # restrict the query to just this subset of trace ids
            query.add_conditions([Condition(Column("trace_id"), Op.IN, chunk)])

            all_queries.append(query)

        assert timestamp_column is not None

        all_raw_results = bulk_snuba_queries(
            [query.get_snql_query() for query in all_queries],
            Referrer.API_TRACE_EXPLORER_SPANS_LIST.value,
        )
        all_results = [
            query.process_results(result) for query, result in zip(all_queries, all_raw_results)
        ]

        matching_trace_ids: list[str] = []
        min_timestamp = self.snuba_params.end
        max_timestamp = self.snuba_params.start
        assert min_timestamp is not None
        assert max_timestamp is not None

        for trace_results in all_results:
            for row in trace_results["data"]:
                matching_trace_ids.append(row["trace"])
                timestamp = datetime.fromisoformat(row[timestamp_column])
                min_timestamp = min(min_timestamp, timestamp)
                max_timestamp = max(max_timestamp, timestamp)

                # early escape once we have enough results
                if len(matching_trace_ids) >= self.limit:
                    return min_timestamp, max_timestamp, matching_trace_ids

        return min_timestamp, max_timestamp, matching_trace_ids

    def get_traces_matching_span_conditions_query(
        self,
        snuba_params: SnubaParams,
    ) -> tuple[BaseQueryBuilder, str]:
        if self.dataset == Dataset.EventsAnalyticsPlatform:
            return self.get_traces_matching_span_conditions_query_eap(snuba_params)
        return self.get_traces_matching_span_conditions_query_indexed(snuba_params)

    def get_traces_matching_span_conditions_query_eap(
        self,
        snuba_params: SnubaParams,
    ) -> tuple[BaseQueryBuilder, str]:
        if len(self.user_queries) < 2:
            timestamp_column = "timestamp"
        else:
            timestamp_column = "min(timestamp)"

        if self.sort == "-timestamp":
            orderby = [f"-{timestamp_column}"]
        elif self.sort == "timestamp":
            orderby = [timestamp_column]
        else:
            # The orderby is intentionally `None` here as this query is much faster
            # if we let Clickhouse decide which order to return the results in.
            # This also means we cannot order by any columns or paginate.
            orderby = None

        if len(self.user_queries) < 2:
            # Optimization: If there is only a condition for a single span,
            # we can take the fast path and query without using aggregates.
            query = SpansEAPQueryBuilder(
                Dataset.EventsAnalyticsPlatform,
                params={},
                snuba_params=snuba_params,
                query=None,
                selected_columns=["trace", timestamp_column],
                orderby=orderby,
                limit=self.limit,
                offset=self.offset,
                limitby=("trace", 1),
                config=QueryBuilderConfig(
                    transform_alias_to_input_format=True,
                ),
            )

            for where in self.user_queries.values():
                query.where.extend(where)
        else:
            query = SpansEAPQueryBuilder(
                Dataset.EventsAnalyticsPlatform,
                params={},
                snuba_params=snuba_params,
                query=None,
                selected_columns=["trace", timestamp_column],
                orderby=orderby,
                limit=self.limit,
                offset=self.offset,
                limitby=("trace", 1),
                config=QueryBuilderConfig(
                    auto_aggregations=True,
                    transform_alias_to_input_format=True,
                ),
            )

            trace_conditions = []
            for where in self.user_queries.values():
                if len(where) == 1:
                    trace_conditions.extend(where)
                elif len(where) > 1:
                    trace_conditions.append(BooleanCondition(op=BooleanOp.AND, conditions=where))

                # Transform the condition into it's aggregate form so it can be used to
                # match on the trace.
                new_condition = generate_trace_condition(where)
                if new_condition:
                    query.having.append(new_condition)

            if len(trace_conditions) == 1:
                # This should never happen since it should use a flat query
                # but handle it just in case.
                query.where.extend(trace_conditions)
            elif len(trace_conditions) > 1:
                query.where.append(BooleanCondition(op=BooleanOp.OR, conditions=trace_conditions))

        if options.get("performance.traces.trace-explorer-skip-floating-spans"):
            query.add_conditions([Condition(Column("segment_id"), Op.NEQ, "00")])

        return query, timestamp_column

    def get_traces_matching_span_conditions_query_indexed(
        self,
        snuba_params: SnubaParams,
    ) -> tuple[BaseQueryBuilder, str]:
        if len(self.user_queries) < 2:
            timestamp_column = "timestamp"
        else:
            timestamp_column = "min(timestamp)"

        if len(self.user_queries) < 2:
            # Optimization: If there is only a condition for a single span,
            # we can take the fast path and query without using aggregates.
            query = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params={},
                snuba_params=snuba_params,
                query=None,
                selected_columns=["trace", timestamp_column],
                limit=self.limit,
                limitby=("trace", 1),
                config=QueryBuilderConfig(
                    transform_alias_to_input_format=True,
                ),
            )

            for where in self.user_queries.values():
                query.where.extend(where)
        else:
            query = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params={},
                snuba_params=snuba_params,
                query=None,
                selected_columns=["trace", timestamp_column],
                limit=self.limit,
                config=QueryBuilderConfig(
                    auto_aggregations=True,
                    transform_alias_to_input_format=True,
                ),
            )

            trace_conditions = []
            for where in self.user_queries.values():
                if len(where) == 1:
                    trace_conditions.extend(where)
                elif len(where) > 1:
                    trace_conditions.append(BooleanCondition(op=BooleanOp.AND, conditions=where))

                # Transform the condition into it's aggregate form so it can be used to
                # match on the trace.
                new_condition = generate_trace_condition(where)
                if new_condition:
                    query.having.append(new_condition)

            if len(trace_conditions) == 1:
                # This should never happen since it should use a flat query
                # but handle it just in case.
                query.where.extend(trace_conditions)
            elif len(trace_conditions) > 1:
                query.where.append(BooleanCondition(op=BooleanOp.OR, conditions=trace_conditions))

        if options.get("performance.traces.trace-explorer-skip-floating-spans"):
            query.add_conditions([Condition(Column("transaction_id"), Op.IS_NOT_NULL, None)])

        return query, timestamp_column

    def get_all_queries(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> list[tuple[BaseQueryBuilder, Referrer]]:
        traces_metas_query_with_referrer = self.get_traces_metas_query(
            snuba_params,
            trace_ids,
        )

        traces_errors_query_with_referrer = self.get_traces_errors_query(
            snuba_params,
            trace_ids,
        )

        traces_occurrences_query_with_referrer = self.get_traces_occurrences_query(
            snuba_params,
            trace_ids,
        )

        traces_breakdown_projects_query_with_referrer = self.get_traces_breakdown_projects_query(
            snuba_params,
            trace_ids,
        )

        return [
            traces_metas_query_with_referrer,
            traces_errors_query_with_referrer,
            traces_occurrences_query_with_referrer,
            traces_breakdown_projects_query_with_referrer,
        ]

    def process_final_results(
        self,
        *,
        traces_metas_results,
        traces_errors_results,
        traces_occurrences_results,
        traces_breakdown_projects_results,
    ) -> list[TraceResult]:
        traces_range = {
            row["trace"]: {
                "start": row["first_seen()"],
                "end": row["last_seen()"],
                "slices": self.breakdown_slices,
            }
            for row in traces_metas_results["data"]
        }

        spans = [span for span in traces_breakdown_projects_results["data"]]
        spans.sort(key=lambda span: (span["precise.start_ts"], span["precise.finish_ts"]))

        try:
            traces_breakdowns = process_breakdowns(spans, traces_range)
        except Exception as e:
            traces_breakdowns = defaultdict(list)

            context = {"traces": list(sorted(traces_range.keys()))}
            sentry_sdk.capture_exception(e, contexts={"bad_traces": context})

        # This is the name of the trace's root span without a parent span
        traces_primary_info: MutableMapping[str, tuple[str, str, float]] = {}

        # This is the name of a span that can take the place of the trace's root
        # based on some heuristics for that type of trace
        traces_fallback_info: MutableMapping[str, tuple[str, str, float]] = {}

        # This is the name of the first span in the trace that will be used if
        # no other candidates names are found
        traces_default_info: MutableMapping[str, tuple[str, str, float]] = {}

        # Normally, the name given to a trace is the name of the first root transaction
        # found within the trace.
        #
        # But there are some cases where traces do not have any root transactions. For
        # these traces, we try to pick out a name from the first span that is a good
        # candidate for the trace name.
        for row in traces_breakdown_projects_results["data"]:
            if row["trace"] in traces_primary_info:
                continue

            name: tuple[str, str, float] = (
                row["project"],
                row["transaction"],
                row["span.duration"],
            )

            # The underlying column is a Nullable(UInt64) but we write a default of 0 to it.
            # So make sure to handle both in case something changes.
            if not row["parent_span"] or int(row["parent_span"], 16) == 0:
                traces_primary_info[row["trace"]] = name

            if row["trace"] in traces_fallback_info:
                continue

            # This span is a good candidate for the trace name so use it.
            if row["trace"] not in traces_fallback_info and is_trace_name_candidate(row):
                traces_fallback_info[row["trace"]] = name

            if row["trace"] in traces_default_info:
                continue

            # This is the first span in this trace.
            traces_default_info[row["trace"]] = name

        def get_trace_info(trace: str) -> tuple[str, str, float] | tuple[None, None, None]:
            if trace in traces_primary_info:
                return traces_primary_info[trace]

            if trace in traces_fallback_info:
                return traces_fallback_info[trace]

            if trace in traces_default_info:
                return traces_default_info[trace]

            return (None, None, None)

        traces_errors: Mapping[str, int] = {
            row["trace"]: row["count()"] for row in traces_errors_results["data"]
        }

        traces_occurrences: Mapping[str, int] = {
            row["trace"]: row["count()"] for row in traces_occurrences_results["data"]
        }

        results: list[TraceResult] = []

        for row in traces_metas_results["data"]:
            info = get_trace_info(row["trace"])

            result: TraceResult = {
                "trace": row["trace"],
                "numErrors": traces_errors.get(row["trace"], 0),
                "numOccurrences": traces_occurrences.get(row["trace"], 0),
                "matchingSpans": row[MATCHING_COUNT_ALIAS],
                # In EAP mode, we have to use `count_sample()` to avoid extrapolation
                "numSpans": row.get("count()") or row.get("count_sample()") or 0,
                "project": info[0],
                "name": info[1],
                "rootDuration": info[2],
                "duration": row["last_seen()"] - row["first_seen()"],
                "start": row["first_seen()"],
                "end": row["last_seen()"],
                "breakdowns": traces_breakdowns[row["trace"]],
            }

            results.append(result)

        return results

    def process_meta_results(self, results):
        return results["meta"]

    def get_traces_breakdown_projects_query(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[BaseQueryBuilder, Referrer]:
        if self.dataset == Dataset.EventsAnalyticsPlatform:
            return self.get_traces_breakdown_projects_query_eap(snuba_params, trace_ids)
        return self.get_traces_breakdown_projects_query_indexed(snuba_params, trace_ids)

    def get_traces_breakdown_projects_query_eap(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[BaseQueryBuilder, Referrer]:
        query = SpansEAPQueryBuilder(
            Dataset.EventsAnalyticsPlatform,
            params={},
            snuba_params=snuba_params,
            query="is_transaction:1",
            selected_columns=[
                "trace",
                "project",
                "sdk.name",
                "span.op",
                "parent_span",
                "transaction",
                "precise.start_ts",
                "precise.finish_ts",
                "span.duration",
            ],
            orderby=["precise.start_ts", "-precise.finish_ts"],
            # limit the number of segments we fetch per trace so a single
            # large trace does not result in the rest being blank
            limitby=("trace", int(MAX_SNUBA_RESULTS / len(trace_ids))),
            limit=MAX_SNUBA_RESULTS,
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        # restrict the query to just this subset of trace ids
        query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])

        return query, Referrer.API_TRACE_EXPLORER_TRACES_BREAKDOWNS

    def get_traces_breakdown_projects_query_indexed(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[BaseQueryBuilder, Referrer]:
        query = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params={},
            snuba_params=snuba_params,
            query="is_transaction:1",
            selected_columns=[
                "trace",
                "project",
                "sdk.name",
                "span.op",
                "parent_span",
                "transaction",
                "precise.start_ts",
                "precise.finish_ts",
                "span.duration",
            ],
            orderby=["precise.start_ts", "-precise.finish_ts"],
            # limit the number of segments we fetch per trace so a single
            # large trace does not result in the rest being blank
            limitby=("trace", int(MAX_SNUBA_RESULTS / len(trace_ids))),
            limit=MAX_SNUBA_RESULTS,
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        # restrict the query to just this subset of trace ids
        query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])

        return query, Referrer.API_TRACE_EXPLORER_TRACES_BREAKDOWNS

    def get_traces_metas_query(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[BaseQueryBuilder, Referrer]:
        if self.dataset == Dataset.EventsAnalyticsPlatform:
            return self.get_traces_metas_query_eap(snuba_params, trace_ids)
        return self.get_traces_metas_query_indexed(snuba_params, trace_ids)

    def get_traces_metas_query_eap(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[BaseQueryBuilder, Referrer]:
        query = SpansEAPQueryBuilder(
            Dataset.EventsAnalyticsPlatform,
            params={},
            snuba_params=snuba_params,
            query=None,
            selected_columns=[
                "trace",
                "count_sample()",
                "first_seen()",
                "last_seen()",
            ],
            limit=len(trace_ids),
            config=QueryBuilderConfig(
                functions_acl=["first_seen", "last_seen"],
                transform_alias_to_input_format=True,
            ),
        )

        # restrict the query to just this subset of trace ids
        query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])

        """
        We want to get a count of the number of matching spans. To do this, we have to
        translate the user queries into conditions, and get a count of spans that match
        any one of the user queries.
        """

        # Translate each user query into a condition to match one
        trace_conditions = []
        for where in self.user_queries.values():
            trace_condition = format_as_trace_conditions(where)
            if not trace_condition:
                continue
            elif len(trace_condition) == 1:
                trace_conditions.append(trace_condition[0])
            else:
                trace_conditions.append(Function("and", trace_condition))

        # Join all the user queries together into a single one where at least 1 have
        # to be true.
        if not trace_conditions:
            query.columns.append(Function("count", [], MATCHING_COUNT_ALIAS))
        elif len(trace_conditions) == 1:
            query.columns.append(Function("countIf", trace_conditions, MATCHING_COUNT_ALIAS))
        else:
            query.columns.append(
                Function("countIf", [Function("or", trace_conditions)], MATCHING_COUNT_ALIAS)
            )

        if options.get("performance.traces.trace-explorer-skip-floating-spans"):
            query.add_conditions([Condition(Column("segment_id"), Op.NEQ, "00")])

        return query, Referrer.API_TRACE_EXPLORER_TRACES_META

    def get_traces_metas_query_indexed(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[BaseQueryBuilder, Referrer]:
        query = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params={},
            snuba_params=snuba_params,
            query=None,
            selected_columns=[
                "trace",
                "count()",
                "first_seen()",
                "last_seen()",
            ],
            limit=len(trace_ids),
            config=QueryBuilderConfig(
                functions_acl=["first_seen", "last_seen"],
                transform_alias_to_input_format=True,
            ),
        )

        # restrict the query to just this subset of trace ids
        query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])

        """
        We want to get a count of the number of matching spans. To do this, we have to
        translate the user queries into conditions, and get a count of spans that match
        any one of the user queries.
        """

        # Translate each user query into a condition to match one
        trace_conditions = []
        for where in self.user_queries.values():
            trace_condition = format_as_trace_conditions(where)
            if not trace_condition:
                continue
            elif len(trace_condition) == 1:
                trace_conditions.append(trace_condition[0])
            else:
                trace_conditions.append(Function("and", trace_condition))

        # Join all the user queries together into a single one where at least 1 have
        # to be true.
        if not trace_conditions:
            query.columns.append(Function("count", [], MATCHING_COUNT_ALIAS))
        elif len(trace_conditions) == 1:
            query.columns.append(Function("countIf", trace_conditions, MATCHING_COUNT_ALIAS))
        else:
            query.columns.append(
                Function("countIf", [Function("or", trace_conditions)], MATCHING_COUNT_ALIAS)
            )

        if options.get("performance.traces.trace-explorer-skip-floating-spans"):
            query.add_conditions([Condition(Column("transaction_id"), Op.IS_NOT_NULL, None)])

        return query, Referrer.API_TRACE_EXPLORER_TRACES_META

    def get_traces_errors_query(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[BaseQueryBuilder, Referrer]:
        query = DiscoverQueryBuilder(
            Dataset.Events,
            params={},
            snuba_params=snuba_params,
            query=None,
            selected_columns=["trace", "count()"],
            limit=len(trace_ids),
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        # restrict the query to just this subset of trace ids
        query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])

        return query, Referrer.API_TRACE_EXPLORER_TRACES_ERRORS

    def get_traces_occurrences_query(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[BaseQueryBuilder, Referrer]:
        query = DiscoverQueryBuilder(
            Dataset.IssuePlatform,
            params={},
            snuba_params=snuba_params,
            query=None,
            selected_columns=["trace", "count()"],
            limit=len(trace_ids),
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        # restrict the query to just this subset of trace ids
        query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])

        return query, Referrer.API_TRACE_EXPLORER_TRACES_OCCURRENCES


class TraceSpansExecutor:
    def __init__(
        self,
        *,
        dataset: Dataset,
        snuba_params: SnubaParams,
        trace_id: str,
        fields: list[str],
        user_queries: list[str],
        sort: list[str] | None,
        metrics_max: float | None,
        metrics_min: float | None,
        metrics_operation: str | None,
        metrics_query: str | None,
        mri: str | None,
    ):
        self.dataset = dataset
        self.snuba_params = snuba_params
        self.trace_id = trace_id
        self.fields = fields
        self.user_queries = process_user_queries(snuba_params, user_queries, dataset)
        self.metrics_max = metrics_max
        self.metrics_min = metrics_min
        self.metrics_operation = metrics_operation
        self.metrics_query = metrics_query
        self.mri = mri
        self.sort = sort

    def execute(self, offset: int, limit: int):
        with handle_span_query_errors():
            span_keys = self.get_metrics_span_keys()

        with handle_span_query_errors():
            spans = self.get_user_spans(
                self.snuba_params,
                span_keys,
                offset=offset,
                limit=limit,
            )

        return spans

    def get_metrics_span_keys(self) -> list[SpanKey] | None:
        if self.mri is None:
            return None

        executor_cls = get_sample_list_executor_cls(self.mri)
        if executor_cls is None:
            raise ParseError(detail=f"Unsupported MRI: {self.mri}")

        executor = executor_cls(
            mri=self.mri,
            snuba_params=self.snuba_params,
            fields=["trace"],
            max=self.metrics_max,
            min=self.metrics_min,
            operation=self.metrics_operation,
            query=self.metrics_query,
            referrer=Referrer.API_TRACE_EXPLORER_METRICS_SPANS_LIST,
        )

        span_keys = executor.get_matching_spans_from_traces(
            [self.trace_id],
            MAX_SNUBA_RESULTS,
        )

        return span_keys

    def get_user_spans(
        self,
        snuba_params: SnubaParams,
        span_keys: list[SpanKey] | None,
        limit: int,
        offset: int,
    ):
        user_spans_query = self.get_user_spans_query(
            snuba_params,
            span_keys,
            limit=limit,
            offset=offset,
        )

        user_spans_results = user_spans_query.run_query(
            referrer=Referrer.API_TRACE_EXPLORER_TRACE_SPANS_LIST.value
        )
        user_spans_results = user_spans_query.process_results(user_spans_results)

        meta = self.process_meta_results(user_spans_results)
        data = self.process_final_results(user_spans_results)

        return {"data": data, "meta": meta}

    def get_user_spans_query(
        self,
        snuba_params: SnubaParams,
        span_keys: list[SpanKey] | None,
        limit: int,
        offset: int,
    ) -> BaseQueryBuilder:
        if self.dataset == Dataset.EventsAnalyticsPlatform:
            # span_keys is not supported in EAP mode because that's a legacy
            # code path to support metrics that no longer exists
            return self.get_user_spans_query_eap(snuba_params, limit, offset)
        return self.get_user_spans_query_indexed(snuba_params, span_keys, limit, offset)

    def get_user_spans_query_eap(
        self,
        snuba_params: SnubaParams,
        limit: int,
        offset: int,
    ) -> BaseQueryBuilder:
        user_spans_query = SpansEAPQueryBuilder(
            Dataset.EventsAnalyticsPlatform,
            params={},
            snuba_params=snuba_params,
            query=None,  # Note: conditions are added below
            selected_columns=self.fields,
            orderby=self.sort,
            limit=limit,
            offset=offset,
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        user_conditions = []

        for where in self.user_queries.values():
            user_conditions.append(where)

        # First make sure that we only return spans from the trace specified
        user_spans_query.add_conditions([Condition(Column("trace_id"), Op.EQ, self.trace_id)])

        conditions = []

        # Next we have to turn the user queries into the appropriate conditions in
        # the SnQL that we produce.

        # There are multiple sets of user conditions that needs to be satisfied
        # and if a span satisfy any of them, it should be considered.
        #
        # To handle this use case, we want to OR all the user specified
        # conditions together in this query.
        for where in user_conditions:
            if len(where) > 1:
                conditions.append(BooleanCondition(op=BooleanOp.AND, conditions=where))
            elif len(where) == 1:
                conditions.append(where[0])

        if len(conditions) > 1:
            # More than 1 set of conditions were specified, we want to show
            # spans that match any 1 of them so join the conditions with `OR`s.
            user_spans_query.add_conditions(
                [BooleanCondition(op=BooleanOp.OR, conditions=conditions)]
            )
        elif len(conditions) == 1:
            # Only 1 set of user conditions were specified, simply insert them into
            # the final query.
            user_spans_query.add_conditions([conditions[0]])

        return user_spans_query

    def get_user_spans_query_indexed(
        self,
        snuba_params: SnubaParams,
        span_keys: list[SpanKey] | None,
        limit: int,
        offset: int,
    ) -> BaseQueryBuilder:
        user_spans_query = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params={},
            snuba_params=snuba_params,
            query=None,  # Note: conditions are added below
            selected_columns=self.fields,
            orderby=self.sort,
            limit=limit,
            offset=offset,
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        user_conditions = []

        for where in self.user_queries.values():
            user_conditions.append(where)

        # First make sure that we only return spans from the trace specified
        user_spans_query.add_conditions([Condition(Column("trace_id"), Op.EQ, self.trace_id)])

        conditions = []

        if span_keys is None:
            # Next we have to turn the user queries into the appropriate conditions in
            # the SnQL that we produce.

            # There are multiple sets of user conditions that needs to be satisfied
            # and if a span satisfy any of them, it should be considered.
            #
            # To handle this use case, we want to OR all the user specified
            # conditions together in this query.
            for where in user_conditions:
                if len(where) > 1:
                    conditions.append(BooleanCondition(op=BooleanOp.AND, conditions=where))
                elif len(where) == 1:
                    conditions.append(where[0])

            if len(conditions) > 1:
                # More than 1 set of conditions were specified, we want to show
                # spans that match any 1 of them so join the conditions with `OR`s.
                user_spans_query.add_conditions(
                    [BooleanCondition(op=BooleanOp.OR, conditions=conditions)]
                )
            elif len(conditions) == 1:
                # Only 1 set of user conditions were specified, simply insert them into
                # the final query.
                user_spans_query.add_conditions([conditions[0]])
        else:
            # Next if there are known span_keys, we only try to fetch those spans
            # This are the additional conditions to better take advantage of the ORDER BY
            # on the spans table. This creates a list of conditions to be `OR`ed together
            # that can will be used by ClickHouse to narrow down the granules.
            #
            # The span ids are not in this condition because they are more effective when
            # specified within the `PREWHERE` clause. So, it's in a separate condition.
            conditions = [
                And(
                    [
                        Condition(user_spans_query.column("span.group"), Op.EQ, key.group),
                        Condition(
                            user_spans_query.column("timestamp"),
                            Op.EQ,
                            datetime.fromisoformat(key.timestamp),
                        ),
                    ]
                )
                for key in span_keys
            ]

            if len(conditions) == 1:
                order_by_condition = conditions[0]
            else:
                order_by_condition = Or(conditions)

            # Using `IN` combined with putting the list in a SnQL "tuple" triggers an optimizer
            # in snuba where it
            # 1. moves the condition into the `PREWHERE` clause
            # 2. maps the ids to the underlying UInt64 and uses the bloom filter index
            span_id_condition = Condition(
                user_spans_query.column("id"),
                Op.IN,
                Function("tuple", [key.span_id for key in span_keys]),
            )

            user_spans_query.add_conditions([order_by_condition, span_id_condition])

        return user_spans_query

    def process_meta_results(self, user_spans_results):
        fields = user_spans_results["meta"].get("fields", {})
        return {
            **user_spans_results["meta"],
            "fields": {field: fields[field] for field in self.fields},
        }

    def process_final_results(self, user_spans_results) -> list[Mapping[str, Any]]:
        return [
            {field: span[field] for field in self.fields} for span in user_spans_results["data"]
        ]


class TraceStatsExecutor:
    def __init__(
        self,
        *,
        dataset: Dataset,
        snuba_params: SnubaParams,
        columns: list[str],
        user_queries: list[str],
        rollup: int,
        zerofill_results: bool,
    ):
        self.dataset = dataset
        self.snuba_params = snuba_params
        self.columns = columns
        self.user_queries = process_user_queries(snuba_params, user_queries, dataset)
        self.rollup = rollup
        self.zerofill_results = zerofill_results

    def execute(self) -> SnubaTSResult:
        query = self.get_timeseries_query()
        result = query.run_query(Referrer.API_TRACE_EXPLORER_STATS.value)
        result = query.process_results(result)
        result["data"] = (
            discover.zerofill(
                result["data"],
                self.snuba_params.start_date,
                self.snuba_params.end_date,
                self.rollup,
                ["time"],
            )
            if self.zerofill_results
            else result["data"]
        )

        return SnubaTSResult(
            {
                "data": result["data"],
                "meta": result["meta"],
            },
            self.snuba_params.start_date,
            self.snuba_params.end_date,
            self.rollup,
        )

    def get_timeseries_query(self) -> BaseQueryBuilder:
        if self.dataset == Dataset.EventsAnalyticsPlatform:
            return self.get_timeseries_query_eap()
        return self.get_timeseries_query_indexed()

    def get_timeseries_query_eap(self) -> BaseQueryBuilder:
        query = TimeseriesSpanEAPIndexedQueryBuilder(
            Dataset.EventsAnalyticsPlatform,
            params={},
            snuba_params=self.snuba_params,
            interval=self.rollup,
            query=None,
            selected_columns=self.columns,
        )

        trace_conditions = []

        for where in self.user_queries.values():
            if len(where) == 1:
                trace_conditions.extend(where)
            elif len(where) > 1:
                trace_conditions.append(BooleanCondition(op=BooleanOp.AND, conditions=where))

        if len(trace_conditions) == 1:
            query.where.extend(trace_conditions)
        elif len(trace_conditions) > 1:
            query.where.append(BooleanCondition(op=BooleanOp.OR, conditions=trace_conditions))

        if options.get("performance.traces.trace-explorer-skip-floating-spans"):
            query.add_conditions([Condition(Column("segment_id"), Op.NEQ, "00")])

        return query

    def get_timeseries_query_indexed(self) -> BaseQueryBuilder:
        query = TimeseriesSpanIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params={},
            snuba_params=self.snuba_params,
            interval=self.rollup,
            query=None,
            selected_columns=self.columns,
        )

        trace_conditions = []

        for where in self.user_queries.values():
            if len(where) == 1:
                trace_conditions.extend(where)
            elif len(where) > 1:
                trace_conditions.append(BooleanCondition(op=BooleanOp.AND, conditions=where))

        if len(trace_conditions) == 1:
            query.where.extend(trace_conditions)
        elif len(trace_conditions) > 1:
            query.where.append(BooleanCondition(op=BooleanOp.OR, conditions=trace_conditions))

        if options.get("performance.traces.trace-explorer-skip-floating-spans"):
            query.add_conditions([Condition(Column("transaction_id"), Op.IS_NOT_NULL, None)])

        return query


def convert_to_slice(timestamp, trace_range, left_bound=None) -> int:
    slices = trace_range["slices"]
    trace_start = trace_range["start"]
    trace_end = trace_range["end"]
    trace_duration = trace_end - trace_start

    idx = round((timestamp - trace_start) * slices / trace_duration)

    if idx < slices and left_bound is not None and left_bound >= idx:
        idx = left_bound + 1

    return idx


def quantize_range(span_start, span_end, trace_range):
    slices = trace_range["slices"]
    trace_start = trace_range["start"]
    trace_end = trace_range["end"]

    trace_duration = trace_end - trace_start

    if trace_duration == 0:
        start_index = 0
        end_index = slices
    else:
        raw_start_index = convert_to_slice(span_start, trace_range)
        start_index = clip(raw_start_index, 0, slices)

        raw_end_index = convert_to_slice(span_end, trace_range, start_index)
        end_index = clip(raw_end_index, 0, slices)

        if raw_start_index != start_index:
            with sentry_sdk.isolation_scope() as scope:
                scope.set_extra("slice start", {"raw": raw_start_index, "clipped": start_index})
                sentry_sdk.capture_message("Slice start was adjusted", level="warning")

        if raw_end_index != end_index:
            with sentry_sdk.isolation_scope() as scope:
                scope.set_extra("slice end", {"raw": raw_end_index, "clipped": end_index})
                sentry_sdk.capture_message("Slice end was adjusted", level="warning")

    rounded_start = span_start
    rounded_end = span_end

    if slices > 0:
        bin_size = int((trace_end - trace_start) / slices)

        if bin_size > 0:
            rounded_start = round((span_start - trace_start) / bin_size) * bin_size + trace_start
            rounded_end = round((span_end - trace_start) / bin_size) * bin_size + trace_start

            # ensure minimum of 1 width
            if rounded_start == rounded_end:
                rounded_end += bin_size

    if span_start <= trace_start:
        rounded_start = trace_start

    # To avoid creating gaps at the end of the trace,
    # do not adjust the end if it's at the trace end.
    if span_end >= trace_end:
        rounded_end = trace_end

    return (int(rounded_start), int(rounded_end)), (start_index, end_index)


def new_trace_interval(row) -> TraceInterval:
    return {
        "kind": "project",
        "project": row["project"],
        "sdkName": row["sdk.name"],
        "start": row["quantized.start_ts"],
        "end": row["quantized.finish_ts"],
        "sliceStart": row["start_index"],
        "sliceEnd": row["end_index"],
        "sliceWidth": row["end_index"] - row["start_index"],
        "duration": 0,
        "components": [(row["precise.start_ts"], row["precise.finish_ts"])],
        "isRoot": not bool(row.get("parent_span")),
    }


def process_breakdowns(data, traces_range):
    breakdowns: Mapping[str, list[TraceInterval]] = {trace: [] for trace in traces_range}
    stacks: Mapping[str, list[TraceInterval]] = {trace: [] for trace in traces_range}

    def should_merge(interval_a, interval_b):
        return (
            # only merge intervals that have parent spans, i.e. those that aren't the trace root
            not interval_a["isRoot"]
            and not interval_b["isRoot"]
            # only merge intervals that overlap
            and interval_a["end"] >= interval_b["start"]
            # only merge intervals that are part of the same service
            and interval_a["project"] == interval_b["project"]
            and interval_a["sdkName"] == interval_b["sdkName"]
        )

    def breakdown_push(trace, interval):
        breakdown = breakdowns[trace]

        """ TODO: Add this back
        # Find the last interval. If there is an interval on the stack, it
        # should take priority over intervals in the breakdown because intervals
        # on the stack are always active, where intervals on the breakdown are
        # the most recently started, and it's possible older intervals end after
        # the newer intervals
        last_interval = stack_peek(trace)
        if last_interval is None and breakdown:
            last_interval = breakdown[-1]

        if last_interval and last_interval["end"] < interval["start"]:
            # A gap in the breakdown was found, fill it with a missing interval
            breakdown.append(
                {
                    "kind": "missing",
                    "project": None,
                    "sdkName": None,
                    "start": last_interval["end"],
                    "end": interval["start"],
                    "duration": 0,
                    "components": [
                        (last_interval["components"][-1][1], interval["components"][0][0]),
                    ],
                    "isRoot": False,
                }
            )
        """

        breakdown.append(interval)

    def stack_push(trace, interval):
        for last_interval in reversed(stacks[trace]):
            if not should_merge(last_interval, interval):
                continue
            # update the end of this interval and it will
            # be updated in the breakdown as well
            last_interval["end"] = max(interval["end"], last_interval["end"])
            last_interval["sliceEnd"] = max(interval["sliceEnd"], last_interval["sliceEnd"])

            # need to update the components of the last interval by merging
            # current interval into it
            last_component = last_interval["components"][-1]
            # there should always be 1 component in the current interval
            assert len(interval["components"]) == 1
            cur_component = interval["components"][0]
            if last_component[1] >= cur_component[0]:
                last_interval["components"][-1] = (
                    last_component[0],
                    max(last_component[1], cur_component[1]),
                )
            else:
                last_interval["components"].extend(interval["components"])

            return

        # Make sure to push the breakdown before the stack. This is because
        # pushing the breakdown can fill in missing intervals but that needs
        # to know what the current state of the stack is. If we push the
        # interval onto the stack first, it would not generate the missing
        # intervals correctly.
        breakdown_push(trace, interval)

        stack = stacks[trace]
        stack.append(interval)

    def stack_peek(trace):
        if not stacks[trace]:
            return None
        return stacks[trace][-1]

    def stack_pop(trace):
        return stacks[trace].pop()

    def stack_clear(trace, until=None):
        while stacks[trace]:
            if until is not None and stack_peek(trace)["end"] >= until:
                break
            stack_pop(trace)

    quantized_data = []

    for row in data:
        try:
            trace = row["trace"]
            precise_start = int(row["precise.start_ts"] * 1000)
            precise_end = int(row["precise.finish_ts"] * 1000)

            trace_range = traces_range[trace]
            trace_start = trace_range["start"]
            trace_end = trace_range["end"]

            # clip the intervals os that it is within range of the trace
            precise_start = clip(precise_start, trace_start, trace_end)
            precise_end = clip(precise_end, trace_start, trace_end)

            (quantized_start, quantized_end), (start_index, end_index) = quantize_range(
                precise_start,
                precise_end,
                traces_range[trace],
            )

            quantized_data.append(
                {
                    **row,
                    "precise.start_ts": precise_start,
                    "precise.finish_ts": precise_end,
                    "quantized.start_ts": quantized_start,
                    "quantized.finish_ts": quantized_end,
                    "start_index": start_index,
                    "end_index": end_index,
                }
            )
        except Exception as e:
            context = {"trace": row["trace"]}
            sentry_sdk.capture_exception(e, contexts={"bad_trace": context})

    quantized_data.sort(
        key=lambda row: (
            row["start_index"],
            row["precise.start_ts"],
            -row["end_index"],
            -row["precise.finish_ts"],
        )
    )

    last_timestamp_per_trace: dict[str, int] = defaultdict(int)

    for row in quantized_data:
        try:
            trace = row["trace"]

            last_timestamp_per_trace["trace"] = max(
                row["precise.finish_ts"], last_timestamp_per_trace["trace"]
            )

            if row["start_index"] == row["end_index"]:
                # after quantizing, this span is far too small to render, so remove it
                continue

            cur = new_trace_interval(row)

            # Clear the stack of any intervals that end before the current interval
            # starts while pushing them to the breakdowns.
            stack_clear(trace, until=cur["start"])

            stack_push(trace, cur)
        except Exception as e:
            context = {"trace": row["trace"]}
            sentry_sdk.capture_exception(e, contexts={"bad_trace": context})

    """ TODO: Add this back
    for trace, trace_range in traces_range.items():
        # Check to see if there is still a gap before the trace ends and fill it
        # with an other interval.

        other_start = trace_range["start"]
        other_end = trace_range["end"]
        other: TraceInterval = {
            "kind": "other",
            "project": None,
            "sdkName": None,
            "start": other_start,
            "end": other_end,
            "duration": 0,
            "isRoot": False,
        }

        # Clear the remaining intervals on the stack to find the latest end time
        # of the intervals. This will be used to decide if there are any portion
        # of the trace that was not covered by one of the intervals.
        while stacks[trace]:
            interval = stack_pop(trace)
            other["start"] = max(other["start"], interval["end"])
            # other["start"] = max(other["start"], interval["components"][-1][1])
            last_component = interval["components"][-1]
            other_start = max(other_start, last_component[1])

        other["components"] = [(other_start, other_end)]

        if other["start"] < other["end"]:
            breakdown_push(trace, other)
    """

    for breakdown in breakdowns.values():
        for interval in breakdown:
            components = interval.pop("components", [])
            component_duration = sum(component[1] - component[0] for component in components)
            interval_duration = interval["end"] - interval["start"]

            # in the event we don't have a duration from the components, we fall back to the interval
            interval["duration"] = (
                component_duration if component_duration > 0 else interval_duration
            )

            interval["sliceWidth"] = interval["sliceEnd"] - interval["sliceStart"]

    return breakdowns


def process_user_queries(
    snuba_params: SnubaParams,
    user_queries: list[str],
    dataset: Dataset = Dataset.SpansIndexed,
) -> dict[str, list[list[WhereType]]]:
    with handle_span_query_errors():
        if dataset == Dataset.EventsAnalyticsPlatform:
            span_indexed_builder = SpansEAPQueryBuilder(
                dataset,
                params={},
                snuba_params=snuba_params,
                query=None,  # Note: conditions are added below
                selected_columns=[],
                config=QueryBuilderConfig(
                    transform_alias_to_input_format=True,
                ),
            )
            resolve_conditions = span_indexed_builder.resolve_conditions
        else:
            span_eap_builder = SpansIndexedQueryBuilder(
                dataset,
                params={},
                snuba_params=snuba_params,
                query=None,  # Note: conditions are added below
                selected_columns=[],
                config=QueryBuilderConfig(
                    transform_alias_to_input_format=True,
                ),
            )
            resolve_conditions = span_eap_builder.resolve_conditions

        queries: dict[str, list[list[WhereType]]] = {}

        for user_query in user_queries:
            user_query = user_query.strip()

            # Filter out empty queries as they do not do anything to change the results.
            if not user_query:
                continue

            # We want to ignore all the aggregate conditions here because we're strictly
            # searching on span attributes, not aggregates
            where, _ = resolve_conditions(user_query)
            queries[user_query] = where

    set_measurement("user_queries_count", len(queries))
    sentry_sdk.set_context("user_queries", {"raw_queries": user_queries})

    return queries


OP_TO_FUNC = {
    Op.GT: "greater",
    Op.LT: "less",
    Op.GTE: "greaterOrEquals",
    Op.LTE: "lessOrEquals",
    Op.EQ: "equals",
    Op.NEQ: "notEquals",
    Op.IN: "in",
    Op.NOT_IN: "notIn",
    Op.LIKE: "like",
    Op.NOT_LIKE: "notLike",
}


def generate_trace_condition(span_conditions: list[WhereType]) -> WhereType | None:
    trace_conditions: list[Function] = format_as_trace_conditions(span_conditions)

    if not trace_conditions:
        return None
    elif len(trace_conditions) == 1:
        return Condition(Function("countIf", trace_conditions), Op.GT, 0)
    else:
        return Condition(Function("countIf", [Function("and", trace_conditions)]), Op.GT, 0)


def format_as_trace_conditions(span_conditions: list[WhereType]) -> list[Function]:
    return [format_as_trace_condition(span_condition) for span_condition in span_conditions]


def format_as_trace_condition(span_condition: WhereType) -> Function:
    if isinstance(span_condition, Condition):
        if span_condition.op == Op.IS_NULL:
            return Function("isNull", span_condition.lhs)
        elif span_condition.op == Op.IS_NOT_NULL:
            return Function("isNotNull", span_condition.lhs)
        else:
            return Function(
                OP_TO_FUNC[span_condition.op],
                [span_condition.lhs, span_condition.rhs],
            )
    elif isinstance(span_condition, BooleanCondition):
        if span_condition.op == BooleanOp.AND:
            return Function(
                "and",
                format_as_trace_conditions(span_condition.conditions),
            )
        elif span_condition.op == BooleanOp.OR:
            return Function(
                "or",
                format_as_trace_conditions(span_condition.conditions),
            )
        else:
            raise ValueError(f"{span_condition.op} is not a BooleanOp")
    else:
        raise ValueError(f"{span_condition} is not a Condition or BooleanCondition")
