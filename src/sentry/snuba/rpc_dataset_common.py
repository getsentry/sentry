import logging
import math
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import sentry_sdk
from google.protobuf.json_format import MessageToJson
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import (
    Expression,
    TimeSeries,
    TimeSeriesRequest,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.discover import arithmetic
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import (
    AnyResolved,
    ResolvedAggregate,
    ResolvedAttribute,
    ResolvedConditionalAggregate,
    ResolvedEquation,
    ResolvedFormula,
    ResolvedLiteral,
)
from sentry.search.eap.constants import DOUBLE, MAX_ROLLUP_POINTS, VALID_GRANULARITIES
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import CONFIDENCES, ConfidenceData, EAPResponse, SearchResolverConfig
from sentry.search.eap.utils import handle_downsample_meta, transform_binary_formula_to_expression
from sentry.search.events.fields import get_function_alias, is_function
from sentry.search.events.types import SAMPLING_MODES, EventsMeta, SnubaData, SnubaParams
from sentry.snuba.discover import OTHER_KEY, create_groupby_dict, create_result_key
from sentry.utils import json, snuba_rpc
from sentry.utils.snuba import SnubaTSResult, process_value

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
            result.sampling_rate[index][label] = process_value(data_point.avg_sampling_rate)
            result.sample_count[index][label] = process_value(data_point.sample_count)

    return result


def categorize_column(
    column: AnyResolved,
) -> Column:
    # Can't do bare literals, so they're actually formulas with +0
    if isinstance(column, (ResolvedFormula, ResolvedEquation, ResolvedLiteral)):
        return Column(formula=column.proto_definition, label=column.public_alias)
    elif isinstance(column, ResolvedAggregate):
        return Column(aggregation=column.proto_definition, label=column.public_alias)
    elif isinstance(column, ResolvedConditionalAggregate):
        return Column(conditional_aggregation=column.proto_definition, label=column.public_alias)
    else:
        return Column(key=column.proto_definition, label=column.public_alias)


def categorize_aggregate(
    column: AnyResolved,
) -> Expression:
    if isinstance(column, (ResolvedFormula, ResolvedEquation)):
        # TODO: Remove when https://github.com/getsentry/eap-planning/issues/206 is merged, since we can use formulas in both APIs at that point
        return Expression(
            formula=transform_binary_formula_to_expression(column.proto_definition),
            label=column.public_alias,
        )
    elif isinstance(column, ResolvedAggregate):
        return Expression(aggregation=column.proto_definition, label=column.public_alias)
    elif isinstance(column, ResolvedConditionalAggregate):
        return Expression(
            conditional_aggregation=column.proto_definition, label=column.public_alias
        )
    else:
        raise Exception(f"Unknown column type {type(column)}")


def update_timestamps(
    params: SnubaParams, resolver: SearchResolver
) -> tuple[TraceItemFilter | None, SnubaParams]:
    """We need to update snuba params to query a wider period than requested so that we get aligned granularities while
    still querying the requested period

    This is because quote:
    "the platform will not be changing its behavior to accommodate this request. The endpoint's capabilities are
    currently flexible enough to allow the client to build either thing. Whether it's rounding time buckets or not, that
    behavior is up to you. Creating two separate almost identical endpoints to allow for both behaviors is also not
    going to happen."
    """
    if not resolver.config.stable_timestamp_quantization:
        return None, params
    elif (
        params.start is not None and params.end is not None and params.granularity_secs is not None
    ):
        # Doing this via timestamps as its the most direct and matches how its stored under the hood
        start = int(params.start.replace(tzinfo=None).timestamp())
        end = int(params.end.replace(tzinfo=None).timestamp())
        timeseries_definition, _ = resolver.resolve_attribute("timestamp")
        # Need timestamp as a double even though that's not how resolver does it so we can pass the timestamp in directly
        timeseries_column = AttributeKey(name=timeseries_definition.internal_name, type=DOUBLE)

        # Create a And statement with the date range that the user selected
        ts_filter = TraceItemFilter(
            and_filter=AndFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=timeseries_column,
                            op=ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
                            value=AttributeValue(val_int=start),
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=timeseries_column,
                            op=ComparisonFilter.OP_LESS_THAN,
                            value=AttributeValue(val_int=end),
                        )
                    ),
                ]
            )
        )

        # Round the start & end so that we get buckets that match the granularity
        params.start = datetime.fromtimestamp(
            math.floor(params.start.timestamp() / params.granularity_secs) * params.granularity_secs
        )
        params.end = datetime.fromtimestamp(
            math.ceil(params.end.timestamp() / params.granularity_secs) * params.granularity_secs
        )
        return ts_filter, params
    else:
        raise InvalidSearchQuery("start, end and interval are required")


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
    list[AnyResolved],
    list[ResolvedAttribute],
]:
    timeseries_filter, params = update_timestamps(params, search_resolver)
    meta = search_resolver.resolve_meta(referrer=referrer, sampling_mode=sampling_mode)
    query, _, query_contexts = search_resolver.resolve_query(query_string)
    selected_equations, selected_axes = arithmetic.categorize_columns(y_axes)
    (functions, _) = search_resolver.resolve_functions(selected_axes)
    equations, _ = search_resolver.resolve_equations(selected_equations)
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

    if timeseries_filter is not None:
        if query is not None:
            query = TraceItemFilter(and_filter=AndFilter(filters=[query, timeseries_filter]))
        else:
            query = timeseries_filter

    return (
        TimeSeriesRequest(
            meta=meta,
            filter=query,
            expressions=[
                categorize_aggregate(fn) for fn in (functions + equations) if fn.is_aggregate
            ],
            group_by=[
                groupby.proto_definition
                for groupby in groupbys
                if isinstance(groupby.proto_definition, AttributeKey)
            ],
            granularity_secs=params.timeseries_granularity_secs,
        ),
        (functions + equations),
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


@dataclass
class TableQuery:
    query_string: str
    selected_columns: list[str]
    orderby: list[str] | None
    offset: int
    limit: int
    referrer: str
    sampling_mode: SAMPLING_MODES | None
    resolver: SearchResolver
    equations: list[str] | None = None
    name: str | None = None


@dataclass
class TableRequest:
    """Container for rpc requests"""

    rpc_request: TraceItemTableRequest
    columns: list[AnyResolved]


@sentry_sdk.trace
def run_bulk_table_queries(queries: list[TableQuery]):
    """Validate the bulk queries"""
    names: set[str] = set()
    for query in queries:
        if query.name is None:
            raise ValueError("Query name is required for bulk queries")
        elif query.name in names:
            raise ValueError("Query names need to be unique")
        else:
            names.add(query.name)
    prepared_queries = {query.name: get_table_rpc_request(query) for query in queries}
    """Run the query"""
    responses = snuba_rpc.table_rpc([query.rpc_request for query in prepared_queries.values()])
    results = {
        name: process_table_response(response, request)
        for (name, request), response in zip(prepared_queries.items(), responses)
    }
    return results


def get_table_rpc_request(query: TableQuery) -> TableRequest:
    """Make the query"""
    resolver = query.resolver
    sentry_sdk.set_tag("query.sampling_mode", query.sampling_mode)
    meta = resolver.resolve_meta(referrer=query.referrer, sampling_mode=query.sampling_mode)
    where, having, query_contexts = resolver.resolve_query(query.query_string)

    all_columns: list[AnyResolved] = []
    equations, equation_contexts = resolver.resolve_equations(
        query.equations if query.equations else []
    )
    columns, column_contexts = resolver.resolve_columns(
        query.selected_columns,
        has_aggregates=any(equation for equation in equations if equation.is_aggregate),
    )
    all_columns = columns + equations
    contexts = resolver.resolve_contexts(query_contexts + column_contexts)
    # We allow orderby function_aliases if they're a selected_column
    # eg. can orderby sum_span_self_time, assuming sum(span.self_time) is selected
    orderby_aliases = {
        resolved_column.public_alias: resolved_column for resolved_column in all_columns
    }
    for alias_column in columns:
        orderby_aliases[get_function_alias(alias_column.public_alias)] = alias_column
    # Orderby is only applicable to TraceItemTableRequest
    resolved_orderby = []
    orderby_columns = query.orderby if query.orderby is not None else []
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

    has_aggregations = any(col for col in columns if col.is_aggregate) or any(
        col for col in equations if col.is_aggregate
    )

    labeled_columns = [categorize_column(col) for col in all_columns]
    if has_aggregations:
        group_by = []
        for col in equations:
            if isinstance(col, ResolvedAttribute) and not col.is_aggregate:
                group_by.append(col.proto_definition)
        for col in columns:
            if isinstance(col.proto_definition, AttributeKey):
                group_by.append(col.proto_definition)
    else:
        group_by = []

    return TableRequest(
        TraceItemTableRequest(
            meta=meta,
            filter=where,
            aggregation_filter=having,
            columns=labeled_columns,
            group_by=group_by,
            order_by=resolved_orderby,
            limit=query.limit,
            page_token=PageToken(offset=query.offset),
            virtual_column_contexts=[context for context in contexts if context is not None],
        ),
        all_columns,
    )


@sentry_sdk.trace
def run_table_query(
    query: TableQuery,
    debug: bool = False,
) -> EAPResponse:
    """Run the query"""
    table_request = get_table_rpc_request(query)
    rpc_request = table_request.rpc_request
    rpc_response = snuba_rpc.table_rpc([rpc_request])[0]
    sentry_sdk.set_tag("query.storage_meta.tier", rpc_response.meta.downsampled_storage_meta.tier)

    return process_table_response(rpc_response, table_request, debug=debug)


def process_table_response(
    rpc_response: TraceItemTableResponse,
    table_request: TableRequest,
    debug: bool = False,
) -> EAPResponse:
    """Process the results"""
    final_data: SnubaData = []
    final_confidence: ConfidenceData = []
    final_meta: EventsMeta = EventsMeta(
        fields={},
        full_scan=handle_downsample_meta(rpc_response.meta.downsampled_storage_meta),
    )
    # Mapping from public alias to resolved column so we know type etc.
    columns_by_name = {col.public_alias: col for col in table_request.columns}

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

    if debug:
        final_meta["query"] = json.loads(MessageToJson(table_request.rpc_request))

    return {"data": final_data, "meta": final_meta, "confidence": final_confidence}


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
                    value=SearchValue(raw_value=value, use_raw_value=True),
                )
            )
            if resolved_term is not None:
                row_conditions.extend(resolved_term)
            other_term, context = resolver.resolve_term(
                SearchFilter(
                    key=SearchKey(name=key),
                    operator="!=",
                    value=SearchValue(raw_value=value, use_raw_value=True),
                )
            )
            if other_term is not None:
                other_row_conditions.extend(other_term)
        conditions.append(TraceItemFilter(and_filter=AndFilter(filters=row_conditions)))
        other_conditions.append(TraceItemFilter(or_filter=OrFilter(filters=other_row_conditions)))
    return (
        TraceItemFilter(or_filter=OrFilter(filters=conditions)),
        TraceItemFilter(and_filter=AndFilter(filters=other_conditions)),
    )


