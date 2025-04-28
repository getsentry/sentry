import logging
from dataclasses import dataclass, field

import sentry_sdk
from google.protobuf.json_format import MessageToJson
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import (
    Expression,
    TimeSeries,
    TimeSeriesRequest,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import AndFilter, TraceItemFilter

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import (
    ResolvedAggregate,
    ResolvedAttribute,
    ResolvedConditionalAggregate,
    ResolvedFormula,
)
from sentry.search.eap.constants import MAX_ROLLUP_POINTS, VALID_GRANULARITIES
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import CONFIDENCES, ConfidenceData, EAPResponse
from sentry.search.eap.utils import handle_downsample_meta, transform_binary_formula_to_expression
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import SAMPLING_MODES, EventsMeta, SnubaData, SnubaParams
from sentry.utils import json, snuba_rpc
from sentry.utils.snuba import process_value

logger = logging.getLogger("sentry.snuba.spans_rpc")


@dataclass
class ProcessedTimeseries:
    timeseries: SnubaData = field(default_factory=list)
    confidence: SnubaData = field(default_factory=list)
    sampling_rate: SnubaData = field(default_factory=list)
    sample_count: SnubaData = field(default_factory=list)


def process_timeseries_list(timeseries_list: list[TimeSeries]) -> ProcessedTimeseries:
    result = ProcessedTimeseries()

    for timeseries in timeseries_list:
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


def categorize_column(
    column: ResolvedAttribute | ResolvedAggregate | ResolvedConditionalAggregate | ResolvedFormula,
) -> Column:
    if isinstance(column, ResolvedFormula):
        return Column(formula=column.proto_definition, label=column.public_alias)
    if isinstance(column, ResolvedAggregate):
        return Column(aggregation=column.proto_definition, label=column.public_alias)
    if isinstance(column, ResolvedConditionalAggregate):
        return Column(conditional_aggregation=column.proto_definition, label=column.public_alias)
    else:
        return Column(key=column.proto_definition, label=column.public_alias)


def categorize_aggregate(
    column: ResolvedAggregate | ResolvedConditionalAggregate | ResolvedFormula,
) -> Expression:
    if isinstance(column, ResolvedFormula):
        # TODO: Remove when https://github.com/getsentry/eap-planning/issues/206 is merged, since we can use formulas in both APIs at that point
        return Expression(
            formula=transform_binary_formula_to_expression(column.proto_definition),
            label=column.public_alias,
        )
    if isinstance(column, ResolvedAggregate):
        return Expression(aggregation=column.proto_definition, label=column.public_alias)
    if isinstance(column, ResolvedConditionalAggregate):
        return Expression(
            conditional_aggregation=column.proto_definition, label=column.public_alias
        )


def get_timeseries_query(
    search_resolver: SearchResolver,
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    groupby: list[str],
    referrer: str,
    sampling_mode: SAMPLING_MODES | None,
    extra_conditions: TraceItemFilter | None = None,
) -> tuple[
    TimeSeriesRequest,
    list[ResolvedFormula | ResolvedAggregate | ResolvedConditionalAggregate],
    list[ResolvedAttribute],
]:
    meta = search_resolver.resolve_meta(referrer=referrer, sampling_mode=sampling_mode)
    query, _, query_contexts = search_resolver.resolve_query(query_string)
    (functions, _) = search_resolver.resolve_functions(y_axes)
    groupbys, groupby_contexts = search_resolver.resolve_attributes(groupby)

    # Virtual context columns (VCCs) are currently only supported in TraceItemTable.
    # Since they are not supported here - we map them manually back to the original
    # column the virtual context column would have used.
    for i, groupby_definition in enumerate(zip(groupbys, groupby_contexts)):
        _, context = groupby_definition
        if context is not None:
            col = search_resolver.map_context_to_original_column(context)
            groupbys[i] = col

    if extra_conditions is not None:
        if query is not None:
            query = TraceItemFilter(and_filter=AndFilter(filters=[query, extra_conditions]))
        else:
            query = extra_conditions

    return (
        TimeSeriesRequest(
            meta=meta,
            filter=query,
            expressions=[categorize_aggregate(fn) for fn in functions if fn.is_aggregate],
            group_by=[
                groupby.proto_definition
                for groupby in groupbys
                if isinstance(groupby.proto_definition, AttributeKey)
            ],
            granularity_secs=params.timeseries_granularity_secs,
        ),
        functions,
        groupbys,
    )


def validate_granularity(
    params: SnubaParams,
) -> None:
    """The granularity has already been somewhat validated by src/sentry/utils/dates.py:validate_granularity
    but the RPC adds additional rules on validation so those are checked here"""
    if params.date_range.total_seconds() / params.timeseries_granularity_secs > MAX_ROLLUP_POINTS:
        raise InvalidSearchQuery(
            "Selected interval would create too many buckets for the timeseries"
        )
    if params.timeseries_granularity_secs not in VALID_GRANULARITIES:
        raise InvalidSearchQuery(
            f"Selected interval is not allowed, allowed intervals are: {sorted(VALID_GRANULARITIES)}"
        )


@sentry_sdk.trace
def run_table_query(
    query_string: str,
    selected_columns: list[str],
    orderby: list[str] | None,
    offset: int,
    limit: int,
    referrer: str,
    sampling_mode: SAMPLING_MODES | None,
    resolver: SearchResolver,
    debug: bool = False,
) -> EAPResponse:
    """Make the query"""
    sentry_sdk.set_tag("query.sampling_mode", sampling_mode)
    meta = resolver.resolve_meta(referrer=referrer, sampling_mode=sampling_mode)
    where, having, query_contexts = resolver.resolve_query(query_string)
    columns, column_contexts = resolver.resolve_columns(selected_columns)
    contexts = resolver.resolve_contexts(query_contexts + column_contexts)
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

    has_aggregations = any(col for col in columns if col.is_aggregate)

    labeled_columns = [categorize_column(col) for col in columns]

    """Run the query"""
    rpc_request = TraceItemTableRequest(
        meta=meta,
        filter=where,
        aggregation_filter=having,
        columns=labeled_columns,
        group_by=(
            [
                col.proto_definition
                for col in columns
                if isinstance(col.proto_definition, AttributeKey)
            ]
            if has_aggregations
            else []
        ),
        order_by=resolved_orderby,
        limit=limit,
        page_token=PageToken(offset=offset),
        virtual_column_contexts=[context for context in contexts if context is not None],
    )
    rpc_response = snuba_rpc.table_rpc([rpc_request])[0]
    sentry_sdk.set_tag("query.storage_meta.tier", rpc_response.meta.downsampled_storage_meta.tier)

    """Process the results"""
    final_data: SnubaData = []
    final_confidence: ConfidenceData = []
    final_meta: EventsMeta = EventsMeta(
        fields={},
        **handle_downsample_meta(rpc_response.meta.downsampled_storage_meta),
    )
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
        final_meta["fields"][attribute] = resolved_column.search_type

        # When there's no aggregates reliabilities is an empty array
        has_reliability = len(column_value.reliabilities) > 0
        if has_reliability:
            assert len(column_value.results) == len(column_value.reliabilities), Exception(
                "Length of rpc results do not match length of rpc reliabilities"
            )
        sentry_sdk.set_measurement(
            f"SearchResolver.result_size.{attribute}", len(column_value.results)
        )

        while len(final_data) < len(column_value.results):
            final_data.append({})
            final_confidence.append({})

        for index, result in enumerate(column_value.results):
            result_value: str | int | float | None
            if result.is_null:
                result_value = None
            else:
                result_value = getattr(result, str(result.WhichOneof("value")))
            result_value = process_value(result_value)
            final_data[index][attribute] = resolved_column.process_column(result_value)
            if has_reliability:
                final_confidence[index][attribute] = CONFIDENCES.get(
                    column_value.reliabilities[index], None
                )
    sentry_sdk.set_measurement("SearchResolver.result_size.final_data", len(final_data))

    if debug:
        final_meta["query"] = json.loads(MessageToJson(rpc_request))

    return {"data": final_data, "meta": final_meta, "confidence": final_confidence}
