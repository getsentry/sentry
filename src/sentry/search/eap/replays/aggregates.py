from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function

from sentry.search.eap import constants
from sentry.search.eap.aggregate_utils import count_processor
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    count_argument_resolver_optimized,
)

REPLAYS_ALWAYS_PRESENT_ATTRIBUTES = [
    AttributeKey(name="replay_id", type=AttributeKey.Type.TYPE_STRING),
]

REPLAYS_AGGREGATE_DEFINITIONS = {
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
                default_arg="replay.id",
            )
        ],
        attribute_resolver=count_argument_resolver_optimized(REPLAYS_ALWAYS_PRESENT_ATTRIBUTES),
    ),
    "sum": AggregateDefinition(
        internal_function=Function.FUNCTION_SUM,
        infer_search_type_from_arguments=True,
        default_search_type="integer",
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
}
