from collections.abc import Callable
from typing import Any

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

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import ArgumentDefinition, FormulaDefinition
from sentry.search.eap.constants import RESPONSE_CODE_MAP


def literal_validator(values: list[Any]) -> Callable[[str], bool]:
    def _validator(input: str) -> bool:
        if input in values:
            return True
        raise InvalidSearchQuery(f"Invalid parameter {input}. Must be one of {values}")

    return _validator


def http_response_rate(code: int) -> Column.BinaryFormula:
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


FORMULA_RESOLVER: dict[Any, Callable[[Any], Column.BinaryFormula]] = {
    "http_response_rate": http_response_rate
}

SPAN_FORMULA_DEFINITIONS = {
    "http_response_rate": FormulaDefinition(
        default_search_type="percentage",
        arguments=[
            ArgumentDefinition(
                argument_types={"integer"},
                is_attribute=False,
                validator=literal_validator(["1", "2", "3", "4", "5"]),
            )
        ],
        formula_resolver=FORMULA_RESOLVER["http_response_rate"],
    ),
}
