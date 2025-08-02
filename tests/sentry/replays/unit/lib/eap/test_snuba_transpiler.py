from datetime import datetime

import pytest
from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    AggregationAndFilter,
    AggregationComparisonFilter,
    AggregationFilter,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as EAPColumn
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableRequest
from sentry_protos.snuba.v1.formula_pb2 import Literal
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function as EAPFunction
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
)
from snuba_sdk.orderby import Direction, OrderBy

from sentry.replays.lib.eap.snuba_transpiler import (
    RequestMeta,
    Settings,
    as_eap_request,
    condidtional_aggregation_filter,
    expression,
    groupby,
    having,
    orderby,
    where,
)
from sentry.snuba.rpc_dataset_common import TraceItemTableRequest

REQUEST_META: RequestMeta = {
    "cogs_category": "a",
    "debug": False,
    "end_datetime": datetime.now(),
    "organization_id": 2,
    "project_ids": [3],
    "referrer": "b",
    "request_id": "11333bc0dd9e4ce898240f162413367b",
    "start_datetime": datetime.now(),
    "trace_item_type": "replay",
}

SETTINGS: Settings = {
    "attribute_types": {"float": float, "int": int, "str": str, "bool": bool},
    "default_limit": 1,
    "default_offset": 0,
    "extrapolation_mode": "none",
}


def make_query(select=None, where=None, having=None, groupby=None, orderby=None) -> Query:
    return Query(
        match=Entity("trace_items"),
        select=select,
        where=where,
        having=having,
        groupby=groupby,
        orderby=orderby,
        limit=Limit(1),
        offset=Offset(0),
    )


def make_request(
    select=None, where=None, having=None, groupby=None, orderby=None
) -> TraceItemTableRequest:
    return TraceItemTableRequest(
        columns=select,
        filter=where,
        aggregation_filter=having,
        order_by=orderby,
        group_by=groupby,
    )


@pytest.mark.parametrize(("query", "req"), [(make_query(), make_request())])
def test_as_eap_request(query, req):
    str(as_eap_request(query, REQUEST_META, SETTINGS, virtual_columns=[])) == str(req)


@pytest.mark.parametrize(
    ("snuba_op", "eap_op"),
    [
        (Op.EQ, ComparisonFilter.OP_EQUALS),
        (Op.NEQ, ComparisonFilter.OP_NOT_EQUALS),
        (Op.IN, ComparisonFilter.OP_IN),
        (Op.NOT_IN, ComparisonFilter.OP_NOT_IN),
        (Op.GT, ComparisonFilter.OP_GREATER_THAN),
        (Op.LT, ComparisonFilter.OP_LESS_THAN),
        (Op.GTE, ComparisonFilter.OP_GREATER_THAN_OR_EQUALS),
        (Op.LTE, ComparisonFilter.OP_LESS_THAN_OR_EQUALS),
        (Op.LIKE, ComparisonFilter.OP_LIKE),
        (Op.NOT_LIKE, ComparisonFilter.OP_NOT_LIKE),
    ],
)
def test_where_comparison_filters(snuba_op, eap_op):
    conditions = [Condition(Column("int"), snuba_op, 1)]
    eap_filter = TraceItemFilter(
        and_filter=AndFilter(
            filters=[
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(type=AttributeKey.TYPE_INT, name="int"),
                        op=eap_op,
                        value=AttributeValue(val_int=1),
                    )
                )
            ]
        )
    )
    assert where(conditions, SETTINGS) == eap_filter


