from typing import Callable

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function

from sentry.search.eap import constants
from sentry.search.eap.aggregate_utils import apply_combinators, count_processor, if_query_validator
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    ValueArgumentDefinition,
    count_argument_resolver_optimized,
)
from sentry.search.eap.common_aggregates import count_unique_aggregate_definition

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
        valid_arithmetic=True,
    ),
    "count_unique": count_unique_aggregate_definition(),
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
        valid_arithmetic=True,
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
        valid_arithmetic=True,
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
        valid_arithmetic=True,
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
        valid_arithmetic=True,
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
        valid_arithmetic=True,
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
        valid_arithmetic=True,
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
        valid_arithmetic=True,
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
        valid_arithmetic=True,
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
        valid_arithmetic=True,
    ),
}


def if_combinator(definition: AggregateDefinition) -> AggregateDefinition:
    return definition.__class__(
        internal_function=definition.internal_function,
        default_search_type=definition.default_search_type,
        infer_search_type_from_arguments=definition.infer_search_type_from_arguments,
        internal_type=definition.internal_type,
        extrapolation_mode_override=definition.extrapolation_mode_override,
        processor=definition.processor,
        private=definition.private,
        attribute_resolver=definition.attribute_resolver,
        arguments=[
            ValueArgumentDefinition(argument_types={"query"}, validator=if_query_validator),
            *definition.arguments,
        ],
        valid_arithmetic=definition.valid_arithmetic,
    )


LOG_AGGREGATE_COMBINATORS: dict[str, Callable[[AggregateDefinition], AggregateDefinition]] = {
    "if": if_combinator,
}

apply_combinators(LOG_AGGREGATE_COMBINATORS, LOG_AGGREGATE_DEFINITIONS)
