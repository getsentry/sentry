import re

from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import DATASETS

KEY_TRANSACTION_ALIAS = "key_transaction"
PROJECT_THRESHOLD_CONFIG_ALIAS = "project_threshold_config"
TEAM_KEY_TRANSACTION_ALIAS = "team_key_transaction"
ERROR_UNHANDLED_ALIAS = "error.unhandled"
USER_DISPLAY_ALIAS = "user.display"
PROJECT_ALIAS = "project"
PROJECT_NAME_ALIAS = "project.name"
ISSUE_ALIAS = "issue"
ISSUE_ID_ALIAS = "issue.id"
RELEASE_ALIAS = "release"
SEMVER_ALIAS = "sentry.semver"
TIMESTAMP_TO_HOUR_ALIAS = "timestamp.to_hour"
TIMESTAMP_TO_DAY_ALIAS = "timestamp.to_day"

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
}
SEARCH_MAP.update(**DATASETS[Dataset.Events])
SEARCH_MAP.update(**DATASETS[Dataset.Discover])

DEFAULT_PROJECT_THRESHOLD_METRIC = "duration"
DEFAULT_PROJECT_THRESHOLD = 300

# Allow list of fields that are compatible with the Snql Query Builder.
# Once we reach a certain threshold of fields handled should turn this into a denylist
# use public facing field/function names for this list
SNQL_FIELD_ALLOWLIST = {
    "environment",
    "message",
    "project",
    "project.id",
    "release",
    USER_DISPLAY_ALIAS,
    "user.email",
    ISSUE_ALIAS,
    ISSUE_ID_ALIAS,
    TIMESTAMP_TO_HOUR_ALIAS,
    TIMESTAMP_TO_DAY_ALIAS,
}

OPERATOR_NEGATION_MAP = {
    "=": "!=",
    "<": ">=",
    "<=": ">",
    ">": "<=",
    ">=": "<",
    "IN": "NOT IN",
}
OPERATOR_TO_DJANGO = {">=": "gte", "<=": "lte", ">": "gt", "<": "lt", "=": "exact"}

SEMVER_MAX_SEARCH_RELEASES = 1000
SEMVER_EMPTY_RELEASE = "____SENTRY_EMPTY_RELEASE____"
SEMVER_FAKE_PACKAGE = "__sentry_fake__"
SEMVER_WILDCARDS = frozenset(["X", "*"])
