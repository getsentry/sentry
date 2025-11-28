from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.formula_pb2 import Literal as LiteralValue
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function
from sentry_protos.snuba.v1.trace_item_filter_pb2 import TraceItemFilter

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import (
    AttributeArgumentDefinition,
    FormulaDefinition,
    ResolvedArguments,
    ResolverSettings,
    ValueArgumentDefinition,
)
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.trace_metrics.config import (
    Metric,
    TraceMetricsSearchResolverConfig,
    get_metric_filter,
    resolve_metric_arguments,
)
from sentry.search.eap.validator import literal_validator


def _rate_internal(
    divisor: int,
    metric: Metric | None,
    settings: ResolverSettings,
    attribute_key: AttributeKey,
    metric_filter: TraceItemFilter,
) -> Column.BinaryFormula:
    """
    Calculate rate per X for trace metrics using the value attribute.
    """
    search_config = settings["search_config"]
    if not isinstance(search_config, TraceMetricsSearchResolverConfig):
        raise InvalidSearchQuery("unexpected search config")

    extrapolation_mode = settings["extrapolation_mode"]
    is_timeseries_request = settings["snuba_params"].is_timeseries_request

    time_interval = (
        settings["snuba_params"].timeseries_granularity_secs
        if is_timeseries_request
        else settings["snuba_params"].interval
    )

    if search_config.metric_type:
        metric_type = search_config.metric_type
    elif metric is not None:
        metric_type = metric.metric_type
    else:
        metric_type = None

    if metric_type == "counter":
        return Column.BinaryFormula(
            left=Column(
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=Function.FUNCTION_SUM,
                    key=attribute_key,
                    filter=metric_filter,
                    extrapolation_mode=extrapolation_mode,
                ),
            ),
            op=Column.BinaryFormula.OP_DIVIDE,
            right=Column(
                literal=LiteralValue(val_double=time_interval / divisor),
            ),
        )

    return Column.BinaryFormula(
        left=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=attribute_key,
                filter=metric_filter,
                extrapolation_mode=extrapolation_mode,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(
            literal=LiteralValue(val_double=time_interval / divisor),
        ),
    )


def per_second(
    resolver: "SearchResolver", args: ResolvedArguments, settings: ResolverSettings
) -> Column.BinaryFormula:
    """
    Calculate rate per second for trace metrics using the value attribute.
    """
    attribute_key, metric = resolve_metric_arguments(args)
    metric_filter = get_metric_filter(resolver, metric)
    return _rate_internal(1, metric, settings, attribute_key, metric_filter)


def per_minute(
    resolver: "SearchResolver", args: ResolvedArguments, settings: ResolverSettings
) -> Column.BinaryFormula:
    """
    Calculate rate per minute for trace metrics using the value attribute.
    """
    attribute_key, metric = resolve_metric_arguments(args)
    metric_filter = get_metric_filter(resolver, metric)
    return _rate_internal(60, metric, settings, attribute_key, metric_filter)


TRACE_METRICS_FORMULA_DEFINITIONS: dict[str, FormulaDefinition] = {
    "per_second": FormulaDefinition(
        default_search_type="rate",
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
        formula_resolver=per_second,
        is_aggregate=True,
        infer_search_type_from_arguments=False,
    ),
    "per_minute": FormulaDefinition(
        default_search_type="rate",
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
        formula_resolver=per_minute,
        is_aggregate=True,
        infer_search_type_from_arguments=False,
    ),
}
