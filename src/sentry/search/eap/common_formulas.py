"""Shared formula builders for EAP datasets."""

from collections.abc import Callable

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.formula_pb2 import Literal as LiteralValue
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    Function,
)

from sentry.search.eap.columns import ResolvedArguments, ResolverSettings


def make_eps(
    count_key: AttributeKey,
) -> Callable[[ResolvedArguments, ResolverSettings], Column.BinaryFormula]:
    """Return an eps formula resolver that counts *count_key* rows per second."""

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
                    key=count_key,
                    extrapolation_mode=extrapolation_mode,
                ),
            ),
            op=Column.BinaryFormula.OP_DIVIDE,
            right=Column(
                literal=LiteralValue(val_double=float(divisor)),
            ),
        )

    return eps


def make_epm(
    count_key: AttributeKey,
) -> Callable[[ResolvedArguments, ResolverSettings], Column.BinaryFormula]:
    """Return an epm formula resolver that counts *count_key* rows per minute."""

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
                    key=count_key,
                    extrapolation_mode=extrapolation_mode,
                ),
            ),
            op=Column.BinaryFormula.OP_DIVIDE,
            right=Column(
                literal=LiteralValue(val_double=divisor / 60.0),
            ),
        )

    return epm
