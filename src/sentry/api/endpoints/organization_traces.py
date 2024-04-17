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
from sentry.utils.numbers import clip
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
                    limit=10_000,
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


def process_breakdowns(data, traces_range):
    breakdowns: Mapping[str, list[TraceInterval]] = defaultdict(list)
    stacks: Mapping[str, list[TraceInterval]] = defaultdict(list)

    def breakdown_push(trace, interval):
        trace_range = traces_range.get(trace)
        if trace_range:
            left, right = trace_range
            interval["start"] = clip(interval["start"], left, right)
            interval["end"] = clip(interval["end"], left, right)

        breakdown = breakdowns[trace]

        if breakdown:
            last_interval = breakdown[-1]

            # An interval that overlaps with existing part of the breakdown was
            # pushed, truncate it to remove the overlapping area.
            if last_interval["end"] > interval["start"]:
                interval["start"] = last_interval["end"]

        # empty interval, skip it
        if interval["start"] == interval["end"]:
            return

        if breakdown:
            last_interval = breakdown[-1]

            # A gap in the breakdown was found, fill it with an interval
            if last_interval["end"] < interval["start"]:
                last = stack_peek(trace)
                if last:
                    # Something is still on the stack, so attribute this gap to
                    # that project
                    breakdown.append(
                        {
                            "project": last["project"],
                            "start": last_interval["end"],
                            "end": interval["start"],
                            "kind": "project",
                        }
                    )
                else:
                    # Nothing is found on the stack, so label it as missing
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
        last = stack_peek(trace)
        if (
            last is not None
            and last["project"] == interval["project"]
            and last["end"] >= interval["start"]
        ):
            # The new interval can be merged with last interval
            last["end"] = max(interval["end"], last["end"])
        else:
            stacks[trace].append(interval)

    def stack_peek(trace):
        if not stacks[trace]:
            return None
        return stacks[trace][-1]

    def stack_pop(trace):
        interval = stacks[trace].pop()

        return interval

    def stack_clear(trace, until=None, insert=True):
        while stacks[trace]:
            if until is not None and stack_peek(trace)["end"] > until:
                break

            interval = stack_pop(trace)
            if insert:
                breakdown_push(trace, interval)

    for row in data:
        trace = row["trace"]

        cur: TraceInterval = {
            "project": row["project"],
            "start": row["first_seen()"],
            "end": row["last_seen()"],
            "kind": "project",
        }

        # Nothing on the stack yet, so directly push onto the stack and wait for
        # next item to come so an interval can be determined
        if not stack_peek(trace):
            stack_push(trace, cur)
            continue

        # Clear the stack of any intervals that end before the current interval
        # starts while pushing them to the breakdowns.
        stack_clear(trace, until=cur["start"], insert=True)

        # At this point, any interval remaining on the stack MUST overlap with
        # the current interval we're working with because we've cleared the
        # stack of all intervals that have ended.

        # This is the last interval that is active during the current interval
        prev = stack_peek(trace)

        if prev is not None and prev["project"] == cur["project"]:
            # Same project as the previous interval, so push it to the stack and
            # let them merge.
            stack_push(trace, cur)
            continue

        if prev is not None:
            # This implies that there is some overlap between this transaction
            # and the previous transaction. So we need push the interval up to
            # the current item to the breakdown.

            breakdown_push(
                trace,
                {
                    "project": prev["project"],
                    "start": prev["start"],
                    "end": cur["start"],
                    "kind": "project",
                },
            )

        # Clear the stack of any intervals that end before the current interval
        # ends. Here we do not need to push them to the breakdowns because
        # that time has already be attributed to the most recent interval.
        stack_clear(trace, until=cur["end"], insert=False)

        stack_push(trace, cur)

    for trace in stacks:
        stack_clear(trace, insert=True)

        # Check to see if there is still a gap before the trace ends and fill it
        # with an unknown interval.
        breakdown = breakdowns[trace]
        trace_range = traces_range.get(trace)
        if breakdown and trace_range:
            left, right = trace_range
            if breakdown[-1]["end"] < right:
                breakdown.append(
                    {
                        "project": None,
                        "start": breakdown[-1]["end"],
                        "end": right,
                        "kind": "unknown",
                    }
                )

    return breakdowns
