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
TRANSACTION_STATUS_ALIAS = "transaction.status"
MEASUREMENTS_FRAMES_SLOW_RATE = "measurements.frames_slow_rate"
MEASUREMENTS_FRAMES_FROZEN_RATE = "measurements.frames_frozen_rate"
MEASUREMENTS_STALL_PERCENTAGE = "measurements.stall_percentage"


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
NO_CONVERSION_FIELDS = {"start", "end"}
EQUALITY_OPERATORS = frozenset(["=", "IN"])
INEQUALITY_OPERATORS = frozenset(["!=", "NOT IN"])
ARRAY_FIELDS = {
    "error.mechanism",
    "error.type",
    "error.value",
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
    "measurements.cls": "d:transactions/measurements.cls@millisecond",
    "measurements.fcp": "d:transactions/measurements.fcp@millisecond",
    "measurements.fid": "d:transactions/measurements.fid@millisecond",
    "measurements.fp": "d:transactions/measurements.fp@millisecond",
    "measurements.frames_frozen": "d:transactions/measurements.frames_frozen@none",
    "measurements.frames_slow": "d:transactions/measurements.frames_slow@none",
    "measurements.frames_total": "d:transactions/measurements.frames_total@none",
    "measurements.lcp": "d:transactions/measurements.lcp@millisecond",
    "measurements.stall_count": "d:transactions/measurements.stall_count@none",
    "measurements.stall_stall_longest_time": "d:transactions/measurements.stall_longest_time@millisecond",
    "measurements.stall_stall_total_time": "d:transactions/measurements.stall_total_time@millisecond",
    "measurements.ttfb": "d:transactions/measurements.ttfb@millisecond",
    "measurements.ttfb.requesttime": "d:transactions/measurements.ttfb.requesttime@millisecond",
    "spans.browser": "d:transactions/breakdowns.span_ops.browser@millisecond",
    "spans.db": "d:transactions/breakdowns.span_ops.db@millisecond",
    "spans.http": "d:transactions/breakdowns.span_ops.http@millisecond",
    "spans.resource": "d:transactions/breakdowns.span_ops.resource@millisecond",
    "transaction.duration": "d:transactions/duration@millisecond",
    "user": "s:transactions/user@none",
}
# 50 to match the size of tables in the UI + 1 for pagination reasons
METRICS_MAX_LIMIT = 101
METRICS_GRANULARITIES = [86400, 3600, 60, 10]
METRIC_TOLERATED_TAG_KEY = "is_tolerated"
METRIC_SATISFIED_TAG_KEY = "is_satisfied"
METRIC_MISERABLE_TAG_KEY = "is_user_miserable"
METRIC_TRUE_TAG_VALUE = "true"
METRIC_FALSE_TAG_VALUE = "false"
# Only the metrics that are on the distributions & are in milliseconds
METRIC_DURATION_COLUMNS = {
    key
    for key, value in METRICS_MAP.items()
    if value.endswith("@millisecond") and value.startswith("d:")
}
# So we can dry run some queries to see how often they'd be compatible
DRY_RUN_COLUMNS = {
    METRIC_TOLERATED_TAG_KEY,
    METRIC_SATISFIED_TAG_KEY,
    METRIC_MISERABLE_TAG_KEY,
    METRIC_TRUE_TAG_VALUE,
    METRIC_FALSE_TAG_VALUE,
    "environment",
    "http.method",
    "measurement_rating",
    "organization_id",
    "project.id",
    "project_id",
    "release",
    "timestamp",
    "transaction.op",
    "transaction",
    "transaction.status",
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
