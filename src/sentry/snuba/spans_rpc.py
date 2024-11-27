import logging
from typing import Any

from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest, TimeSeriesResponse
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeAggregation, AttributeKey

from sentry.search.eap.columns import ResolvedColumn, ResolvedFunction
from sentry.search.eap.constants import FLOAT, INT, STRING
from sentry.search.eap.spans import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import EventsMeta, EventsResponse, SnubaData, SnubaParams
from sentry.utils import snuba_rpc
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger("sentry.snuba.spans_rpc")


def categorize_column(column: ResolvedColumn | ResolvedFunction) -> Column:
    if isinstance(column, ResolvedFunction):
        return Column(aggregation=column.proto_definition, label=column.public_alias)
    else:
        return Column(key=column.proto_definition, label=column.public_alias)


def run_table_query(
    params: SnubaParams,
    query_string: str,
    selected_columns: list[str],
    orderby: list[str] | None,
    offset: int,
    limit: int,
    referrer: str,
    config: SearchResolverConfig,
) -> EventsResponse:
    """Make the query"""
    resolver = SearchResolver(params=params, config=config)
    meta = resolver.resolve_meta(referrer=referrer)
    query = resolver.resolve_query(query_string)
    columns, contexts = resolver.resolve_columns(selected_columns)
    # We allow orderby function_aliases if they're a selected_column
    # eg. can orderby sum_span_self_time, assuming sum(span.self_time) is selected
    orderby_aliases = {
        get_function_alias(column_name): resolved_column
        for resolved_column, column_name in zip(columns, selected_columns)
    }
    # Orderby is only applicable to TraceItemTableRequest
    resolved_orderby = []
    orderby_columns = orderby if orderby is not None else []
    for orderby_column in orderby_columns:
        stripped_orderby = orderby_column.lstrip("-")
        if stripped_orderby in orderby_aliases:
            resolved_column = orderby_aliases[stripped_orderby]
        else:
            resolved_column = resolver.resolve_column(stripped_orderby)[0]
        resolved_orderby.append(
            TraceItemTableRequest.OrderBy(
                column=categorize_column(resolved_column),
                descending=orderby_column.startswith("-"),
            )
        )

    labeled_columns = [categorize_column(col) for col in columns]

    """Run the query"""
    rpc_request = TraceItemTableRequest(
        meta=meta,
        filter=query,
        columns=labeled_columns,
        group_by=[
            col.proto_definition
            for col in columns
            if isinstance(col.proto_definition, AttributeKey)
        ],
        order_by=resolved_orderby,
        limit=limit,
        virtual_column_contexts=[context for context in contexts if context is not None],
    )
    rpc_response = snuba_rpc.table_rpc(rpc_request)

    """Process the results"""
    final_data: SnubaData = []
    final_meta: EventsMeta = EventsMeta(fields={})
    # Mapping from public alias to resolved column so we know type etc.
    columns_by_name = {col.public_alias: col for col in columns}

    for column_value in rpc_response.column_values:
        attribute = column_value.attribute_name
        if attribute not in columns_by_name:
            logger.warning(
                "A column was returned by the rpc but not a known column",
                extra={"attribute": attribute},
            )
            continue
        resolved_column = columns_by_name[attribute]
        final_meta["fields"][attribute] = resolved_column.meta_type

        while len(final_data) < len(column_value.results):
            final_data.append({})

        for index, result in enumerate(column_value.results):
            result_value: str | int | float
            if resolved_column.proto_type == STRING:
                result_value = result.val_str
            elif resolved_column.proto_type == INT:
                result_value = result.val_int
            elif resolved_column.proto_type == FLOAT:
                result_value = result.val_float
            final_data[index][attribute] = resolved_column.process_column(result_value)

    return {"data": final_data, "meta": final_meta}


def get_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    groupby: list[str],
    referrer: str,
    config: SearchResolverConfig,
    granularity_secs: int,
) -> TimeSeriesRequest:
    resolver = SearchResolver(params=params, config=config)
    meta = resolver.resolve_meta(referrer=referrer)
    query = resolver.resolve_query(query_string)
    (aggregations, _) = resolver.resolve_aggregates(y_axes)
    (groupbys, _) = resolver.resolve_columns(groupby)

    return TimeSeriesRequest(
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
    )


def run_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    referrer: str,
    granularity_secs: int,
    config: SearchResolverConfig,
) -> SnubaTSResult:
    """Make the query"""
    rpc_request = get_timeseries_query(
        params, query_string, y_axes, [], referrer, config, granularity_secs
    )

    """Run the query"""
    rpc_response = snuba_rpc.timeseries_rpc(rpc_request)

    """Process the results"""
    return _process_timeseries(rpc_response, params, granularity_secs)


def run_top_events_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    groupby: list[str],
    orderby: list[str],
) -> Any:
    """We intentionally duplicate run_timeseries_query code here to reduce the complexity of needing multiple helper
    functions that both would call
    This is because at time of writing, the query construction is very straightforward, if that changes perhaps we can
    change this"""
    pass
    """Make the query"""
    # maker = SearchResolver(params)
    # top_events = run_table_query() with process_results off
    # new_conditions = construct conditions based on top_events
    # resolved_query = And(new_conditions, maker.resolve_query(query_string))
    # groupby, contexts = maker.resolve_columns(groupby)
    # yaxes = maker.resolve_aggregate(y_axes)

    """Run the query"""
    # rpc = timeseries_RPC(columns=[column.proto_definition for column in groupby], query=query)

    """Process the results"""
    # result = rpc.run()
    # return _process_timeseries(result, columns)


def _process_timeseries(
    rpc_response: TimeSeriesResponse, params: SnubaParams, granularity_secs: int
) -> SnubaTSResult:
    result: SnubaData = []
    for timeseries in rpc_response.result_timeseries:
        # Timeseries serialization expects the function alias (eg. `count` not `count()`)
        label = get_function_alias(timeseries.label)
        if len(result) < len(timeseries.buckets):
            for bucket in timeseries.buckets:
                result.append({"time": bucket.seconds})
        for index, data_point in enumerate(timeseries.data_points):
            result[index][label] = data_point.data

    return SnubaTSResult({"data": result}, params.start, params.end, granularity_secs)