@pytest.mark.parametrize(
    ("snuba_fn", "eap_fn"),
    [
        ("avg", EAPFunction.FUNCTION_AVG),
        ("count", EAPFunction.FUNCTION_COUNT),
        ("max", EAPFunction.FUNCTION_MAX),
        ("min", EAPFunction.FUNCTION_MIN),
        ("p50", EAPFunction.FUNCTION_P50),
        ("p75", EAPFunction.FUNCTION_P75),
        ("p90", EAPFunction.FUNCTION_P90),
        ("p95", EAPFunction.FUNCTION_P95),
        ("p99", EAPFunction.FUNCTION_P99),
        ("quantiles(0.5)", EAPFunction.FUNCTION_P50),
        ("quantiles(0.75)", EAPFunction.FUNCTION_P75),
        ("quantiles(0.90)", EAPFunction.FUNCTION_P90),
        ("quantiles(0.95)", EAPFunction.FUNCTION_P95),
        ("quantiles(0.99)", EAPFunction.FUNCTION_P99),
        ("sum", EAPFunction.FUNCTION_SUM),
        ("uniq", EAPFunction.FUNCTION_UNIQ),
    ],
)
def test_having_comparison_filters(snuba_fn, eap_fn):
    operators = [
        (Op.EQ, AggregationComparisonFilter.OP_EQUALS),
        (Op.NEQ, AggregationComparisonFilter.OP_NOT_EQUALS),
        (Op.GT, AggregationComparisonFilter.OP_GREATER_THAN),
        (Op.LT, AggregationComparisonFilter.OP_LESS_THAN),
        (Op.GTE, AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS),
        (Op.LTE, AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS),
    ]

    for snuba_op, eap_op in operators:
        conditions = [Condition(Function(snuba_fn, parameters=[Column("int")]), snuba_op, 1.0)]
        eap_filter = AggregationFilter(
            and_filter=AggregationAndFilter(
                filters=[
                    AggregationFilter(
                        comparison_filter=AggregationComparisonFilter(
                            op=eap_op,
                            val=1.0,
                            aggregation=AttributeAggregation(
                                aggregate=eap_fn,
                                key=AttributeKey(type=AttributeKey.TYPE_INT, name="int"),
                                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
                            ),
                        )
                    )
                ]
            )
        )
        assert having(conditions, SETTINGS) == eap_filter


@pytest.mark.parametrize(
    ("column", "eap_type"),
    [
        ("bool", AttributeKey.TYPE_BOOLEAN),
        ("float", AttributeKey.TYPE_DOUBLE),
        ("int", AttributeKey.TYPE_INT),
        ("str", AttributeKey.TYPE_STRING),
    ],
)
def test_column_expressions(column, eap_type):
    """Test columns are translated to their type.

    Type mappings are stored in the SETTINGS global.
    """
    assert expression(Column(column), SETTINGS) == EAPColumn(
        key=AttributeKey(type=eap_type, name=column), label=column
    )


def test_literal_expressions():
    assert expression(1, SETTINGS) == EAPColumn(literal=Literal(val_double=float(1.0)))
    assert expression(1.0, SETTINGS) == EAPColumn(literal=Literal(val_double=float(1.0)))
    assert expression(True, SETTINGS) == EAPColumn(literal=Literal(val_double=float(1.0)))
    with pytest.raises(TypeError):
        expression("1", SETTINGS)


@pytest.mark.parametrize(
    ("snuba_fn", "eap_fn"),
    [
        ("avg", EAPFunction.FUNCTION_AVG),
        ("count", EAPFunction.FUNCTION_COUNT),
        ("max", EAPFunction.FUNCTION_MAX),
        ("min", EAPFunction.FUNCTION_MIN),
        ("p50", EAPFunction.FUNCTION_P50),
        ("p75", EAPFunction.FUNCTION_P75),
        ("p90", EAPFunction.FUNCTION_P90),
        ("p95", EAPFunction.FUNCTION_P95),
        ("p99", EAPFunction.FUNCTION_P99),
        ("quantiles(0.5)", EAPFunction.FUNCTION_P50),
        ("quantiles(0.75)", EAPFunction.FUNCTION_P75),
        ("quantiles(0.90)", EAPFunction.FUNCTION_P90),
        ("quantiles(0.95)", EAPFunction.FUNCTION_P95),
        ("quantiles(0.99)", EAPFunction.FUNCTION_P99),
        ("sum", EAPFunction.FUNCTION_SUM),
        ("uniq", EAPFunction.FUNCTION_UNIQ),
    ],
)
def test_aggregation_expressions(snuba_fn, eap_fn):
    snuba_expr = Function(snuba_fn, parameters=[Column("int")], alias="func(col)")
    eap_expr = EAPColumn(
        aggregation=AttributeAggregation(
            aggregate=eap_fn,
            key=AttributeKey(type=AttributeKey.TYPE_INT, name="int"),
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            label="func(col)",
        ),
        label="func(col)",
    )
    assert expression(snuba_expr, SETTINGS) == eap_expr


