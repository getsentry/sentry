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
    FormulaDefinition,
    ResolvedArguments,
    ResolverSettings,
    ValueArgumentDefinition,
)


def rate_divisor_validator(divisor: str) -> bool:
    """Validate that divisor is a positive integer."""
    try:
        divisor_int = int(divisor)
        return divisor_int > 0
    except (ValueError, TypeError):
        return False


def rate(args: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
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

    divisor = int(cast(str, args[0])) if args else 1

    if divisor > time_interval:
        raise InvalidSearchQuery(
            f"Divisor {divisor} cannot be greater than time interval {time_interval}"
        )

    if time_interval % divisor != 0:
        raise InvalidSearchQuery(
            f"Divisor {divisor} must divide evenly into time interval {time_interval}"
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
            literal=LiteralValue(val_double=divisor),
        ),
    )


TRACE_METRICS_FORMULA_DEFINITIONS = {
    "rate": FormulaDefinition(
        default_search_type="rate",
        arguments=[
            ValueArgumentDefinition(
                argument_types={"integer"},
                default_arg="1",
                validator=rate_divisor_validator,
            ),
        ],
        formula_resolver=rate,
        is_aggregate=True,
    ),
}
