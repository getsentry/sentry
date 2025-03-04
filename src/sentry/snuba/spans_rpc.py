import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

import sentry_sdk
from sentry_protos.snuba.v1.endpoint_get_trace_pb2 import GetTraceRequest
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeries, TimeSeriesRequest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeAggregation, AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import AndFilter, OrFilter, TraceItemFilter

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import ResolvedColumn, ResolvedFunction
from sentry.search.eap.constants import DOUBLE, INT, MAX_ROLLUP_POINTS, STRING, VALID_GRANULARITIES
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.span_columns import SPAN_DEFINITIONS
from sentry.search.eap.types import CONFIDENCES, EAPResponse, SearchResolverConfig
from sentry.search.events.fields import is_function
from sentry.search.events.types import EventsMeta, SnubaData, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.snuba.discover import OTHER_KEY, create_result_key, zerofill
from sentry.utils import snuba_rpc
from sentry.utils.snuba import SnubaTSResult, process_value

logger = logging.getLogger("sentry.snuba.spans_rpc")


@dataclass
class ProcessedTimeseries:
    timeseries: SnubaData = field(default_factory=list)
    confidence: SnubaData = field(default_factory=list)
    sampling_rate: SnubaData = field(default_factory=list)
    sample_count: SnubaData = field(default_factory=list)


def get_resolver(params: SnubaParams, config: SearchResolverConfig) -> SearchResolver:
    return SearchResolver(
        params=params,
        config=config,
        definitions=SPAN_DEFINITIONS,
    )


@sentry_sdk.trace
def run_table_query(
    params: SnubaParams,
    query_string: str,
    selected_columns: list[str],
    orderby: list[str] | None,
    offset: int,
    limit: int,
    referrer: str,
    config: SearchResolverConfig,
    search_resolver: SearchResolver | None = None,
) -> EAPResponse:
    return rpc_dataset_common.run_table_query(
        query_string,
        selected_columns,
        orderby,
        offset,
        limit,
        referrer,
        search_resolver or get_resolver(params, config),
    )


def get_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    groupby: list[str],
    referrer: str,
    config: SearchResolverConfig,
    granularity_secs: int,
    extra_conditions: TraceItemFilter | None = None,
) -> tuple[TimeSeriesRequest, list[type[ResolvedFunction]], list[ResolvedColumn]]:
    resolver = get_resolver(params=params, config=config)
    meta = resolver.resolve_meta(referrer=referrer)
    query, _, query_contexts = resolver.resolve_query(query_string)
    (aggregations, _) = resolver.resolve_aggregates(y_axes)
    (groupbys, _) = resolver.resolve_attributes(groupby)
    if extra_conditions is not None:
        if query is not None:
            query = TraceItemFilter(and_filter=AndFilter(filters=[query, extra_conditions]))
        else:
            query = extra_conditions

    return (
        TimeSeriesRequest(
            meta=meta,
            filter=query,
            aggregations=[
                agg.proto_definition
                for agg in aggregations
                if isinstance(agg.proto_definition, AttributeAggregation)
            ],
            group_by=[
                groupby.proto_definition
                for groupby in groupbys
                if isinstance(groupby.proto_definition, AttributeKey)
            ],
            granularity_secs=granularity_secs,
        ),
        aggregations,
        groupbys,
    )


def validate_granularity(
    params: SnubaParams,
    granularity_secs: int,
) -> None:
    """The granularity has already been somewhat validated by src/sentry/utils/dates.py:validate_granularity
    but the RPC adds additional rules on validation so those are checked here"""
    if params.date_range.total_seconds() / granularity_secs > MAX_ROLLUP_POINTS:
        raise InvalidSearchQuery(
            "Selected interval would create too many buckets for the timeseries"
        )
    if granularity_secs not in VALID_GRANULARITIES:
        raise InvalidSearchQuery(
            f"Selected interval is not allowed, allowed intervals are: {sorted(VALID_GRANULARITIES)}"
        )


