from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function
from sentry_protos.snuba.v1.trace_item_filter_pb2 import TraceItemFilter

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    ConditionalAggregateDefinition,
    ResolvedArguments,
    ValueArgumentDefinition,
    count_argument_resolver_optimized,
)
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.trace_metrics.config import get_metric_filter, resolve_metric_arguments
from sentry.search.eap.validator import literal_validator


def count_processor(count_value: int | None) -> int:
    if count_value is None:
        return 0
    else:
        return count_value


def resolve_metric_aggregate(
    resolver: "SearchResolver", args: ResolvedArguments
) -> tuple[AttributeKey, TraceItemFilter]:
    attribute_key, metric = resolve_metric_arguments(args)
    metric_filter = get_metric_filter(resolver, metric)
    return attribute_key, metric_filter


TRACE_METRICS_ALWAYS_PRESENT_ATTRIBUTES = [
    AttributeKey(name="sentry.metric_name", type=AttributeKey.Type.TYPE_STRING),
    AttributeKey(name="sentry.metric_type", type=AttributeKey.Type.TYPE_STRING),
    AttributeKey(name="sentry.value", type=AttributeKey.Type.TYPE_DOUBLE),
]

TRACE_METRICS_AGGREGATE_DEFINITIONS: dict[str, AggregateDefinition] = {}


TRACE_METRICS_CONDITIONAL_AGGREGATE_DEFINITIONS: dict[str, ConditionalAggregateDefinition] = {
    "count": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        attribute_resolver=count_argument_resolver_optimized(
            TRACE_METRICS_ALWAYS_PRESENT_ATTRIBUTES
        ),
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "count_unique": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "sum": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "avg": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "p50": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "p75": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "p90": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "p95": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "p99": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "max": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
    "min": ConditionalAggregateDefinition(
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
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        aggregate_resolver=resolve_metric_aggregate,
    ),
}
