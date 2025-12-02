import dataclasses
from collections import defaultdict
from collections.abc import Callable, Generator, Mapping, MutableMapping
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Literal, NotRequired, TypedDict

import sentry_sdk
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_get_traces_pb2 import (
    GetTracesRequest,
    GetTracesResponse,
    TraceAttribute,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, IntArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)
from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Function, Op
from urllib3.exceptions import ReadTimeoutError

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.constants import TIMEOUT_SPAN_ERROR_MESSAGE
from sentry.search.events.types import QueryBuilderConfig, SnubaParams, WhereType
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.numbers import clip
from sentry.utils.sdk import set_span_attribute
from sentry.utils.snuba import bulk_snuba_queries_with_referrers
from sentry.utils.snuba_rpc import get_traces_rpc

MAX_SNUBA_RESULTS = 10_000

CANDIDATE_SPAN_OPS = {"pageload", "navigation"}
MATCHING_COUNT_ALIAS = "matching_count"


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
    dataset = serializers.ChoiceField(["spans"], required=False, default="spans")

    breakdownSlices = serializers.IntegerField(default=40, min_value=1, max_value=100)
    query = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField(allow_blank=True)
    )
    sort = serializers.CharField(required=False)

    def validate_dataset(self, value):
        sentry_sdk.set_tag("query.dataset", value)
        if value == "spans":
            return Dataset.EventsAnalyticsPlatform
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
def handle_span_query_errors() -> Generator[None]:
    with handle_query_errors():
        try:
            yield
        except ReadTimeoutError:
            raise InvalidSearchQuery(TIMEOUT_SPAN_ERROR_MESSAGE)