@sentry_sdk.trace
def run_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    referrer: str,
    granularity_secs: int,
    config: SearchResolverConfig,
    comparison_delta: timedelta | None = None,
) -> SnubaTSResult:
    """Make the query"""
    validate_granularity(params, granularity_secs)
    rpc_request, aggregates, groupbys = get_timeseries_query(
        params, query_string, y_axes, [], referrer, config, granularity_secs
    )

    """Run the query"""
    rpc_response = snuba_rpc.timeseries_rpc([rpc_request])[0]

    """Process the results"""
    result = ProcessedTimeseries()
    final_meta: EventsMeta = EventsMeta(fields={})
    for resolved_field in aggregates + groupbys:
        final_meta["fields"][resolved_field.public_alias] = resolved_field.search_type

    for timeseries in rpc_response.result_timeseries:
        processed = _process_all_timeseries([timeseries], params, granularity_secs)
        if len(result.timeseries) == 0:
            result = processed
        else:
            for attr in ["timeseries", "confidence", "sample_count", "sampling_rate"]:
                for existing, new in zip(getattr(result, attr), getattr(processed, attr)):
                    existing.update(new)
    if len(result.timeseries) == 0:
        # The rpc only zerofills for us when there are results, if there aren't any we have to do it ourselves
        result.timeseries = zerofill(
            [],
            params.start_date,
            params.end_date,
            granularity_secs,
            ["time"],
        )

    if comparison_delta is not None:
        if len(rpc_request.aggregations) != 1:
            raise InvalidSearchQuery("Only one column can be selected for comparison queries")

        comp_query_params = params.copy()
        assert comp_query_params.start is not None, "start is required"
        assert comp_query_params.end is not None, "end is required"
        comp_query_params.start = comp_query_params.start_date - comparison_delta
        comp_query_params.end = comp_query_params.end_date - comparison_delta

        comp_rpc_request, aggregates, groupbys = get_timeseries_query(
            comp_query_params, query_string, y_axes, [], referrer, config, granularity_secs
        )
        comp_rpc_response = snuba_rpc.timeseries_rpc([comp_rpc_request])[0]

        if comp_rpc_response.result_timeseries:
            timeseries = comp_rpc_response.result_timeseries[0]
            processed = _process_all_timeseries([timeseries], params, granularity_secs)
            for existing, new in zip(result.timeseries, processed.timeseries):
                existing["comparisonCount"] = new[timeseries.label]
        else:
            for existing in result.timeseries:
                existing["comparisonCount"] = 0

    return SnubaTSResult(
        {"data": result.timeseries, "processed_timeseries": result, "meta": final_meta},
        params.start,
        params.end,
        granularity_secs,
    )


@sentry_sdk.trace
def build_top_event_conditions(
    resolver: SearchResolver, top_events: EAPResponse, groupby_columns: list[str]
) -> Any:
    conditions = []
    other_conditions = []
    for event in top_events["data"]:
        row_conditions = []
        other_row_conditions = []
        for key in groupby_columns:
            if key == "project.id":
                value = resolver.params.project_slug_map[
                    event.get("project", event.get("project.slug"))
                ]
            else:
                value = event[key]
            resolved_term, context = resolver.resolve_term(
                SearchFilter(
                    key=SearchKey(name=key),
                    operator="=",
                    value=SearchValue(raw_value=value),
                )
            )
            if resolved_term is not None:
                row_conditions.append(resolved_term)
            other_term, context = resolver.resolve_term(
                SearchFilter(
                    key=SearchKey(name=key),
                    operator="!=",
                    value=SearchValue(raw_value=value),
                )
            )
            if other_term is not None:
                other_row_conditions.append(other_term)
        conditions.append(TraceItemFilter(and_filter=AndFilter(filters=row_conditions)))
        other_conditions.append(TraceItemFilter(or_filter=OrFilter(filters=other_row_conditions)))
    return (
        TraceItemFilter(or_filter=OrFilter(filters=conditions)),
        TraceItemFilter(and_filter=AndFilter(filters=other_conditions)),
    )


