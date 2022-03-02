from __future__ import annotations

import dataclasses
from datetime import datetime
from itertools import chain
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import sentry_sdk
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function, Identifier, Lambda
from snuba_sdk.orderby import Direction, OrderBy

from sentry import eventstore, features
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.rest_framework import ListField
from sentry.discover.arithmetic import is_equation, strip_equation
from sentry.models import Organization
from sentry.search.events.builder import QueryBuilder, TimeseriesQueryBuilder
from sentry.search.events.types import ParamsType
from sentry.snuba import discover
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.snuba import Dataset, SnubaTSResult, raw_snql_query
from sentry.utils.time_window import TimeWindow, remove_time_windows, union_time_windows
from sentry.utils.validators import INVALID_SPAN_ID, is_span_id


@dataclasses.dataclass(frozen=True)
class SpanPerformanceColumn:
    suspect_op_group_columns: List[str]
    suspect_op_group_sort: List[str]
    suspect_example_functions: List[str]


SPAN_PERFORMANCE_COLUMNS: Dict[str, SpanPerformanceColumn] = {
    "count": SpanPerformanceColumn(
        ["count()", "sumArray(spans_exclusive_time)"],
        ["count()", "sumArray(spans_exclusive_time)"],
        ["count", "sum"],
    ),
    "avgOccurrence": SpanPerformanceColumn(
        [
            "count()",
            "count_unique(id)",
            "equation|count() / count_unique(id)",
            "sumArray(spans_exclusive_time)",
        ],
        ["equation[0]", "sumArray(spans_exclusive_time)"],
        ["count", "sum"],
    ),
    "sumExclusiveTime": SpanPerformanceColumn(
        ["sumArray(spans_exclusive_time)"],
        ["sumArray(spans_exclusive_time)"],
        ["sum"],
    ),
    "p50ExclusiveTime": SpanPerformanceColumn(
        ["percentileArray(spans_exclusive_time, 0.50)"],
        ["percentileArray(spans_exclusive_time, 0.50)"],
        ["max"],
    ),
    "p75ExclusiveTime": SpanPerformanceColumn(
        ["percentileArray(spans_exclusive_time, 0.75)"],
        ["percentileArray(spans_exclusive_time, 0.75)"],
        ["max"],
    ),
    "p95ExclusiveTime": SpanPerformanceColumn(
        ["percentileArray(spans_exclusive_time, 0.95)"],
        ["percentileArray(spans_exclusive_time, 0.95)"],
        ["max"],
    ),
    "p99ExclusiveTime": SpanPerformanceColumn(
        ["percentileArray(spans_exclusive_time, 0.99)"],
        ["percentileArray(spans_exclusive_time, 0.99)"],
        ["max"],
    ),
}


class OrganizationEventsSpansEndpointBase(OrganizationEventsV2EndpointBase):  # type: ignore
    def has_feature(self, request: Request, organization: Organization) -> bool:
        return bool(
            features.has(
                "organizations:performance-suspect-spans-view",
                organization,
                actor=request.user,
            )
        )

    def get_snuba_params(
        self, request: Request, organization: Organization, check_global_views: bool = True
    ) -> Dict[str, Any]:
        params = super().get_snuba_params(request, organization, check_global_views)

        if len(params.get("project_id", [])) != 1:
            raise ParseError(detail="You must specify exactly 1 project.")

        return params

    def get_orderby_column(self, request: Request) -> Tuple[str, str]:
        orderbys = super().get_orderby(request)

        if orderbys is None:
            direction = "-"
            orderby = "sumExclusiveTime"
        elif len(orderbys) != 1:
            raise ParseError(detail="Can only order by one column.")
        else:
            direction = "-" if orderbys[0].startswith("-") else ""
            orderby = orderbys[0].lstrip("-")

        if orderby not in SPAN_PERFORMANCE_COLUMNS:
            options = ", ".join(SPAN_PERFORMANCE_COLUMNS.keys())
            raise ParseError(detail=f"Can only order by one of {options}")

        return direction, orderby


