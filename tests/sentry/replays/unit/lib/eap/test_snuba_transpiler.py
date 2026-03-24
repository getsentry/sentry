from collections.abc import Iterable, Sequence
from datetime import datetime

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    AggregationAndFilter,
    AggregationComparisonFilter,
    AggregationFilter,
    TraceItemTableRequest,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as EAPColumn
from sentry_protos.snuba.v1.formula_pb2 import Literal
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta as EAPRequestMeta
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
    ExistsFilter,
    NotFilter,
    OrFilter,
    TraceItemFilter,
)
from snuba_sdk import Column, Condition, Entity, Function, Limit, Offset, Op, Or, Query
from snuba_sdk.conditions import ConditionGroup
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import SelectableExpression

from sentry.replays.lib.eap.snuba_transpiler import (
    TRACE_ITEM_TYPE_MAP,
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
    "extrapolation_modes": {},
}


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
def test_where_comparison_filters(snuba_op, eap_op):  # type: ignore[no-untyped-def]
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
def test_having_comparison_filters(snuba_fn, eap_fn):  # type: ignore[no-untyped-def]
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
def test_having_conditional_comparison_filters(snuba_fn, eap_fn):  # type: ignore[no-untyped-def]
    snuba_condition = Function("greater", parameters=[Column("float"), 1.0])
    eap_condition = condidtional_aggregation_filter(snuba_condition, SETTINGS)

    operators = [
        (Op.EQ, AggregationComparisonFilter.OP_EQUALS),
        (Op.NEQ, AggregationComparisonFilter.OP_NOT_EQUALS),
        (Op.GT, AggregationComparisonFilter.OP_GREATER_THAN),
        (Op.LT, AggregationComparisonFilter.OP_LESS_THAN),
        (Op.GTE, AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS),
        (Op.LTE, AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS),
    ]

    for snuba_op, eap_op in operators:
        conditions = [
            Condition(
                Function(snuba_fn, parameters=[Column("int"), snuba_condition]),
                snuba_op,
                1.0,
            )
        ]
        eap_filter = AggregationFilter(
            and_filter=AggregationAndFilter(
                filters=[
                    AggregationFilter(
                        comparison_filter=AggregationComparisonFilter(
                            op=eap_op,
                            val=1.0,
                            conditional_aggregation=AttributeConditionalAggregation(
                                aggregate=eap_fn,
                                key=AttributeKey(type=AttributeKey.TYPE_INT, name="int"),
                                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
                                filter=eap_condition,
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
def test_column_expressions(column, eap_type):  # type: ignore[no-untyped-def]
    """Test columns are translated to their type.

    Type mappings are stored in the SETTINGS global.
    """
    assert expression(Column(column), SETTINGS) == EAPColumn(
        key=AttributeKey(type=eap_type, name=column), label=column
    )


def test_literal_expressions():  # type: ignore[no-untyped-def]
    assert expression(1, SETTINGS) == EAPColumn(literal=Literal(val_double=1.0))
    assert expression(1.0, SETTINGS) == EAPColumn(literal=Literal(val_double=1.0))
    assert expression(True, SETTINGS) == EAPColumn(literal=Literal(val_double=1.0))
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
def test_aggregation_expressions(snuba_fn, eap_fn):  # type: ignore[no-untyped-def]
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
def test_conditional_aggregation_expressions(snuba_fn, eap_fn):  # type: ignore[no-untyped-def]
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
def test_orderby(snuba_fn, direction):  # type: ignore[no-untyped-def]
    assert orderby([OrderBy(snuba_fn, direction)], SETTINGS) == [
        TraceItemTableRequest.OrderBy(
            column=expression(snuba_fn, SETTINGS),
            descending=direction == Direction.DESC,
        )
    ]


def test_groupby():  # type: ignore[no-untyped-def]
    cols = [Column("int"), Column("float"), Column("bool"), Column("str")]
    assert groupby(cols, SETTINGS) == [
        AttributeKey(type=AttributeKey.TYPE_INT, name="int"),
        AttributeKey(type=AttributeKey.TYPE_DOUBLE, name="float"),
        AttributeKey(type=AttributeKey.TYPE_BOOLEAN, name="bool"),
        AttributeKey(type=AttributeKey.TYPE_STRING, name="str"),
    ]


def make_query(
    select: Sequence[SelectableExpression] | None = None,
    where: ConditionGroup | None = None,
    having: ConditionGroup | None = None,
    groupby: Sequence[SelectableExpression] | None = None,
    orderby: Sequence[OrderBy] | None = None,
    limit: int = 1,
    offset: int = 0,
) -> Query:
    return Query(
        match=Entity("trace_items"),
        select=select,
        where=where,
        having=having,
        groupby=groupby,
        orderby=orderby,
        limit=Limit(limit),
        offset=Offset(offset),
    )


def make_request(
    select: Iterable[EAPColumn] | None = None,
    where: TraceItemFilter | None = None,
    having: AggregationFilter | None = None,
    groupby: Iterable[AttributeKey] | None = None,
    orderby: Iterable[TraceItemTableRequest.OrderBy] | None = None,
    limit: int = 1,
    offset: int = 0,
) -> TraceItemTableRequest:
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(REQUEST_META["start_datetime"])

    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(REQUEST_META["end_datetime"])

    return TraceItemTableRequest(
        columns=select,
        filter=where,
        aggregation_filter=having,
        order_by=orderby,
        group_by=groupby,
        limit=limit,
        page_token=PageToken(offset=offset),
        meta=EAPRequestMeta(
            cogs_category=REQUEST_META["cogs_category"],
            debug=REQUEST_META["debug"],
            end_timestamp=end_timestamp,
            organization_id=REQUEST_META["organization_id"],
            project_ids=REQUEST_META["project_ids"],
            referrer=REQUEST_META["referrer"],
            request_id=REQUEST_META["request_id"],
            start_timestamp=start_timestamp,
            trace_item_type=TRACE_ITEM_TYPE_MAP[REQUEST_META["trace_item_type"]],
            downsampled_storage_config=DownsampledStorageConfig(
                mode=DownsampledStorageConfig.MODE_BEST_EFFORT
            ),
        ),
    )


@pytest.mark.parametrize(
    ("query", "req"),
    [
        (make_query(), make_request()),
        (make_query(limit=10, offset=20), make_request(limit=10, offset=20)),
        (
            make_query(
                where=[Condition(Column("int"), Op.EQ, 2), Condition(Column("str"), Op.EQ, "a")]
            ),
            make_request(
                where=TraceItemFilter(
                    and_filter=AndFilter(
                        filters=[
                            TraceItemFilter(
                                comparison_filter=ComparisonFilter(
                                    key=AttributeKey(name="int", type=AttributeKey.TYPE_INT),
                                    op=ComparisonFilter.OP_EQUALS,
                                    value=AttributeValue(val_int=2),
                                )
                            ),
                            TraceItemFilter(
                                comparison_filter=ComparisonFilter(
                                    key=AttributeKey(name="str", type=AttributeKey.TYPE_STRING),
                                    op=ComparisonFilter.OP_EQUALS,
                                    value=AttributeValue(val_str="a"),
                                )
                            ),
                        ]
                    )
                )
            ),
        ),
        (
            make_query(
                where=[
                    Or([Condition(Column("int"), Op.EQ, 2), Condition(Column("str"), Op.EQ, "a")])
                ]
            ),
            make_request(
                where=TraceItemFilter(
                    and_filter=AndFilter(
                        filters=[
                            TraceItemFilter(
                                or_filter=OrFilter(
                                    filters=[
                                        TraceItemFilter(
                                            comparison_filter=ComparisonFilter(
                                                key=AttributeKey(
                                                    name="int", type=AttributeKey.TYPE_INT
                                                ),
                                                op=ComparisonFilter.OP_EQUALS,
                                                value=AttributeValue(val_int=2),
                                            )
                                        ),
                                        TraceItemFilter(
                                            comparison_filter=ComparisonFilter(
                                                key=AttributeKey(
                                                    name="str", type=AttributeKey.TYPE_STRING
                                                ),
                                                op=ComparisonFilter.OP_EQUALS,
                                                value=AttributeValue(val_str="a"),
                                            )
                                        ),
                                    ]
                                )
                            )
                        ]
                    )
                )
            ),
        ),
        (
            make_query(where=[Condition(Function("exists", parameters=[Column("int")]), Op.EQ, 1)]),
            make_request(
                where=TraceItemFilter(
                    and_filter=AndFilter(
                        filters=[
                            TraceItemFilter(
                                exists_filter=ExistsFilter(
                                    key=AttributeKey(type=AttributeKey.TYPE_INT, name="int")
                                )
                            )
                        ]
                    )
                )
            ),
        ),
        (
            make_query(
                where=[
                    Condition(
                        Function(
                            "not", parameters=[Function("equals", parameters=[Column("int"), 1])]
                        ),
                        Op.EQ,
                        1,
                    )
                ]
            ),
            make_request(
                where=TraceItemFilter(
                    and_filter=AndFilter(
                        filters=[
                            TraceItemFilter(
                                not_filter=NotFilter(
                                    filters=[
                                        TraceItemFilter(
                                            and_filter=AndFilter(
                                                filters=[
                                                    TraceItemFilter(
                                                        comparison_filter=ComparisonFilter(
                                                            key=AttributeKey(
                                                                name="int",
                                                                type=AttributeKey.TYPE_INT,
                                                            ),
                                                            op=ComparisonFilter.OP_EQUALS,
                                                            value=AttributeValue(val_int=1),
                                                        )
                                                    )
                                                ]
                                            )
                                        )
                                    ]
                                )
                            )
                        ]
                    )
                )
            ),
        ),
    ],
)
def test_as_eap_request(query: Query, req: TraceItemTableRequest):  # type: ignore[no-untyped-def]
    compare_requests(as_eap_request(query, REQUEST_META, SETTINGS, virtual_columns=[]), req)


def compare_requests(req1: TraceItemTableRequest, req2: TraceItemTableRequest):  # type: ignore[no-untyped-def]
    """Gives more granular error reporting when two requests do not match."""
    assert req1.meta.cogs_category == req2.meta.cogs_category
    assert req1.meta.debug == req2.meta.debug
    assert req1.meta.end_timestamp == req2.meta.end_timestamp
    assert req1.meta.organization_id == req2.meta.organization_id
    assert req1.meta.project_ids == req2.meta.project_ids
    assert req1.meta.referrer == req2.meta.referrer
    assert req1.meta.request_id == req2.meta.request_id
    assert req1.meta.start_timestamp == req2.meta.start_timestamp
    assert req1.meta.trace_item_type == req2.meta.trace_item_type
    assert req1.meta.downsampled_storage_config.mode == req2.meta.downsampled_storage_config.mode

    assert req1.filter == req2.filter
    assert req1.aggregation_filter == req2.aggregation_filter
    assert req1.columns == req2.columns
    assert req1.group_by == req2.group_by
    assert req1.order_by == req2.order_by
    assert req1.limit == req2.limit
    assert req1.page_token == req2.page_token
    assert req1.virtual_column_contexts == req2.virtual_column_contexts

    assert req1 == req2
