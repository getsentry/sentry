from typing import Any

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.search.eap.spans import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.utils import snuba_rpc


def get_table_query(
    params: SnubaParams,
    query_string: str,
    selected_columns: list[str],  # Aggregations & Fields?
    orderby: list[str],
    offset: int,
    limit: int,
    referrer: str,
    config: SearchResolverConfig,
) -> TraceItemTableRequest:
    """Make the query"""
    resolver = SearchResolver(params=params, config=config)
    columns, contexts = resolver.resolve_columns(selected_columns)
    final_columns = []
    for col in columns:
        if col.is_aggregate:
            final_columns.append(Column(aggregation=col.proto_definition, label=col.public_alias))
        else:
            final_columns.append(Column(key=col.proto_definition, label=col.public_alias))
    query = resolver.resolve_query(query_string)
    contexts = list(set(contexts))

    rpc_request = TraceItemTableRequest(
        meta=None,  # TODO
        filter=query,
        columns=final_columns,
        group_by=[col for col in columns if isinstance(col, AttributeKey)],
        virtual_column_contexts=[context for context in contexts if context is not None],
    )

    return rpc_request


def run_table_query(
    params: SnubaParams,
    query_string: str,
    selected_columns: list[str],  # Aggregations & Fields?
    orderby: list[str],
    offset: int,
    limit: int,
    referrer: str,
    config: SearchResolverConfig,
) -> Any:
    rpc_request = get_table_query(
        params=params,
        query_string=query_string,
        selected_columns=selected_columns,
        orderby=orderby,
        offset=offset,
        limit=limit,
        referrer=referrer,
        config=config,
    )
    rpc_response = snuba_rpc.rpc(rpc_request, TraceItemTableResponse)

    """Process the results"""
    return rpc_response
    # for row in result:
    #     for column in columns:
    #         column.process(row)
    # return result


def run_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    groupby: list[str],
) -> Any:
    pass
    """Make the query"""
    # maker = SearchResolver(params)
    # groupby, contexts = maker.resolve_columns(groupby)
    # yaxes = maker.resolve_aggregate(y_axes)
    # query = maker.resolve_query(query_string)

    """Run the query"""
    # rpc = timeseries_RPC(columns=[column.proto_definition for column in groupby], query=query)
    # result = rpc.run()

    """Process the results"""
    # return _process_timeseries(result, columns)


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


def _process_timeseries(result, columns):
    pass
    # for row in result:
    #     for column in columns:
    #         column.process(row)
    # return result
