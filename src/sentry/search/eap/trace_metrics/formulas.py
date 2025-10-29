from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.formula_pb2 import Literal as LiteralValue
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    Function,
)

from sentry.search.eap.columns import FormulaDefinition, ResolvedArguments, ResolverSettings


def _rate_internal(divisor: int, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Calculate rate per X (assumed second if not passed) for trace metrics using the value attribute.
    """
    extrapolation_mode = settings["extrapolation_mode"]
    is_timeseries_request = settings["snuba_params"].is_timeseries_request

    time_interval = (
        settings["snuba_params"].timeseries_granularity_secs
        if is_timeseries_request
        else settings["snuba_params"].interval
    )

    return Column.BinaryFormula(
        left=Column(
            aggregation=AttributeAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(type=AttributeKey.TYPE_DOUBLE, name="sentry.value"),
                extrapolation_mode=extrapolation_mode,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(
            literal=LiteralValue(val_double=time_interval / divisor),
        ),
    )


def per_second(_: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Calculate rate per second for trace metrics using the value attribute.
    """
    return _rate_internal(1, settings)


def per_minute(_: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Calculate rate per minute for trace metrics using the value attribute.
    """
    return _rate_internal(60, settings)


TRACE_METRICS_FORMULA_DEFINITIONS = {
    "per_second": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=per_second,
        is_aggregate=True,
    ),
    "per_minute": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=per_minute,
        is_aggregate=True,
    ),
}