class OrganizationTracesEndpointBase(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.DATA_BROWSING


@region_silo_endpoint
class OrganizationTracesEndpoint(OrganizationTracesEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ) and not features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
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

        with handle_query_errors():
            executor = TracesExecutor(
                dataset=serialized["dataset"],
                snuba_params=snuba_params,
                user_queries=serialized.get("query", []),
                sort=serialized.get("sort"),
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


class TracesExecutor:
    def __init__(
        self,
        *,
        dataset: Dataset,
        snuba_params: SnubaParams,
        user_queries: list[str],
        sort: str | None,
        limit: int,
        breakdown_slices: int,
        get_all_projects: Callable[[], list[Project]],
    ):
        self.dataset = dataset
        self.snuba_params = snuba_params
        self.raw_user_queries = user_queries
        self.rpc_user_queries = process_rpc_user_queries(snuba_params, user_queries)
        self.sort = sort
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
        self.offset = offset
        self.limit = limit

        return {"data": self._execute_rpc()}

    def _execute_rpc(self):
        if self.snuba_params.organization_id is None:
            raise Exception("An organization is required to resolve queries")

        all_projects = self.get_all_projects()

        rpc_request = self.get_traces_rpc(all_projects)

        rpc_response = get_traces_rpc(rpc_request)

        if not rpc_response.traces:
            return []

        projects_map: dict[int, str] = {project.id: project.slug for project in all_projects}
        traces = [format_trace_result(trace, projects_map) for trace in rpc_response.traces]

        with handle_span_query_errors():
            snuba_params = self.params_with_all_projects()
            self.enrich_eap_traces_with_extra_data(traces, snuba_params)

        return traces

    def enrich_eap_traces_with_extra_data(
        self,
        traces: list[TraceResult],
        snuba_params: SnubaParams,
    ):
        trace_ids = [trace["trace"] for trace in traces]

        breakdown_raw_results = Spans.run_table_query(
            params=snuba_params,
            query_string=f"is_transaction:1 trace:[{','.join(trace_ids)}]",
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
            offset=0,
            limit=MAX_SNUBA_RESULTS,
            referrer=Referrer.API_TRACE_EXPLORER_TRACES_BREAKDOWNS.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode=None,
        )
        spans = breakdown_raw_results["data"]

        extra_queries = [
            self.get_traces_errors_query(snuba_params, trace_ids),
            self.get_traces_occurrences_query(snuba_params, trace_ids),
        ]

        extra_raw_results = bulk_snuba_queries_with_referrers(
            [(query.get_snql_query(), referrer.value) for query, referrer in extra_queries]
        )

        extra_results = [
            query.process_results(result)
            for (query, _), result in zip(extra_queries, extra_raw_results)
        ]

        traces_errors: dict[str, int] = {
            row["trace"]: row["count()"] for row in extra_results[0]["data"]
        }

        traces_occurrences: dict[str, int] = {
            row["trace"]: row["count()"] for row in extra_results[1]["data"]
        }

        self.enrich_traces_with_extra_data(
            traces,
            spans,
            traces_errors,
            traces_occurrences,
        )

    def enrich_traces_with_extra_data(
        self,
        traces: list[TraceResult],
        spans: list[dict[str, Any]],
        traces_errors: dict[str, int],
        traces_occurrences: dict[str, int],
    ):
        traces_range = {
            trace["trace"]: {
                "start": trace["start"],
                "end": trace["end"],
                "slices": self.breakdown_slices,
            }
            for trace in traces
        }

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
        for span in spans:
            if span["trace"] in traces_primary_info:
                continue

            name: tuple[str, str, float] = (
                span["project"],
                span["transaction"],
                # to minmimize the impact of floating point errors,
                # multiply by 1e3 first then do the subtraction
                # once we move to eap_items, this can be just `span["span.duration"]`
                span["precise.finish_ts"] * 1e3 - span["precise.start_ts"] * 1e3,
            )

            # The underlying column is a Nullable(UInt64) but we write a default of 0 to it.
            # So make sure to handle both in case something changes.
            if not span["parent_span"] or int(span["parent_span"], 16) == 0:
                traces_primary_info[span["trace"]] = name

            if span["trace"] in traces_fallback_info:
                continue

            # This span is a good candidate for the trace name so use it.
            if span["trace"] not in traces_fallback_info and is_trace_name_candidate(span):
                traces_fallback_info[span["trace"]] = name

            if span["trace"] in traces_default_info:
                continue

            # This is the first span in this trace.
            traces_default_info[span["trace"]] = name

        def get_trace_info(
            trace: str,
        ) -> tuple[str, str, float] | tuple[None, None, None]:
            if trace in traces_primary_info:
                return traces_primary_info[trace]

            if trace in traces_fallback_info:
                return traces_fallback_info[trace]

            if trace in traces_default_info:
                return traces_default_info[trace]

            return (None, None, None)

        for trace in traces:
            info = get_trace_info(trace["trace"])
            if info[0] is not None and info[1] is not None:
                trace["project"] = info[0]
                trace["name"] = info[1]
                trace["rootDuration"] = info[2]

            trace["numErrors"] = traces_errors.get(trace["trace"], 0)
            trace["numOccurrences"] = traces_occurrences.get(trace["trace"], 0)
            trace["breakdowns"] = traces_breakdowns[trace["trace"]]

    def get_traces_rpc(self, projects: list[Project]):
        assert self.snuba_params.organization_id is not None
        meta = RequestMeta(
            organization_id=self.snuba_params.organization_id,
            referrer=Referrer.API_TRACE_EXPLORER_SPANS_LIST.value,
            project_ids=[project.id for project in projects],
            start_timestamp=self.snuba_params.rpc_start_date,
            end_timestamp=self.snuba_params.rpc_end_date,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_UNSPECIFIED,
        )

        base_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_int_array=IntArray(values=self.snuba_params.project_ids)),
            )
        )

        if self.rpc_user_queries:
            filters = [
                GetTracesRequest.TraceFilter(
                    item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
                    filter=TraceItemFilter(
                        and_filter=AndFilter(
                            filters=[
                                base_filter,
                                user_query,
                            ],
                        )
                    ),
                )
                for user_query in self.rpc_user_queries.values()
            ]
        else:
            filters = [
                GetTracesRequest.TraceFilter(
                    item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
                    filter=base_filter,
                )
            ]

        if self.sort == "-timestamp":
            orderby = [
                GetTracesRequest.OrderBy(
                    key=TraceAttribute.Key.KEY_START_TIMESTAMP, descending=True
                ),
            ]
        elif self.sort == "timestamp":
            orderby = [
                GetTracesRequest.OrderBy(
                    key=TraceAttribute.Key.KEY_START_TIMESTAMP, descending=False
                ),
            ]
        else:
            # The orderby is intentionally empty here as this query is much faster
            # if we let Clickhouse decide which order to return the results in.
            # This also means we cannot order by any columns or paginate.
            orderby = []
        return GetTracesRequest(
            meta=meta,
            page_token=PageToken(offset=self.offset),
            limit=self.limit,
            filters=filters,
            order_by=orderby,
            attributes=[
                TraceAttribute(key=TraceAttribute.Key.KEY_TRACE_ID),
                TraceAttribute(key=TraceAttribute.Key.KEY_START_TIMESTAMP),
                TraceAttribute(key=TraceAttribute.Key.KEY_END_TIMESTAMP),
                TraceAttribute(key=TraceAttribute.Key.KEY_TOTAL_ITEM_COUNT),
                TraceAttribute(key=TraceAttribute.Key.KEY_FILTERED_ITEM_COUNT),
                # earliest span
                TraceAttribute(key=TraceAttribute.Key.KEY_EARLIEST_SPAN_PROJECT_ID),
                TraceAttribute(key=TraceAttribute.Key.KEY_EARLIEST_SPAN_NAME),
                TraceAttribute(key=TraceAttribute.Key.KEY_EARLIEST_SPAN_DURATION_MS),
                # frontend span
                TraceAttribute(key=TraceAttribute.Key.KEY_EARLIEST_FRONTEND_SPAN_PROJECT_ID),
                TraceAttribute(key=TraceAttribute.Key.KEY_EARLIEST_FRONTEND_SPAN),
                TraceAttribute(key=TraceAttribute.Key.KEY_EARLIEST_FRONTEND_SPAN_DURATION_MS),
                # root span
                TraceAttribute(key=TraceAttribute.Key.KEY_ROOT_SPAN_PROJECT_ID),
                TraceAttribute(key=TraceAttribute.Key.KEY_ROOT_SPAN_NAME),
                TraceAttribute(key=TraceAttribute.Key.KEY_ROOT_SPAN_DURATION_MS),
            ],
        )

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

    def process_final_results(
        self,
        *,
        traces_metas_results,
        traces_errors_results,
        traces_occurrences_results,
        traces_breakdown_projects_results,
    ) -> list[TraceResult]:
        results: list[TraceResult] = []

        for row in traces_metas_results["data"]:
            result: TraceResult = {
                "trace": row["trace"],
                "numErrors": 0,
                "numOccurrences": 0,
                "matchingSpans": row[MATCHING_COUNT_ALIAS],
                # In EAP mode, we have to use `count_sample()` to avoid extrapolation
                "numSpans": row.get("count()") or row.get("count_sample()") or 0,
                "project": None,
                "name": None,
                "rootDuration": None,
                "duration": row["last_seen()"] - row["first_seen()"],
                "start": row["first_seen()"],
                "end": row["last_seen()"],
                "breakdowns": [],
            }

            results.append(result)

        traces_errors: dict[str, int] = {
            row["trace"]: row["count()"] for row in traces_errors_results["data"]
        }

        traces_occurrences: dict[str, int] = {
            row["trace"]: row["count()"] for row in traces_occurrences_results["data"]
        }

        self.enrich_traces_with_extra_data(
            results,
            traces_breakdown_projects_results["data"],
            traces_errors,
            traces_occurrences,
        )

        return results

    def process_meta_results(self, results):
        return results["meta"]

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
    parent_span = row.get("parent_span", "")
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
        "isRoot": not parent_span or set(parent_span) == {"0"},
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


