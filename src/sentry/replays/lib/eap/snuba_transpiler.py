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

This module does not consider aliasing. If you have a query which contains aliases you must
normalize it first.
"""

from collections.abc import Sequence
from datetime import datetime
from typing import Any
from typing import Literal as TLiteral
from typing import NotRequired, TypedDict, cast

import urllib3
from django.conf import settings
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.exceptions import NotFound
from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    AggregationAndFilter,
    AggregationComparisonFilter,
    AggregationFilter,
    AggregationOrFilter,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as EAPColumn
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableRequest
from sentry_protos.snuba.v1.error_pb2 import Error as ErrorProto
from sentry_protos.snuba.v1.formula_pb2 import Literal
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta as EAPRequestMeta
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    DoubleArray,
    ExtrapolationMode,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function as EAPFunction
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import IntArray, StrArray, VirtualColumnContext
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    ExistsFilter,
    NotFilter,
    OrFilter,
    TraceItemFilter,
)
from snuba_sdk import (
    AliasedExpression,
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

from sentry.net.http import connection_from_url
from sentry.utils.snuba import RetrySkipTimeout
from sentry.utils.snuba_rpc import SnubaRPCError

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

TRACE_ITEM_TYPE_MAP = {
    "span": TraceItemType.TRACE_ITEM_TYPE_SPAN,
    "error": TraceItemType.TRACE_ITEM_TYPE_ERROR,
    "log": TraceItemType.TRACE_ITEM_TYPE_LOG,
    "uptime_check": TraceItemType.TRACE_ITEM_TYPE_UPTIME_CHECK,
    "uptime_result": TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
    "replay": TraceItemType.TRACE_ITEM_TYPE_REPLAY,
}


class RequestMeta(TypedDict):
    cogs_category: str
    debug: bool
    end_datetime: datetime
    organization_id: int
    project_ids: list[int]
    referrer: str
    request_id: str
    start_datetime: datetime
    trace_item_type: TLiteral[
        "span", "error", "log", "uptime_check", "uptime_result", "replay"  # noqa
    ]


class Settings(TypedDict, total=False):
    """Query settings which are not representable in Snuba SDK."""

    attribute_types: dict[str, type[bool | float | int | str]]
    default_limit: int
    default_offset: int
    extrapolation_mode: TLiteral["weighted", "none"]  # noqa


VirtualColumn = TypedDict(
    "VirtualColumn",
    {
        "from": str,
        "to": str,
        "value_map": dict[str, str],
        "default_value": NotRequired[str],
    },
)


def execute_query(request: TraceItemTableRequest, referrer: str):
    request_method = "POST"
    request_body = request.SerializeToString()
    request_url = "/rpc/EndpointTraceItemTable/v1"
    request_headers = {"referer": referrer}

    try:
        _snuba_pool = connection_from_url(
            settings.SENTRY_SNUBA,
            retries=RetrySkipTimeout(
                total=5,
                # Our calls to snuba frequently fail due to network issues. We want to
                # automatically retry most requests. Some of our POSTs and all of our DELETEs
                # do cause mutations, but we have other things in place to handle duplicate
                # mutations.
                allowed_methods={"GET", "POST", "DELETE"},
            ),
            timeout=settings.SENTRY_SNUBA_TIMEOUT,
            maxsize=10,
        )

        http_resp = _snuba_pool.urlopen(
            method=request_method,
            url=request_url,
            body=request_body,
            headers=request_headers,
        )
    except urllib3.exceptions.HTTPError as err:
        raise SnubaRPCError(err)

    if http_resp.status >= 400:
        error = ErrorProto()
        error.ParseFromString(http_resp.data)
        if http_resp.status == 404:
            raise NotFound() from SnubaRPCError(error)
        else:
            raise SnubaRPCError(error)

    return http_resp


def query(
    query: Query, meta: RequestMeta, settings: Settings, virtual_columns: list[VirtualColumn]
) -> TraceItemTableRequest:
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(meta["start_datetime"])

    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(meta["end_datetime"])

    return TraceItemTableRequest(
        columns=select(query.select, settings),
        filter=where(query.where, settings),
        aggregation_filter=having(query.having, settings),
        group_by=groupby(query.groupby, settings),
        order_by=orderby(query.orderby, settings),
        limit=query.limit.limit if query.limit else settings.get("default_limit", 25),
        page_token=PageToken(
            offset=query.offset.offset if query.offset else settings.get("default_offset", 0)
        ),
        virtual_column_contexts=[
            VirtualColumnContext(
                from_column_name=vc["from"],
                to_column_name=vc["to"],
                value_map=vc["value_map"],
                default_value=vc.get("default_value", ""),
            )
            for vc in virtual_columns
        ],
        meta=EAPRequestMeta(
            cogs_category=meta["cogs_category"],
            debug=meta["debug"],
            end_timestamp=end_timestamp,
            organization_id=meta["organization_id"],
            project_ids=meta["project_ids"],
            referrer=meta["referrer"],
            request_id=meta["request_id"],
            start_timestamp=start_timestamp,
            trace_item_type=TRACE_ITEM_TYPE_MAP[meta["trace_item_type"]],
        ),
    )


def select(
    exprs: list[AliasedExpression | Column | CurriedFunction | Function] | None,
    settings: Settings,
) -> list[EAPColumn] | None:
    if exprs is None:
        return None

    return [expression(expr, settings) for expr in exprs]


def where(
    conditions: list[BooleanCondition | Condition] | None,
    settings: Settings,
) -> TraceItemFilter | None:
    if not conditions:
        return None

    return TraceItemFilter(
        and_filter=AndFilter(filters=[condition(c, settings) for c in conditions])
    )


def having(
    conditions: list[BooleanCondition | Condition] | None,
    settings: Settings,
) -> AggregationFilter | None:
    if not conditions:
        return None

    return AggregationFilter(
        and_filter=AggregationAndFilter(filters=[agg_condition(c, settings) for c in conditions])
    )


def orderby(
    orderby: Sequence[OrderBy] | None,
    settings: Settings,
) -> list[TraceItemTableRequest.OrderBy] | None:
    if not orderby:
        return None

    return [
        TraceItemTableRequest.OrderBy(
            column=expression(o.exp, settings), descending=o.direction == Direction.DESC
        )
        for o in orderby
    ]


def groupby(
    columns: list[AliasedExpression | Column | CurriedFunction | Function], settings: Settings
) -> list[AttributeKey]:
    if not all(isinstance(c, Column) for c in columns):
        raise TypeError("Only column types are permitted in the group by clause")

    return [key(column, settings) for column in columns]


def condition(expr: BooleanCondition | Condition, settings: Settings) -> TraceItemFilter:
    if isinstance(expr, BooleanCondition):
        filters = [condition(c, settings) for c in expr.conditions]
        if expr.op == BooleanOp.AND:
            return TraceItemFilter(and_filter=AndFilter(filters=filters))
        else:
            return TraceItemFilter(or_filter=OrFilter(filters=filters))

    if isinstance(expr.lhs, (CurriedFunction, Function)):
        assert expr.op == Op.EQ, "Dropped operator must be equals"
        assert expr.rhs == 1, "Dropped right hand expression must be one"
        return function_to_filter(expr.lhs, settings)
    else:
        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=key(expr.lhs, settings),
                op=operator(expr.op),
                value=literal(expr.rhs),
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
        return TraceItemFilter(exists_filter=ExistsFilter(key=key(expr.parameters[0], settings)))
    elif expr.function == "not":
        filters = [function_to_filter(p, settings) for p in expr.parameters]
        return TraceItemFilter(
            not_filter=NotFilter(filters=[TraceItemFilter(and_filter=AndFilter(filters=filters))])
        )
    elif expr.function in FUNCTION_OPERATOR_MAP:
        assert len(expr.parameters) == 2, "Invalid number of parameters for binary expression"
        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=key(expr.parameters[0], settings),
                op=FUNCTION_OPERATOR_MAP[expr.function],
                value=literal(expr.parameters[1]),
            )
        )
    else:
        raise ValueError("Unsupported expr specified", expr)


def agg_condition(expr: BooleanCondition | Condition, settings: Settings) -> AggregationFilter:
    if isinstance(expr, BooleanCondition):
        filters = [agg_condition(c, settings) for c in expr.conditions]
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
        return EAPColumn(key=key(expr, settings), label=expr.name)
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
                    key=key(expr.parameters[0], settings),
                    extrapolation_mode=EXTRAPOLATION_MODE_MAP[settings["extrapolation_mode"]],
                )
            )
        elif expr.function in CONDITIONAL_FUNCTION_MAP:
            return EAPColumn(
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=CONDITIONAL_FUNCTION_MAP[expr.function],
                    key=key(expr.parameters[0], settings),
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
        raise TypeError("Invalid expression type specified", expr)


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
            if not all(isinstance(item, typ_) for item in value):
                raise ValueError("Heterogenous list specified", value)

            if isinstance(value[0], float):
                return AttributeValue(val_double_array=DoubleArray(values=cast(list[float], value)))
            elif isinstance(value[0], int):
                return AttributeValue(val_int_array=IntArray(values=cast(list[int], value)))
            else:
                return AttributeValue(val_str_array=StrArray(values=cast(list[str], value)))
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
