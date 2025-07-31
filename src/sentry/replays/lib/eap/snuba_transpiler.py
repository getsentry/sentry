"""
███████╗████████╗ ██████╗ ██████╗
██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
███████╗   ██║   ██║   ██║██████╔╝
╚════██║   ██║   ██║   ██║██╔═══╝
███████║   ██║   ╚██████╔╝██║
╚══════╝   ╚═╝    ╚═════╝ ╚═╝

Do not use any of these functions. They are private and subject to change.

This module contains a translation layer from Snuba SDK to the EAP protocol buffers format. You do
not need to call any of the functions contained within this module to query EAP or use the
translation layer.
"""

from typing import Any, Literal, TypedDict

from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    AggregationAndFilter,
    AggregationComparisonFilter,
    AggregationFilter,
    AggregationOrFilter,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as EAPColumn
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableRequest
from sentry_protos.snuba.v1.formula_pb2 import Literal
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    ExtrapolationMode,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function as EAPFunction
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    ExistsFilter,
    NotFilter,
    OrFilter,
    TraceItemFilter,
)
from snuba_sdk import (
    BooleanCondition,
    BooleanOp,
    Column,
    Condition,
    CurriedFunction,
    Function,
    Op,
    Query,
)
from snuba_sdk.orderby import Direction, OrderBy

from sentry.snuba.rpc_dataset_common import AttributeKey, AttributeValue

ARITHMETIC_FUNCTION_MAP: dict[str, Column.BinaryFormula.Op.ValueType] = {
    "divide": Column.BinaryFormula.OP_DIVIDE,
    "minus": Column.BinaryFormula.OP_SUBTRACT,
    "multiply": Column.BinaryFormula.OP_MULTIPLY,
    "plus": Column.BinaryFormula.OP_ADD,
}

FUNCTION_MAP = {
    "avg": EAPFunction.FUNCTION_AVG,
    "count": EAPFunction.FUNCTION_COUNT,
    "max": EAPFunction.FUNCTION_MAX,
    "min": EAPFunction.FUNCTION_MIN,
    "p50": EAPFunction.FUNCTION_P50,
    "p75": EAPFunction.FUNCTION_P75,
    "p90": EAPFunction.FUNCTION_P90,
    "p95": EAPFunction.FUNCTION_P95,
    "p99": EAPFunction.FUNCTION_P99,
    "quantiles(0.5)": EAPFunction.FUNCTION_P50,
    "quantiles(0.75)": EAPFunction.FUNCTION_P75,
    "quantiles(0.90)": EAPFunction.FUNCTION_P90,
    "quantiles(0.95)": EAPFunction.FUNCTION_P95,
    "quantiles(0.99)": EAPFunction.FUNCTION_P99,
    "sum": EAPFunction.FUNCTION_SUM,
    "uniq": EAPFunction.FUNCTION_UNIQ,
}

CONDITIONAL_FUNCTION_MAP = {
    "avgIf": EAPFunction.FUNCTION_AVG,
    "countIf": EAPFunction.FUNCTION_COUNT,
    "maxIf": EAPFunction.FUNCTION_MAX,
    "minIf": EAPFunction.FUNCTION_MIN,
    "p50If": EAPFunction.FUNCTION_P50,
    "p75If": EAPFunction.FUNCTION_P75,
    "p90If": EAPFunction.FUNCTION_P90,
    "p95If": EAPFunction.FUNCTION_P95,
    "p99If": EAPFunction.FUNCTION_P99,
    "quantilesIf(0.5)": EAPFunction.FUNCTION_P50,
    "quantilesIf(0.75)": EAPFunction.FUNCTION_P75,
    "quantilesIf(0.90)": EAPFunction.FUNCTION_P90,
    "quantilesIf(0.95)": EAPFunction.FUNCTION_P95,
    "quantilesIf(0.99)": EAPFunction.FUNCTION_P99,
    "sumIf": EAPFunction.FUNCTION_SUM,
    "uniqIf": EAPFunction.FUNCTION_UNIQ,
}

AGGREGATION_OPERATOR_MAP = {
    Op.EQ: AggregationComparisonFilter.OP_EQUALS,
    Op.NEQ: AggregationComparisonFilter.OP_NOT_EQUALS,
    Op.GT: AggregationComparisonFilter.OP_GREATER_THAN,
    Op.LT: AggregationComparisonFilter.OP_LESS_THAN,
    Op.GTE: AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    Op.LTE: AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS,
}

