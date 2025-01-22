import logging

import sentry_sdk
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as RPCColumn
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableRequest
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeAggregation, AttributeKey
from snuba_sdk import Column, Condition

from sentry.search.eap.columns import ResolvedColumn, ResolvedFunction
from sentry.search.eap.ourlog_columns import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import CONFIDENCES, ConfidenceData, EAPResponse, SearchResolverConfig
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import EventsMeta, EventsResponse, SnubaData, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.utils import snuba_rpc
from sentry.utils.snuba import process_value

logger = logging.getLogger("sentry.snuba.ourlogs")


def categorize_column(column: ResolvedColumn | ResolvedFunction) -> RPCColumn:
    if isinstance(column, ResolvedFunction):
        return RPCColumn(aggregation=column.proto_definition, label=column.public_alias)
    else:
        return RPCColumn(key=column.proto_definition, label=column.public_alias)


def get_resolver(params: SnubaParams, config: SearchResolverConfig) -> SearchResolver:
    return SearchResolver(
        params=params,
        config=config,
        definitions=OURLOG_DEFINITIONS,
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
    """Make the query"""
    resolver = (
        get_resolver(params=params, config=config) if search_resolver is None else search_resolver
    )
    meta = resolver.resolve_meta(referrer=referrer)
    where, having, query_contexts = resolver.resolve_query(query_string)
    columns, column_contexts = resolver.resolve_columns(selected_columns)
    contexts = resolver.clean_contexts(query_contexts + column_contexts)
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
    has_aggregations = any(
        col for col in columns if isinstance(col.proto_definition, AttributeAggregation)
    )

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
        virtual_column_contexts=[context for context in contexts if context is not None],
    )
    rpc_response = snuba_rpc.table_rpc([rpc_request])[0]

    """Process the results"""
    final_data: SnubaData = []
    final_confidence: ConfidenceData = []
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
            result_value: str | int | float
            result_value = getattr(result, str(result.WhichOneof("value")))
            result_value = process_value(result_value)
            final_data[index][attribute] = resolved_column.process_column(result_value)
            if has_reliability:
                final_confidence[index][attribute] = CONFIDENCES.get(
                    column_value.reliabilities[index], None
                )

    return {"data": final_data, "meta": final_meta, "confidence": final_confidence}


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
) -> EventsResponse:
    return run_table_query(
        params=snuba_params,
        query_string=query or "",
        selected_columns=selected_columns,
        orderby=orderby,
        offset=offset or 0,
        limit=limit,
        referrer=referrer or "referrer unset",
        config=SearchResolverConfig(
            auto_fields=False,
            use_aggregate_conditions=use_aggregate_conditions,
        ),
        search_resolver=None,
    )
