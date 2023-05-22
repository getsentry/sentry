import re
from typing import Dict, TypedDict

from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import DATASETS

TIMEOUT_ERROR_MESSAGE = """
Query timeout. Please try again. If the problem persists try a smaller date range or fewer projects. Also consider a
filter on the transaction field if you're filtering performance data.
"""
PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS = "project_threshold_config_index"
PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS = "project_threshold_override_config_index"
PROJECT_THRESHOLD_CONFIG_ALIAS = "project_threshold_config"
TEAM_KEY_TRANSACTION_ALIAS = "team_key_transaction"
ERROR_UNHANDLED_ALIAS = "error.unhandled"
ERROR_HANDLED_ALIAS = "error.handled"
EVENT_TYPE_ALIAS = "event.type"
USER_DISPLAY_ALIAS = "user.display"
PROJECT_ALIAS = "project"
PROJECT_NAME_ALIAS = "project.name"
PROJECT_DOT_ID_ALIAS = "project.id"
PROJECT_ID_ALIAS = "project_id"
ISSUE_ALIAS = "issue"
ISSUE_ID_ALIAS = "issue.id"
RELEASE_ALIAS = "release"
RELEASE_STAGE_ALIAS = "release.stage"
SEMVER_ALIAS = "release.version"
SEMVER_PACKAGE_ALIAS = "release.package"
SEMVER_BUILD_ALIAS = "release.build"
TITLE_ALIAS = "title"
TIMESTAMP_TO_HOUR_ALIAS = "timestamp.to_hour"
TIMESTAMP_TO_DAY_ALIAS = "timestamp.to_day"
# Named this way in case we want to eventually do stuff like total.p50
TOTAL_COUNT_ALIAS = "total.count"
TOTAL_TRANSACTION_DURATION_ALIAS = "total.transaction_duration"
TRANSACTION_STATUS_ALIAS = "transaction.status"
MEASUREMENTS_FRAMES_SLOW_RATE = "measurements.frames_slow_rate"
MEASUREMENTS_FRAMES_FROZEN_RATE = "measurements.frames_frozen_rate"
MEASUREMENTS_STALL_PERCENTAGE = "measurements.stall_percentage"
TRACE_PARENT_SPAN_CONTEXT = "trace.parent_span_id"
TRACE_PARENT_SPAN_ALIAS = "trace.parent_span"
HTTP_STATUS_CODE_ALIAS = "http.status_code"
DEVICE_CLASS_ALIAS = "device.class"


class ThresholdDict(TypedDict):
    poor: float
    meh: float


QUERY_TIPS: Dict[str, str] = {
    "CHAINED_OR": "Did you know you can replace chained or conditions like `field:a OR field:b OR field:c` with `field:[a,b,c]`"
}


VITAL_THRESHOLDS: Dict[str, ThresholdDict] = {
    "lcp": {
        "poor": 4000,
        "meh": 2500,
    },
    "fp": {
        "poor": 3000,
        "meh": 1000,
    },
    "fcp": {
        "poor": 3000,
        "meh": 1000,
    },
    "fid": {
        "poor": 300,
        "meh": 100,
    },
    "cls": {
        "poor": 0.25,
        "meh": 0.1,
    },
}

TAG_KEY_RE = re.compile(r"^tags\[(?P<tag>.*)\]$")
# Based on general/src/protocol/tags.rs in relay
VALID_FIELD_PATTERN = re.compile(r"^[a-zA-Z0-9_.:-]*$")

# The regex for alias here is to match any word, but exclude anything that is only digits
# eg. 123 doesn't match, but test_123 will match
ALIAS_REGEX = r"(\w+)?(?!\d+)\w+"

MISERY_ALPHA = 5.8875
MISERY_BETA = 111.8625

ALIAS_PATTERN = re.compile(rf"{ALIAS_REGEX}$")
FUNCTION_PATTERN = re.compile(
    rf"^(?P<function>[^\(]+)\((?P<columns>.*)\)( (as|AS) (?P<alias>{ALIAS_REGEX}))?$"
)

DURATION_PATTERN = re.compile(r"(\d+\.?\d?)(\D{1,3})")