AGGREGATION_FUNCTION_OPERATOR_MAP = {
    "equals": AggregationComparisonFilter.OP_EQUALS,
    "notEquals": AggregationComparisonFilter.OP_NOT_EQUALS,
    "greater": AggregationComparisonFilter.OP_GREATER_THAN,
    "less": AggregationComparisonFilter.OP_LESS_THAN,
    "greaterOrEquals": AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    "lessOrEquals": AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS,
}

OPERATOR_MAP = {
    Op.EQ: ComparisonFilter.OP_EQUALS,
    Op.NEQ: ComparisonFilter.OP_NOT_EQUALS,
    Op.IN: ComparisonFilter.OP_IN,
    Op.NOT_IN: ComparisonFilter.OP_NOT_IN,
    Op.GT: ComparisonFilter.OP_GREATER_THAN,
    Op.LT: ComparisonFilter.OP_LESS_THAN,
    Op.GTE: ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    Op.LTE: ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
    Op.LIKE: ComparisonFilter.OP_LIKE,
    Op.NOT_LIKE: ComparisonFilter.OP_NOT_LIKE,
}

FUNCTION_OPERATOR_MAP = {
    "equals": ComparisonFilter.OP_EQUALS,
    "notEquals": ComparisonFilter.OP_NOT_EQUALS,
    "in": ComparisonFilter.OP_IN,
    "notIn": ComparisonFilter.OP_NOT_IN,
    "greater": ComparisonFilter.OP_GREATER_THAN,
    "less": ComparisonFilter.OP_LESS_THAN,
    "greaterOrEquals": ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    "lessOrEquals": ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
    "like": ComparisonFilter.OP_LIKE,
    "notLike": ComparisonFilter.OP_NOT_LIKE,
}

TYPE_MAP = {
    bool: AttributeKey.TYPE_BOOLEAN,
    float: AttributeKey.TYPE_DOUBLE,
    int: AttributeKey.TYPE_INT,
    str: AttributeKey.TYPE_STRING,
}

EXTRAPOLATION_MODE_MAP = {
    "weighted": ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
    "none": ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
}


class Settings(TypedDict, totals=False):
    """Query settings which are not representable in Snuba SDK."""

    attribute_types: dict[str, type[bool | float | int | str]]
    default_limit: int
    default_offset: int
    extrapolation_mode: Literal["weighted", "none"]


def query(query: Query, settings: Settings) -> TraceItemTableRequest:
    return TraceItemTableRequest(
        columns=select(query.select, settings),
        filter=where(query.where, settings),
        aggregation_filter=having(query.having, settings),
        group_by=groupby(query.groupby),
        order_by=orderby(query.orderby, settings),
        limit=query.limit.limit if query.limit else settings.get("default_limit", 25),
        page_token=PageToken(
            offset=query.offset.offset if query.offset else settings.get("default_offset", 0)
        ),
        virtual_column_contexts=[],
        meta=RequestMeta(...),
    )


def select(exprs: list[Column | Function], settings: Settings) -> list[EAPColumn]:
    return [expression(expr, settings) for expr in exprs]


def where(conditions: list[BooleanCondition | Condition], settings: Settings) -> TraceItemFilter:
    return TraceItemFilter(
        and_filter=AndFilter(filters=[condition(c, settings) for c in conditions])
    )


def having(conditions: list[BooleanCondition | Condition], settings: Settings) -> AggregationFilter:
    return AggregationFilter(
        and_filter=AggregationAndFilter(filters=[agg_condition(c, settings) for c in conditions])
    )


def orderby(orderby: OrderBy, settings: Settings) -> TraceItemTableRequest.OrderBy:
    return TraceItemTableRequest.OrderBy(
        column=expression(orderby.exp, settings),
        descending=orderby.direction == Direction.DESC,
    )


def groupby(columns: list[Column], settings: Settings) -> list[AttributeKey]:
    return [key(column, settings) for column in columns]


def condition(expr: BooleanCondition | Condition, settings: Settings) -> TraceItemFilter:
    if isinstance(expr, BooleanCondition):
        filters = [condition(c) for c in expr.conditions]
        if expr.op == BooleanOp.AND:
            return TraceItemFilter(and_filter=AndFilter(filters=filters))
        else:
            return TraceItemFilter(or_filter=OrFilter(filters=filters))

    if isinstance(expr.lhs, (CurriedFunction, Function)):
        assert expr.op == Op.EQ, "Dropped operator must be equals"
        assert expr.rhs == 1, "Dropped right hand expression must be one"
        return function_to_filter(expr.lhs)
    else:
        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=key(expr.lhs, settings).key,
                op=operator(expr.op),
                value=literal(expr.rhs, settings),
            )
        )


