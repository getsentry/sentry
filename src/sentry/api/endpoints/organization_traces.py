from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, Literal, TypedDict, cast

import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Op

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.events.builder import SpansIndexedQueryBuilder
from sentry.search.events.types import ParamsType, QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import bulk_snql_query


class TraceInterval(TypedDict):
    project: str | None
    start: int
    end: int
    kind: Literal["project", "missing", "unknown"]


class TraceResult(TypedDict):
    trace: str
    numSpans: int
    name: str | None
    duration: int
    start: int
    end: int
    breakdowns: list[TraceInterval]
    spans: list[Mapping[str, Any]]


class OrganizationTracesSerializer(serializers.Serializer):
    field = serializers.ListField(required=True, allow_empty=False, child=serializers.CharField())
    query = serializers.CharField(required=False)
    maxSpansPerTrace = serializers.IntegerField(default=1, min_value=1, max_value=100)


@region_silo_endpoint
class OrganizationTracesEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.PERFORMANCE

    def get(self, request: Request, organization: Organization) -> Response:
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
                builder = SpansIndexedQueryBuilder(
                    Dataset.SpansIndexed,
                    cast(ParamsType, params),
                    snuba_params=snuba_params,
                    query=serialized.get("query", ""),
                    selected_columns=["trace", "timestamp"] + serialized["field"],
                    # The orderby is intentionally `None` here as this query is much faster
                    # if we let Clickhouse decide which order to return the results in.
                    # This also means we cannot order by any columns or paginate.
                    orderby=None,
                    limit=per_page * serialized["maxSpansPerTrace"],
                    limitby=("trace", serialized["maxSpansPerTrace"]),
                    sample_rate=sample_rate,
                    config=QueryBuilderConfig(
                        transform_alias_to_input_format=True,
                    ),
                )
                span_results = builder.run_query(Referrer.API_TRACE_EXPLORER_SPANS_LIST.value)
                span_results = builder.process_results(span_results)

            fields = span_results["meta"].pop("fields", {})
            meta = {
                **span_results["meta"],
                "fields": {field: fields[field] for field in serialized["field"]},
            }

            if not span_results["data"]:
                return {"data": [], "meta": meta}

            spans_by_trace: Mapping[str, list[Mapping[str, Any]]] = defaultdict(list)
            for row in span_results["data"]:
                spans_by_trace[row["trace"]].append(row)

            trace_spans_count = sorted(
                [(trace, len(spans)) for trace, spans in spans_by_trace.items()],
                key=lambda item: item[0],
                reverse=True,
            )[:per_page]

            spans_by_trace = {trace: spans_by_trace[trace] for trace, _ in trace_spans_count}

            min_timestamp = snuba_params.end
            max_timestamp = snuba_params.start
            assert min_timestamp is not None
            assert max_timestamp is not None
            for spans in spans_by_trace.values():
                for span in spans:
                    timestamp = datetime.fromisoformat(span["timestamp"])
                    if timestamp < min_timestamp:
                        min_timestamp = timestamp
                    if timestamp > max_timestamp:
                        max_timestamp = timestamp

            # TODO: move to use `update_snuba_params_with_timestamp`
            time_buffer = options.get("performance.traces.trace-explorer-buffer-hours")
            buffer = timedelta(hours=time_buffer)
            params["start"] = min_timestamp - buffer
            params["end"] = max_timestamp + buffer
            snuba_params.start = min_timestamp - buffer
            snuba_params.end = max_timestamp + buffer

            trace_condition = f"trace:[{', '.join(spans_by_trace.keys())}]"

            with handle_query_errors():
                breakdowns_query = SpansIndexedQueryBuilder(
                    Dataset.SpansIndexed,
                    cast(ParamsType, params),
                    snuba_params=snuba_params,
                    query=f"{trace_condition}",
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
                    limitby=("trace", int(10_000 / len(spans_by_trace))),
                    config=QueryBuilderConfig(
                        functions_acl=["trace_name", "first_seen", "last_seen"],
                        transform_alias_to_input_format=True,
                    ),
                )
                # TODO: this should be `is_transaction:1` but there's some
                # boolean mapping that's not working for this field
                breakdowns_query.add_conditions(
                    [
                        Condition(Column("is_segment"), Op.EQ, 1),
                    ]
                )

            with handle_query_errors():
                traces_meta_query = SpansIndexedQueryBuilder(
                    Dataset.SpansIndexed,
                    cast(ParamsType, params),
                    snuba_params=snuba_params,
                    query=trace_condition,
                    selected_columns=[
                        "trace",
                        "count()",
                        "trace_name()",
                        "first_seen()",
                        "last_seen()",
                    ],
                    limit=len(spans_by_trace),
                    config=QueryBuilderConfig(
                        functions_acl=["trace_name", "first_seen", "last_seen"],
                        transform_alias_to_input_format=True,
                    ),
                )

            with handle_query_errors():
                results = bulk_snql_query(
                    [
                        breakdowns_query.get_snql_query(),
                        traces_meta_query.get_snql_query(),
                    ],
                    Referrer.API_TRACE_EXPLORER_TRACES_META.value,
                )
                breakdowns_results = breakdowns_query.process_results(results[0])
                traces_meta_results = traces_meta_query.process_results(results[1])

            try:
                breakdowns = process_breakdowns(breakdowns_results["data"])
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


