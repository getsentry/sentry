from typing import cast

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, Function
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    ComparisonFilter,
    ExistsFilter,
    TraceItemFilter,
)

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    AggregateDefinition,
    ArgumentDefinition,
    ConditionalAggregateDefinition,
    ResolvedArguments,
)
from sentry.search.eap.utils import literal_validator

WEB_VITALS_MEASUREMENTS = [
    "measurements.score.total",
    "measurements.score.lcp",
    "measurements.score.fcp",
    "measurements.score.cls",
    "measurements.score.ttfb",
    "measurements.score.inp",
]


def count_processor(count_value: int | None) -> int:
    if count_value is None:
        return 0
    else:
        return count_value


def resolve_count_op(args: ResolvedArguments) -> tuple[AttributeKey, TraceItemFilter]:
    op_value = cast(str, args[0])

    filter = TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(
                name="sentry.op",
                type=AttributeKey.TYPE_STRING,
            ),
            op=ComparisonFilter.OP_EQUALS,
            value=AttributeValue(val_str=op_value),
        )
    )
    return (AttributeKey(name="sentry.op", type=AttributeKey.TYPE_STRING), filter)


def resolve_key_eq_value_filter(args: ResolvedArguments) -> tuple[AttributeKey, TraceItemFilter]:
    aggregate_key = cast(AttributeKey, args[0])
    key = cast(AttributeKey, args[1])
    value = cast(str, args[2])

    filter = TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=key,
            op=ComparisonFilter.OP_EQUALS,
            value=AttributeValue(val_str=value),
        )
    )
    return (aggregate_key, filter)


# TODO: We should eventually update the frontend to query the ratio column directly
def resolve_count_scores(args: ResolvedArguments) -> tuple[AttributeKey, TraceItemFilter]:
    score_column = cast(str, args[0])
    ratio_column_name = score_column.replace("measurements.score", "score.ratio")
    if ratio_column_name == "score.ratio.total":
        ratio_column_name = "score.total"
    attribute_key = AttributeKey(name=ratio_column_name, type=AttributeKey.TYPE_DOUBLE)
    filter = TraceItemFilter(exists_filter=ExistsFilter(key=attribute_key))

    return (attribute_key, filter)


SPAN_CONDITIONAL_AGGREGATE_DEFINITIONS = {
    "count_op": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        default_search_type="integer",
        arguments=[ArgumentDefinition(argument_types={"string"}, is_attribute=False)],
        aggregate_resolver=resolve_count_op,
    ),
    "avg_if": ConditionalAggregateDefinition(
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
            ),
            ArgumentDefinition(
                argument_types={
                    "string",
                },
            ),
            ArgumentDefinition(
                argument_types={"string"},
                is_attribute=False,
            ),
        ],
        aggregate_resolver=resolve_key_eq_value_filter,
    ),
    "count_scores": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        default_search_type="integer",
        arguments=[
            ArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(WEB_VITALS_MEASUREMENTS),
                is_attribute=False,
            )
        ],
        aggregate_resolver=resolve_count_scores,
    ),
}

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
