import math
from collections import defaultdict
from collections.abc import Generator, Mapping, MutableMapping, Sequence
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Literal, NotRequired, TypedDict, cast

import sentry_sdk
from rest_framework import serializers
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import And, BooleanCondition, BooleanOp, Column, Condition, Function, LimitBy, Op, Or
from snuba_sdk.expressions import Expression
from urllib3.exceptions import ReadTimeoutError

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.builder import (
    QueryBuilder,
    SpansIndexedQueryBuilder,
    TimeseriesSpanIndexedQueryBuilder,
)
from sentry.search.events.constants import TIMEOUT_SPAN_ERROR_MESSAGE
from sentry.search.events.types import ParamsType, QueryBuilderConfig, SnubaParams, WhereType
from sentry.sentry_metrics.querying.samples_list import SpanKey, get_sample_list_executor_cls
from sentry.services.hybrid_cloud.organization import RpcOrganization
from sentry.snuba import discover, spans_indexed
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.iterators import chunked
from sentry.utils.numbers import clip
from sentry.utils.snuba import SnubaTSResult, bulk_snuba_queries

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
    duration: int
    start: int
    end: int
    breakdowns: list[TraceInterval]
    spans: list[Mapping[str, Any]]
    suggestedSpans: list[Mapping[str, Any]]


class OrganizationTracesSerializer(serializers.Serializer):
    metricsMax = serializers.FloatField(required=False)
    metricsMin = serializers.FloatField(required=False)
    metricsOp = serializers.CharField(required=False)
    metricsQuery = serializers.CharField(required=False)
    mri = serializers.CharField(required=False)

    breakdownSlices = serializers.IntegerField(default=40, min_value=1, max_value=100)
    field = serializers.ListField(required=True, allow_empty=False, child=serializers.CharField())
    sort = serializers.ListField(required=False, allow_empty=True, child=serializers.CharField())
    query = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField(allow_blank=True)
    )
    suggestedQuery = serializers.CharField(required=False)
    maxSpansPerTrace = serializers.IntegerField(default=1, min_value=1, max_value=100)


@contextmanager
def handle_span_query_errors() -> Generator[None, None, None]:
    with handle_query_errors():
        try:
            yield
        except ReadTimeoutError:
            raise ParseError(detail=TIMEOUT_SPAN_ERROR_MESSAGE)


class OrganizationTracesEndpointBase(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.PERFORMANCE

    def get_snuba_dataclass(
        self, request: Request, organization: Organization, check_global_views: bool = True
    ) -> tuple[SnubaParams, dict[str, Any]]:
        """The trace endpoint always wants to get all projects regardless of what's passed into the API.
        This is because a trace can span any number of projects in an organization. So disable the
        check_global_views condition."""
        return super().get_snuba_dataclass(request, organization, check_global_views=False)

    def get_projects(  # type: ignore[override]
        self,
        request: Request,
        organization: Organization | RpcOrganization,
        project_ids: set[int] | None = None,
        project_slugs: set[str] | None = None,
        include_all_accessible: bool = True,
    ) -> list[Project]:
        """The trace endpoint always wants to get all projects regardless of what's passed into the API.

        This is because a trace can span any number of projects in an organization. But we still want to
        use the get_projects function to check for any permissions. So we'll just pass project_ids=-1 everytime
        which is what would be sent if we wanted all projects"""
        return super().get_projects(
            request,
            organization,
            project_ids={-1},
            project_slugs=None,
            include_all_accessible=True,
        )


@region_silo_endpoint
class OrganizationTracesEndpoint(OrganizationTracesEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params, params = self.get_snuba_dataclass(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = OrganizationTracesSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        executor = TracesExecutor(
            params=cast(ParamsType, params),
            snuba_params=snuba_params,
            fields=serialized["field"],
            user_queries=serialized.get("query", []),
            suggested_query=serialized.get("suggestedQuery", ""),
            sort=serialized.get("sort"),
            metrics_max=serialized.get("metricsMax"),
            metrics_min=serialized.get("metricsMin"),
            metrics_operation=serialized.get("metricsOp"),
            metrics_query=serialized.get("metricsQuery"),
            mri=serialized.get("mri"),
            limit=self.get_per_page(request),
            max_spans_per_trace=serialized["maxSpansPerTrace"],
            breakdown_slices=serialized["breakdownSlices"],
        )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=executor.execute),
            on_results=lambda results: self.handle_results_with_meta(
                request,
                organization,
                params["project_id"],
                results,
                standard_meta=True,
                dataset=Dataset.SpansIndexed,
            ),
        )


class OrganizationTraceSpansSerializer(serializers.Serializer):
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


@region_silo_endpoint
class OrganizationTraceSpansEndpoint(OrganizationTracesEndpointBase):
    def get(self, request: Request, organization: Organization, trace_id: str) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params, params = self.get_snuba_dataclass(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = OrganizationTraceSpansSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        executor = TraceSpansExecutor(
            params=cast(ParamsType, params),
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
                params["project_id"],
                results,
                standard_meta=True,
                dataset=Dataset.SpansIndexed,
            ),
        )


class OrganizationTracesStatsSerializer(serializers.Serializer):
    query = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField(allow_blank=True)
    )
    yAxis = serializers.ListField(required=True, child=serializers.CharField())


