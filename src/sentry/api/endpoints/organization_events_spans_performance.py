import dataclasses
from itertools import chain
from typing import Any, Dict, List, Optional, Tuple

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
from sentry.models import Organization
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import ParamsType
from sentry.utils.snuba import Dataset, raw_snql_query
from sentry.utils.time_window import TimeWindow, remove_time_windows, union_time_windows


@dataclasses.dataclass(frozen=True)
class SpanPerformanceColumn:
    suspect_op_group_column: str
    suspect_example_column: str


SPAN_PERFORMANCE_COLUMNS: Dict[str, SpanPerformanceColumn] = {
    "count": SpanPerformanceColumn("count()", "count()"),
    "sumExclusiveTime": SpanPerformanceColumn(
        "sumArray(spans_exclusive_time)", "sumArray(spans_exclusive_time)"
    ),
    "p50ExclusiveTime": SpanPerformanceColumn(
        "percentileArray(spans_exclusive_time, 0.50)", "maxArray(spans_exclusive_time)"
    ),
    "p75ExclusiveTime": SpanPerformanceColumn(
        "percentileArray(spans_exclusive_time, 0.75)", "maxArray(spans_exclusive_time)"
    ),
    "p95ExclusiveTime": SpanPerformanceColumn(
        "percentileArray(spans_exclusive_time, 0.95)", "maxArray(spans_exclusive_time)"
    ),
    "p99ExclusiveTime": SpanPerformanceColumn(
        "percentileArray(spans_exclusive_time, 0.99)", "maxArray(spans_exclusive_time)"
    ),
}


class OrganizationEventsSpansPerformanceEndpoint(OrganizationEventsEndpointBase):  # type: ignore
    def has_feature(self, request: Request, organization: Organization) -> bool:
        return bool(
            features.has(
                "organizations:performance-suspect-spans-view",
                organization,
                actor=request.user,
            )
        )

    def get(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(request, organization):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        query = request.GET.get("query")
        span_ops = request.GET.getlist("spanOp")

        direction, orderby_column = self.get_orderby_column(request)

        def data_fn(offset: int, limit: int) -> Any:
            alias = get_function_alias(
                SPAN_PERFORMANCE_COLUMNS[orderby_column].suspect_op_group_column
            )
            orderby = direction + alias
            suspects = query_suspect_span_groups(params, query, span_ops, orderby, limit, offset)

            alias = get_function_alias(
                SPAN_PERFORMANCE_COLUMNS[orderby_column].suspect_example_column
            )
            orderby = direction + alias

            # Because we want to support pagination, the limit is 1 more than will be
            # returned and displayed. Since this extra result is only used for
            # pagination, we do not need to get any example transactions for it.
            suspects_requiring_examples = suspects[: limit - 1]

            transaction_ids = query_example_transactions(
                params, query, orderby, suspects_requiring_examples
            )

            return [
                SuspectSpanWithExamples(
                    examples=[
                        get_example_transaction(
                            suspect.project_id,
                            transaction_id,
                            suspect.op,
                            suspect.group,
                        )
                        for transaction_id in transaction_ids.get((suspect.op, suspect.group), [])
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
    project_id: int
    project: str
    transaction: str
    op: str
    group: str
    frequency: int
    count: int
    sum_exclusive_time: float
    p50_exclusive_time: float
    p75_exclusive_time: float
    p95_exclusive_time: float
    p99_exclusive_time: float

    def serialize(self) -> Any:
        return {
            "projectId": self.project_id,
            "project": self.project,
            "transaction": self.transaction,
            "op": self.op,
            "group": self.group.rjust(16, "0"),
            "frequency": self.frequency,
            "count": self.count,
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


def query_suspect_span_groups(
    params: ParamsType,
    query: Optional[str],
    span_ops: Optional[List[str]],
    order_column: str,
    limit: int,
    offset: int,
) -> List[SuspectSpan]:
    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=[
            "project.id",
            "project",
            "transaction",
            "array_join(spans_op)",
            "array_join(spans_group)",
            "count_unique(id)",
            *(column.suspect_op_group_column for column in SPAN_PERFORMANCE_COLUMNS.values()),
        ],
        query=query,
        orderby=order_column,
        auto_aggregations=True,
        use_aggregate_conditions=True,
        limit=limit,
        offset=offset,
        functions_acl=["array_join", "sumArray", "percentileArray", "maxArray"],
    )

    if span_ops:
        builder.add_conditions(
            [
                Condition(
                    builder.resolve_function("array_join(spans_op)"),
                    Op.IN,
                    Function("tuple", span_ops),
                ),
            ]
        )

    snql_query = builder.get_snql_query()
    results = raw_snql_query(snql_query, "api.organization-events-spans-performance-suspects")

    return [
        SuspectSpan(
            project_id=suspect["project.id"],
            project=suspect["project"],
            transaction=suspect["transaction"],
            op=suspect["array_join_spans_op"],
            group=suspect["array_join_spans_group"],
            frequency=suspect["count_unique_id"],
            count=suspect["count"],
            sum_exclusive_time=suspect["sumArray_spans_exclusive_time"],
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
    order_column: str,
    suspects: List[SuspectSpan],
    per_suspect: int = 5,
) -> Dict[Tuple[str, str], List[str]]:
    # there aren't any suspects, early return to save an empty query
    if not suspects:
        return {}

    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=[
            "id",
            "array_join(spans_op)",
            "array_join(spans_group)",
            *(column.suspect_example_column for column in SPAN_PERFORMANCE_COLUMNS.values()),
        ],
        query=query,
        orderby=get_function_alias(order_column),
        # we want only `per_suspect` examples for each suspect
        limit=len(suspects) * per_suspect,
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
                    [Function("tuple", [suspect.op, suspect.group]) for suspect in suspects],
                ),
            ),
        ]
    )

    # Hack: the limit by clause only allows columns but here we want to
    # do a limitby on the two array joins. For the time being, directly
    # do the limitby on the internal snuba name for the span group column
    # but this should not be relied upon in production, and if two spans
    # differ only by the span op, this will result in a incorrect query
    builder.limitby = LimitBy(Column("_snuba_array_join_spans_group"), per_suspect)

    snql_query = builder.get_snql_query()
    results = raw_snql_query(snql_query, "api.organization-events-spans-performance-examples")

    examples: Dict[Tuple[str, str], List[str]] = {
        (suspect.op, suspect.group): [] for suspect in suspects
    }

    for example in results["data"]:
        key = example["array_join_spans_op"], example["array_join_spans_group"]
        examples[key].append(example["id"])

    return examples


def get_example_transaction(
    project_id: int,
    transaction_id: str,
    span_op: str,
    span_group: str,
) -> ExampleTransaction:
    span_group_id = int(span_group, 16)
    event = eventstore.get_event_by_id(project_id, transaction_id)
    data = event.data

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
        id=transaction_id,
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