RESULT_TYPES = {"duration", "string", "number", "integer", "percentage", "date"}
# event_search normalizes to bytes
# based on https://getsentry.github.io/relay/relay_metrics/enum.InformationUnit.html
SIZE_UNITS = {
    "bit": 8,
    "byte": 1,
    "kibibyte": 1 / 1024,
    "mebibyte": 1 / 1024**2,
    "gibibyte": 1 / 1024**3,
    "tebibyte": 1 / 1024**4,
    "pebibyte": 1 / 1024**5,
    "exbibyte": 1 / 1024**6,
    "kilobyte": 1 / 1000,
    "megabyte": 1 / 1000**2,
    "gigabyte": 1 / 1000**3,
    "terabyte": 1 / 1000**4,
    "petabyte": 1 / 1000**5,
    "exabyte": 1 / 1000**6,
}
# event_search normalizes to seconds
DURATION_UNITS = {
    "nanosecond": 1000**2,
    "microsecond": 1000,
    "millisecond": 1,
    "second": 1 / 1000,
    "minute": 1 / (1000 * 60),
    "hour": 1 / (1000 * 60 * 60),
    "day": 1 / (1000 * 60 * 60 * 24),
    "week": 1 / (1000 * 60 * 60 * 24 * 7),
}
RESULT_TYPES = RESULT_TYPES.union(SIZE_UNITS.keys())
RESULT_TYPES = RESULT_TYPES.union(DURATION_UNITS.keys())
PERCENT_UNITS = {"ratio", "percent"}

NO_CONVERSION_FIELDS = {"start", "end"}
# Skip total_count_alias since it queries the total count and therefore doesn't make sense in a filter
# In these cases we should instead treat it as a tag instead
SKIP_FILTER_RESOLUTION = {TOTAL_COUNT_ALIAS, TOTAL_TRANSACTION_DURATION_ALIAS}
EQUALITY_OPERATORS = frozenset(["=", "IN"])
INEQUALITY_OPERATORS = frozenset(["!=", "NOT IN"])
ARRAY_FIELDS = {
    "error.mechanism",
    "error.type",
    "error.value",
    "performance.issue_ids",
    "stack.abs_path",
    "stack.colno",
    "stack.filename",
    "stack.function",
    "stack.in_app",
    "stack.lineno",
    "stack.module",
    "stack.package",
    "stack.stack_level",
    "spans_op",
    "spans_group",
    "spans_exclusive_time",
}
TIMESTAMP_FIELDS = {
    "timestamp",
    "timestamp.to_hour",
    "timestamp.to_day",
}
NON_FAILURE_STATUS = {"ok", "cancelled", "unknown"}

CONFIGURABLE_AGGREGATES = {
    "apdex()": "apdex({threshold}) as apdex",
    "user_misery()": "user_misery({threshold}) as user_misery",
    "count_miserable(user)": "count_miserable(user,{threshold}) as count_miserable_user",
}
TREND_FUNCTION_TYPE_MAP = {
    "trend_percentage()": "percentage",
    "count_percentage()": "percentage",
    "trend_difference()": "duration",
    "confidence()": "number",
}

# Create the known set of fields from the issue properties
# and the transactions and events dataset mapping definitions.
SEARCH_MAP = {
    "start": "start",
    "end": "end",
    "project_id": "project_id",
    "first_seen": "first_seen",
    "last_seen": "last_seen",
    "times_seen": "times_seen",
    SEMVER_ALIAS: SEMVER_ALIAS,
    RELEASE_STAGE_ALIAS: RELEASE_STAGE_ALIAS,
}
SEARCH_MAP.update(**DATASETS[Dataset.Events])
SEARCH_MAP.update(**DATASETS[Dataset.Discover])

DEFAULT_PROJECT_THRESHOLD_METRIC = "duration"
DEFAULT_PROJECT_THRESHOLD = 300
MAX_QUERYABLE_TRANSACTION_THRESHOLDS = 500

OPERATOR_NEGATION_MAP = {
    "=": "!=",
    "!=": "=",
    "<": ">=",
    "<=": ">",
    ">": "<=",
    ">=": "<",
    "IN": "NOT IN",
    "NOT IN": "IN",
}
OPERATOR_TO_DJANGO = {">=": "gte", "<=": "lte", ">": "gt", "<": "lt", "=": "exact"}

MAX_SEARCH_RELEASES = 1000
SEMVER_EMPTY_RELEASE = "____SENTRY_EMPTY_RELEASE____"
SEMVER_WILDCARDS = frozenset(["X", "*"])