def function_to_filter(expr: Any, settings: Settings) -> TraceItemFilter:
    if not isinstance(expr, Function):
        raise TypeError("Invalid nested expression specified. Expected function", expr)

    if expr.function == "and":
        filters = [function_to_filter(p, settings) for p in expr.parameters]
        return TraceItemFilter(and_filter=AndFilter(filters=filters))
    elif expr.function == "or":
        filters = [function_to_filter(p, settings) for p in expr.parameters]
        return TraceItemFilter(or_filter=OrFilter(filters=filters))
    elif expr.function == "exists":
        assert len(expr.parameters) == 1, "Expected single parameter to exists function"
        return TraceItemFilter(exists_filter=ExistsFilter(key=key(expr.parameters[0])))
    elif expr.function == "not":
        filters = [function_to_filter(p, settings) for p in expr.parameters]
        return TraceItemFilter(
            not_filter=NotFilter(filters=[TraceItemFilter(and_filter=AndFilter(filters=filters))])
        )
    elif expr.function in FUNCTION_OPERATOR_MAP:
        assert len(expr.parameters) == 2, "Invalid number of parameters for binary expression"
        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=key(expr.parameters[0], settings).key,
                op=FUNCTION_OPERATOR_MAP[expr.function],
                value=literal(expr.parameters[1], settings),
            )
        )
    else:
        raise ValueError("Unsupported expr specified", expr)


def agg_condition(expr: BooleanCondition | Condition, settings: Settings) -> AggregationFilter:
    if isinstance(expr, BooleanCondition):
        filters = [agg_condition(c) for c in expr.conditions]
        if expr.op == BooleanOp.AND:
            return AggregationFilter(and_filter=AggregationAndFilter(filters=filters))
        else:
            return AggregationFilter(or_filter=AggregationOrFilter(filters=filters))

    if isinstance(expr.lhs, (CurriedFunction, Function)):
        if expr.lhs.function == "and":
            filters = [agg_function_to_filter(p, settings) for p in expr.lhs.parameters]
            return AggregationFilter(and_filter=AggregationAndFilter(filters=filters))
        elif expr.lhs.function == "or":
            filters = [agg_function_to_filter(p, settings) for p in expr.lhs.parameters]
            return AggregationFilter(or_filter=AggregationOrFilter(filters=filters))
        elif expr.lhs.function in FUNCTION_MAP:
            assert len(expr.lhs.parameters) == 1, "Expected one parameter to aggregate function"
            return AggregationFilter(
                comparison_filter=AggregationComparisonFilter(
                    op=aggregate_operator(expr.op),
                    val=float(expr.rhs),
                    aggregation=AttributeAggregation(
                        aggregate=FUNCTION_MAP[expr.lhs.function],
                        key=key(expr.lhs.parameters[0], settings),
                        extrapolation_mode=EXTRAPOLATION_MODE_MAP[settings["extrapolation_mode"]],
                    ),
                )
            )
        elif expr.lhs.function in CONDITIONAL_FUNCTION_MAP:
            assert len(expr.lhs.parameters) == 2, "Expected two parameters to conditional aggregate"
            return AggregationFilter(
                comparison_filter=AggregationComparisonFilter(
                    op=aggregate_operator(expr.op),
                    val=float(expr.rhs),
                    conditional_aggregation=AttributeConditionalAggregation(
                        aggregate=CONDITIONAL_FUNCTION_MAP[expr.lhs.function],
                        key=key(expr.lhs.parameters[0], settings),
                        extrapolation_mode=EXTRAPOLATION_MODE_MAP[settings["extrapolation_mode"]],
                        filter=condition(expr.lhs.parameters[1], settings),
                    ),
                )
            )
        else:
            raise ValueError("Unsupported aggregation function specified", expr)
    else:
        raise ValueError("Expected aggregation function", expr)


