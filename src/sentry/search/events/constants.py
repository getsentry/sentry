import re

from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import DATASETS

KEY_TRANSACTION_ALIAS = "key_transaction"
ERROR_UNHANDLED_ALIAS = "error.unhandled"
USER_DISPLAY_ALIAS = "user.display"
PROJECT_ALIAS = "project"
PROJECT_NAME_ALIAS = "project.name"
ISSUE_ALIAS = "issue"
ISSUE_ID_ALIAS = "issue.id"
RELEASE_ALIAS = "release"

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

# Create the known set of fields from the issue properties
# and the transactions and events dataset mapping definitions.
SEARCH_MAP = {
    "start": "start",
    "end": "end",
    "project_id": "project_id",
    "first_seen": "first_seen",
    "last_seen": "last_seen",
    "times_seen": "times_seen",
}
SEARCH_MAP.update(**DATASETS[Dataset.Events])
SEARCH_MAP.update(**DATASETS[Dataset.Discover])
