import logging

import sentry_sdk
from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeAggregation, AttributeKey

from sentry.search.eap.columns import Function, ResolvedColumn, ResolvedFormula, ResolvedFunction
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import CONFIDENCES, ConfidenceData, EAPResponse
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import EventsMeta, SnubaData
from sentry.utils import snuba_rpc
from sentry.utils.snuba import process_value

logger = logging.getLogger("sentry.snuba.spans_rpc")


def categorize_column(column: ResolvedColumn | ResolvedFunction | ResolvedFormula) -> Column:
    if isinstance(column, ResolvedFormula):
        return Column(formula=column.proto_definition, label=column.public_alias)
    if isinstance(column, ResolvedFunction):
        return Column(aggregation=column.proto_definition, label=column.public_alias)
    else:
        return Column(key=column.proto_definition, label=column.public_alias)


def is_aggregate(column: ResolvedColumn | ResolvedFunction | ResolvedFormula) -> bool:
    proto_definition = column.proto_definition
    if isinstance(proto_definition, AttributeKey):
        return False

    def is_aggregate_definition(
        definition: AttributeAggregation | AttributeConditionalAggregation | Column.BinaryFormula,
    ):
        if (
            isinstance(definition, AttributeAggregation)
            and definition.aggregate != Function.FUNCTION_UNSPECIFIED
        ):
            return True
        if (
            isinstance(definition, AttributeConditionalAggregation)
            and definition.aggregate != Function.FUNCTION_UNSPECIFIED
        ):
            return True

        if isinstance(definition, Column.BinaryFormula):
            return (
                is_aggregate_definition(definition.left.aggregation)
                or is_aggregate_definition(definition.right.aggregation)
                or is_aggregate_definition(definition.left.conditional_aggregation)
                or is_aggregate_definition(definition.right.conditional_aggregation)
                or is_aggregate_definition(definition.left.formula)
            )

        return False

    return is_aggregate_definition(proto_definition)


@sentry_sdk.trace
def run_table_query(
    query_string: str,
    selected_columns: list[str],
    orderby: list[str] | None,
    offset: int,
    limit: int,
    referrer: str,
    resolver: SearchResolver,
) -> EAPResponse:
    """Make the query"""
    meta = resolver.resolve_meta(referrer=referrer)
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
    has_aggregations = any(col for col in columns if is_aggregate(col))

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

    return {"data": final_data, "meta": final_meta, "confidence": final_confidence}