def process_rpc_user_queries(
    snuba_params: SnubaParams,
    user_queries: list[str],
    dataset: Dataset = Dataset.SpansIndexed,
) -> dict[str, TraceItemFilter]:
    if len(user_queries) > 1:
        raise ValueError("Only 1 user query supported")

    queries: dict[str, TraceItemFilter] = {}

    config = SearchResolverConfig(auto_fields=True)
    resolver = Spans.get_resolver(snuba_params, config)

    # Filter out empty queries as they do not do anything to change the results.
    user_queries = [user_query for user_query in user_queries if len(user_query) > 0]

    # ensure at least 1 user query exists as the environment filter is AND'ed to it
    if not user_queries:
        user_queries.append("")

    for user_query in user_queries:
        user_query = user_query.strip()

        # We want to ignore all the aggregate conditions here because we're strictly
        # searching on span attributes, not aggregates
        where, _, _ = resolver.resolve_query(user_query)
        if where is not None:
            queries[user_query] = where

    set_span_attribute("user_queries_count", len(queries))
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


@dataclasses.dataclass
class TraceInfo:
    project: int | None = None
    name: str | None = None
    duration: float | None = None


def format_trace_result(
    trace: GetTracesResponse.Trace,
    projects_map: dict[int, str],
) -> TraceResult:
    result: TraceResult = {
        "trace": "",
        "numErrors": 0,
        "numOccurrences": 0,
        "matchingSpans": 0,
        "numSpans": 0,
        "project": None,
        "name": None,
        "rootDuration": None,
        "duration": 0,
        "start": 0,
        "end": 0,
        "breakdowns": [],
    }

    earliest_span = TraceInfo()
    frontend_span = TraceInfo()
    root_span = TraceInfo()

    for attribute in trace.attributes:
        if attribute.key == TraceAttribute.Key.KEY_TRACE_ID:
            result["trace"] = get_attr_val_str(attribute)
        elif attribute.key == TraceAttribute.Key.KEY_START_TIMESTAMP:
            result["start"] = int(get_attr_val_double(attribute) * 1000)
        elif attribute.key == TraceAttribute.Key.KEY_END_TIMESTAMP:
            result["end"] = int(get_attr_val_double(attribute) * 1000)
        elif attribute.key == TraceAttribute.Key.KEY_TOTAL_ITEM_COUNT:
            result["numSpans"] = get_attr_val_int(attribute)
        elif attribute.key == TraceAttribute.Key.KEY_FILTERED_ITEM_COUNT:
            result["matchingSpans"] = get_attr_val_int(attribute)

        # earliest span
        elif attribute.key == TraceAttribute.Key.KEY_EARLIEST_SPAN_PROJECT_ID:
            earliest_span.project = get_attr_val_int(attribute)
        elif attribute.key == TraceAttribute.Key.KEY_EARLIEST_SPAN_NAME:
            earliest_span.name = get_attr_val_str(attribute)
        elif attribute.key == TraceAttribute.Key.KEY_EARLIEST_SPAN_DURATION_MS:
            earliest_span.duration = float(get_attr_val_int(attribute))

        # frontend span
        elif attribute.key == TraceAttribute.Key.KEY_EARLIEST_FRONTEND_SPAN_PROJECT_ID:
            frontend_span.project = get_attr_val_int(attribute)
        elif attribute.key == TraceAttribute.Key.KEY_EARLIEST_FRONTEND_SPAN:
            frontend_span.name = get_attr_val_str(attribute)
        elif attribute.key == TraceAttribute.Key.KEY_EARLIEST_FRONTEND_SPAN_DURATION_MS:
            frontend_span.duration = float(get_attr_val_int(attribute))

        # root span
        elif attribute.key == TraceAttribute.Key.KEY_ROOT_SPAN_PROJECT_ID:
            root_span.project = get_attr_val_int(attribute)
        elif attribute.key == TraceAttribute.Key.KEY_ROOT_SPAN_NAME:
            root_span.name = get_attr_val_str(attribute)
        elif attribute.key == TraceAttribute.Key.KEY_ROOT_SPAN_DURATION_MS:
            root_span.duration = float(get_attr_val_int(attribute))

        else:
            raise ValueError(f"Unexpected attribute found: {attribute.key}")

    if not result["start"]:
        raise ValueError(f"Expected {TraceAttribute.Key.KEY_START_TIMESTAMP} to be present")
    if not result["end"]:
        raise ValueError(f"Expected {TraceAttribute.Key.KEY_END_TIMESTAMP} to be present")

    result["duration"] = result["end"] - result["start"]

    # if we see any of these spans, use them to fill in the result
    # on a best-effort basis
    for span in [root_span, frontend_span, earliest_span]:
        if span.project in projects_map and span.name:
            result["project"] = projects_map[span.project]
            result["name"] = span.name
            result["rootDuration"] = span.duration
            break

    return result


def validate_attribute_type(attribute: TraceAttribute, type: AttributeKey.Type.ValueType):
    if attribute.type != type:
        raise ValueError(f"Expected {attribute.key} to be of type {type} but got {attribute.type}")


def get_attr_val_str(attribute: TraceAttribute) -> str:
    validate_attribute_type(attribute, AttributeKey.Type.TYPE_STRING)
    return attribute.value.val_str


def get_attr_val_double(attribute: TraceAttribute) -> float:
    validate_attribute_type(attribute, AttributeKey.Type.TYPE_DOUBLE)
    return attribute.value.val_double


def get_attr_val_int(attribute: TraceAttribute) -> int:
    validate_attribute_type(attribute, AttributeKey.Type.TYPE_INT)
    return attribute.value.val_int
