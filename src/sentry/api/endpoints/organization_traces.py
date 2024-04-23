import dataclasses
from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, Literal, TypedDict, cast

import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Op

from sentry import features, options
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
from sentry.utils.snuba import bulk_snuba_queries


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
    query = serializers.CharField(required=False)
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
                builder = SpansIndexedQueryBuilder(
                    Dataset.SpansIndexed,
                    cast(ParamsType, params),
                    snuba_params=snuba_params,
                    query=serialized.get("query", ""),
                    selected_columns=["trace", "timestamp"],
                    # The orderby is intentionally `None` here as this query is much faster
                    # if we let Clickhouse decide which order to return the results in.
                    # This also means we cannot order by any columns or paginate.
                    orderby=None,
                    limit=per_page,
                    limitby=("trace", 1),
                    sample_rate=sample_rate,
                    config=QueryBuilderConfig(
                        transform_alias_to_input_format=True,
                    ),
                )
                trace_results = builder.run_query(Referrer.API_TRACE_EXPLORER_SPANS_LIST.value)
                trace_results = builder.process_results(trace_results)

            if not trace_results["data"]:
                return {"data": [], "meta": {"fields": {}}}

            trace_ids: list[str] = []

            min_timestamp = snuba_params.end
            max_timestamp = snuba_params.start
            assert min_timestamp is not None
            assert max_timestamp is not None

            for row in trace_results["data"]:
                trace_ids.append(row["trace"])
                timestamp = datetime.fromisoformat(row["timestamp"])
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

            trace_id_condition = Condition(Column("trace_id"), Op.IN, trace_ids)

            with handle_query_errors():
                breakdowns_query = SpansIndexedQueryBuilder(
                    Dataset.SpansIndexed,
                    cast(ParamsType, all_projects_params),
                    snuba_params=all_projects_snuba_params,
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
                breakdowns_query.add_conditions([trace_id_condition])

            with handle_query_errors():
                traces_meta_query = SpansIndexedQueryBuilder(
                    Dataset.SpansIndexed,
                    cast(ParamsType, all_projects_params),
                    snuba_params=all_projects_snuba_params,
                    query=None,
                    selected_columns=[
                        "trace",
                        "count()",
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
                traces_meta_query.add_conditions([trace_id_condition])

            sort = serialized.get("sort")
            suggested_query = serialized.get("suggestedQuery", "")
            user_query = serialized.get("query", "")
            add_suggestions = user_query != suggested_query
            with handle_query_errors():
                query_strs = [user_query, suggested_query] if add_suggestions else [user_query]

                spans_queries = [
                    SpansIndexedQueryBuilder(
                        Dataset.SpansIndexed,
                        cast(ParamsType, params),
                        snuba_params=snuba_params,
                        query=query_str,
                        selected_columns=["trace"] + serialized["field"],
                        orderby=sort,
                        limit=per_page * serialized["maxSpansPerTrace"],
                        limitby=("trace", serialized["maxSpansPerTrace"]),
                        sample_rate=sample_rate,
                        config=QueryBuilderConfig(
                            transform_alias_to_input_format=True,
                        ),
                    )
                    for query_str in query_strs
                ]
                for spans_query in spans_queries:
                    spans_query.add_conditions([trace_id_condition])

            queries = [
                breakdowns_query,
                traces_meta_query,
                *spans_queries,
            ]

            with handle_query_errors():
                results = bulk_snuba_queries(
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
