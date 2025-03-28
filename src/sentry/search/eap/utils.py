from collections.abc import Callable
from datetime import datetime
from typing import Any, Literal

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import Expression, TimeSeriesRequest
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.constants import SAMPLING_MODES
from sentry.search.eap.ourlogs.attributes import LOGS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS
from sentry.search.eap.spans.attributes import SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS
from sentry.search.eap.types import SupportedTraceItemType

# TODO: Remove when https://github.com/getsentry/eap-planning/issues/206 is merged, since we can use formulas in both APIs at that point
BINARY_FORMULA_OPERATOR_MAP = {
    Column.BinaryFormula.OP_ADD: Expression.BinaryFormula.OP_ADD,
    Column.BinaryFormula.OP_SUBTRACT: Expression.BinaryFormula.OP_SUBTRACT,
    Column.BinaryFormula.OP_MULTIPLY: Expression.BinaryFormula.OP_MULTIPLY,
    Column.BinaryFormula.OP_DIVIDE: Expression.BinaryFormula.OP_DIVIDE,
    Column.BinaryFormula.OP_UNSPECIFIED: Expression.BinaryFormula.OP_UNSPECIFIED,
}


def literal_validator(values: list[Any]) -> Callable[[str], bool]:
    def _validator(input: str) -> bool:
        if input in values:
            return True
        raise InvalidSearchQuery(f"Invalid parameter {input}. Must be one of {values}")

    return _validator


def add_start_end_conditions(
    in_msg: TimeSeriesRequest, start: datetime, end: datetime
) -> TimeSeriesRequest:
    start_time_proto = Timestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = Timestamp()
    end_time_proto.FromDatetime(end)
    in_msg.meta.start_timestamp.CopyFrom(start_time_proto)
    in_msg.meta.end_timestamp.CopyFrom(end_time_proto)

    return in_msg


def transform_binary_formula_to_expression(
    column: Column.BinaryFormula,
) -> Expression.BinaryFormula:
    """TODO: Remove when https://github.com/getsentry/eap-planning/issues/206 is merged, since we can use formulas in both APIs at that point"""
    return Expression.BinaryFormula(
        left=transform_column_to_expression(column.left),
        right=transform_column_to_expression(column.right),
        op=BINARY_FORMULA_OPERATOR_MAP[column.op],
    )


def transform_column_to_expression(column: Column) -> Expression:
    """TODO: Remove when https://github.com/getsentry/eap-planning/issues/206 is merged, since we can use formulas in both APIs at that point"""
    if column.formula.op != Column.BinaryFormula.OP_UNSPECIFIED:
        return Expression(
            formula=transform_binary_formula_to_expression(column.formula),
            label=column.label,
        )

    if column.aggregation.aggregate != Function.FUNCTION_UNSPECIFIED:
        return Expression(
            aggregation=column.aggregation,
            label=column.label,
        )

    if column.conditional_aggregation.aggregate != Function.FUNCTION_UNSPECIFIED:
        return Expression(
            conditional_aggregation=column.conditional_aggregation,
            label=column.label,
        )

    return Expression(
        label=column.label,
        literal=column.literal,
    )


def validate_sampling(sampling_mode: str | None) -> DownsampledStorageConfig:
    if sampling_mode is None:
        return DownsampledStorageConfig(mode=DownsampledStorageConfig.MODE_UNSPECIFIED)
    sampling_mode = sampling_mode.upper()
    if sampling_mode not in SAMPLING_MODES:
        raise InvalidSearchQuery(f"sampling mode: {sampling_mode} is not supported")
    else:
        return DownsampledStorageConfig(mode=SAMPLING_MODES[sampling_mode])


INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[
    SupportedTraceItemType, dict[Literal["string", "number"], dict[str, str]]
] = {
    SupportedTraceItemType.SPANS: SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.LOGS: LOGS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
}


def translate_internal_to_public_alias(
    internal_alias: str,
    type: Literal["string", "number"],
    item_type: SupportedTraceItemType,
) -> str | None:
    mapping = INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(item_type, {}).get(type, {})
    return mapping.get(internal_alias)