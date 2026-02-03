from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function

from sentry.search.eap import constants
from sentry.search.eap.aggregate_utils import count_processor
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    count_argument_resolver_optimized,
)

LOGS_ALWAYS_PRESENT_ATTRIBUTES = [
    AttributeKey(name="sentry.body", type=AttributeKey.Type.TYPE_STRING),
]

LOG_AGGREGATE_DEFINITIONS = {
    "count": AggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        infer_search_type_from_arguments=False,
        processor=count_processor,
        default_search_type="integer",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "string",
                    "number",
                    "integer",
                },
                default_arg="log.body",
            )
        ],
        attribute_resolver=count_argument_resolver_optimized(LOGS_ALWAYS_PRESENT_ATTRIBUTES),
    ),
    "count_unique": AggregateDefinition(
        internal_function=Function.FUNCTION_UNIQ,
        default_search_type="integer",
        infer_search_type_from_arguments=False,
        processor=count_processor,
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "string",
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "sum": AggregateDefinition(
        internal_function=Function.FUNCTION_SUM,
        default_search_type="number",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "avg": AggregateDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="number",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "p50": AggregateDefinition(
        internal_function=Function.FUNCTION_P50,
        default_search_type="number",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "p75": AggregateDefinition(
        internal_function=Function.FUNCTION_P75,
        default_search_type="number",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "p90": AggregateDefinition(
        internal_function=Function.FUNCTION_P90,
        default_search_type="number",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "p95": AggregateDefinition(
        internal_function=Function.FUNCTION_P95,
        default_search_type="number",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "p99": AggregateDefinition(
        internal_function=Function.FUNCTION_P99,
        default_search_type="number",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "max": AggregateDefinition(
        internal_function=Function.FUNCTION_MAX,
        default_search_type="number",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "min": AggregateDefinition(
        internal_function=Function.FUNCTION_MIN,
        default_search_type="number",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
}
