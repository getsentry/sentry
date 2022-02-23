import re

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
TIMESTAMP_TO_HOUR_ALIAS = "timestamp.to_hour"
TIMESTAMP_TO_DAY_ALIAS = "timestamp.to_day"
TRANSACTION_STATUS_ALIAS = "transaction.status"
MEASUREMENTS_FRAMES_SLOW_RATE = "measurements.frames_slow_rate"
MEASUREMENTS_FRAMES_FROZEN_RATE = "measurements.frames_frozen_rate"
MEASUREMENTS_STALL_PERCENTAGE = "measurements.stall_percentage"

TAG_KEY_RE = re.compile(r"^tags\[(?P<tag>.*)\]$")
# Based on general/src/protocol/tags.rs in relay
VALID_FIELD_PATTERN = re.compile(r"^[a-zA-Z0-9_.:-]*$")

# The regex for alias here is to match any word, but exclude anything that is only digits
# eg. 123 doesn't match, but test_123 will match
ALIAS_REGEX = r"(\w+)?(?!\d+)\w+"

ALIAS_PATTERN = re.compile(fr"{ALIAS_REGEX}$")
FUNCTION_PATTERN = re.compile(
    fr"^(?P<function>[^\(]+)\((?P<columns>.*)\)( (as|AS) (?P<alias>{ALIAS_REGEX}))?$"
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

CONFIGURABLE_AGGREGATES = {
    "apdex()": "apdex({threshold}) as apdex",
    "user_misery()": "user_misery({threshold}) as user_misery",
    "count_miserable(user)": "count_miserable(user,{threshold}) as count_miserable_user",
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
    "measurements.fp": "sentry.transactions.measurements.fp",
    "measurements.fcp": "sentry.transactions.measurements.fcp",
    "measurements.lcp": "sentry.transactions.measurements.lcp",
    "measurements.fid": "sentry.transactions.measurements.fid",
    "measurements.cls": "sentry.transactions.measurements.cls",
    "measurements.ttfb": "sentry.transactions.measurements.ttfb",
    "measurements.ttfb.requesttime": "sentry.transactions.measurements.ttfb.requesttime",
    "transaction.duration": "sentry.transactions.transaction.duration",
    "user": "sentry.transactions.user",
}
# 50 to match the size of tables in the UI + 1 for pagination reasons
METRICS_MAX_LIMIT = 51
