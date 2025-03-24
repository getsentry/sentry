from collections.abc import Callable
from datetime import datetime
from typing import Any

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import Expression, TimeSeriesRequest
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function

from sentry.exceptions import InvalidSearchQuery

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

    if column.aggregation.aggregate == Function.FUNCTION_UNSPECIFIED:
        return Expression(
            conditional_aggregation=column.conditional_aggregation,
            label=column.label,
        )

    return Expression(
        aggregation=column.aggregation,
        label=column.label,
    )