@region_silo_endpoint
class OrganizationTracesStatsEndpoint(OrganizationTracesEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params, params = self.get_snuba_dataclass(request, organization)
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
            _params: dict[str, str],
            rollup: int,
            zerofill_results: bool,
            comparison_delta: timedelta | None,
        ) -> SnubaTSResult:
            executor = TraceStatsExecutor(
                params=cast(ParamsType, params),
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
        params: ParamsType,
        snuba_params: SnubaParams,
        fields: list[str],
        user_queries: list[str],
        suggested_query: str,
        metrics_max: float | None,
        metrics_min: float | None,
        metrics_operation: str | None,
        metrics_query: str | None,
        mri: str | None,
        sort: str | None,
        limit: int,
        max_spans_per_trace: int,
        breakdown_slices: int,
    ):
        self.params = params
        self.snuba_params = snuba_params
        self.fields = fields
        # Filter out empty queries as they do not do anything to change the results.
        self.user_queries = {
            query.strip(): i + 1  # ensure no zero ids
            for i, query in enumerate(user_queries)
            if query.strip()
        }
        self.suggested_query = suggested_query
        self.metrics_max = metrics_max
        self.metrics_min = metrics_min
        self.metrics_operation = metrics_operation
        self.metrics_query = metrics_query
        self.mri = mri
        self.sort = sort
        self.limit = limit
        self.max_spans_per_trace = max_spans_per_trace
        self.breakdown_slices = breakdown_slices

    def execute(self, offset: int, limit: int):
        return self._execute()

    def _execute(self):
        selected_projects_params = self.params
        selected_projects_snuba_params = self.snuba_params

        with handle_span_query_errors():
            (
                min_timestamp,
                max_timestamp,
                trace_ids,
                span_keys,
            ) = self.get_traces_matching_conditions(
                selected_projects_params,
                selected_projects_snuba_params,
            )

        self.refine_params(min_timestamp, max_timestamp)

        if not trace_ids:
            return {"data": [], "meta": {"fields": {}}}

        with handle_span_query_errors():
            all_queries = self.get_all_queries(
                self.params,
                self.snuba_params,
                trace_ids,
                span_keys,
            )

            all_raw_results = bulk_snuba_queries(
                [query.get_snql_query() for query in all_queries],
                Referrer.API_TRACE_EXPLORER_TRACES_META.value,
            )

            all_results = [
                query.process_results(result) for query, result in zip(all_queries, all_raw_results)
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

            user_spans_results = all_results[idx]
            idx += 1

            suggested_spans_results = all_results[idx] if len(all_results) > idx else None
            idx += 1

            meta = self.process_meta_results(user_spans_results)
            data = self.process_final_results(
                traces_metas_results=traces_metas_results,
                traces_errors_results=traces_errors_results,
                traces_occurrences_results=traces_occurrences_results,
                traces_breakdown_projects_results=traces_breakdown_projects_results,
                user_spans_results=user_spans_results,
                suggested_spans_results=suggested_spans_results,
            )

        return {"data": data, "meta": meta}

    def refine_params(self, min_timestamp: datetime, max_timestamp: datetime):
        """
        Once we have a min/max timestamp for all the traces in the query,
        refine the params so that it selects a time range that is as small as possible.
        """

        # TODO: move to use `update_snuba_params_with_timestamp`
        time_buffer = options.get("performance.traces.trace-explorer-buffer-hours")
        buffer = timedelta(hours=time_buffer)

        self.params["start"] = min_timestamp - buffer
        self.params["end"] = max_timestamp + buffer
        self.snuba_params.start = min_timestamp - buffer
        self.snuba_params.end = max_timestamp + buffer

    def get_traces_matching_conditions(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
    ) -> tuple[datetime, datetime, list[str], list[SpanKey] | None]:
        if self.mri is not None:
            return self.get_traces_matching_metric_conditions(params, snuba_params)

        min_timestamp, max_timestamp, trace_ids = self.get_traces_matching_span_conditions(
            params, snuba_params
        )
        return min_timestamp, max_timestamp, trace_ids, None

    def get_traces_matching_metric_conditions(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
    ) -> tuple[datetime, datetime, list[str], list[SpanKey]]:
        assert self.mri is not None

        executor_cls = get_sample_list_executor_cls(self.mri)
        if executor_cls is None:
            raise ParseError(detail=f"Unsupported MRI: {self.mri}")

        executor = executor_cls(
            mri=self.mri,
            params=params,
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
            if timestamp < min_timestamp:
                min_timestamp = timestamp
            if timestamp > max_timestamp:
                max_timestamp = timestamp

        if not trace_ids or min_timestamp > max_timestamp:
            return min_timestamp, max_timestamp, [], []

        self.refine_params(min_timestamp, max_timestamp)

        if self.user_queries:
            # If there are user queries, further refine the trace ids by applying them
            # leaving us with only traces where the metric exists and matches the user
            # queries.
            (
                min_timestamp,
                max_timestamp,
                trace_ids,
            ) = self.get_traces_matching_span_conditions_in_traces(params, snuba_params, trace_ids)

            if not trace_ids:
                return min_timestamp, max_timestamp, [], []
        else:
            # No user queries so take the first N trace ids as our list
            min_timestamp = snuba_params.end
            max_timestamp = snuba_params.start
            assert min_timestamp is not None
            assert max_timestamp is not None

            trace_ids = trace_ids[: self.limit]
            timestamps = timestamps[: self.limit]
            for timestamp in timestamps:
                if timestamp < min_timestamp:
                    min_timestamp = timestamp
                if timestamp > max_timestamp:
                    max_timestamp = timestamp

        self.refine_params(min_timestamp, max_timestamp)

        span_keys = executor.get_matching_spans_from_traces(
            trace_ids,
            self.max_spans_per_trace,
        )

        if not span_keys:
            # TODO: log a message that we found traces but no span ids for metrics condition
            return min_timestamp, max_timestamp, [], []

        return min_timestamp, max_timestamp, trace_ids, span_keys

    def get_traces_matching_span_conditions(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str] | None = None,
    ) -> tuple[datetime, datetime, list[str]]:
        all_queries: list[QueryBuilder] = []
        timestamp_column: str | None = None

        query, timestamp_column = self.get_traces_matching_span_conditions_query(
            params,
            snuba_params,
        )
        all_queries.append(query)

        if options.get("performance.traces.trace-explorer-skip-floating-spans"):
            for query in all_queries:
                query.add_conditions([Condition(Column("transaction_id"), Op.IS_NOT_NULL, None)])

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
                if timestamp < min_timestamp:
                    min_timestamp = timestamp
                if timestamp > max_timestamp:
                    max_timestamp = timestamp

                # early escape once we have enough results
                if len(matching_trace_ids) >= self.limit:
                    return min_timestamp, max_timestamp, matching_trace_ids

        return min_timestamp, max_timestamp, matching_trace_ids

    def get_traces_matching_span_conditions_in_traces(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> tuple[datetime, datetime, list[str]]:
        all_queries: list[QueryBuilder] = []
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
                params,
                snuba_params,
            )

            # restrict the query to just this subset of trace ids
            query.add_conditions(
                [
                    Condition(
                        Column("trace_id"),
                        Op.IN,
                        Function("splitByChar", [",", ",".join(chunk)]),
                    )
                ]
            )

            all_queries.append(query)

        if options.get("performance.traces.trace-explorer-skip-floating-spans"):
            for query in all_queries:
                query.add_conditions([Condition(Column("transaction_id"), Op.IS_NOT_NULL, None)])

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
                if timestamp < min_timestamp:
                    min_timestamp = timestamp
                if timestamp > max_timestamp:
                    max_timestamp = timestamp

                # early escape once we have enough results
                if len(matching_trace_ids) >= self.limit:
                    return min_timestamp, max_timestamp, matching_trace_ids

        return min_timestamp, max_timestamp, matching_trace_ids

    def get_traces_matching_span_conditions_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
    ) -> tuple[QueryBuilder, str]:
        if len(self.user_queries) < 2:
            # Optimization: If there is only a condition for a single span,
            # we can take the fast path and query without using aggregates.
            timestamp_column = "timestamp"
            query = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params=params,
                snuba_params=snuba_params,
                query=next(iter(self.user_queries)) if self.user_queries else None,
                selected_columns=["trace", timestamp_column],
                # The orderby is intentionally `None` here as this query is much faster
                # if we let Clickhouse decide which order to return the results in.
                # This also means we cannot order by any columns or paginate.
                orderby=None,
                limit=self.limit,
                limitby=("trace", 1),
                config=QueryBuilderConfig(
                    transform_alias_to_input_format=True,
                ),
            )
        else:
            timestamp_column = "min(timestamp)"
            query = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params=params,
                snuba_params=snuba_params,
                query=None,
                selected_columns=["trace", timestamp_column],
                # The orderby is intentionally `None` here as this query is much faster
                # if we let Clickhouse decide which order to return the results in.
                # This also means we cannot order by any columns or paginate.
                orderby=None,
                limit=self.limit,
                config=QueryBuilderConfig(
                    auto_aggregations=True,
                    transform_alias_to_input_format=True,
                ),
            )

            trace_conditions = []
            for user_query in self.user_queries:
                # We want to ignore all the aggregate conditions here because we're strictly
                # searching on span attributes, not aggregates
                where, _ = query.resolve_conditions(user_query)
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

        return query, timestamp_column

    def get_all_queries(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
        span_keys: list[SpanKey] | None,
    ) -> list[QueryBuilder]:
        meta_data_queries = self.get_all_meta_data_queries(
            params,
            snuba_params,
            trace_ids,
        )

        span_samples_queries = self.get_all_span_samples_queries(
            params,
            snuba_params,
            trace_ids,
            span_keys,
        )

        return meta_data_queries + span_samples_queries

    def get_all_meta_data_queries(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> list[QueryBuilder]:
        traces_metas_query = self.get_traces_metas_query(
            params,
            snuba_params,
            trace_ids,
        )

        traces_errors_query = self.get_traces_errors_query(
            params,
            snuba_params,
            trace_ids,
        )

        traces_occurrences_query = self.get_traces_occurrences_query(
            params,
            snuba_params,
            trace_ids,
        )

        traces_breakdown_projects_query = self.get_traces_breakdown_projects_query(
            params,
            snuba_params,
            trace_ids,
        )

        queries = [
            traces_metas_query,
            traces_errors_query,
            traces_occurrences_query,
            traces_breakdown_projects_query,
        ]

        return queries

    def get_all_span_samples_queries(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
        span_keys: list[SpanKey] | None,
    ) -> list[QueryBuilder]:
        user_spans_query = self.get_user_spans_query(
            params,
            snuba_params,
            trace_ids,
            span_keys,
        )

        suggested_spans_query = self.get_suggested_spans_query(
            params,
            snuba_params,
            trace_ids,
        )

        span_samples_queries = [user_spans_query]

        if suggested_spans_query:
            span_samples_queries.append(suggested_spans_query)

        return span_samples_queries

    def process_final_results(
        self,
        *,
        traces_metas_results,
        traces_errors_results,
        traces_occurrences_results,
        traces_breakdown_projects_results,
        user_spans_results,
        suggested_spans_results,
    ) -> list[TraceResult]:
        # mapping of trace id to a tuple of start/finish times
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

        # Normally, the name given to a trace is the name of the first root transaction
        # found within the trace.
        #
        # But there are some cases where traces do not have any root transactions. For
        # these traces, we try to pick out a name from the first span that is a good
        # candidate for the trace name.
        traces_primary_names: MutableMapping[str, tuple[str, str]] = {}
        traces_fallback_names: MutableMapping[str, tuple[str, str]] = {}
        for row in traces_breakdown_projects_results["data"]:
            if row["trace"] in traces_primary_names:
                continue
            else:
                # The underlying column is a Nullable(UInt64) but we write a default of 0 to it.
                # So make sure to handle both in case something changes.
                if not row["parent_span"] or int(row["parent_span"], 16) == 0:
                    traces_primary_names[row["trace"]] = (row["project"], row["transaction"])

            if row["trace"] not in traces_fallback_names and is_trace_name_candidate(row):
                traces_fallback_names[row["trace"]] = (row["project"], row["transaction"])

        def get_trace_name(trace):
            if trace in traces_primary_names:
                return traces_primary_names[trace]

            if trace in traces_fallback_names:
                return traces_fallback_names[trace]

            return (None, None)

        traces_errors: Mapping[str, int] = {
            row["trace"]: row["count()"] for row in traces_errors_results["data"]
        }

        traces_occurrences: Mapping[str, int] = {
            row["trace"]: row["count()"] for row in traces_occurrences_results["data"]
        }

        traces_user_spans: Mapping[str, list[Mapping[str, Any]]] = defaultdict(list)
        for row in user_spans_results["data"]:
            traces_user_spans[row["trace"]].append(row)

        traces_suggested_spans: Mapping[str, list[Mapping[str, Any]]] = defaultdict(list)
        if suggested_spans_results:
            for row in suggested_spans_results["data"]:
                traces_suggested_spans[row["trace"]].append(row)

        for row in traces_metas_results["data"]:
            if not traces_user_spans[row["trace"]]:
                context = {
                    "trace": row["trace"],
                    "start": row["first_seen()"],
                    "end": row["last_seen()"],
                }
                sentry_sdk.capture_message(
                    "trace missing spans", contexts={"trace_missing_spans": context}
                )

        return [
            {
                "trace": row["trace"],
                "numErrors": traces_errors.get(row["trace"], 0),
                "numOccurrences": traces_occurrences.get(row["trace"], 0),
                "matchingSpans": row[MATCHING_COUNT_ALIAS],
                "numSpans": row["count()"],
                "project": get_trace_name(row["trace"])[0],
                "name": get_trace_name(row["trace"])[1],
                "duration": row["last_seen()"] - row["first_seen()"],
                "start": row["first_seen()"],
                "end": row["last_seen()"],
                "breakdowns": traces_breakdowns[row["trace"]],
                "spans": [
                    {field: span[field] for field in self.fields}
                    for span in traces_user_spans[row["trace"]]
                ],
                "suggestedSpans": [
                    {field: span[field] for field in self.fields}
                    for span in traces_suggested_spans[row["trace"]]
                ],
            }
            for row in traces_metas_results["data"]
            if traces_user_spans[row["trace"]]
        ]

    def process_meta_results(self, results):
        fields = results["meta"].get("fields", {})
        return {
            **results["meta"],
            "fields": {field: fields[field] for field in self.fields},
        }

    def get_traces_breakdown_projects_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> QueryBuilder:
        trace_ids_str = ",".join(trace_ids)
        trace_ids_condition = f"trace:[{trace_ids_str}]"
        return SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            snuba_params=snuba_params,
            query=f"is_transaction:1 {trace_ids_condition}",
            selected_columns=[
                "trace",
                "project",
                "sdk.name",
                "span.op",
                "parent_span",
                "transaction",
                "precise.start_ts",
                "precise.finish_ts",
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

    def get_traces_metas_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> QueryBuilder:
        trace_ids_str = ",".join(trace_ids)
        trace_ids_condition = f"trace:[{trace_ids_str}]"
        query = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            snuba_params=snuba_params,
            query=trace_ids_condition,
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

        """
        We want to get a count of the number of matching spans. To do this, we have to
        translate the user queries into conditions, and get a count of spans that match
        any one of the user queries.
        """

        # Translate each user query into a condition to match one
        trace_conditions = []
        for user_query in self.user_queries:
            # We want to ignore all the aggregate conditions here because we're strictly
            # searching on span attributes, not aggregates
            where, _ = query.resolve_conditions(user_query)

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

        return query

    def get_traces_errors_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> QueryBuilder:
        trace_ids_str = ",".join(trace_ids)
        trace_ids_condition = f"trace:[{trace_ids_str}]"
        return QueryBuilder(
            Dataset.Events,
            params,
            snuba_params=snuba_params,
            query=trace_ids_condition,
            selected_columns=["trace", "count()"],
            limit=len(trace_ids),
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

    def get_traces_occurrences_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> QueryBuilder:
        trace_ids_str = ",".join(trace_ids)
        trace_ids_condition = f"trace:[{trace_ids_str}]"
        return QueryBuilder(
            Dataset.IssuePlatform,
            params,
            snuba_params=snuba_params,
            query=trace_ids_condition,
            selected_columns=["trace", "count()"],
            limit=len(trace_ids),
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

    def get_user_spans_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
        span_keys: list[SpanKey] | None,
    ) -> QueryBuilder:
        # Divide the allowed number of results per trace amoung the number of queries
        limit_per_query = self.max_spans_per_trace
        if self.user_queries:
            limit_per_query = math.floor(self.max_spans_per_trace / len(self.user_queries))
        limit_per_query = max(limit_per_query, 1)

        limit = len(trace_ids) * limit_per_query
        if self.user_queries:
            limit *= len(self.user_queries)

        user_spans_query = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            snuba_params=snuba_params,
            query=None,  # Note: conditions are added below
            selected_columns=["trace"] + self.fields,
            orderby=self.sort,
            limit=limit,
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        user_conditions = []

        multi_if_args: Expression = []

        for query, i in self.user_queries.items():
            where, _ = user_spans_query.resolve_conditions(query)

            # The user conditions may be needed to identify which spans
            # to fetch if not using span keys. So hold on to them for later.
            user_conditions.append(where)

            trace_conditions: list[Function] = format_as_trace_conditions(where)
            if not trace_conditions:
                pass
            elif len(trace_conditions) == 1:
                multi_if_args.append(trace_conditions[0])
                multi_if_args.append(i)
            elif len(trace_conditions) > 1:
                multi_if_args.append(Function("and", trace_conditions))
                multi_if_args.append(i)

        # Insert three 0s to the end
        # - a placeholder false condition so there's always a condition
        # - a default value of 0
        multi_if_args.extend([0, 0, 0])

        # Insert a label column into the query that tells us which span condition
        # the span matched against.
        #
        # We only label it with the first matching span condition even if it
        # matches multiple.
        user_spans_query.columns.append(Function("multiIf", multi_if_args, MATCHING_SPAN_LABEL))

        # The built in limit by is restricted to the allowed columns but since we're
        # injecting columns here to label rows, we'll have to inject the limit by clause
        # as well.
        user_spans_query.limitby = LimitBy(
            [user_spans_query.resolve_column("trace"), Column(MATCHING_SPAN_LABEL)],
            limit_per_query,
        )

        # First make sure that we only return spans from one of the traces identified
        user_spans_query.add_conditions(
            [
                Condition(
                    Column("trace_id"),
                    Op.IN,
                    Function("splitByChar", [",", ",".join(trace_ids)]),
                )
            ]
        )

        conditions = []
        if span_keys is not None:
            assert span_keys

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
        else:
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

    def get_suggested_spans_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> QueryBuilder | None:
        # If any user queries is the same as the suggested query, we don't have to run it
        if (
            not self.user_queries
            and not self.suggested_query
            or any(user_query == self.suggested_query for user_query in self.user_queries)
        ):
            return None

        suggested_spans_query = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            snuba_params=snuba_params,
            query=self.suggested_query,
            selected_columns=["trace"] + self.fields,
            orderby=self.sort,
            limit=len(trace_ids) * self.max_spans_per_trace,
            limitby=("trace", self.max_spans_per_trace),
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )
        suggested_spans_query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])
        return suggested_spans_query


