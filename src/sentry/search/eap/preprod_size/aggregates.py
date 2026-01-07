from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function

from sentry.search.eap import constants
from sentry.search.eap.columns import AggregateDefinition, AttributeArgumentDefinition

# Only max makes sense for pre-aggregated mobile app size data
PREPROD_SIZE_AGGREGATE_DEFINITIONS = {
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
}