class SpansPerformanceSerializer(serializers.Serializer):  # type: ignore
    field = ListField(child=serializers.CharField(), required=False, allow_null=True)
    query = serializers.CharField(required=False, allow_null=True)
    spanOp = ListField(child=serializers.CharField(), required=False, allow_null=True, max_length=4)
    spanGroup = ListField(
        child=serializers.CharField(), required=False, allow_null=True, max_length=4
    )

    def validate_spanGroup(self, span_groups):
        for group in span_groups:
            if not is_span_id(group):
                raise serializers.ValidationError(INVALID_SPAN_ID.format("spanGroup"))
        return span_groups


class OrganizationEventsSpansPerformanceEndpoint(OrganizationEventsSpansEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(request, organization):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = SpansPerformanceSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        fields = serialized.get("field", [])
        query = serialized.get("query")
        span_ops = serialized.get("spanOp")
        span_groups = serialized.get("spanGroup")

        direction, orderby_column = self.get_orderby_column(request)

        def data_fn(offset: int, limit: int) -> Any:
            suspects = query_suspect_span_groups(
                params,
                fields,
                query,
                span_ops,
                span_groups,
                direction,
                orderby_column,
                limit,
                offset,
            )

            return [suspect.serialize() for suspect in suspects]

        with self.handle_query_errors():
            return self.paginate(
                request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                default_per_page=10,
                max_per_page=100,
            )


class SpanSerializer(serializers.Serializer):  # type: ignore
    query = serializers.CharField(required=False, allow_null=True)
    span = serializers.CharField(required=True, allow_null=False)

    def validate_span(self, span: str) -> Span:
        try:
            return Span.from_str(span)
        except ValueError as e:
            raise serializers.ValidationError(str(e))


class OrganizationEventsSpansExamplesEndpoint(OrganizationEventsSpansEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(request, organization):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = SpanSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        query = serialized.get("query")
        span = serialized["span"]

        direction, orderby_column = self.get_orderby_column(request)

        def data_fn(offset: int, limit: int) -> Any:
            example_transactions = query_example_transactions(
                params, query, direction, orderby_column, span, limit, offset
            )

            return [
                {
                    "op": span.op,
                    "group": span.group,
                    "examples": [
                        get_example_transaction(
                            event,
                            span.op,
                            span.group,
                        ).serialize()
                        for event in example_transactions.get(span, [])
                    ],
                }
            ]

        with self.handle_query_errors():
            return self.paginate(
                request,
                paginator=SpanExamplesPaginator(data_fn=data_fn),
                default_per_page=3,
                max_per_page=10,
            )


class SpanExamplesPaginator:
    def __init__(self, data_fn: Callable[[int, int], Any]):
        self.data_fn = data_fn

    def get_result(self, limit: int, cursor: Optional[Cursor] = None) -> CursorResult:
        assert limit > 0
        offset = cursor.offset if cursor is not None else 0
        # Request 1 more than limit so we can tell if there is another page
        data = self.data_fn(offset, limit + 1)

        has_more = any(len(result["examples"]) == limit + 1 for result in data)
        for result in data:
            result["examples"] = result["examples"][:limit]

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )


class OrganizationEventsSpansStatsEndpoint(OrganizationEventsSpansEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(request, organization):
            return Response(status=404)

        serializer = SpanSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        span = serialized["span"]

        def get_event_stats(
            query_columns: Sequence[str],
            query: str,
            params: Dict[str, str],
            rollup: int,
            zerofill_results: bool,
            comparison_delta: Optional[datetime] = None,
        ) -> SnubaTSResult:
            with sentry_sdk.start_span(
                op="discover.discover", description="timeseries.filter_transform"
            ):
                builder = TimeseriesQueryBuilder(
                    Dataset.Discover,
                    params,
                    rollup,
                    query=query,
                    selected_columns=query_columns,
                    functions_acl=["array_join", "percentileArray", "sumArray"],
                )

                span_op_column = builder.resolve_function("array_join(spans_op)")
                span_group_column = builder.resolve_function("array_join(spans_group)")

                # Adding spans.op and spans.group to the group by because
                # We need them in the query to help the array join optimizer
                # in snuba take effect but the TimeseriesQueryBuilder
                # removes all non aggregates from the select clause.
                builder.groupby.extend([span_op_column, span_group_column])

                builder.add_conditions(
                    [
                        Condition(
                            Function("tuple", [span_op_column, span_group_column]),
                            Op.IN,
                            Function("tuple", [Function("tuple", [span.op, span.group])]),
                        ),
                    ]
                )

                snql_query = builder.get_snql_query()
                results = raw_snql_query(
                    snql_query, "api.organization-events-spans-performance-stats"
                )

            with sentry_sdk.start_span(
                op="discover.discover", description="timeseries.transform_results"
            ):
                result = discover.zerofill(
                    results["data"],
                    params["start"],
                    params["end"],
                    rollup,
                    "time",
                )

            return SnubaTSResult({"data": result}, params["start"], params["end"], rollup)

        return Response(
            self.get_event_stats_data(
                request,
                organization,
                get_event_stats,
                query_column="sumArray(spans_exclusive_time)",
            ),
            status=200,
        )


@dataclasses.dataclass(frozen=True)
class ExampleSpan:
    id: str
    start_timestamp: float
    finish_timestamp: float
    exclusive_time: float

    def serialize(self) -> Any:
        return {
            "id": self.id,
            "startTimestamp": self.start_timestamp,
            "finishTimestamp": self.finish_timestamp,
            "exclusiveTime": self.exclusive_time,
        }


@dataclasses.dataclass(frozen=True)
class ExampleTransaction:
    id: str
    description: Optional[str]
    start_timestamp: float
    finish_timestamp: float
    non_overlapping_exclusive_time: float
    spans: List[ExampleSpan]

    def serialize(self) -> Any:
        return {
            "id": self.id,
            "description": self.description,
            "startTimestamp": self.start_timestamp,
            "finishTimestamp": self.finish_timestamp,
            "nonOverlappingExclusiveTime": self.non_overlapping_exclusive_time,
            "spans": [span.serialize() for span in self.spans],
        }


@dataclasses.dataclass(frozen=True)
class SuspectSpan:
    op: str
    group: str
    description: Optional[str]
    frequency: Optional[int]
    count: Optional[int]
    avg_occurrences: Optional[float]
    sum_exclusive_time: Optional[float]
    p50_exclusive_time: Optional[float]
    p75_exclusive_time: Optional[float]
    p95_exclusive_time: Optional[float]
    p99_exclusive_time: Optional[float]

    def serialize(self) -> Any:
        return {
            "op": self.op,
            "group": self.group.rjust(16, "0"),
            "description": self.description,
            "frequency": self.frequency,
            "count": self.count,
            "avgOccurrences": self.avg_occurrences,
            "sumExclusiveTime": self.sum_exclusive_time,
            "p50ExclusiveTime": self.p50_exclusive_time,
            "p75ExclusiveTime": self.p75_exclusive_time,
            "p95ExclusiveTime": self.p95_exclusive_time,
            "p99ExclusiveTime": self.p99_exclusive_time,
        }


@dataclasses.dataclass(frozen=True)
class Span:
    op: str
    group: str

    @staticmethod
    def from_str(s: str) -> Span:
        parts = s.rsplit(":", 1)
        if len(parts) != 2:
            raise ValueError(
                "span must consist of of a span op and a valid 16 character hex delimited by a colon (:)"
            )
        if not is_span_id(parts[1]):
            raise ValueError(INVALID_SPAN_ID.format("spanGroup"))
        return Span(op=parts[0], group=parts[1])


@dataclasses.dataclass(frozen=True)
class EventID:
    project_id: int
    event_id: str


def query_suspect_span_groups(
    params: ParamsType,
    fields: List[str],
    query: Optional[str],
    span_ops: Optional[List[str]],
    span_groups: Optional[List[str]],
    direction: str,
    orderby: str,
    limit: int,
    offset: int,
) -> List[SuspectSpan]:
    suspect_span_columns = SPAN_PERFORMANCE_COLUMNS[orderby]

    selected_columns: List[str] = [
        column
        for column in suspect_span_columns.suspect_op_group_columns + fields
        if not is_equation(column)
    ] + [
        "array_join(spans_op)",
        "array_join(spans_group)",
        # want a single event id to fetch from nodestore for the span description
        "any(id)",
    ]

    equations: List[str] = [
        strip_equation(column)
        for column in suspect_span_columns.suspect_op_group_columns + fields
        if is_equation(column)
    ]

    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=selected_columns,
        equations=equations,
        query=query,
        orderby=[direction + column for column in suspect_span_columns.suspect_op_group_sort],
        auto_aggregations=True,
        use_aggregate_conditions=True,
        limit=limit,
        offset=offset,
        functions_acl=["array_join", "sumArray", "percentileArray", "maxArray"],
    )

    extra_conditions = []

    if span_ops:
        extra_conditions.append(
            Condition(
                builder.resolve_function("array_join(spans_op)"),
                Op.IN,
                Function("tuple", span_ops),
            )
        )

    if span_groups:
        extra_conditions.append(
            Condition(
                builder.resolve_function("array_join(spans_group)"),
                Op.IN,
                Function("tuple", span_groups),
            )
        )

    if extra_conditions:
        builder.add_conditions(extra_conditions)

    snql_query = builder.get_snql_query()
    results = raw_snql_query(snql_query, "api.organization-events-spans-performance-suspects")

    return [
        SuspectSpan(
            op=suspect["array_join_spans_op"],
            group=suspect["array_join_spans_group"],
            description=get_span_description(
                EventID(params["project_id"][0], suspect["any_id"]),
                span_op=suspect["array_join_spans_op"],
                span_group=suspect["array_join_spans_group"],
            ),
            frequency=suspect.get("count_unique_id"),
            count=suspect.get("count"),
            avg_occurrences=suspect.get("equation[0]"),
            sum_exclusive_time=suspect.get("sumArray_spans_exclusive_time"),
            p50_exclusive_time=suspect.get("percentileArray_spans_exclusive_time_0_50"),
            p75_exclusive_time=suspect.get("percentileArray_spans_exclusive_time_0_75"),
            p95_exclusive_time=suspect.get("percentileArray_spans_exclusive_time_0_95"),
            p99_exclusive_time=suspect.get("percentileArray_spans_exclusive_time_0_99"),
        )
        for suspect in results["data"]
    ]


class SpanQueryBuilder(QueryBuilder):  # type: ignore
    def resolve_span_function(self, function: str, span: Span, alias: str):
        op = span.op
        group = span.group

        return Function(
            "arrayReduce",
            [
                f"{function}If",
                self.column("spans_exclusive_time"),
                Function(
                    "arrayMap",
                    [
                        Lambda(
                            ["x", "y"],
                            Function(
                                "and",
                                [
                                    Function("equals", [Identifier("x"), op]),
                                    Function("equals", [Identifier("y"), group]),
                                ],
                            ),
                        ),
                        self.column("spans_op"),
                        self.column("spans_group"),
                    ],
                ),
            ],
            alias,
        )


def query_example_transactions(
    params: ParamsType,
    query: Optional[str],
    direction: str,
    orderby: str,
    span: Span,
    per_suspect: int = 5,
    offset: Optional[int] = None,
) -> Dict[Span, List[EventID]]:
    # there aren't any suspects, early return to save an empty query
    if per_suspect == 0:
        return {}

    selected_columns: List[str] = [
        "id",
        "project.id",
    ]

    builder = SpanQueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=selected_columns,
        query=query,
        orderby=[],
        limit=per_suspect,
        offset=offset,
    )

    # Make sure to resolve the custom span functions and add it to the columns and order bys
    orderby_columns = [
        builder.resolve_span_function(function, span, f"{function}_span_time")
        for function in SPAN_PERFORMANCE_COLUMNS[orderby].suspect_example_functions
    ]
    builder.columns += orderby_columns
    builder.orderby += [
        OrderBy(column, Direction.DESC if direction == "-" else Direction.ASC)
        for column in orderby_columns
    ]

    # we are only interested in the specific op, group pairs from the suspects
    builder.add_conditions(
        [
            Condition(Function("has", [builder.column("spans_op"), span.op]), Op.EQ, 1),
            Condition(Function("has", [builder.column("spans_group"), span.group]), Op.EQ, 1),
            Condition(
                builder.resolve_span_function("count", span, "count_span_time"),
                Op.GT,
                0,
            ),
        ]
    )

    snql_query = builder.get_snql_query()
    results = raw_snql_query(snql_query, "api.organization-events-spans-performance-examples")

    examples: Dict[Span, List[EventID]] = {Span(span.op, span.group): []}

    for example in results["data"]:
        value = EventID(params["project_id"][0], example["id"])
        examples[span].append(value)

    return examples