class TraceSpansExecutor:
    def __init__(
        self,
        *,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_id: str,
        fields: list[str],
        user_queries: list[str],
        sort: str | None,
        metrics_max: float | None,
        metrics_min: float | None,
        metrics_operation: str | None,
        metrics_query: str | None,
        mri: str | None,
    ):
        self.params = params
        self.snuba_params = snuba_params
        self.trace_id = trace_id
        self.fields = fields
        # Filter out empty queries as they do not do anything to change the results.
        self.user_queries = {
            query.strip(): i + 1  # ensure no zero ids
            for i, query in enumerate(user_queries)
            if query.strip()
        }
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
                self.params,
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
            params=self.params,
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
        params: ParamsType,
        snuba_params: SnubaParams,
        span_keys: list[SpanKey] | None,
        limit: int,
        offset: int,
    ):
        user_spans_query = self.get_user_spans_query(
            params,
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
        params: ParamsType,
        snuba_params: SnubaParams,
        span_keys: list[SpanKey] | None,
        limit: int,
        offset: int,
    ) -> QueryBuilder:
        user_spans_query = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
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

        for query, i in self.user_queries.items():
            where, _ = user_spans_query.resolve_conditions(query)
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
        params: ParamsType,
        snuba_params: SnubaParams,
        columns: list[str],
        user_queries: list[str],
        rollup: int,
        zerofill_results: bool,
    ):
        self.params = params
        self.snuba_params = snuba_params
        self.columns = columns
        # Filter out empty queries as they do not do anything to change the results.
        self.user_queries = [query.strip() for query in user_queries if query.strip()]
        self.rollup = rollup
        self.zerofill_results = zerofill_results

    def execute(self) -> SnubaTSResult:
        query = self.get_timeseries_query()
        result = query.run_query(Referrer.API_TRACE_EXPLORER_STATS.value)
        result = query.process_results(result)
        result["data"] = (
            discover.zerofill(
                result["data"],
                self.params["start"],
                self.params["end"],
                self.rollup,
                "time",
            )
            if self.zerofill_results
            else result["data"]
        )

        return SnubaTSResult(
            {
                "data": result["data"],
                "meta": result["meta"],
            },
            self.params["start"],
            self.params["end"],
            self.rollup,
        )

    def get_timeseries_query(self) -> QueryBuilder:
        query = TimeseriesSpanIndexedQueryBuilder(
            Dataset.SpansIndexed,
            self.params,
            self.rollup,
            query=None,
            selected_columns=self.columns,
        )

        trace_conditions = []

        for user_query in self.user_queries:
            # We want to ignore all the aggregate conditions here because we're strictly
            # searching on span attributes, not aggregates
            where, _ = query.resolve_conditions(user_query)
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
            with sentry_sdk.push_scope() as scope:
                scope.set_extra("slice start", {"raw": raw_start_index, "clipped": start_index})
                sentry_sdk.capture_message("Slice start was adjusted", level="warning")

        if raw_end_index != end_index:
            with sentry_sdk.push_scope() as scope:
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