@sentry_sdk.trace
def run_top_events_timeseries_query(
    get_resolver: Callable[[SnubaParams, SearchResolverConfig], SearchResolver],
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
    """We intentionally duplicate run_timeseries_query code here to reduce the complexity of needing multiple helper
    functions that both would call
    This is because at time of writing, the query construction is very straightforward, if that changes perhaps we can
    change this"""
    validate_granularity(params)

    # Virtual context columns (VCCs) are currently only supported in TraceItemTable.
    # For TopN queries, we want table and timeseries data to match.
    # Here, we want to run the table request the the VCCs. SnubaParams has
    # a property `is_timeseries_request` which resolves to true if granularity_secs is set.
    # `is_timeseries_request` is used to evaluate if VCCs should be used.
    # Unset granularity_secs, so this gets treated as a table request with
    # the correct VCC.
    table_query_params = params.copy()
    table_query_params.granularity_secs = None
    table_search_resolver = get_resolver(table_query_params, config)

    # Make a table query first to get what we need to filter by
    _, non_equation_axes = arithmetic.categorize_columns(y_axes)
    top_events = run_table_query(
        TableQuery(
            query_string=query_string,
            selected_columns=raw_groupby + non_equation_axes,
            orderby=orderby,
            offset=0,
            limit=limit,
            referrer=referrer,
            sampling_mode=sampling_mode,
            resolver=table_search_resolver,
            equations=equations,
        )
    )
    if len(top_events["data"]) == 0:
        return {}

    search_resolver = get_resolver(params, config)
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
        search_resolver,
        params,
        query_string,
        y_axes,
        groupby_columns_without_project,
        referrer,
        sampling_mode=sampling_mode,
        extra_conditions=top_conditions,
    )
    other_request, other_aggregates, other_groupbys = get_timeseries_query(
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
        result = process_timeseries_list(map_result_key_to_timeseries[result_key])
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
        result = process_timeseries_list(
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
