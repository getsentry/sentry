from typing import cast

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, Function
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    ExistsFilter,
    TraceItemFilter,
)

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    ConditionalAggregateDefinition,
    ResolvedArguments,
    ValueArgumentDefinition,
)
from sentry.search.eap.spans.utils import WEB_VITALS_MEASUREMENTS, transform_vital_score_to_ratio
from sentry.search.eap.utils import literal_validator


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


def resolve_count_starts(args: ResolvedArguments) -> tuple[AttributeKey, TraceItemFilter]:
    attribute = cast(AttributeKey, args[0])
    filter = TraceItemFilter(
        exists_filter=ExistsFilter(
            key=attribute,
        )
    )
    return (attribute, filter)


# TODO: We should eventually update the frontend to query the ratio column directly
def resolve_count_scores(args: ResolvedArguments) -> tuple[AttributeKey, TraceItemFilter]:
    score_attribute = cast(AttributeKey, args[0])
    ratio_attribute = transform_vital_score_to_ratio([score_attribute])
    filter = TraceItemFilter(exists_filter=ExistsFilter(key=ratio_attribute))

    return (ratio_attribute, filter)


def resolve_bounded_sample(args: ResolvedArguments) -> tuple[AttributeKey, TraceItemFilter]:
    attribute = cast(AttributeKey, args[0])
    lower_bound = cast(int, args[1])
    upper_bound = cast(int | None, args[2])

    lower_bound_filter = TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=attribute,
            op=ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
            value=AttributeValue(val_double=lower_bound),
        )
    )

    filter = None

    if upper_bound is not None:
        upper_bound_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=attribute,
                op=ComparisonFilter.OP_LESS_THAN,
                value=AttributeValue(val_double=upper_bound),
            )
        )
        filter = TraceItemFilter(
            and_filter=AndFilter(filters=[lower_bound_filter, upper_bound_filter])
        )
    else:
        filter = lower_bound_filter

    return (attribute, filter)


SPAN_CONDITIONAL_AGGREGATE_DEFINITIONS = {
    "count_op": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        default_search_type="integer",
        arguments=[ValueArgumentDefinition(argument_types={"string"})],
        aggregate_resolver=resolve_count_op,
    ),
    "avg_if": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            ),
            AttributeArgumentDefinition(attribute_types={"string"}),
            ValueArgumentDefinition(argument_types={"string"}),
        ],
        aggregate_resolver=resolve_key_eq_value_filter,
    ),
    "count_scores": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        default_search_type="integer",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                validator=literal_validator(WEB_VITALS_MEASUREMENTS),
            )
        ],
        aggregate_resolver=resolve_count_scores,
    ),
    "count_starts": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        default_search_type="integer",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={*constants.DURATION_TYPE},
                validator=literal_validator(
                    ["measurements.app_start_warm", "measurements.app_start_cold"]
                ),
            )
        ],
        aggregate_resolver=resolve_count_starts,
    ),
    "bounded_sample": ConditionalAggregateDefinition(
        # Bounded sample will return 1.0 if the sample is between the lower bound (2nd parameter) and if provided, greater the upper bound (3rd parameter).
        # You should also `group_by` the `span.id` so that this function is applied to each span.
        internal_function=Function.FUNCTION_COUNT,
        default_search_type="integer",
        arguments=[
            AttributeArgumentDefinition(attribute_types={"millisecond"}),
            ValueArgumentDefinition(argument_types={"integer"}),
            ValueArgumentDefinition(argument_types={"integer"}, default_arg=None),
        ],
        aggregate_resolver=resolve_bounded_sample,
        extrapolation=False,
    ),
}

SPAN_AGGREGATE_DEFINITIONS = {
    "sum": AggregateDefinition(
        internal_function=Function.FUNCTION_SUM,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={
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
            AttributeArgumentDefinition(
                attribute_types={"string"},
            )
        ],
    ),
    "performance_score": AggregateDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="integer",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                validator=literal_validator(WEB_VITALS_MEASUREMENTS),
            ),
        ],
        attribute_resolver=transform_vital_score_to_ratio,
    ),
}
