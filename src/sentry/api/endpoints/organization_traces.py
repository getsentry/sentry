import dataclasses
import math
from collections import defaultdict
from collections.abc import Callable, Mapping, MutableMapping
from datetime import datetime, timedelta
from typing import Any, Literal, TypedDict, cast

from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import And, BooleanCondition, BooleanOp, Column, Condition, Function, Op, Or

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.builder import QueryBuilder, SpansIndexedQueryBuilder
from sentry.search.events.types import ParamsType, QueryBuilderConfig, SnubaParams, WhereType
from sentry.sentry_metrics.querying.samples_list import SpanKey, get_sample_list_executor_cls
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.iterators import chunked
from sentry.utils.numbers import clip
from sentry.utils.snuba import bulk_snuba_queries

MAX_SNUBA_RESULTS = 10_000


class TraceInterval(TypedDict):
    project: str | None
    start: int
    end: int
    kind: Literal["project", "missing", "other"]
    opCategory: str | None


class TraceResult(TypedDict):
    trace: str
    numErrors: int
    numOccurrences: int
    numSpans: int
    project: str | None
    name: str | None
    duration: int
    start: int
    end: int
    breakdowns: list[TraceInterval]
    spans: list[Mapping[str, Any]]
    suggestedSpans: list[Mapping[str, Any]]


class OrganizationTracesSerializer(serializers.Serializer):
    breakdownCategory = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField()
    )
    field = serializers.ListField(required=True, allow_empty=False, child=serializers.CharField())
    sort = serializers.ListField(required=False, allow_empty=True, child=serializers.CharField())
    metricsQuery = serializers.CharField(required=False)
    mri = serializers.CharField(required=False)
    query = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField(allow_blank=True)
    )
    suggestedQuery = serializers.CharField(required=False)
    minBreakdownDuration = serializers.IntegerField(default=0, min_value=0)
    maxSpansPerTrace = serializers.IntegerField(default=1, min_value=1, max_value=100)


