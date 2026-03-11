"""
Rate aggregates for the occurrences EAP dataset (events per second/minute).

Semantics match legacy errors eps/epm: count of rows over time window.
Spans use count(sentry.exclusive_time_ms) because that attribute exists on every span;
occurrences use count(group_id) as the always-present attribute for row count.
"""

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.formula_pb2 import Literal as LiteralValue
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    Function,
)

from sentry.search.eap.columns import (
    FormulaDefinition,
    ResolvedArguments,
    ResolverSettings,
)

# group_id is always present on occurrences (OCCURRENCES_ALWAYS_PRESENT_ATTRIBUTES).
# Counting it yields row count; dividing by time gives events per second/minute.
_OCCURRENCE_COUNT_KEY = AttributeKey(
    name="group_id",
    type=AttributeKey.Type.TYPE_INT,
)


def eps(_: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    extrapolation_mode = settings["extrapolation_mode"]
    is_timeseries_request = settings["snuba_params"].is_timeseries_request

    divisor = (
        settings["snuba_params"].timeseries_granularity_secs
        if is_timeseries_request
        else settings["snuba_params"].interval
    )

    return Column.BinaryFormula(
        left=Column(
            aggregation=AttributeAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=_OCCURRENCE_COUNT_KEY,
                extrapolation_mode=extrapolation_mode,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(
            literal=LiteralValue(val_double=float(divisor)),
        ),
    )


def epm(_: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    extrapolation_mode = settings["extrapolation_mode"]
    is_timeseries_request = settings["snuba_params"].is_timeseries_request

    divisor = (
        settings["snuba_params"].timeseries_granularity_secs
        if is_timeseries_request
        else settings["snuba_params"].interval
    )

    return Column.BinaryFormula(
        left=Column(
            aggregation=AttributeAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=_OCCURRENCE_COUNT_KEY,
                extrapolation_mode=extrapolation_mode,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(
            literal=LiteralValue(val_double=divisor / 60.0),
        ),
    )


OCCURRENCE_FORMULA_DEFINITIONS = {
    "eps": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=eps,
        is_aggregate=True,
    ),
    "epm": FormulaDefinition(
        default_search_type="rate",
        arguments=[],
        formula_resolver=epm,
        is_aggregate=True,
    ),
}
