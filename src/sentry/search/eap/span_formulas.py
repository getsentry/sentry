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


def http_response_rate(arg: str) -> Column.BinaryFormula:
    code = int(
        arg  # TODO - converting this arg is a bit of a hack, we should pass in the int directly if the arg type is int
    )

    # TODO - handling valid parameters should be handled in the function_definitions (span_columns.py)
    if code not in [1, 2, 3, 4, 5]:
        raise Exception("http_response_rate takes in a single digit (1,2,3,4,5)")

    response_code_map = {
        1: ["100", "101", "102"],
        2: ["200", "201", "202", "203", "204", "205", "206", "207", "208", "226"],
        3: ["300", "301", "302", "303", "304", "305", "306", "307", "308"],
        4: [
            "400",
            "401",
            "402",
            "403",
            "404",
            "405",
            "406",
            "407",
            "408",
            "409",
            "410",
            "411",
            "412",
            "413",
            "414",
            "415",
            "416",
            "417",
            "418",
            "421",
            "422",
            "423",
            "424",
            "425",
            "426",
            "428",
            "429",
            "431",
            "451",
        ],
        5: ["500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "510", "511"],
    }

    response_codes = response_code_map[code]
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
                                values=response_codes,
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


CUSTOM_FUNCTION_RESOLVER: dict[str, Callable[[Any], Column.BinaryFormula]] = {
    "http_response_rate": http_response_rate
}
