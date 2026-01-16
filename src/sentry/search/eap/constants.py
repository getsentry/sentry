from typing import Literal

from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import AggregationComparisonFilter, Column
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, ExtrapolationMode
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter

from sentry.search.eap.types import SupportedTraceItemType
from sentry.search.events.constants import DURATION_UNITS, SIZE_UNITS, DurationUnit, SizeUnit
from sentry.search.events.types import SAMPLING_MODES

# Mapping from our supported string enum types to the protobuf enum types
SUPPORTED_TRACE_ITEM_TYPE_MAP = {
    SupportedTraceItemType.LOGS: TraceItemType.TRACE_ITEM_TYPE_LOG,
    SupportedTraceItemType.SPANS: TraceItemType.TRACE_ITEM_TYPE_SPAN,
    SupportedTraceItemType.UPTIME_RESULTS: TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
    SupportedTraceItemType.TRACEMETRICS: TraceItemType.TRACE_ITEM_TYPE_METRIC,
    SupportedTraceItemType.PROFILE_FUNCTIONS: TraceItemType.TRACE_ITEM_TYPE_PROFILE_FUNCTION,
    SupportedTraceItemType.PREPROD: TraceItemType.TRACE_ITEM_TYPE_PREPROD,
    SupportedTraceItemType.ATTACHMENTS: TraceItemType.TRACE_ITEM_TYPE_ATTACHMENT,
}

SUPPORTED_STATS_TYPES = {"attributeDistributions"}

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
LITERAL_OPERATOR_MAP = {
    "equals": ComparisonFilter.OP_EQUALS,
    "notEquals": ComparisonFilter.OP_NOT_EQUALS,
    "greater": ComparisonFilter.OP_GREATER_THAN,
    "less": ComparisonFilter.OP_LESS_THAN,
    "greaterOrEquals": ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    "lessOrEquals": ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
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

EXTRAPOLATION_MODE_MAP = {
    "sampleWeighted": ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
    "serverOnly": ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
    "unspecified": ExtrapolationMode.EXTRAPOLATION_MODE_UNSPECIFIED,
    "none": ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
}

SearchType = (
    SizeUnit
    | DurationUnit
    | Literal[
        "duration", "integer", "number", "percentage", "string", "boolean", "rate", "currency"
    ]
)

SIZE_TYPE: set[SearchType] = set(SIZE_UNITS.keys())

DURATION_TYPE: set[SearchType] = set(DURATION_UNITS.keys())

STRING = AttributeKey.TYPE_STRING
BOOLEAN = AttributeKey.TYPE_BOOLEAN
DOUBLE = AttributeKey.TYPE_DOUBLE
INT = AttributeKey.TYPE_INT
TYPE_TO_STRING_MAP = {
    STRING: "string",
    BOOLEAN: "boolean",
    DOUBLE: "double",
    INT: "integer",
}

# TODO: we need a datetime type
# Maps search types back to types for the proto
TYPE_MAP: dict[SearchType, AttributeKey.Type.ValueType] = {
    "bit": DOUBLE,
    "byte": DOUBLE,
    "kibibyte": DOUBLE,
    "mebibyte": DOUBLE,
    "gibibyte": DOUBLE,
    "tebibyte": DOUBLE,
    "pebibyte": DOUBLE,
    "exbibyte": DOUBLE,
    "kilobyte": DOUBLE,
    "megabyte": DOUBLE,
    "gigabyte": DOUBLE,
    "terabyte": DOUBLE,
    "petabyte": DOUBLE,
    "exabyte": DOUBLE,
    "nanosecond": DOUBLE,
    "microsecond": DOUBLE,
    "millisecond": DOUBLE,
    "second": DOUBLE,
    "minute": DOUBLE,
    "hour": DOUBLE,
    "day": DOUBLE,
    "week": DOUBLE,
    "duration": DOUBLE,
    "integer": INT,
    "number": DOUBLE,
    "percentage": DOUBLE,
    "string": STRING,
    "boolean": BOOLEAN,
    "currency": DOUBLE,
}

# https://github.com/getsentry/snuba/blob/master/snuba/web/rpc/v1/endpoint_time_series.py
# The RPC limits us to 10100 points per timeseries
# MAX 1 minute granularity over 7 days (10080 buckets) + extra buckets to allow for partial time buckets on
MAX_ROLLUP_POINTS = 10100
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
        2 * 3600,
        3 * 3600,
        4 * 3600,
        12 * 3600,
        24 * 3600,  # hours
    }
)
TRUTHY_VALUES = {"1", "true"}
FALSEY_VALUES = {"0", "false"}
BOOLEAN_VALUES = TRUTHY_VALUES.union(FALSEY_VALUES)

PROJECT_FIELDS = {"project", "project.slug", "project.name"}
REVERSE_CONTEXT_ERROR = "Unknown value {} for filter {}, expecting one of: {}"

RESPONSE_CODE_MAP = {
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

SAMPLING_MODE_HIGHEST_ACCURACY: SAMPLING_MODES = "HIGHEST_ACCURACY"
SAMPLING_MODE_HIGHEST_ACCURACY_FLEX_TIME: SAMPLING_MODES = "HIGHEST_ACCURACY_FLEX_TIME"
SAMPLING_MODE_MAP: dict[SAMPLING_MODES, DownsampledStorageConfig.Mode.ValueType] = {
    "BEST_EFFORT": DownsampledStorageConfig.MODE_BEST_EFFORT,
    "PREFLIGHT": DownsampledStorageConfig.MODE_PREFLIGHT,
    "NORMAL": DownsampledStorageConfig.MODE_NORMAL,
    SAMPLING_MODE_HIGHEST_ACCURACY: DownsampledStorageConfig.MODE_HIGHEST_ACCURACY,
    SAMPLING_MODE_HIGHEST_ACCURACY_FLEX_TIME: DownsampledStorageConfig.MODE_HIGHEST_ACCURACY_FLEXTIME,
}

ARITHMETIC_OPERATOR_MAP: dict[str, Column.BinaryFormula.Op.ValueType] = {
    "divide": Column.BinaryFormula.OP_DIVIDE,
    "multiply": Column.BinaryFormula.OP_MULTIPLY,
    "plus": Column.BinaryFormula.OP_ADD,
    "minus": Column.BinaryFormula.OP_SUBTRACT,
}

META_PREFIX = "sentry._meta"
META_FIELD_PREFIX = f"{META_PREFIX}.fields"
META_ATTRIBUTE_PREFIX = f"{META_FIELD_PREFIX}.attributes"

SENTRY_INTERNAL_PREFIXES = ["__sentry_internal", "sentry._internal."]

# public alias that we want to be sure are consistent
TIMESTAMP_PRECISE_ALIAS = "timestamp_precise"
TIMESTAMP_ALIAS = "timestamp"
TRACE_ALIAS = "trace"

ATTRIBUTES_QUERY_PARAM_TO_ATTRIBUTE_TYPE_MAP = {
    "number": AttributeKey.Type.TYPE_DOUBLE,
    "boolean": AttributeKey.Type.TYPE_BOOLEAN,
    "string": AttributeKey.Type.TYPE_STRING,
}