@region_silo_endpoint
class OrganizationTracesEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.PERFORMANCE

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

        executor = TraceSamplesExecutor(
            params=cast(ParamsType, params),
            snuba_params=snuba_params,
            fields=serialized["field"],
            # Filter out empty queries as they do not do anything to change the results.
            user_queries=[query.strip() for query in serialized.get("query", []) if query.strip()],
            suggested_query=serialized.get("suggestedQuery", ""),
            metrics_query=serialized.get("metricsQuery", ""),
            mri=serialized.get("mri"),
            sort=serialized.get("sort"),
            limit=self.get_per_page(request),
            max_spans_per_trace=serialized["maxSpansPerTrace"],
            breakdown_categories=serialized.get("breakdownCategory", []),
            min_breakdown_duration=serialized["minBreakdownDuration"],
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
            # paginator=GenericOffsetPaginator(data_fn=data_fn),
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


class TraceSamplesExecutor:
    def __init__(
        self,
        *,
        params: ParamsType,
        snuba_params: SnubaParams,
        fields: list[str],
        user_queries: list[str],
        suggested_query: str,
        metrics_query: str,
        mri: str | None,
        sort: str | None,
        limit: int,
        max_spans_per_trace: int,
        breakdown_categories: list[str],
        min_breakdown_duration: int,
        get_all_projects: Callable[[], list[Project]],
    ):
        self.params = params
        self.snuba_params = snuba_params
        self.fields = fields
        self.user_queries = user_queries
        self.suggested_query = suggested_query
        self.metrics_query = metrics_query
        self.mri = mri
        self.sort = sort
        self.limit = limit
        self.max_spans_per_trace = max_spans_per_trace
        self.breakdown_categories = breakdown_categories
        self.min_breakdown_duration = min_breakdown_duration
        self.get_all_projects = get_all_projects
        self._all_projects: list[Project] | None = None

    @property
    def all_projects(self) -> list[Project]:
        if self._all_projects is None:
            self._all_projects = self.get_all_projects()
        return self._all_projects

    def execute(self, offset: int, limit: int):
        return self._execute()

    def _execute(self):
        selected_projects_params = self.params
        selected_projects_snuba_params = self.snuba_params

        with handle_query_errors():
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

        all_projects_params, all_projects_snuba_params = self.params_with_all_projects()

        if not trace_ids:
            return {"data": [], "meta": {"fields": {}}}

        with handle_query_errors():
            all_queries = self.get_all_queries(
                all_projects_params,
                all_projects_snuba_params,
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

            if self.breakdown_categories:
                traces_breakdown_categories_results = all_results[idx]
                idx += 1
            else:
                traces_breakdown_categories_results = {
                    "data": [],
                    "meta": {
                        "fields": {},
                        "tips": {},
                    },
                }

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
                traces_breakdown_categories_results=traces_breakdown_categories_results,
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

    def params_with_all_projects(self) -> tuple[ParamsType, SnubaParams]:
        all_projects_snuba_params = dataclasses.replace(
            self.snuba_params, projects=self.all_projects
        )

        all_projects_params = dict(self.params)
        all_projects_params["projects"] = all_projects_snuba_params.projects
        all_projects_params["projects_objects"] = all_projects_snuba_params.projects
        all_projects_params["projects_id"] = all_projects_snuba_params.project_ids

        return cast(ParamsType, all_projects_params), all_projects_snuba_params

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
            min_timestamp, max_timestamp, trace_ids = self.get_traces_matching_span_conditions(
                params, snuba_params, trace_ids
            )

            if not trace_ids:
                return min_timestamp, max_timestamp, [], []
        else:
            # No user queries so take the first N trace ids as our list
            trace_ids = trace_ids[: self.limit]
            timestamps = timestamps[: self.limit]
            for timestamp in timestamps:
                if timestamp < min_timestamp:
                    min_timestamp = timestamp
                if timestamp < max_timestamp:
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

        if trace_ids:
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
                query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])

                all_queries.append(query)
        else:
            query, timestamp_column = self.get_traces_matching_span_conditions_query(
                params,
                snuba_params,
            )
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
                if timestamp < min_timestamp:
                    min_timestamp = timestamp
                if timestamp > max_timestamp:
                    max_timestamp = timestamp

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
                query=self.user_queries[0] if self.user_queries else None,
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

            for user_query in self.user_queries:
                # We want to ignore all the aggregate conditions here because we're strictly
                # searching on span attributes, not aggregates
                where, _ = query.resolve_conditions(user_query)

                # Transform the condition into it's aggregate form so it can be used to
                # match on the trace.
                new_condition = generate_trace_condition(where)
                query.having.append(new_condition)

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

        if self.breakdown_categories:
            traces_breakdown_categories_query = self.get_traces_breakdown_categories_query(
                params,
                snuba_params,
                trace_ids,
            )
            queries.append(traces_breakdown_categories_query)

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
        traces_breakdown_categories_results,
        user_spans_results,
        suggested_spans_results,
    ) -> list[TraceResult]:
        # mapping of trace id to a tuple of start/finish times
        traces_range = {
            row["trace"]: (row["first_seen()"], row["last_seen()"])
            for row in traces_metas_results["data"]
        }

        spans = [
            *traces_breakdown_projects_results["data"],
            *traces_breakdown_categories_results["data"],
        ]
        spans.sort(key=lambda span: (span["precise.start_ts"], span["precise.finish_ts"]))

        traces_breakdowns = process_breakdowns(spans, traces_range)

        # mapping of trace id to a tuple of project slug + transaction name
        traces_names: MutableMapping[str, tuple[str, str]] = {}
        for row in traces_breakdown_projects_results["data"]:
            # The underlying column is a Nullable(UInt64) but we write a default of 0 to it.
            # So make sure to handle both in case something changes.
            if not row["parent_span"] or int(row["parent_span"], 16) == 0:
                traces_names[row["trace"]] = (row["project"], row["transaction"])

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

        return [
            {
                "trace": row["trace"],
                "numErrors": traces_errors.get(row["trace"], 0),
                "numOccurrences": traces_occurrences.get(row["trace"], 0),
                "numSpans": row["count()"],
                "project": traces_names.get(row["trace"], (None, None))[0],
                "name": traces_names.get(row["trace"], (None, None))[1],
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
                "parent_span",
                "transaction",
                "precise.start_ts",
                "precise.finish_ts",
            ],
            orderby=["precise.start_ts", "precise.finish_ts"],
            # limit the number of segments we fetch per trace so a single
            # large trace does not result in the rest being blank
            limitby=("trace", int(MAX_SNUBA_RESULTS / len(trace_ids))),
            limit=MAX_SNUBA_RESULTS,
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

    def get_traces_breakdown_categories_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> QueryBuilder:
        conditions = []

        span_categories_str = ",".join(self.breakdown_categories)
        conditions.append(f"span.category:[{span_categories_str}]")

        trace_ids_str = ",".join(trace_ids)
        conditions.append(f"trace:[{trace_ids_str}]")

        if self.min_breakdown_duration > 0:
            conditions.append(f"span.duration:>={self.min_breakdown_duration}")

        return SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            snuba_params=snuba_params,
            query=" ".join(conditions),
            selected_columns=[
                "trace",
                "project",
                "transaction",
                "span.category",
                "precise.start_ts",
                "precise.finish_ts",
            ],
            orderby=["precise.start_ts", "precise.finish_ts"],
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
        return SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            snuba_params=snuba_params,
            query=trace_ids_condition,
            selected_columns=[
                "trace",
                "count()",
                # TODO: count if of matching spans
                "first_seen()",
                "last_seen()",
            ],
            limit=len(trace_ids),
            config=QueryBuilderConfig(
                functions_acl=["first_seen", "last_seen"],
                transform_alias_to_input_format=True,
            ),
        )

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
        user_spans_query = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            snuba_params=snuba_params,
            query=None,  # Note: conditions are added below
            selected_columns=["trace"] + self.fields,
            orderby=self.sort,
            limit=len(trace_ids) * self.max_spans_per_trace,
            limitby=("trace", self.max_spans_per_trace),
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        # First make sure that we only return spans from one of the traces identified
        user_spans_query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])

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
            for query in self.user_queries:
                # We want to ignore all the aggregate conditions here because we're strictly
                # searching on span attributes, not aggregates
                where, _ = user_spans_query.resolve_conditions(query)
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


