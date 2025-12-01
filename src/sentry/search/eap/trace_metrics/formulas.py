from typing import cast

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.formula_pb2 import Literal as LiteralValue
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    Function,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import (
    AttributeArgumentDefinition,
    FormulaDefinition,
    ResolvedArguments,
    ResolverSettings,
    TraceMetricFormulaDefinition,
    ValueArgumentDefinition,
)
from sentry.search.eap.trace_metrics.config import TraceMetricsSearchResolverConfig
from sentry.search.eap.validator import literal_validator


def _rate_internal(
    divisor: int, metric_type: str, settings: ResolverSettings
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

    metric_type = (
        search_config.metric.metric_type
        if search_config.metric and search_config.metric.metric_type
        else metric_type
    )

    if metric_type == "counter":
        return Column.BinaryFormula(
            left=Column(
                aggregation=AttributeAggregation(
                    aggregate=Function.FUNCTION_SUM,
                    key=AttributeKey(type=AttributeKey.TYPE_DOUBLE, name="sentry.value"),
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
            aggregation=AttributeAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
                extrapolation_mode=extrapolation_mode,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(
            literal=LiteralValue(val_double=time_interval / divisor),
        ),
    )


def per_second(args: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Calculate rate per second for trace metrics using the value attribute.
    """
    metric_type = cast(str, args[2]) if len(args) >= 3 and args[2] else "counter"
    return _rate_internal(1, metric_type, settings)


def per_minute(args: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Calculate rate per minute for trace metrics using the value attribute.
    """
    metric_type = cast(str, args[2]) if len(args) >= 3 and args[2] else "counter"
    return _rate_internal(60, metric_type, settings)


TRACE_METRICS_FORMULA_DEFINITIONS: dict[str, FormulaDefinition] = {
    "per_second": TraceMetricFormulaDefinition(
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
    "per_minute": TraceMetricFormulaDefinition(
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