# In Performance TPM is used as an alias to EPM
FUNCTION_ALIASES = {
    "tpm": "epm",
    "tps": "eps",
}

# Mapping of public aliases back to the metrics identifier
METRICS_MAP = {
    "measurements.app_start_cold": "d:transactions/measurements.app_start_cold@millisecond",
    "measurements.app_start_warm": "d:transactions/measurements.app_start_warm@millisecond",
    "measurements.cls": "d:transactions/measurements.cls@none",
    "measurements.fcp": "d:transactions/measurements.fcp@millisecond",
    "measurements.fid": "d:transactions/measurements.fid@millisecond",
    "measurements.fp": "d:transactions/measurements.fp@millisecond",
    "measurements.frames_frozen": "d:transactions/measurements.frames_frozen@none",
    "measurements.frames_slow": "d:transactions/measurements.frames_slow@none",
    "measurements.frames_total": "d:transactions/measurements.frames_total@none",
    "measurements.lcp": "d:transactions/measurements.lcp@millisecond",
    "measurements.time_to_initial_display": "d:transactions/measurements.time_to_initial_display@millisecond",
    "measurements.time_to_full_display": "d:transactions/measurements.time_to_full_display@millisecond",
    "measurements.stall_count": "d:transactions/measurements.stall_count@none",
    "measurements.stall_stall_longest_time": "d:transactions/measurements.stall_longest_time@millisecond",
    "measurements.stall_stall_total_time": "d:transactions/measurements.stall_total_time@millisecond",
    "measurements.ttfb": "d:transactions/measurements.ttfb@millisecond",
    "measurements.ttfb.requesttime": "d:transactions/measurements.ttfb.requesttime@millisecond",
    MEASUREMENTS_FRAMES_FROZEN_RATE: "d:transactions/measurements.frames_frozen_rate@ratio",
    MEASUREMENTS_FRAMES_SLOW_RATE: "d:transactions/measurements.frames_slow_rate@ratio",
    MEASUREMENTS_STALL_PERCENTAGE: "d:transactions/measurements.stall_percentage@ratio",
    "spans.browser": "d:transactions/breakdowns.span_ops.ops.browser@millisecond",
    "spans.db": "d:transactions/breakdowns.span_ops.ops.db@millisecond",
    "spans.http": "d:transactions/breakdowns.span_ops.ops.http@millisecond",
    "spans.resource": "d:transactions/breakdowns.span_ops.ops.resource@millisecond",
    "spans.ui": "d:transactions/breakdowns.span_ops.ops.ui@millisecond",
    "transaction.duration": "d:transactions/duration@millisecond",
    "user": "s:transactions/user@none",
}
SPAN_METRICS_MAP = {
    "user": "s:transactions/span.user@none",
    "span.duration": "d:transactions/span.duration@millisecond",
}
# 50 to match the size of tables in the UI + 1 for pagination reasons
METRICS_MAX_LIMIT = 101

METRICS_GRANULARITIES = [86400, 3600, 60]
METRIC_TOLERATED_TAG_VALUE = "tolerated"
METRIC_SATISFIED_TAG_VALUE = "satisfied"
METRIC_FRUSTRATED_TAG_VALUE = "frustrated"
METRIC_SATISFACTION_TAG_KEY = "satisfaction"
# These strings will be resolved by the indexer, but aren't available in the dataset
METRIC_UNAVAILBLE_COLUMNS = {"os.name"}

# Only the metrics that are on the distributions & are in milliseconds
METRIC_DURATION_COLUMNS = {
    key
    for key, value in METRICS_MAP.items()
    if value.endswith("@millisecond") and value.startswith("d:")
}
METRIC_PERCENTILES = {
    0.25,
    0.5,
    0.75,
    0.9,
    0.95,
    0.99,
    1,
}

CUSTOM_MEASUREMENT_PATTERN = re.compile(r"^measurements\..+$")
METRIC_FUNCTION_LIST_BY_TYPE = {
    "generic_distribution": [
        "apdex",
        "avg",
        "p50",
        "p75",
        "p90",
        "p95",
        "p99",
        "p100",
        "max",
        "min",
        "sum",
        "percentile",
    ],
    "generic_set": [
        "count_miserable",
        "user_misery",
        "count_unique",
    ],
}
