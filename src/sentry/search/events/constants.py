import re
from typing import TypedDict

from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import DATASETS

TIMEOUT_ERROR_MESSAGE = """
Query timeout. Please try again. If the problem persists try a smaller date range or fewer projects. Also consider a
filter on the transaction field if you're filtering performance data.
"""
TIMEOUT_SPAN_ERROR_MESSAGE = """
Query timeout. Please try again. If the problem persists try a smaller date range or fewer projects. Also consider a
filter on the transaction field or tags.
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
PRECISE_START_TS = "precise.start_ts"
PRECISE_FINISH_TS = "precise.finish_ts"
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
TOTAL_SPAN_DURATION_ALIAS = "total.span_duration"
SPAN_MODULE_ALIAS = "span.module"
SPAN_DOMAIN_ALIAS = "span.domain"
SPAN_DOMAIN_SEPARATOR = ","
UNIQUE_SPAN_DOMAIN_ALIAS = "unique.span_domains"
SPAN_IS_SEGMENT_ALIAS = "span.is_segment"
SPAN_OP = "span.op"
SPAN_DESCRIPTION = "span.description"
SPAN_STATUS = "span.status"
SPAN_CATEGORY = "span.category"


class ThresholdDict(TypedDict):
    poor: float
    meh: float


QUERY_TIPS: dict[str, str] = {
    "CHAINED_OR": "Did you know you can replace chained or conditions like `field:a OR field:b OR field:c` with `field:[a,b,c]`"
}


VITAL_THRESHOLDS: dict[str, ThresholdDict] = {
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

WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS: dict[str, float] = {
    "lcp": 0.30,
    "fcp": 0.15,
    "cls": 0.15,
    "ttfb": 0.10,
    "inp": 0.30,
}

MAX_TAG_KEY_LENGTH = 200
TAG_KEY_RE = re.compile(r"^(sentry_tags|tags)\[(?P<tag>.*)\]$")

TYPED_TAG_KEY_RE = re.compile(
    r"^(sentry_tags|tags)\[(?P<tag>.{0,200}),\s{0,200}(?P<type>.{0,200})\]$"
)


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

RESULT_TYPES = {
    "duration",
    "string",
    "number",
    "integer",
    "percentage",
    "percent_change",
    "date",
    "rate",
}
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
HTTP_SERVER_ERROR_STATUS = {
    "500",
    "501",
    "502",
    "503",
    "504",
    "505",
    "506",
    "507",
    "508",
    "510",
    "511",
}

CACHE_HIT_STATUS = {"true", "false"}

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

METRICS_FUNCTION_ALIASES: dict[str, str] = {}

SPAN_MODULE_CATEGORY_VALUES = ["cache", "db", "http", "queue", "resource"]

SPAN_FUNCTION_ALIASES = {
    "sps": "eps",
    "spm": "epm",
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
    "measurements.score.lcp": "d:transactions/measurements.score.lcp@ratio",
    "measurements.score.fid": "d:transactions/measurements.score.fid@ratio",
    "measurements.score.cls": "d:transactions/measurements.score.cls@ratio",
    "measurements.score.fcp": "d:transactions/measurements.score.fcp@ratio",
    "measurements.score.ttfb": "d:transactions/measurements.score.ttfb@ratio",
    "measurements.score.total": "d:transactions/measurements.score.total@ratio",
    "measurements.score.weight.lcp": "d:transactions/measurements.score.weight.lcp@ratio",
    "measurements.score.weight.fid": "d:transactions/measurements.score.weight.fid@ratio",
    "measurements.score.weight.cls": "d:transactions/measurements.score.weight.cls@ratio",
    "measurements.score.weight.fcp": "d:transactions/measurements.score.weight.fcp@ratio",
    "measurements.score.weight.ttfb": "d:transactions/measurements.score.weight.ttfb@ratio",
    "measurements.inp": "d:spans/webvital.inp@millisecond",
    "measurements.score.inp": "d:spans/webvital.score.inp@ratio",
    "measurements.score.weight.inp": "d:spans/webvital.score.weight.inp@ratio",
    "spans.browser": "d:transactions/breakdowns.span_ops.ops.browser@millisecond",
    "spans.db": "d:transactions/breakdowns.span_ops.ops.db@millisecond",
    "spans.http": "d:transactions/breakdowns.span_ops.ops.http@millisecond",
    "spans.resource": "d:transactions/breakdowns.span_ops.ops.resource@millisecond",
    "spans.ui": "d:transactions/breakdowns.span_ops.ops.ui@millisecond",
    "transaction.duration": "d:transactions/duration@millisecond",
    "user": "s:transactions/user@none",
}
# The assumed list of tags that all metrics have, some won't because we remove tags to reduce cardinality
# Use the public api aliases here
DEFAULT_METRIC_TAGS = {
    "browser.name",
    "device.class",
    "environment",
    "geo.country_code",
    "user.geo.subregion",
    "has_profile",
    "histogram_outlier",
    "http.method",
    "http.status_code",
    "measurement_rating",
    "os.name",
    "query_hash",
    "release",
    "resource.render_blocking_status",
    "cache.hit",
    "satisfaction",
    "sdk",
    "session.status",
    "transaction",
    "transaction.method",
    "transaction.op",
    "transaction.status",
    "span.op",
    "trace.status",
    "messaging.destination.name",
}
SPAN_MESSAGING_LATENCY = "g:spans/messaging.message.receive.latency@millisecond"
SELF_TIME_LIGHT = "d:spans/exclusive_time_light@millisecond"
SPAN_METRICS_MAP = {
    "user": "s:spans/user@none",
    "span.self_time": "d:spans/exclusive_time@millisecond",
    "span.duration": "d:spans/duration@millisecond",
    "ai.total_tokens.used": "c:spans/ai.total_tokens.used@none",
    "ai.total_cost": "c:spans/ai.total_cost@usd",
    "http.response_content_length": "d:spans/http.response_content_length@byte",
    "http.decoded_response_content_length": "d:spans/http.decoded_response_content_length@byte",
    "http.response_transfer_size": "d:spans/http.response_transfer_size@byte",
    "cache.item_size": "d:spans/cache.item_size@byte",
    "mobile.slow_frames": "g:spans/mobile.slow_frames@none",
    "mobile.frozen_frames": "g:spans/mobile.frozen_frames@none",
    "mobile.total_frames": "g:spans/mobile.total_frames@none",
    "mobile.frames_delay": "g:spans/mobile.frames_delay@second",
    "messaging.message.receive.latency": SPAN_MESSAGING_LATENCY,
}
# 50 to match the size of tables in the UI + 1 for pagination reasons
METRICS_MAX_LIMIT = 101

METRICS_GRANULARITIES = [86400, 3600, 60]
METRICS_GRANULARITY_MAPPING = {"1d": 86400, "1h": 3600, "1m": 60}
METRIC_TOLERATED_TAG_VALUE = "tolerated"
METRIC_SATISFIED_TAG_VALUE = "satisfied"
METRIC_FRUSTRATED_TAG_VALUE = "frustrated"
METRIC_SATISFACTION_TAG_KEY = "satisfaction"

# Only the metrics that are on the distributions & are in milliseconds
METRIC_DURATION_COLUMNS = {
    key
    for key, value in METRICS_MAP.items()
    if value.endswith("@millisecond") and value.startswith("d:")
}
SPAN_METRIC_DURATION_COLUMNS = {
    key
    for key, value in SPAN_METRICS_MAP.items()
    if value.endswith("@millisecond") or value.endswith("@second")
}
SPAN_METRIC_SUMMABLE_COLUMNS = SPAN_METRIC_DURATION_COLUMNS.union(
    {"ai.total_tokens.used", "ai.total_cost"}
)
SPAN_METRIC_COUNT_COLUMNS = {
    key
    for key, value in SPAN_METRICS_MAP.items()
    if value.endswith("@none") and value.startswith("g:")
}
SPAN_METRIC_BYTES_COLUMNS = {
    key
    for key, value in SPAN_METRICS_MAP.items()
    if value.endswith("@byte") and value.startswith("d:")
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
        "http_error_count",
        "http_error_rate",
    ],
    "generic_set": [
        "count_miserable",
        "user_misery",
        "count_unique",
    ],
}

# The limit in snuba currently for a single query is 131,535bytes, including room for other parameters picking 120,000
# for now
MAX_PARAMETERS_IN_ARRAY = 120_000

SPANS_METRICS_TAGS = {SPAN_MODULE_ALIAS, SPAN_DESCRIPTION, SPAN_OP, SPAN_CATEGORY}

SPANS_METRICS_FUNCTIONS = {
    "spm",
    "cache_miss_rate",
    "http_response_rate",
}

METRICS_LAYER_UNSUPPORTED_TRANSACTION_METRICS_FUNCTIONS = {
    "performance_score",
    "weighted_performance_score",
    "count_scores",
}
