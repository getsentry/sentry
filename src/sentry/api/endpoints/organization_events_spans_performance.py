from __future__ import annotations

import dataclasses
from itertools import chain
from typing import Any, Dict, List, Optional, Tuple

from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function
from snuba_sdk.orderby import LimitBy

from sentry import eventstore, features
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.rest_framework import ListField
from sentry.discover.arithmetic import is_equation, strip_equation
from sentry.models import Organization
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import ParamsType
from sentry.utils.snuba import Dataset, raw_snql_query
from sentry.utils.time_window import TimeWindow, remove_time_windows, union_time_windows
from sentry.utils.validators import INVALID_SPAN_ID, is_span_id


@dataclasses.dataclass(frozen=True)
class SpanPerformanceColumn:
    suspect_op_group_columns: List[str]
    suspect_op_group_sort: List[str]
    suspect_example_sort: List[str]


SPAN_PERFORMANCE_COLUMNS: Dict[str, SpanPerformanceColumn] = {
    "count": SpanPerformanceColumn(
        ["count()", "sumArray(spans_exclusive_time)"],
        ["count()", "sumArray(spans_exclusive_time)"],
        ["count()", "sumArray(spans_exclusive_time)"],
    ),
    "avgOccurrence": SpanPerformanceColumn(
        [
            "count()",
            "count_unique(id)",
            "equation|count() / count_unique(id)",
            "sumArray(spans_exclusive_time)",
        ],
        ["equation[0]", "sumArray(spans_exclusive_time)"],
        ["count()", "sumArray(spans_exclusive_time)"],
    ),
    "sumExclusiveTime": SpanPerformanceColumn(
        ["sumArray(spans_exclusive_time)"],
        ["sumArray(spans_exclusive_time)"],
        ["sumArray(spans_exclusive_time)"],
    ),
    "p50ExclusiveTime": SpanPerformanceColumn(
        ["percentileArray(spans_exclusive_time, 0.50)"],
        ["percentileArray(spans_exclusive_time, 0.50)"],
        ["maxArray(spans_exclusive_time)"],
    ),
    "p75ExclusiveTime": SpanPerformanceColumn(
        ["percentileArray(spans_exclusive_time, 0.75)"],
        ["percentileArray(spans_exclusive_time, 0.75)"],
        ["maxArray(spans_exclusive_time)"],
    ),
    "p95ExclusiveTime": SpanPerformanceColumn(
        ["percentileArray(spans_exclusive_time, 0.95)"],
        ["percentileArray(spans_exclusive_time, 0.95)"],
        ["maxArray(spans_exclusive_time)"],
    ),
    "p99ExclusiveTime": SpanPerformanceColumn(
        ["percentileArray(spans_exclusive_time, 0.99)"],
        ["percentileArray(spans_exclusive_time, 0.99)"],
        ["maxArray(spans_exclusive_time)"],
    ),
}


class OrganizationEventsSpansEndpointBase(OrganizationEventsEndpointBase):  # type: ignore
    def has_feature(self, request: Request, organization: Organization) -> bool:
        return bool(
            features.has(
                "organizations:performance-suspect-spans-view",
                organization,
                actor=request.user,
            )
        )

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
    perSuspect = serializers.IntegerField(default=4, min_value=0, max_value=10)

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
        per_suspect = serialized.get("perSuspect")

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

            # Because we want to support pagination, the limit is 1 more than will be
            # returned and displayed. Since this extra result is only used for
            # pagination, we do not need to get any example transactions for it.
            suspects_requiring_examples = [
                Span(suspect.op, suspect.group) for suspect in suspects[: limit - 1]
            ]

            example_transactions = query_example_transactions(
                params, query, direction, orderby_column, suspects_requiring_examples, per_suspect
            )

            return [
                SuspectSpanWithExamples(
                    examples=[
                        get_example_transaction(
                            event,
                            suspect.op,
                            suspect.group,
                        )
                        for event in example_transactions.get(Span(suspect.op, suspect.group), [])
                    ],
                    **dataclasses.asdict(suspect),
                ).serialize()
                for suspect in suspects
            ]

        with self.handle_query_errors():
            return self.paginate(
                request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                default_per_page=4,
                max_per_page=4,
            )


class SpansExamplesSerializer(serializers.Serializer):  # type: ignore
    query = serializers.CharField(required=False, allow_null=True)
    span = ListField(child=serializers.CharField(), required=True, allow_null=False, max_length=10)

    def validate_span(self, spans: List[str]) -> List[Span]:
        try:
            return [Span.from_str(span) for span in spans]
        except ValueError as e:
            raise serializers.ValidationError(str(e))


