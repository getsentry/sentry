from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    Function,
)

from sentry.search.eap.aggregate_utils import count_processor
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    count_argument_resolver_optimized,
)
from sentry.search.eap.common_aggregates import count_unique_aggregate_definition

PROCESSING_ERRORS_ALWAYS_PRESENT_ATTRIBUTES = [
    AttributeKey(name="error_type", type=AttributeKey.Type.TYPE_STRING),
]

PROCESSING_ERROR_AGGREGATE_DEFINITIONS = {
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
                default_arg="error_type",
            )
        ],
        attribute_resolver=count_argument_resolver_optimized(
            PROCESSING_ERRORS_ALWAYS_PRESENT_ATTRIBUTES
        ),
    ),
    "count_unique": count_unique_aggregate_definition(default_arg="event_id"),
}