def process_breakdowns(data):
    trace_stacks: Mapping[str, list[TraceInterval]] = defaultdict(list)
    breakdowns_by_trace: Mapping[str, list[TraceInterval]] = defaultdict(list)

    def breakdown_append(breakdown, interval):
        breakdown.append(interval)

    def stack_pop(stack):
        interval = stack.pop()
        if stack:
            # when popping an interval off the stack, it means that we've
            # consumed up to this point in time, so we update the transaction
            # above it to the remaining interval
            stack[-1]["start"] = interval["end"]
        return interval

    def stack_clear(breakdown, stack, until=None):
        interval = None
        while stack:
            if until is not None and stack[-1]["end"] > until:
                break

            item = stack_pop(stack)

            # While popping the stack, we adjust the start
            # of the intervals in the stack, so it's possible
            # we produce an invalid interval. Make sure to
            # filter them out here
            if item["start"] <= item["end"]:
                interval = item
                breakdown_append(breakdown, interval)
        return interval

    for row in data:
        stack = trace_stacks[row["trace"]]
        cur: TraceInterval = {
            "project": row["project"],
            "start": row["first_seen()"],
            "end": row["last_seen()"],
            "kind": "project",
        }

        # nothing on the stack yet, so directly push onto
        # stack and wait for next item to come so an
        # interval can be determined
        if not stack:
            stack.append(cur)
            continue

        breakdown = breakdowns_by_trace[row["trace"]]
        prev = stack[-1]
        if prev["end"] <= cur["start"]:
            # This implies there's no overlap between this transaction
            # and the previous transaction. So we're done with the whole stack

            last = stack_clear(breakdown, stack, until=cur["start"])

            # if there's a gap between prev end and cur start
            if not stack or stack[-1]["end"] < cur["start"]:
                if last is not None and last["end"] < cur["start"]:
                    breakdown_append(
                        breakdown,
                        {
                            "project": None,
                            "start": prev["end"],
                            "end": cur["start"],
                            "kind": "missing",
                        },
                    )
        elif prev["project"] == cur["project"]:
            # If the intervals are in the same project,
            # we need to merge them into the same interval.
            new_end = max(prev["end"], cur["end"])
            prev["end"] = new_end
            continue
        else:
            # This imples that there is some overlap between this transaction
            # and the previous transaction. So we need push the interval up to
            # the current item to the breakdown.

            breakdown_append(
                breakdown,
                {
                    "project": prev["project"],
                    "start": prev["start"],
                    "end": cur["start"],
                    "kind": "project",
                },
            )

            if prev["end"] <= cur["end"]:
                stack_pop(stack)

        stack.append(cur)

    for trace, stack in trace_stacks.items():
        breakdown = breakdowns_by_trace[trace]
        stack_clear(breakdown, stack)

    return breakdowns_by_trace
