from typing import Literal

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import AggregationComparisonFilter
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter

from sentry.search.events.constants import DurationUnit, SizeUnit

OPERATOR_MAP = {
    "=": ComparisonFilter.OP_EQUALS,
    "!=": ComparisonFilter.OP_NOT_EQUALS,
    "IN": ComparisonFilter.OP_IN,
    "NOT IN": ComparisonFilter.OP_NOT_IN,
    ">": ComparisonFilter.OP_GREATER_THAN,
    "<": ComparisonFilter.OP_LESS_THAN,
    ">=": ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    "<=": ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
}
IN_OPERATORS = ["IN", "NOT IN"]

AGGREGATION_OPERATOR_MAP = {
    "=": AggregationComparisonFilter.OP_EQUALS,
    "!=": AggregationComparisonFilter.OP_NOT_EQUALS,
    ">": AggregationComparisonFilter.OP_GREATER_THAN,
    "<": AggregationComparisonFilter.OP_LESS_THAN,
    ">=": AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    "<=": AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS,
}

SearchType = (
    SizeUnit
    | DurationUnit
    | Literal[
        "duration",
        "integer",
        "number",
        "percentage",
        "string",
        "boolean",
    ]
)

STRING = AttributeKey.TYPE_STRING
BOOLEAN = AttributeKey.TYPE_BOOLEAN
FLOAT = AttributeKey.TYPE_FLOAT
DOUBLE = AttributeKey.TYPE_DOUBLE
INT = AttributeKey.TYPE_INT

# TODO: we need a datetime type
# Maps search types back to types for the proto
TYPE_MAP: dict[SearchType, AttributeKey.Type.ValueType] = {
    "bit": FLOAT,
    "byte": FLOAT,
    "kibibyte": FLOAT,
    "mebibyte": FLOAT,
    "gibibyte": FLOAT,
    "tebibyte": FLOAT,
    "pebibyte": FLOAT,
    "exbibyte": FLOAT,
    "kilobyte": FLOAT,
    "megabyte": FLOAT,
    "gigabyte": FLOAT,
    "terabyte": FLOAT,
    "petabyte": FLOAT,
    "exabyte": FLOAT,
    "nanosecond": FLOAT,
    "microsecond": FLOAT,
    "millisecond": FLOAT,
    "second": FLOAT,
    "minute": FLOAT,
    "hour": FLOAT,
    "day": FLOAT,
    "week": FLOAT,
    "duration": FLOAT,
    "integer": INT,
    "number": FLOAT,
    "percentage": FLOAT,
    "string": STRING,
    "boolean": BOOLEAN,
}

# https://github.com/getsentry/snuba/blob/master/snuba/web/rpc/v1/endpoint_time_series.py
# The RPC limits us to 2016 points per timeseries
MAX_ROLLUP_POINTS = 2016
# Copied from snuba, a number of total seconds
VALID_GRANULARITIES = frozenset(
    {
        15,
        30,
        60,  # seconds
        2 * 60,
        5 * 60,
        10 * 60,
        15 * 60,
        30 * 60,  # minutes
        1 * 3600,
        3 * 3600,
        12 * 3600,
        24 * 3600,  # hours
    }
)
TRUTHY_VALUES = {"1", "true"}
FALSEY_VALUES = {"0", "false"}
BOOLEAN_VALUES = TRUTHY_VALUES.union(FALSEY_VALUES)
