import logging
from datetime import timedelta
from typing import Any

from sentry_sdk import trace

from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.eap.utils import handle_downsample_meta
from sentry.search.events.types import SAMPLING_MODES, EventsMeta, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.snuba.discover import zerofill
from sentry.utils import snuba_rpc
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger("sentry.snuba.ourlogs")


def get_resolver(params: SnubaParams, config: SearchResolverConfig) -> SearchResolver:
    return SearchResolver(
        params=params,
        config=config,
        definitions=OURLOG_DEFINITIONS,
    )


@trace
def run_table_query(
    params: SnubaParams,
    query_string: str,
    selected_columns: list[str],
    orderby: list[str] | None,
    offset: int,
    limit: int,
    referrer: str,
    config: SearchResolverConfig,
    sampling_mode: SAMPLING_MODES | None = None,
    equations: list[str] | None = None,
    search_resolver: SearchResolver | None = None,
    debug: bool = False,
) -> EAPResponse:
    precise_timestamp = "tags[sentry.timestamp_precise,number]"
    if orderby == ["-timestamp"]:
        orderby = ["-timestamp", f"-{precise_timestamp}"]
        if precise_timestamp not in selected_columns:
            selected_columns.append(precise_timestamp)
    if orderby == ["timestamp"]:
        orderby = ["timestamp", precise_timestamp]
        if precise_timestamp not in selected_columns:
            selected_columns.append(precise_timestamp)

    return rpc_dataset_common.run_table_query(
        rpc_dataset_common.TableQuery(
            query_string=query_string,
            selected_columns=selected_columns,
            orderby=orderby,
            offset=offset,
            limit=limit,
            referrer=referrer,
            sampling_mode=None,
            resolver=search_resolver
            or get_resolver(
                params=params,
                config=config,
            ),
        ),
        debug=debug,
    )


@trace
def run_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    referrer: str,
    config: SearchResolverConfig,
    sampling_mode: SAMPLING_MODES | None,
    comparison_delta: timedelta | None = None,
) -> SnubaTSResult:
    rpc_dataset_common.validate_granularity(params)
    search_resolver = get_resolver(params, config)
    rpc_request, aggregates, groupbys = rpc_dataset_common.get_timeseries_query(
        search_resolver, params, query_string, y_axes, [], referrer, sampling_mode=None
    )

    """Run the query"""
    rpc_response = snuba_rpc.timeseries_rpc([rpc_request])[0]

    """Process the results"""
    result = rpc_dataset_common.ProcessedTimeseries()
    final_meta: EventsMeta = EventsMeta(
        fields={},
        full_scan=handle_downsample_meta(rpc_response.meta.downsampled_storage_meta),
    )
    for resolved_field in aggregates + groupbys:
        final_meta["fields"][resolved_field.public_alias] = resolved_field.search_type

    for timeseries in rpc_response.result_timeseries:
        processed = rpc_dataset_common.process_timeseries_list([timeseries])
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
            params.timeseries_granularity_secs,
            ["time"],
        )

    return SnubaTSResult(
        {"data": result.timeseries, "processed_timeseries": result, "meta": final_meta},
        params.start,
        params.end,
        params.granularity_secs,
    )


@trace
def run_top_events_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    raw_groupby: list[str],
    orderby: list[str] | None,
    limit: int,
    referrer: str,
    config: SearchResolverConfig,
    sampling_mode: SAMPLING_MODES | None,
    equations: list[str] | None = None,
) -> Any:
    return rpc_dataset_common.run_top_events_timeseries_query(
        get_resolver=get_resolver,
        params=params,
        query_string=query_string,
        y_axes=y_axes,
        raw_groupby=raw_groupby,
        orderby=orderby,
        limit=limit,
        referrer=referrer,
        config=config,
        sampling_mode=sampling_mode,
        equations=equations,
    )