@pytest.mark.parametrize(
    ("snuba_fn", "eap_fn"),
    [
        ("avgIf", EAPFunction.FUNCTION_AVG),
        ("countIf", EAPFunction.FUNCTION_COUNT),
        ("maxIf", EAPFunction.FUNCTION_MAX),
        ("minIf", EAPFunction.FUNCTION_MIN),
        ("p50If", EAPFunction.FUNCTION_P50),
        ("p75If", EAPFunction.FUNCTION_P75),
        ("p90If", EAPFunction.FUNCTION_P90),
        ("p95If", EAPFunction.FUNCTION_P95),
        ("p99If", EAPFunction.FUNCTION_P99),
        ("quantilesIf(0.5)", EAPFunction.FUNCTION_P50),
        ("quantilesIf(0.75)", EAPFunction.FUNCTION_P75),
        ("quantilesIf(0.90)", EAPFunction.FUNCTION_P90),
        ("quantilesIf(0.95)", EAPFunction.FUNCTION_P95),
        ("quantilesIf(0.99)", EAPFunction.FUNCTION_P99),
        ("sumIf", EAPFunction.FUNCTION_SUM),
        ("uniqIf", EAPFunction.FUNCTION_UNIQ),
    ],
)
def test_conditional_aggregation_expressions(snuba_fn, eap_fn):
    snuba_condition = Function("greater", parameters=[Column("float"), 1.0])
    eap_condition = condidtional_aggregation_filter(snuba_condition, SETTINGS)

    snuba_expr = Function(snuba_fn, parameters=[Column("int"), snuba_condition], alias="func(col)")
    eap_expr = EAPColumn(
        conditional_aggregation=AttributeConditionalAggregation(
            aggregate=eap_fn,
            key=AttributeKey(type=AttributeKey.TYPE_INT, name="int"),
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            filter=eap_condition,
            label="func(col)",
        ),
        label="func(col)",
    )
    assert expression(snuba_expr, SETTINGS) == eap_expr


@pytest.mark.parametrize(
    ("snuba_fn", "direction"),
    [
        (Column("int"), Direction.DESC),
        (Column("float"), Direction.ASC),
        (Function("count", parameters=[Column("int")]), Direction.DESC),
        (Function("avg", parameters=[Column("float")]), Direction.ASC),
    ],
)
def test_orderby(snuba_fn, direction):
    assert orderby([OrderBy(snuba_fn, direction)], SETTINGS) == [
        TraceItemTableRequest.OrderBy(
            column=expression(snuba_fn, SETTINGS),
            descending=direction == Direction.DESC,
        )
    ]


def test_groupby():
    cols = [Column("int"), Column("float"), Column("bool"), Column("str")]
    assert groupby(cols, SETTINGS) == [
        AttributeKey(type=AttributeKey.TYPE_INT, name="int"),
        AttributeKey(type=AttributeKey.TYPE_DOUBLE, name="float"),
        AttributeKey(type=AttributeKey.TYPE_BOOLEAN, name="bool"),
        AttributeKey(type=AttributeKey.TYPE_STRING, name="str"),
    ]
