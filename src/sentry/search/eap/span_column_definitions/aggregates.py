from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function

from sentry.search.eap import constants
from sentry.search.eap.columns import AggregateDefinition, ArgumentDefinition


def count_processor(count_value: int | None) -> int:
    if count_value is None:
        return 0
    else:
        return count_value


SPAN_AGGREGATE_DEFINITIONS = {
    "sum": AggregateDefinition(
        internal_function=Function.FUNCTION_SUM,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "avg": AggregateDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "avg_sample": AggregateDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
        extrapolation=False,
    ),
    "count": AggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        infer_search_type_from_arguments=False,
        default_search_type="integer",
        processor=count_processor,
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "count_sample": AggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        infer_search_type_from_arguments=False,
        default_search_type="integer",
        processor=count_processor,
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
        extrapolation=False,
    ),
    "p50": AggregateDefinition(
        internal_function=Function.FUNCTION_P50,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p50_sample": AggregateDefinition(
        internal_function=Function.FUNCTION_P50,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
        extrapolation=False,
    ),
    "p75": AggregateDefinition(
        internal_function=Function.FUNCTION_P75,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p90": AggregateDefinition(
        internal_function=Function.FUNCTION_P90,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p95": AggregateDefinition(
        internal_function=Function.FUNCTION_P95,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p99": AggregateDefinition(
        internal_function=Function.FUNCTION_P99,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "p100": AggregateDefinition(
        internal_function=Function.FUNCTION_MAX,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "max": AggregateDefinition(
        internal_function=Function.FUNCTION_MAX,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "min": AggregateDefinition(
        internal_function=Function.FUNCTION_MIN,
        default_search_type="duration",
        arguments=[
            ArgumentDefinition(
                argument_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
    ),
    "count_unique": AggregateDefinition(
        internal_function=Function.FUNCTION_UNIQ,
        default_search_type="integer",
        infer_search_type_from_arguments=False,
        processor=count_processor,
        arguments=[
            ArgumentDefinition(
                argument_types={"string"},
            )
        ],
    ),
}
