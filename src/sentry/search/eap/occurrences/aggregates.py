from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function

from sentry.search.eap import constants
from sentry.search.eap.aggregate_utils import count_processor, resolve_key_eq_value_filter
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    ConditionalAggregateDefinition,
    ValueArgumentDefinition,
    count_argument_resolver_optimized,
)
from sentry.search.eap.validator import literal_validator, number_validator

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
    "count_if": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        infer_search_type_from_arguments=False,
        default_search_type="integer",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    "boolean",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="group_id",
            ),
            AttributeArgumentDefinition(
                attribute_types={
                    "string",
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    "boolean",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                }
            ),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "equals",
                        "notEquals",
                        "lessOrEquals",
                        "greaterOrEquals",
                        "less",
                        "greater",
                        "between",
                    ]
                ),
            ),
            ValueArgumentDefinition(argument_types={"string"}),
            ValueArgumentDefinition(
                argument_types={"string"}, default_arg="", validator=number_validator
            ),  # Second value is only for between, so it must be a number
        ],
        aggregate_resolver=resolve_key_eq_value_filter,
    ),
    "min": AggregateDefinition(
        internal_function=Function.FUNCTION_MIN,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "integer",
                    "percentage",
                    "currency",
                    "string",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            )
        ],
    ),
}