def get_span_description(
    event: EventID,
    span_op: str,
    span_group: str,
) -> Optional[str]:
    nodestore_event = eventstore.get_event_by_id(event.project_id, event.event_id)
    data = nodestore_event.data

    # the transaction itself is a span as well, so make sure to check it
    trace_context = data.get("contexts", {}).get("trace", {})
    if trace_context["op"] == span_op and int(trace_context["hash"], 16) == int(span_group, 16):
        return data["transaction"]

    for span in data.get("spans", []):
        if span["op"] == span_op and int(span["hash"], 16) == int(span_group, 16):
            return span.get("description")

    return None


def get_example_transaction(
    event: EventID,
    span_op: str,
    span_group: str,
) -> ExampleTransaction:
    span_group_id = int(span_group, 16)
    nodestore_event = eventstore.get_event_by_id(event.project_id, event.event_id)
    data = nodestore_event.data

    # the transaction itself is a span as well but we need to reconstruct
    # it from the event as it's not present in the spans array
    trace_context = data.get("contexts", {}).get("trace", {})
    root_span = {
        "span_id": trace_context["span_id"],
        "op": trace_context["op"],
        "hash": trace_context["hash"],
        "exclusive_time": trace_context["exclusive_time"],
        "description": data["transaction"],
        "start_timestamp": data["start_timestamp"],
        "timestamp": data["timestamp"],
    }

    matching_spans = [
        span
        for span in chain([root_span], data.get("spans", []))
        if span["op"] == span_op and int(span["hash"], 16) == span_group_id
    ]

    # get the first non-None description
    # use None if all descriptions are None
    description = None
    for span in matching_spans:
        if span.get("description") is None:
            continue
        description = span["description"]

    spans: List[ExampleSpan] = [
        ExampleSpan(
            id=span["span_id"],
            start_timestamp=span["start_timestamp"],
            finish_timestamp=span["timestamp"],
            exclusive_time=span["exclusive_time"],
        )
        for span in matching_spans
    ]

    non_overlapping_exclusive_time_windows = union_time_windows(
        [
            window
            for span in spans
            for window in get_exclusive_time_windows(
                span,
                # don't need to check the root span here because its parent
                # will never be one of the spans in this transaction
                data.get("spans", []),
            )
        ]
    )

    return ExampleTransaction(
        id=event.event_id,
        description=description,
        start_timestamp=data["start_timestamp"],
        finish_timestamp=data["timestamp"],
        non_overlapping_exclusive_time=sum(
            window.duration_ms for window in non_overlapping_exclusive_time_windows
        ),
        spans=spans,
    )


def get_exclusive_time_windows(span: ExampleSpan, spans: List[Any]) -> List[TimeWindow]:
    non_overlapping_children_time_windows = union_time_windows(
        [
            TimeWindow(start=child["start_timestamp"], end=child["timestamp"])
            for child in spans
            if child.get("parent_span_id") == span.id
        ]
    )
    return remove_time_windows(
        TimeWindow(start=span.start_timestamp, end=span.finish_timestamp),
        non_overlapping_children_time_windows,
    )
