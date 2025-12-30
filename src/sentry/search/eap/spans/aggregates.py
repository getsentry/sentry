from typing import Literal, cast

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    ExistsFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap import constants
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    ConditionalAggregateDefinition,
    ResolvedArguments,
    ValueArgumentDefinition,
    count_argument_resolver_optimized,
)
from sentry.search.eap.normalizer import unquote_literal
from sentry.search.eap.spans.utils import WEB_VITALS_MEASUREMENTS, transform_vital_score_to_ratio
from sentry.search.eap.validator import literal_validator, number_validator


def count_processor(count_value: int | None) -> int:
    if count_value is None:
        return 0
    else:
        return count_value


def resolve_attribute_value(attribute: AttributeKey, value: str) -> AttributeValue:
    attr_value = None

    try:
        if attribute.type == AttributeKey.TYPE_DOUBLE:
            attr_value = AttributeValue(val_double=float(value))
        elif attribute.type == AttributeKey.TYPE_FLOAT:
            attr_value = AttributeValue(val_float=float(value))
        elif attribute.type == AttributeKey.TYPE_INT:
            attr_value = AttributeValue(val_int=int(value))
        else:
            value = unquote_literal(value)
            attr_value = AttributeValue(val_str=value)

    except ValueError:
        expected_type = "string"
        if attribute.type in [AttributeKey.TYPE_FLOAT, AttributeKey.TYPE_DOUBLE]:
            expected_type = "number"
        if attribute.type == AttributeKey.TYPE_INT:
            expected_type = "integer"
        raise InvalidSearchQuery(f"Invalid parameter '{value}'. Must be of type {expected_type}.")

    if attribute.type == AttributeKey.TYPE_BOOLEAN:
        lower_value = value.lower()
        if lower_value not in ["true", "false"]:
            raise InvalidSearchQuery(
                f"Invalid parameter {value}. Must be one of {["true", "false"]}"
            )
        attr_value = AttributeValue(val_bool=value == "true")

    return attr_value


SPANS_ALWAYS_PRESENT_ATTRIBUTES = [
    AttributeKey(name="sentry.duration_ms", type=AttributeKey.Type.TYPE_DOUBLE),
]


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
    operator = cast(str, args[2])

    value = args[3]
    assert isinstance(
        value, str
    ), "Value must be a String"  # This should always be a string. Assertion to deal with typing errors.

    attr_value = resolve_attribute_value(key, value)

    if operator == "between":
        value2 = args[4]
        # TODO: A bit of a hack here, the default arg is set to an empty string so it's not treated as a required argument.
        # We check against the default arg to determine if the second value is missing.
        if value2 == "":
            raise InvalidSearchQuery("between operator requires two values")

        if float(value2) <= float(value):
            raise InvalidSearchQuery(f"Invalid parameter {value2}. Must be greater than {value}")

        attr_value2 = resolve_attribute_value(key, value2)
        trace_filter = TraceItemFilter(
            and_filter=AndFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=key,
                            op=ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
                            value=attr_value,
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=key,
                            op=ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
                            value=attr_value2,
                        )
                    ),
                ]
            )
        )
    else:
        trace_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=key,
                op=constants.LITERAL_OPERATOR_MAP[operator],
                value=attr_value,
            )
        )
    return (aggregate_key, trace_filter)


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


def resolve_http_response_count(args: ResolvedArguments) -> tuple[AttributeKey, TraceItemFilter]:
    code = cast(Literal[1, 2, 3, 4, 5], args[0])
    codes = constants.RESPONSE_CODE_MAP[code]

    status_code_attribute = AttributeKey(
        name="sentry.status_code",
        type=AttributeKey.TYPE_STRING,
    )

    filter = TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(
                name="sentry.status_code",
                type=AttributeKey.TYPE_STRING,
            ),
            op=ComparisonFilter.OP_IN,
            value=AttributeValue(
                val_str_array=StrArray(
                    values=codes,  # It is faster to exact matches then startsWith
                ),
            ),
        )
    )
    return (status_code_attribute, filter)


def resolve_bounded_sample(args: ResolvedArguments) -> tuple[AttributeKey, TraceItemFilter]:
    attribute = cast(AttributeKey, args[0])
    lower_bound = cast(float, args[1])
    upper_bound = cast(float | None, args[2])

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