def run_top_events_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    raw_groupby: list[str],
    orderby: list[str] | None,
    limit: int,
    referrer: str,
    granularity_secs: int,
    config: SearchResolverConfig,
) -> Any:
    """We intentionally duplicate run_timeseries_query code here to reduce the complexity of needing multiple helper
    functions that both would call
    This is because at time of writing, the query construction is very straightforward, if that changes perhaps we can
    change this"""
    """Make a table query first to get what we need to filter by"""
    validate_granularity(params, granularity_secs)
    search_resolver = get_resolver(params, config)
    top_events = run_table_query(
        params,
        query_string,
        raw_groupby + y_axes,
        orderby,
        0,
        limit,
        referrer,
        config,
        search_resolver,
    )
    if len(top_events["data"]) == 0:
        return {}
    # Need to change the project slug columns to project.id because timeseries requests don't take virtual_column_contexts
    groupby_columns = [col for col in raw_groupby if not is_function(col)]
    groupby_columns_without_project = [
        col if col not in ["project", "project.name"] else "project.id" for col in groupby_columns
    ]
    top_conditions, other_conditions = build_top_event_conditions(
        search_resolver, top_events, groupby_columns_without_project
    )
    """Make the query"""
    rpc_request, aggregates, groupbys = get_timeseries_query(
        params,
        query_string,
        y_axes,
        groupby_columns_without_project,
        referrer,
        config,
        granularity_secs,
        extra_conditions=top_conditions,
    )
    other_request, other_aggregates, other_groupbys = get_timeseries_query(
        params,
        query_string,
        y_axes,
        [],  # in the other series, we want eveything in a single group, so remove the group by
        referrer,
        config,
        granularity_secs,
        extra_conditions=other_conditions,
    )

    """Run the query"""
    rpc_response, other_response = snuba_rpc.timeseries_rpc([rpc_request, other_request])

    """Process the results"""
    map_result_key_to_timeseries = defaultdict(list)

    final_meta: EventsMeta = EventsMeta(fields={})
    for resolved_field in aggregates + groupbys:
        final_meta["fields"][resolved_field.public_alias] = resolved_field.search_type

    for timeseries in rpc_response.result_timeseries:
        groupby_attributes = timeseries.group_by_attributes
        remapped_groupby = {}
        # Remap internal attrs back to public ones
        for col in groupby_columns:
            if col in ["project", "project.slug"]:
                resolved_groupby, _ = search_resolver.resolve_attribute("project.id")
                remapped_groupby[col] = params.project_id_map[
                    int(groupby_attributes[resolved_groupby.internal_name])
                ]
            else:
                resolved_groupby, _ = search_resolver.resolve_attribute(col)
                remapped_groupby[col] = groupby_attributes[resolved_groupby.internal_name]
        result_key = create_result_key(remapped_groupby, groupby_columns, {})
        map_result_key_to_timeseries[result_key].append(timeseries)
    final_result = {}
    # Top Events actually has the order, so we need to iterate through it, regenerate the result keys
    for index, row in enumerate(top_events["data"]):
        result_key = create_result_key(row, groupby_columns, {})
        result = _process_all_timeseries(
            map_result_key_to_timeseries[result_key],
            params,
            granularity_secs,
        )
        final_result[result_key] = SnubaTSResult(
            {
                "data": result.timeseries,
                "processed_timeseries": result,
                "order": index,
                "meta": final_meta,
            },
            params.start,
            params.end,
            granularity_secs,
        )
    if other_response.result_timeseries:
        result = _process_all_timeseries(
            [timeseries for timeseries in other_response.result_timeseries],
            params,
            granularity_secs,
        )
        final_result[OTHER_KEY] = SnubaTSResult(
            {
                "data": result.timeseries,
                "processed_timeseries": result,
                "order": limit,
                "meta": final_meta,
            },
            params.start,
            params.end,
            granularity_secs,
        )
    return final_result


def _process_all_timeseries(
    all_timeseries: list[TimeSeries],
    params: SnubaParams,
    granularity_secs: int,
    order: int | None = None,
) -> ProcessedTimeseries:
    result = ProcessedTimeseries()

    for timeseries in all_timeseries:
        label = timeseries.label
        if result.timeseries:
            for index, bucket in enumerate(timeseries.buckets):
                assert result.timeseries[index]["time"] == bucket.seconds
                assert result.confidence[index]["time"] == bucket.seconds
                assert result.sampling_rate[index]["time"] == bucket.seconds
                assert result.sample_count[index]["time"] == bucket.seconds
        else:
            for bucket in timeseries.buckets:
                result.timeseries.append({"time": bucket.seconds})
                result.confidence.append({"time": bucket.seconds})
                result.sampling_rate.append({"time": bucket.seconds})
                result.sample_count.append({"time": bucket.seconds})

        for index, data_point in enumerate(timeseries.data_points):
            result.timeseries[index][label] = process_value(data_point.data)
            result.confidence[index][label] = CONFIDENCES.get(data_point.reliability, None)
            result.sampling_rate[index][label] = data_point.avg_sampling_rate
            result.sample_count[index][label] = data_point.sample_count

    return result


def run_trace_query(
    trace_id: str,
    params: SnubaParams,
    referrer: str,
    config: SearchResolverConfig,
) -> list[dict[str, Any]]:
    trace_attributes = [
        "parent_span",
        "description",
        "span.op",
        "is_transaction",
        "transaction.span_id",
        "transaction",
        "precise.start_ts",
        "precise.finish_ts",
        "project.slug",
        "project.id",
        "span.duration",
    ]
    resolver = get_resolver(params=params, config=SearchResolverConfig())
    columns, _ = resolver.resolve_attributes(trace_attributes)
    meta = resolver.resolve_meta(referrer=referrer)
    request = GetTraceRequest(
        meta=meta,
        trace_id=trace_id,
        items=[
            GetTraceRequest.TraceItem(
                item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
                attributes=[col.proto_definition for col in columns],
            )
        ],
    )
    response = snuba_rpc.get_trace_rpc(request)
    spans = []
    columns_by_name = {col.proto_definition.name: col for col in columns}
    for item_group in response.item_groups:
        for span_item in item_group.items:
            span: dict[str, Any] = {"id": span_item.id, "children": []}
            for attribute in span_item.attributes:
                resolved_column = columns_by_name[attribute.key.name]
                if resolved_column.proto_definition.type == STRING:
                    span[resolved_column.public_alias] = attribute.value.val_str
                elif resolved_column.proto_definition.type == DOUBLE:
                    span[resolved_column.public_alias] = attribute.value.val_double
                elif resolved_column.search_type == "boolean":
                    span[resolved_column.public_alias] = attribute.value.val_int == 1
                elif resolved_column.proto_definition.type == INT:
                    span[resolved_column.public_alias] = attribute.value.val_int
            spans.append(span)
    return spans
