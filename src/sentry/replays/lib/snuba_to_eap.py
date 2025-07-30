# from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
#     AttributeConditionalAggregation,
# )
# from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
#     AggregationAndFilter,
#     AggregationComparisonFilter,
#     AggregationFilter,
#     AggregationOrFilter,
#     Column,
# )
# from sentry_protos.snuba.v1.formula_pb2 import Literal as LiteralValue
# from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta
# from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
#     AttributeAggregation,
#     AttributeKey,
#     AttributeValue,
#     DoubleArray,
#     IntArray,
#     StrArray,
#     VirtualColumnContext,
# )
# from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
#     AndFilter,
#     ComparisonFilter,
#     ExistsFilter,
#     NotFilter,
#     OrFilter,
#     TraceItemFilter,
# )

# FUNCTION_MAP = {
#     "avg": FUNCTION_AVG,
#     "count": FUNCTION_COUNT,
#     "max": FUNCTION_MAX,
#     "min": FUNCTION_MIN,
#     "p50": FUNCTION_P50,
#     "p75": FUNCTION_P75,
#     "p90": FUNCTION_P90,
#     "p95": FUNCTION_P95,
#     "p99": FUNCTION_P99,
#     "sum": FUNCTION_SUM,
#     "uniq": FUNCTION_UNIQ,
# }

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import AggregationComparisonFilter
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as EAPColumn
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)
from snuba_sdk import Column, Condition, Entity, Granularity, Op, Query

from sentry.snuba.rpc_dataset_common import AttributeKey

AGGREGATION_OPERATOR_MAP = {
    Op.EQ: AggregationComparisonFilter.OP_EQUALS,
    Op.NEQ: AggregationComparisonFilter.OP_NOT_EQUALS,
    Op.GT: AggregationComparisonFilter.OP_GREATER_THAN,
    Op.LT: AggregationComparisonFilter.OP_LESS_THAN,
    Op.GTE: AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    Op.LTE: AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS,
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
}

query = Query(
    match=Entity("trace_items"),
    select=[Column("replay_id")],
    where=[
        Condition(Column("project_id"), Op.IN, project_ids),
        Condition(Column("timestamp"), Op.LT, period_stop),
        Condition(Column("timestamp"), Op.GTE, period_start),
    ],
    having=having,
    orderby=orderby,
    groupby=[Column("replay_id")],
    granularity=Granularity(3600),
)


def t(query: Query) -> TraceItemTableRequest:
    if query.where:
        w = query.where
        where = TraceItemFilter(and_filter=AndFilter(filters=[TraceItemFilter()]))
    else:
        where = None

    EAPColumn

    return TraceItemTableRequest(
        meta=meta,
        filter=where,
        aggregation_filter=None,
        columns=EAPColumn(key=AttributeKey(name="timestamp")),
        group_by=group_by,
        order_by=resolved_orderby,
        limit=query.limit.limit,
        page_token=PageToken(offset=query.offset.offset if query.offset else 0),
        virtual_column_contexts=[context for context in contexts if context is not None],
    )


# query.select
# query.where        Condition(Column("timestamp"), Op.GTE, period_start),
#     ],
#     having=having,
#     orderby=orderby,
#     groupby=[Column("replay_id")],
#     granularity=Granularity(3600),
# )

# query.select
# query.where
# )

# query.select
# query.where
