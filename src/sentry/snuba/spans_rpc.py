from typing import Any

from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer


def run_table_query(
    params: SnubaParams,
    query_string: str,
    selected_columns: list[str],  # Aggregations & Fields?
    orderby: list[str],
    offset: int,
    limit: int,
    referrer: Referrer,
    config: SearchResolverConfig,
) -> Any:
    pass
    """Make the query"""
    # maker = SearchResolver(params)
    # columns, contexts = maker.resolve_columns(selected_columns)
    # query = maker.resolve_query(query_string)

    """Run the query"""
    # rpc = table_RPC(columns=[column.proto_definition for column in columns], query=query)
    # result = rpc.run()

    """Process the results"""
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
