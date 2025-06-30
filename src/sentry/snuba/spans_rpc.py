import logging
from datetime import timedelta
from typing import Any

import sentry_sdk
from sentry_protos.snuba.v1.endpoint_get_trace_pb2 import GetTraceRequest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.constants import DOUBLE, INT, STRING
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.eap.utils import handle_downsample_meta
from sentry.search.events.types import SAMPLING_MODES, EventsMeta, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.snuba.discover import zerofill
from sentry.utils import snuba_rpc
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger("sentry.snuba.spans_rpc")


def get_resolver(
    params: SnubaParams,
    config: SearchResolverConfig,
) -> SearchResolver:
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
    sampling_mode: SAMPLING_MODES | None,
    equations: list[str] | None = None,
    search_resolver: SearchResolver | None = None,
    debug: bool = False,
) -> EAPResponse:
    return rpc_dataset_common.run_table_query(
        rpc_dataset_common.TableQuery(
            query_string=query_string,
            selected_columns=selected_columns,
            equations=equations,
            orderby=orderby,
            offset=offset,
            limit=limit,
            referrer=referrer,
            sampling_mode=sampling_mode,
            resolver=search_resolver or get_resolver(params, config),
        ),
        debug,
    )


@sentry_sdk.trace
def run_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    referrer: str,
    config: SearchResolverConfig,
    sampling_mode: SAMPLING_MODES | None,
    comparison_delta: timedelta | None = None,
) -> SnubaTSResult:
    """Make the query"""
    rpc_dataset_common.validate_granularity(params)
    search_resolver = get_resolver(params, config)
    rpc_request, aggregates, groupbys = rpc_dataset_common.get_timeseries_query(
        search_resolver, params, query_string, y_axes, [], referrer, sampling_mode
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

    if comparison_delta is not None:
        if len(rpc_request.expressions) != 1:
            raise InvalidSearchQuery("Only one column can be selected for comparison queries")

        comp_query_params = params.copy()
        assert comp_query_params.start is not None, "start is required"
        assert comp_query_params.end is not None, "end is required"
        comp_query_params.start = comp_query_params.start_date - comparison_delta
        comp_query_params.end = comp_query_params.end_date - comparison_delta

        search_resolver = get_resolver(comp_query_params, config)
        comp_rpc_request, aggregates, groupbys = rpc_dataset_common.get_timeseries_query(
            search_resolver,
            comp_query_params,
            query_string,
            y_axes,
            [],
            referrer,
            sampling_mode=sampling_mode,
        )
        comp_rpc_response = snuba_rpc.timeseries_rpc([comp_rpc_request])[0]

        if comp_rpc_response.result_timeseries:
            timeseries = comp_rpc_response.result_timeseries[0]
            processed = rpc_dataset_common.process_timeseries_list([timeseries])
            for existing, new in zip(result.timeseries, processed.timeseries):
                existing["comparisonCount"] = new[timeseries.label]
        else:
            for existing in result.timeseries:
                existing["comparisonCount"] = 0

    return SnubaTSResult(
        {"data": result.timeseries, "processed_timeseries": result, "meta": final_meta},
        params.start,
        params.end,
        params.granularity_secs,
    )


@sentry_sdk.trace
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


@sentry_sdk.trace
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
        "transaction.event_id",
        "transaction",
        "precise.start_ts",
        "precise.finish_ts",
        "project.id",
        "profile.id",
        "profiler.id",
        "span.duration",
        "sdk.name",
        "measurements.time_to_initial_display",
        "measurements.time_to_full_display",
    ]
    for key in {
        "lcp",
        "fcp",
        "inp",
        "cls",
        "ttfb",
    }:
        trace_attributes.append(f"measurements.{key}")
        trace_attributes.append(f"measurements.score.ratio.{key}")
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
            span: dict[str, Any] = {
                "id": span_item.id,
                "children": [],
                "errors": [],
                "occurrences": [],
                "event_type": "span",
            }
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
                    if resolved_column.public_alias == "project.id":
                        span["project.slug"] = resolver.params.project_id_map.get(
                            span[resolved_column.public_alias], "Unknown"
                        )
            spans.append(span)
    return spans
