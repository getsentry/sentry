from collections.abc import Callable
from typing import Any, Literal

from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.search.eap.columns import ArgumentDefinition, AttributeAggregation, FormulaDefinition
from sentry.search.eap.constants import RESPONSE_CODE_MAP
from sentry.search.eap.utils import literal_validator


def http_response_rate(code: Literal[1, 2, 3, 4, 5]) -> Column.BinaryFormula:
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


def trace_status_rate(status: str) -> Column.BinaryFormula:
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
        right=Column(
            aggregation=AttributeAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=AttributeKey(type=AttributeKey.TYPE_DOUBLE, name="sentry.exclusive_time_ms"),
                label="total",
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
            )
        ),
    )


FORMULA_RESOLVER: dict[Any, Callable[[Any], Column.BinaryFormula]] = {
    "http_response_rate": http_response_rate,
}

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
        formula_resolver=FORMULA_RESOLVER["http_response_rate"],
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
}