class OrganizationEventsSpansEndpoint(OrganizationEventsSpansEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(request, organization):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = SpansExamplesSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        query = serialized.get("query")
        spans = serialized["span"]

        direction, orderby_column = self.get_orderby_column(request)

        def data_fn(offset: int, limit: int) -> Any:
            if len(spans) > 1 and offset > 0:
                raise ParseError(detail="Can only specify offset with one span.")

            example_transactions = query_example_transactions(
                params, query, direction, orderby_column, spans, limit, offset
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
                for span in sorted(spans, key=lambda span: (span.op, span.group))
            ]

        with self.handle_query_errors():
            return self.paginate(
                request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                default_per_page=3,
                max_per_page=10,
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
    project_id: int
    project: str
    description: Optional[str]
    start_timestamp: float
    finish_timestamp: float
    non_overlapping_exclusive_time: float
    spans: List[ExampleSpan]

    def serialize(self) -> Any:
        return {
            "id": self.id,
            "projectId": self.project_id,
            "project": self.project,
            "description": self.description,
            "startTimestamp": self.start_timestamp,
            "finishTimestamp": self.finish_timestamp,
            "nonOverlappingExclusiveTime": self.non_overlapping_exclusive_time,
            "spans": [span.serialize() for span in self.spans],
        }


@dataclasses.dataclass(frozen=True)
class SuspectSpan:
    project_id: int
    project: str
    transaction: str
    op: str
    group: str
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
            "projectId": self.project_id,
            "project": self.project,
            "transaction": self.transaction,
            "op": self.op,
            "group": self.group.rjust(16, "0"),
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
class SuspectSpanWithExamples(SuspectSpan):
    examples: Optional[List[ExampleTransaction]] = None

    def serialize(self) -> Any:
        serialized = super().serialize()
        serialized["examples"] = (
            [] if self.examples is None else [ex.serialize() for ex in self.examples]
        )
        return serialized


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
    project_slug: str
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
        "project.id",
        "project",
        "transaction",
        "array_join(spans_op)",
        "array_join(spans_group)",
        "count()",
        "count_unique(id)",
    ]

    equations: List[str] = [
        strip_equation(column)
        for column in suspect_span_columns.suspect_op_group_columns
        if is_equation(column)
    ]

    # TODO: This adds all the possible fields to the query by default. However,
    # due to the way shards aggregate the rows, this can be slow. As an
    # optimization, allow the fields to be user specified to only get the
    # necessary aggregations.
    #
    # As part of the transition, continue to add all possible fields when its
    # not specified, but this should be removed in the future.
    if not fields:
        for column in SPAN_PERFORMANCE_COLUMNS.values():
            for col in column.suspect_op_group_sort:
                if not col.startswith("equation["):
                    selected_columns.append(col)

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
            project_id=suspect["project.id"],
            project=suspect["project"],
            transaction=suspect["transaction"],
            op=suspect["array_join_spans_op"],
            group=suspect["array_join_spans_group"],
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


def query_example_transactions(
    params: ParamsType,
    query: Optional[str],
    direction: str,
    orderby: str,
    spans: List[Span],
    per_suspect: int = 5,
    offset: Optional[int] = None,
) -> Dict[Span, List[EventID]]:
    # there aren't any suspects, early return to save an empty query
    if not spans or per_suspect == 0:
        return {}

    orderby_columns = SPAN_PERFORMANCE_COLUMNS[orderby].suspect_example_sort

    selected_columns: List[str] = [
        "id",
        "project.id",
        "project",
        "array_join(spans_op)",
        "array_join(spans_group)",
        *orderby_columns,
    ]

    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=selected_columns,
        query=query,
        orderby=[direction + column for column in orderby_columns],
        # we want only `per_suspect` examples for each suspect
        limit=len(spans) * per_suspect,
        offset=offset,
        functions_acl=["array_join", "sumArray", "percentileArray", "maxArray"],
    )

    # we are only interested in the specific op, group pairs from the suspects
    builder.add_conditions(
        [
            Condition(
                Function(
                    "tuple",
                    [
                        builder.resolve_function("array_join(spans_op)"),
                        builder.resolve_function("array_join(spans_group)"),
                    ],
                ),
                Op.IN,
                Function(
                    "tuple",
                    [Function("tuple", [suspect.op, suspect.group]) for suspect in spans],
                ),
            ),
        ]
    )

    if len(spans) > 1:
        # Hack: the limit by clause only allows columns but here we want to
        # do a limitby on the two array joins. For the time being, directly
        # do the limitby on the internal snuba name for the span group column
        # but this should not be relied upon in production, and if two spans
        # differ only by the span op, this will result in a incorrect query
        builder.limitby = LimitBy(Column("_snuba_array_join_spans_group"), per_suspect)

    snql_query = builder.get_snql_query()
    results = raw_snql_query(snql_query, "api.organization-events-spans-performance-examples")

    examples: Dict[Span, List[EventID]] = {Span(suspect.op, suspect.group): [] for suspect in spans}

    for example in results["data"]:
        key = Span(example["array_join_spans_op"], example["array_join_spans_group"])
        value = EventID(example["project.id"], example["project"], example["id"])
        examples[key].append(value)

    return examples


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
        project_id=event.project_id,
        project=event.project_slug,
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
            if child["parent_span_id"] == span.id
        ]
    )
    return remove_time_windows(
        TimeWindow(start=span.start_timestamp, end=span.finish_timestamp),
        non_overlapping_children_time_windows,
    )
