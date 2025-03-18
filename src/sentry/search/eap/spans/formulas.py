from typing import Literal, cast

from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.search.eap.columns import ArgumentDefinition, FormulaDefinition, ResolvedArguments
from sentry.search.eap.constants import RESPONSE_CODE_MAP
from sentry.search.eap.utils import literal_validator

"""
This column represents a count of the all of spans.
It works by counting the number of spans that have the attribute "sentry.exclusive_time_ms" (which is set on every span)
"""
TOTAL_SPAN_COUNT = Column(
    aggregation=AttributeAggregation(
        aggregate=Function.FUNCTION_COUNT,
        key=AttributeKey(type=AttributeKey.TYPE_DOUBLE, name="sentry.exclusive_time_ms"),
        label="total",
        extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
    )
)


def http_response_rate(args: ResolvedArguments) -> Column.BinaryFormula:
    code = cast(Literal[1, 2, 3, 4, 5], args[0])

    response_codes = RESPONSE_CODE_MAP[code]
    return Column.BinaryFormula(
        left=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(
                    name="sentry.status_code",
                    type=AttributeKey.TYPE_STRING,
                ),
                filter=TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(
                            name="sentry.status_code",
                            type=AttributeKey.TYPE_STRING,
                        ),
                        op=ComparisonFilter.OP_IN,
                        value=AttributeValue(
                            val_str_array=StrArray(
                                values=response_codes,  # It is faster to exact matches then startsWith
                            ),
                        ),
                    )
                ),
                label="error_request_count",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(
                    name="sentry.status_code",
                    type=AttributeKey.TYPE_STRING,
                ),
                label="total_request_count",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            ),
        ),
    )


def trace_status_rate(args: ResolvedArguments) -> Column.BinaryFormula:
    status = cast(str, args[0])

    return Column.BinaryFormula(
        left=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(
                    name="sentry.trace.status",
                    type=AttributeKey.TYPE_STRING,
                ),
                filter=TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(
                            name="sentry.trace.status",
                            type=AttributeKey.TYPE_STRING,
                        ),
                        op=ComparisonFilter.OP_EQUALS,
                        value=AttributeValue(
                            val_str=status,
                        ),
                    )
                ),
                label="trace_status_count",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=TOTAL_SPAN_COUNT,
    )


def cache_miss_rate(args: ResolvedArguments) -> Column.BinaryFormula:
    return Column.BinaryFormula(
        left=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(
                    name="cache.hit",
                    type=AttributeKey.TYPE_BOOLEAN,
                ),
                filter=TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(
                            name="cache.hit",
                            type=AttributeKey.TYPE_BOOLEAN,
                        ),
                        op=ComparisonFilter.OP_EQUALS,
                        value=AttributeValue(
                            val_bool=False,
                        ),
                    )
                ),
                label="cache_miss_count",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(
                    name="cache.hit",
                    type=AttributeKey.TYPE_BOOLEAN,
                ),
                label="total_cache_count",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            ),
        ),
    )


def ttfd_contribution_rate(args: ResolvedArguments) -> Column.BinaryFormula:
    return Column.BinaryFormula(
        left=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(name="sentry.ttfd", type=AttributeKey.TYPE_STRING),
                filter=TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(name="sentry.ttfd", type=AttributeKey.TYPE_STRING),
                        op=ComparisonFilter.OP_EQUALS,
                        value=AttributeValue(val_str="ttfd"),
                    )
                ),
                label="ttfd_count",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=TOTAL_SPAN_COUNT,
    )


def ttid_contribution_rate(args: ResolvedArguments) -> Column.BinaryFormula:
    return Column.BinaryFormula(
        left=Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(name="sentry.ttid", type=AttributeKey.TYPE_STRING),
                filter=TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(name="sentry.ttid", type=AttributeKey.TYPE_STRING),
                        op=ComparisonFilter.OP_EQUALS,
                        value=AttributeValue(val_str="ttid"),
                    )
                ),
                label="ttid_count",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            ),
        ),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=TOTAL_SPAN_COUNT,
    )


SPAN_FORMULA_DEFINITIONS = {
    "http_response_rate": FormulaDefinition(
        default_search_type="percentage",
        is_aggregate=True,
        arguments=[
            ArgumentDefinition(
                argument_types={"integer"},
                is_attribute=False,
                validator=literal_validator(["1", "2", "3", "4", "5"]),
            )
        ],
        formula_resolver=http_response_rate,
    ),
    "cache_miss_rate": FormulaDefinition(
        default_search_type="percentage",
        arguments=[],
        formula_resolver=cache_miss_rate,
        is_aggregate=True,
    ),
    "trace_status_rate": FormulaDefinition(
        default_search_type="percentage",
        is_aggregate=True,
        arguments=[
            ArgumentDefinition(
                argument_types={"string"},
                is_attribute=False,
            )
        ],
        formula_resolver=trace_status_rate,
    ),
    "ttfd_contribution_rate": FormulaDefinition(
        default_search_type="percentage",
        arguments=[],
        formula_resolver=ttfd_contribution_rate,
        is_aggregate=True,
    ),
    "ttid_contribution_rate": FormulaDefinition(
        default_search_type="percentage",
        arguments=[],
        formula_resolver=ttid_contribution_rate,
        is_aggregate=True,
    ),
}