SPAN_AGGREGATE_DEFINITIONS = {
    "count_op": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        default_search_type="integer",
        arguments=[ValueArgumentDefinition(argument_types={"string"})],
        aggregate_resolver=resolve_count_op,
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
                    "percentage",
                    "currency",
                    "boolean",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.self_time",
                field_allowlist={"is_transaction"},
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
    "avg_if": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_AVG,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            ),
            AttributeArgumentDefinition(attribute_types={"string"}),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(["equals", "notEquals"]),
            ),
            ValueArgumentDefinition(argument_types={"string"}),
        ],
        aggregate_resolver=resolve_key_eq_value_filter,
    ),
    "p50_if": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_P50,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            ),
            AttributeArgumentDefinition(attribute_types={"string", "boolean"}),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(["equals", "notEquals"]),
            ),
            ValueArgumentDefinition(argument_types={"string"}),
        ],
        aggregate_resolver=resolve_key_eq_value_filter,
    ),
    "p75_if": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_P75,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            ),
            AttributeArgumentDefinition(attribute_types={"string", "boolean"}),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(["equals", "notEquals"]),
            ),
            ValueArgumentDefinition(argument_types={"string"}),
        ],
        aggregate_resolver=resolve_key_eq_value_filter,
    ),
    "p90_if": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_P90,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            ),
            AttributeArgumentDefinition(attribute_types={"string", "boolean"}),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(["equals", "notEquals"]),
            ),
            ValueArgumentDefinition(argument_types={"string"}),
        ],
        aggregate_resolver=resolve_key_eq_value_filter,
    ),
    "p95_if": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_P95,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            ),
            AttributeArgumentDefinition(attribute_types={"string", "boolean"}),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(["equals", "notEquals"]),
            ),
            ValueArgumentDefinition(argument_types={"string"}),
        ],
        aggregate_resolver=resolve_key_eq_value_filter,
    ),
    "p99_if": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_P99,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            ),
            AttributeArgumentDefinition(attribute_types={"string", "boolean"}),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(["equals", "notEquals"]),
            ),
            ValueArgumentDefinition(argument_types={"string"}),
        ],
        aggregate_resolver=resolve_key_eq_value_filter,
    ),
    "sum_if": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_SUM,
        default_search_type="duration",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "duration",
                    "number",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
            ),
            AttributeArgumentDefinition(attribute_types={"string", "boolean"}),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(["equals", "notEquals"]),
            ),
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
                    "currency",
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
    "http_response_count": ConditionalAggregateDefinition(
        internal_function=Function.FUNCTION_COUNT,
        default_search_type="integer",
        arguments=[
            ValueArgumentDefinition(
                argument_types={"integer"},
                validator=literal_validator(["1", "2", "3", "4", "5"]),
            )
        ],
        aggregate_resolver=resolve_http_response_count,
    ),
    "bounded_sample": ConditionalAggregateDefinition(
        # Bounded sample will return True if the sample is between the lower bound (2nd parameter) and if provided, greater the upper bound (3rd parameter).
        # You should also `group_by` the `span.id` so that this function is applied to each span.
        # TODO: We need to do some more work so that bounded sample is more random
        internal_function=Function.FUNCTION_COUNT,
        default_search_type="boolean",
        arguments=[
            AttributeArgumentDefinition(attribute_types={"millisecond"}),
            ValueArgumentDefinition(argument_types={"number"}, validator=number_validator),
            ValueArgumentDefinition(
                argument_types={"number"}, validator=number_validator, default_arg=None
            ),
        ],
        aggregate_resolver=resolve_bounded_sample,
        processor=lambda x: x > 0,
        extrapolation_mode_override=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
    ),
    "sum": AggregateDefinition(
        internal_function=Function.FUNCTION_SUM,
        default_search_type="duration",
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
                    "integer",
                    "currency",
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
                    "integer",
                    "percentage",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
        extrapolation_mode_override=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
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
                default_arg="span.duration",
            )
        ],
        attribute_resolver=count_argument_resolver_optimized(SPANS_ALWAYS_PRESENT_ATTRIBUTES),
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
                    "integer",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
        extrapolation_mode_override=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
    ),
    "p50": AggregateDefinition(
        internal_function=Function.FUNCTION_P50,
        default_search_type="duration",
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
                    "integer",
                    "currency",
                    *constants.SIZE_TYPE,
                    *constants.DURATION_TYPE,
                },
                default_arg="span.duration",
            )
        ],
        extrapolation_mode_override=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
    ),
    "p75": AggregateDefinition(
        internal_function=Function.FUNCTION_P75,
        default_search_type="duration",
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
                    "integer",
                    "percentage",
                    "currency",
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
                    "integer",
                    "percentage",
                    "currency",
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
                    "integer",
                    "percentage",
                    "currency",
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
                    "integer",
                    "percentage",
                    "currency",
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
                    "integer",
                    "percentage",
                    "currency",
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
                    "integer",
                    "percentage",
                    "currency",
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
}
