from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    count_argument_resolver_optimized,
)


def count_processor(count_value: int | None) -> int:
    if count_value is None:
        return 0
    return count_value


OCCURRENCES_ALWAYS_PRESENT_ATTRIBUTES = [
    AttributeKey(name="group_id", type=AttributeKey.Type.TYPE_INT),
]

OCCURRENCE_AGGREGATE_DEFINITIONS = {
    "avg": AggregateDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    "integer",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
    "count": AggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        infer_search_type_from_arguments=False,
        default_search_type="integer",
        processor=count_processor,
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
                default_arg="group_id",
            )
        ],
        attribute_resolver=count_argument_resolver_optimized(OCCURRENCES_ALWAYS_PRESENT_ATTRIBUTES),
    ),
}
