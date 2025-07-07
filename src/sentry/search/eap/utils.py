from collections.abc import Callable
from datetime import datetime
from typing import Any, Literal

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import (
    DownsampledStorageConfig,
    DownsampledStorageMeta,
)
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import Expression, TimeSeriesRequest
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.constants import SAMPLING_MODE_MAP
from sentry.search.eap.ourlogs.attributes import (
    LOGS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    LOGS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    LOGS_PRIVATE_ATTRIBUTES,
    LOGS_REPLACEMENT_ATTRIBUTES,
    LOGS_REPLACEMENT_MAP,
)
from sentry.search.eap.spans.attributes import (
    SPAN_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SPANS_PRIVATE_ATTRIBUTES,
    SPANS_REPLACEMENT_ATTRIBUTES,
    SPANS_REPLACEMENT_MAP,
)
from sentry.search.eap.types import SupportedTraceItemType
from sentry.search.events.types import SAMPLING_MODES

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


def number_validator(input: str) -> bool:
    if input.replace(".", "", 1).isdecimal():
        return True
    raise InvalidSearchQuery(f"Invalid parameter {input}. Must be numeric")


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
        default_value_double=column.default_value_double,
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


def validate_sampling(sampling_mode: SAMPLING_MODES | None) -> DownsampledStorageConfig:
    if sampling_mode is None:
        return DownsampledStorageConfig(mode=DownsampledStorageConfig.MODE_NORMAL)
    if sampling_mode not in SAMPLING_MODE_MAP:
        raise InvalidSearchQuery(f"sampling mode: {sampling_mode} is not supported")
    else:
        return DownsampledStorageConfig(mode=SAMPLING_MODE_MAP[sampling_mode])


INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[
    SupportedTraceItemType, dict[Literal["string", "number"], dict[str, str]]
] = {
    SupportedTraceItemType.SPANS: SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.LOGS: LOGS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
}


PRIVATE_ATTRIBUTES: dict[SupportedTraceItemType, set[str]] = {
    SupportedTraceItemType.SPANS: SPANS_PRIVATE_ATTRIBUTES,
    SupportedTraceItemType.LOGS: LOGS_PRIVATE_ATTRIBUTES,
}

SENTRY_CONVENTIONS_REPLACEMENT_ATTRIBUTES: dict[SupportedTraceItemType, set[str]] = {
    SupportedTraceItemType.SPANS: SPANS_REPLACEMENT_ATTRIBUTES,
    SupportedTraceItemType.LOGS: LOGS_REPLACEMENT_ATTRIBUTES,
}

SENTRY_CONVENTIONS_REPLACEMENT_MAPPINGS: dict[SupportedTraceItemType, dict[str, str]] = {
    SupportedTraceItemType.SPANS: SPANS_REPLACEMENT_MAP,
    SupportedTraceItemType.LOGS: LOGS_REPLACEMENT_MAP,
}


INTERNAL_TO_SECONDARY_ALIASES: dict[SupportedTraceItemType, dict[str, set[str]]] = {
    SupportedTraceItemType.SPANS: SPAN_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SupportedTraceItemType.LOGS: LOGS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
}


def translate_internal_to_public_alias(
    internal_alias: str,
    type: Literal["string", "number"],
    item_type: SupportedTraceItemType,
) -> str | None:
    mapping = INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(item_type, {}).get(type, {})
    return mapping.get(internal_alias)


def get_secondary_aliases(
    internal_alias: str, item_type: SupportedTraceItemType
) -> set[str] | None:
    mapping = INTERNAL_TO_SECONDARY_ALIASES.get(item_type, {})
    return mapping.get(internal_alias)


def can_expose_attribute(attribute: str, item_type: SupportedTraceItemType) -> bool:
    return attribute not in PRIVATE_ATTRIBUTES.get(item_type, {})


def handle_downsample_meta(meta: DownsampledStorageMeta) -> bool:
    return not meta.can_go_to_higher_accuracy_tier


def is_sentry_convention_replacement_attribute(
    public_alias: str, item_type: SupportedTraceItemType
) -> bool:
    return public_alias in SENTRY_CONVENTIONS_REPLACEMENT_ATTRIBUTES.get(item_type, {})


def translate_to_sentry_conventions(public_alias: str, item_type: SupportedTraceItemType) -> str:
    mapping = SENTRY_CONVENTIONS_REPLACEMENT_MAPPINGS.get(item_type, {})
    return mapping.get(public_alias, public_alias)
