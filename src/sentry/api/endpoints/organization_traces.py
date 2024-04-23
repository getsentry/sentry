import dataclasses
from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, Literal, TypedDict, cast

import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Function, Op

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.events.builder import SpansIndexedQueryBuilder
from sentry.search.events.types import ParamsType, QueryBuilderConfig, SnubaParams, WhereType
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.numbers import clip
from sentry.utils.snuba import bulk_snql_query


class TraceInterval(TypedDict):
    project: str | None
    start: int
    end: int
    kind: Literal["project", "missing", "other"]


class TraceResult(TypedDict):
    trace: str
    numSpans: int
    name: str | None
    duration: int
    start: int
    end: int
    breakdowns: list[TraceInterval]
    spans: list[Mapping[str, Any]]
    suggestedSpans: list[Mapping[str, Any]]


class OrganizationTracesSerializer(serializers.Serializer):
    field = serializers.ListField(required=True, allow_empty=False, child=serializers.CharField())
    sort = serializers.ListField(required=False, allow_empty=True, child=serializers.CharField())
    query = serializers.ListField(required=False, allow_empty=True, child=serializers.CharField())
    suggestedQuery = serializers.CharField(required=False)
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

        per_page = self.get_per_page(request)

        def data_fn(offset: int, limit: int):
            with handle_query_errors():
                sample_rate = options.get("traces.sample-list.sample-rate")
                if sample_rate <= 0:
                    sample_rate = None

                user_queries = serialized.get("query", [])

                trace_ids, min_timestamp, max_timestamp = self.get_matching_traces(
                    cast(ParamsType, params),
                    snuba_params,
                    user_queries,
                    per_page,
                )

            if not trace_ids:
                return {"data": [], "meta": {"fields": {}}}

            # TODO: move to use `update_snuba_params_with_timestamp`
            time_buffer = options.get("performance.traces.trace-explorer-buffer-hours")
            buffer = timedelta(hours=time_buffer)
            params["start"] = min_timestamp - buffer
            params["end"] = max_timestamp + buffer
            snuba_params.start = min_timestamp - buffer
            snuba_params.end = max_timestamp + buffer

            all_projects = self.get_projects(
                request,
                organization,
                project_ids={-1},
                project_slugs=None,
                include_all_accessible=True,
            )
            all_projects_snuba_params = dataclasses.replace(snuba_params, projects=all_projects)
            all_projects_params = dict(params)
            all_projects_params["projects"] = all_projects_snuba_params.projects
            all_projects_params["projects_objects"] = all_projects_snuba_params.projects
            all_projects_params["projects_id"] = all_projects_snuba_params.project_ids

            breakdowns_query = self.get_breakdown_query(
                cast(ParamsType, all_projects_params),
                all_projects_snuba_params,
                trace_ids,
            )

            traces_meta_query = self.get_traces_meta_query(
                cast(ParamsType, all_projects_params),
                all_projects_snuba_params,
                trace_ids,
            )

            user_spans_query, suggested_spans_query = self.get_matching_spans_query(
                cast(ParamsType, params),
                snuba_params,
                serialized["field"],
                serialized.get("sort"),
                user_queries,
                serialized.get("suggestedQuery", ""),
                trace_ids,
                serialized["maxSpansPerTrace"],
            )

            queries = [
                query
                for query in [
                    breakdowns_query,
                    traces_meta_query,
                    user_spans_query,
                    suggested_spans_query,
                ]
                if query
            ]

            with handle_query_errors():
                results = bulk_snql_query(
                    [query.get_snql_query() for query in queries],
                    Referrer.API_TRACE_EXPLORER_TRACES_META.value,
                )

                all_results = [
                    query.process_results(result) for query, result in zip(queries, results)
                ]
                breakdowns_results = all_results[0]
                traces_meta_results = all_results[1]
                spans_results = all_results[2]
                suggested_spans_results = all_results[3] if len(all_results) > 3 else None

            fields = spans_results["meta"].get("fields", {})
            meta = {
                **spans_results["meta"],
                "fields": {field: fields[field] for field in serialized["field"]},
            }

            spans_by_trace: Mapping[str, list[Mapping[str, Any]]] = defaultdict(list)
            for row in spans_results["data"]:
                spans_by_trace[row["trace"]].append(row)

            suggested_spans_by_trace: Mapping[str, list[Mapping[str, Any]]] = defaultdict(list)
            if suggested_spans_results:
                for row in suggested_spans_results["data"]:
                    suggested_spans_by_trace[row["trace"]].append(row)

            try:
                traces_range = {
                    row["trace"]: (row["first_seen()"], row["last_seen()"])
                    for row in traces_meta_results["data"]
                }
                breakdowns = process_breakdowns(
                    breakdowns_results["data"],
                    traces_range,
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
                breakdowns = defaultdict(list)

            traces: list[TraceResult] = [
                {
                    "trace": row["trace"],
                    "numSpans": row["count()"],
                    "name": row["trace_name()"],
                    "duration": row["last_seen()"] - row["first_seen()"],
                    "start": row["first_seen()"],
                    "end": row["last_seen()"],
                    "breakdowns": breakdowns[row["trace"]],
                    "spans": [
                        {field: span[field] for field in serialized["field"]}
                        for span in spans_by_trace[row["trace"]]
                    ],
                    "suggestedSpans": [
                        {field: span[field] for field in serialized["field"]}
                        for span in suggested_spans_by_trace[row["trace"]]
                    ],
                }
                for row in traces_meta_results["data"]
            ]

            return {"data": traces, "meta": meta}

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: self.handle_results_with_meta(
                request,
                organization,
                params["project_id"],
                results,
                standard_meta=True,
                dataset=Dataset.SpansIndexed,
            ),
        )

    def get_matching_traces(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        user_queries: list[str],
        limit: int,
    ) -> tuple[list[str], datetime, datetime]:
        if len(user_queries) < 2:
            # Optimization: If there is only a condition for a single span,
            # we can take the fast path and query without using aggregates.
            timestamp_column = "timestamp"
            builder = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params,
                snuba_params=snuba_params,
                query=user_queries[0] if user_queries else None,
                selected_columns=["trace", timestamp_column],
                # The orderby is intentionally `None` here as this query is much faster
                # if we let Clickhouse decide which order to return the results in.
                # This also means we cannot order by any columns or paginate.
                orderby=None,
                limit=limit,
                limitby=("trace", 1),
                config=QueryBuilderConfig(
                    transform_alias_to_input_format=True,
                ),
            )
        else:
            timestamp_column = "min(timestamp)"
            builder = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params,
                snuba_params=snuba_params,
                query=None,
                selected_columns=["trace", timestamp_column],
                # The orderby is intentionally `None` here as this query is much faster
                # if we let Clickhouse decide which order to return the results in.
                # This also means we cannot order by any columns or paginate.
                orderby=None,
                limit=limit,
                config=QueryBuilderConfig(
                    auto_aggregations=True,
                    transform_alias_to_input_format=True,
                ),
            )

            for query in user_queries:
                # We want to ignore all the aggregate conditions here because we're strictly
                # searching on span attributes, not aggregates
                where, _ = builder.resolve_conditions(query)

                # Transform the condition into it's aggregate form so it can be used to
                # match on the trace.
                new_condition = generate_trace_condition(where)
                builder.having.append(new_condition)

        trace_results = builder.run_query(Referrer.API_TRACE_EXPLORER_SPANS_LIST.value)
        trace_results = builder.process_results(trace_results)

        trace_ids: list[str] = []
        min_timestamp = snuba_params.end
        max_timestamp = snuba_params.start
        assert min_timestamp is not None
        assert max_timestamp is not None

        for row in trace_results["data"]:
            trace_ids.append(row["trace"])
            timestamp = datetime.fromisoformat(row[timestamp_column])
            if timestamp < min_timestamp:
                min_timestamp = timestamp
            if timestamp > max_timestamp:
                max_timestamp = timestamp

        return trace_ids, min_timestamp, max_timestamp

    def get_breakdown_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> SpansIndexedQueryBuilder:
        with handle_query_errors():
            breakdowns_query = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params,
                snuba_params=snuba_params,
                query="is_transaction:1",
                selected_columns=[
                    "trace",
                    "project",
                    "transaction",
                    "first_seen()",
                    "last_seen()",
                ],
                orderby=["first_seen()", "last_seen()"],
                # limit the number of segments we fetch per trace so a single
                # large trace does not result in the rest being blank
                limitby=("trace", int(10_000 / len(trace_ids))),
                limit=10_000,
                config=QueryBuilderConfig(
                    functions_acl=["trace_name", "first_seen", "last_seen"],
                    transform_alias_to_input_format=True,
                ),
            )
            breakdowns_query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])
        return breakdowns_query

    def get_traces_meta_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        trace_ids: list[str],
    ) -> SpansIndexedQueryBuilder:
        with handle_query_errors():
            traces_meta_query = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params,
                snuba_params=snuba_params,
                query=None,
                selected_columns=[
                    "trace",
                    "count()",
                    # TODO: count if of matching spans
                    "trace_name()",
                    "first_seen()",
                    "last_seen()",
                ],
                limit=len(trace_ids),
                config=QueryBuilderConfig(
                    functions_acl=["trace_name", "first_seen", "last_seen"],
                    transform_alias_to_input_format=True,
                ),
            )
            traces_meta_query.add_conditions([Condition(Column("trace_id"), Op.IN, trace_ids)])
        return traces_meta_query

    def get_matching_spans_query(
        self,
        params: ParamsType,
        snuba_params: SnubaParams,
        fields: list[str],
        sort: str | None,
        user_queries: list[str],
        suggested_query: str,
        trace_ids: list[str],
        max_spans_per_trace: int,
    ) -> tuple[SpansIndexedQueryBuilder, SpansIndexedQueryBuilder | None]:
        trace_id_condition = Condition(Column("trace_id"), Op.IN, trace_ids)

        with handle_query_errors():
            user_spans_query = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params,
                snuba_params=snuba_params,
                query=None,
                selected_columns=["trace"] + fields,
                orderby=sort,
                limit=len(trace_ids) * max_spans_per_trace,
                limitby=("trace", max_spans_per_trace),
                config=QueryBuilderConfig(
                    transform_alias_to_input_format=True,
                ),
            )

            # There are multiple sets of user conditions that needs to be satisfied
            # and if a span satisfy any of them, it should be considered.
            #
            # To handle this use case, we want to OR all the user specified
            # conditions together in this query.
            conditions = []
            for query in user_queries:
                # We want to ignore all the aggregate conditions here because we're strictly
                # searching on span attributes, not aggregates
                where, _ = user_spans_query.resolve_conditions(query)
                if len(where) > 1:
                    conditions.append(BooleanCondition(op=BooleanOp.AND, conditions=where))
                elif len(where) == 1:
                    conditions.append(where[0])

            if len(conditions) > 1:
                user_spans_query.add_conditions(
                    [BooleanCondition(op=BooleanOp.OR, conditions=conditions)]
                )
            elif len(conditions) == 1:
                user_spans_query.add_conditions([conditions[0]])
            user_spans_query.add_conditions([trace_id_condition])

        if all(user_query != suggested_query for user_query in user_queries):
            with handle_query_errors():
                suggested_spans_query = SpansIndexedQueryBuilder(
                    Dataset.SpansIndexed,
                    params,
                    snuba_params=snuba_params,
                    query=suggested_query,
                    selected_columns=["trace"] + fields,
                    orderby=sort,
                    limit=len(trace_ids) * max_spans_per_trace,
                    limitby=("trace", max_spans_per_trace),
                    config=QueryBuilderConfig(
                        transform_alias_to_input_format=True,
                    ),
                )
                suggested_spans_query.add_conditions([trace_id_condition])
        else:
            suggested_spans_query = None

        return user_spans_query, suggested_spans_query


def process_breakdowns(data, traces_range):
    breakdowns: Mapping[str, list[TraceInterval]] = defaultdict(list)
    stacks: Mapping[str, list[TraceInterval]] = defaultdict(list)

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
                    "project": None,
                    "start": last_interval["end"],
                    "end": interval["start"],
                    "kind": "missing",
                }
            )

        breakdown.append(interval)

    def stack_push(trace, interval):
        last_interval = stack_peek(trace)
        if (
            last_interval
            and last_interval["project"] == interval["project"]
            and last_interval["end"] >= interval["start"]
        ):
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
            "project": row["project"],
            "start": row["first_seen()"],
            "end": row["last_seen()"],
            "kind": "project",
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

        other = {
            "project": None,
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