def process_breakdowns(data, traces_range):
    breakdowns: Mapping[str, list[TraceInterval]] = defaultdict(list)
    stacks: Mapping[str, list[TraceInterval]] = defaultdict(list)

    def should_merge(interval_a, interval_b):
        return (
            interval_a["end"] >= interval_b["start"]
            and interval_a["project"] == interval_b["project"]
            and interval_a["opCategory"] == interval_b["opCategory"]
        )

    def breakdown_push(trace, interval):
        # Clip the intervals os that it is within range of the trace
        if trace_range := traces_range.get(trace):
            left, right = trace_range
            interval["start"] = clip(interval["start"], left, right)
            interval["end"] = clip(interval["end"], left, right)

        breakdown = breakdowns[trace]

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
                    "opCategory": None,
                    "start": last_interval["end"],
                    "end": interval["start"],
                }
            )

        breakdown.append(interval)

    def stack_push(trace, interval):
        last_interval = stack_peek(trace)
        if last_interval and should_merge(last_interval, interval):
            # update the end of this interval and it will
            # be updated in the breakdown as well
            last_interval["end"] = max(interval["end"], last_interval["end"])
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

    for row in data:
        trace = row["trace"]

        cur: TraceInterval = {
            "kind": "project",
            "project": row["project"],
            "opCategory": row.get("span.category"),
            "start": int(row["precise.start_ts"] * 1000),
            "end": int(row["precise.finish_ts"] * 1000),
        }

        # Clear the stack of any intervals that end before the current interval
        # starts while pushing them to the breakdowns.
        stack_clear(trace, until=cur["start"])

        stack_push(trace, cur)

        # Clear the stack of any intervals that end before the current interval
        # ends. Here we do not need to push them to the breakdowns because
        # that time has already be attributed to the most recent interval.
        stack_clear(trace, until=cur["end"])

    for trace, (trace_start, trace_end) in traces_range.items():
        # Check to see if there is still a gap before the trace ends and fill it
        # with an other interval.

        other: TraceInterval = {
            "project": None,
            "opCategory": None,
            "start": trace_start,
            "end": trace_end,
            "kind": "other",
        }

        # Clear the remaining intervals on the stack to find the latest end time
        # of the intervals. This will be used to decide if there are any portion
        # of the trace that was not covered by one of the intervals.
        while stacks[trace]:
            interval = stack_pop(trace)
            other["start"] = max(other["start"], interval["end"])

        if other["start"] < other["end"]:
            breakdown_push(trace, other)

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
