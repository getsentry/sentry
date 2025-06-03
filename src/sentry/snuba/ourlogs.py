import logging
from collections import defaultdict
from datetime import timedelta
from typing import Any

from sentry_sdk import trace
from snuba_sdk import Column, Condition

from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.eap.utils import handle_downsample_meta
from sentry.search.events.fields import is_function
from sentry.search.events.types import SAMPLING_MODES, EventsMeta, EventsResponse, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import OTHER_KEY, create_groupby_dict, create_result_key, zerofill
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.rpc_dataset_common import TableQuery, run_table_query
from sentry.utils import snuba_rpc
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger("sentry.snuba.ourlogs")


def get_resolver(params: SnubaParams, config: SearchResolverConfig) -> SearchResolver:
    return SearchResolver(
        params=params,
        config=config,
        definitions=OURLOG_DEFINITIONS,
    )


def query(
    selected_columns: list[str],
    query: str,
    snuba_params: SnubaParams,
    equations: list[str] | None = None,
    orderby: list[str] | None = None,
    offset: int | None = None,
    limit: int = 50,
    referrer: str | None = None,
    auto_fields: bool = False,
    auto_aggregations: bool = False,
    include_equation_fields: bool = False,
    allow_metric_aggregates: bool = False,
    use_aggregate_conditions: bool = False,
    conditions: list[Condition] | None = None,
    functions_acl: list[str] | None = None,
    transform_alias_to_input_format: bool = False,
    sample: float | None = None,
    has_metrics: bool = False,
    use_metrics_layer: bool = False,
    skip_tag_resolution: bool = False,
    extra_columns: list[Column] | None = None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    dataset: Dataset = Dataset.Discover,
    fallback_to_transactions: bool = False,
    query_source: QuerySource | None = None,
    debug: bool = False,
) -> EventsResponse:
    precise_timestamp = "tags[sentry.timestamp_precise,number]"
    if orderby == ["-timestamp"]:
        orderby = ["-timestamp", f"-{precise_timestamp}"]
        if precise_timestamp not in selected_columns:
            selected_columns.append(precise_timestamp)
    if orderby == ["timestamp"]:
        orderby = ["timestamp", precise_timestamp]
        if precise_timestamp not in selected_columns:
            selected_columns.append(precise_timestamp)
    return run_table_query(
        TableQuery(
            query_string=query or "",
            selected_columns=selected_columns,
            orderby=orderby,
            offset=offset or 0,
            limit=limit,
            referrer=referrer or "referrer unset",
            sampling_mode=None,
            resolver=get_resolver(
                params=snuba_params,
                config=SearchResolverConfig(
                    auto_fields=False,
                    use_aggregate_conditions=use_aggregate_conditions,
                ),
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
) -> Any:
    """Make a table query first to get what we need to filter by"""
    rpc_dataset_common.validate_granularity(params)

    # Virtual context columns (VCCs) are currently only supported in TraceItemTable.
    # For TopN queries, we want table and timeseries data to match.
    # Here, we want to run the table request the the VCCs. SnubaParams has
    # a property `is_timeseries_request` which resolves to true if granularity_secs is set.
    # `is_timeseries_request` is used to evaluate if VCCs should be used.
    # Unset granularity_secs, so this gets treated as a table request with
    # the correct VCC.
    table_query_params = params.copy()
    table_query_params.granularity_secs = None
    table_search_resolver = get_resolver(params=table_query_params, config=config)

    top_events = run_table_query(
        table_query_params,
        query_string,
        raw_groupby + y_axes,
        orderby,
        0,
        limit,
        referrer,
        config,
        sampling_mode,
        table_search_resolver,
    )
    if len(top_events["data"]) == 0:
        return {}

    search_resolver = get_resolver(params=params, config=config)
    # Need to change the project slug columns to project.id because timeseries requests don't take virtual_column_contexts
    groupby_columns = [col for col in raw_groupby if not is_function(col)]
    groupby_columns_without_project = [
        col if col not in ["project", "project.name"] else "project.id" for col in groupby_columns
    ]
    top_conditions, other_conditions = rpc_dataset_common.build_top_event_conditions(
        search_resolver, top_events, groupby_columns_without_project
    )
    """Make the query"""
    rpc_request, aggregates, groupbys = rpc_dataset_common.get_timeseries_query(
        search_resolver,
        params,
        query_string,
        y_axes,
        groupby_columns_without_project,
        referrer,
        sampling_mode=sampling_mode,
        extra_conditions=top_conditions,
    )
    other_request, other_aggregates, other_groupbys = rpc_dataset_common.get_timeseries_query(
        search_resolver,
        params,
        query_string,
        y_axes,
        [],  # in the other series, we want eveything in a single group, so the group by
        referrer,
        sampling_mode=sampling_mode,
        extra_conditions=other_conditions,
    )

    """Run the query"""
    rpc_response, other_response = snuba_rpc.timeseries_rpc([rpc_request, other_request])

    """Process the results"""
    map_result_key_to_timeseries = defaultdict(list)

    final_meta: EventsMeta = EventsMeta(
        fields={},
        full_scan=handle_downsample_meta(rpc_response.meta.downsampled_storage_meta),
    )
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
                resolved_groupby, context = search_resolver.resolve_attribute(col)

                # Virtual context columns (VCCs) are currently only supported in TraceItemTable.
                # Since timeseries run the query with the original column, we need to map
                # them correctly so they map the table result. We need to map both the column name
                # and the values.
                if context is not None:
                    resolved_groupby = search_resolver.map_context_to_original_column(context)

                groupby_value = groupby_attributes[resolved_groupby.internal_name]
                if context is not None:
                    groupby_value = context.constructor(params).value_map[groupby_value]
                    groupby_attributes[resolved_groupby.internal_name] = groupby_value

                remapped_groupby[col] = groupby_value

        result_key = create_result_key(remapped_groupby, groupby_columns, {})
        map_result_key_to_timeseries[result_key].append(timeseries)
    final_result = {}
    # Top Events actually has the order, so we need to iterate through it, regenerate the result keys
    for index, row in enumerate(top_events["data"]):
        result_key = create_result_key(row, groupby_columns, {})
        result_groupby = create_groupby_dict(row, groupby_columns, {})
        result = rpc_dataset_common.process_timeseries_list(
            map_result_key_to_timeseries[result_key]
        )
        final_result[result_key] = SnubaTSResult(
            {
                "data": result.timeseries,
                "groupby": result_groupby,
                "processed_timeseries": result,
                "is_other": False,
                "order": index,
                "meta": final_meta,
            },
            params.start,
            params.end,
            params.granularity_secs,
        )
    if other_response.result_timeseries:
        result = rpc_dataset_common.process_timeseries_list(
            [timeseries for timeseries in other_response.result_timeseries]
        )
        final_result[OTHER_KEY] = SnubaTSResult(
            {
                "data": result.timeseries,
                "processed_timeseries": result,
                "order": limit,
                "meta": final_meta,
                "groupby": None,
                "is_other": True,
            },
            params.start,
            params.end,
            params.granularity_secs,
        )
    return final_result