def agg_function_to_filter(expr: Any, settings: Settings) -> AggregationFilter:
    assert isinstance(expr, (CurriedFunction, Function)), "Expected function"

    if expr.function == "and":
        filters = [agg_function_to_filter(p, settings) for p in expr.parameters]
        return AggregationFilter(and_filter=AggregationAndFilter(filters=filters))
    elif expr.function == "or":
        filters = [agg_function_to_filter(p, settings) for p in expr.parameters]
        return AggregationFilter(or_filter=AggregationOrFilter(filters=filters))
    elif expr.function in AGGREGATION_FUNCTION_OPERATOR_MAP:
        assert len(expr.parameters) == 2, "Expected two parameters to binary expression"

        nested_fn = expr.parameters[0]
        assert isinstance(nested_fn, (CurriedFunction, Function)), "Expected aggregate function"

        return AggregationFilter(
            comparison_filter=AggregationComparisonFilter(
                op=AGGREGATION_FUNCTION_OPERATOR_MAP[expr.function],
                val=float(expr.parameters[1]),
                aggregation=AttributeAggregation(
                    aggregate=FUNCTION_MAP[nested_fn.function],
                    key=key(nested_fn.parameters[0], settings),
                    extrapolation_mode=EXTRAPOLATION_MODE_MAP[settings["extrapolation_mode"]],
                ),
            )
        )
    else:
        raise TypeError("Invalid function specified", expr)


def expression(expr: Column | CurriedFunction | Function, settings: Settings) -> EAPColumn:
    if isinstance(expr, Column):
        return EAPColumn(key=key(expr), label=expr.name)
    elif isinstance(expr, Function):
        if expr.function in ARITHMETIC_FUNCTION_MAP:
            return EAPColumn(
                formula=EAPColumn.BinaryFormula(
                    op=ARITHMETIC_FUNCTION_MAP[expr.function],
                    left=expression(expr.parameters[0], settings),
                    right=expression(expr.parameters[1], settings),
                )
            )
        elif expr.function in FUNCTION_MAP:
            return EAPColumn(
                aggregation=AttributeAggregation(
                    aggregate=FUNCTION_MAP[expr.function],
                    key=expression(expr.parameters[0], settings),
                    extrapolation_mode=EXTRAPOLATION_MODE_MAP[settings["extrapolation_mode"]],
                )
            )
        elif expr.function in CONDITIONAL_FUNCTION_MAP:
            return EAPColumn(
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=CONDITIONAL_FUNCTION_MAP[expr.function],
                    key=expression(expr.parameters[0], settings),
                    extrapolation_mode=EXTRAPOLATION_MODE_MAP[settings["extrapolation_mode"]],
                    filter=condition(expr.parameters[1], settings),
                )
            )
        else:
            raise ValueError("Unsupported function specified", expr)
    elif isinstance(expr, (float, int)):
        return EAPColumn(literal=Literal(val_double=float(expr)))
    elif isinstance(expr, CurriedFunction):
        raise NotImplementedError
    else:
        raise TypeError("Invalid expression type specified", expr, attr_map)


def literal(value: Any) -> AttributeValue:
    match value:
        case bool():
            return AttributeValue(val_bool=value)
        case float():
            return AttributeValue(val_double=value)
        case int():
            return AttributeValue(val_int=value)
        case str():
            return AttributeValue(val_str=value)
        case None:
            return AttributeValue(is_null=True)
        case list():
            if not value:
                raise ValueError("List is empty.")

            allowed_types = float, int, str
            if not all(isinstance(item, allowed_types) for item in value):
                raise ValueError("Invalid type specified in value array", value)

            typ_ = type(value[0])
            if not all(type(item) == typ_ for item in value):
                raise ValueError("Heterogenous list specified", value)

            if isinstance(value, float):
                return AttributeValue(val_double_array=value)
            elif isinstance(value, int):
                return AttributeValue(val_int_array=value)
            else:
                return AttributeValue(val_str_array=value)
        case _:
            raise TypeError("Invalid literal specified", value)


def key(column: Any, settings: Settings) -> AttributeKey:
    assert isinstance(column, Column), "Expected column"
    return AttributeKey(type=TYPE_MAP[settings["attribute_types"][column.name]], name=column.name)


def operator(op: Op) -> ComparisonFilter.Op.ValueType:
    try:
        return OPERATOR_MAP[op]
    except KeyError:
        raise ValueError("Invalid operator specified", op)


def aggregate_operator(op: Op) -> AggregationComparisonFilter.Op.ValueType:
    try:
        return AGGREGATION_OPERATOR_MAP[op]
    except KeyError:
        raise ValueError("Invalid aggregate operator specified", op)
