import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Sequence, TypedDict, Union
from urllib.parse import urlparse

from sentry.spans.grouping.utils import Hash, parse_fingerprint_var


class Span(TypedDict):
    trace_id: str
    parent_span_id: str
    span_id: str
    start_timestamp: float
    timestamp: float
    same_process_as_parent: bool
    op: str
    description: Optional[str]
    fingerprint: Optional[Sequence[str]]
    tags: Optional[Any]
    data: Optional[Any]


# A callable strategy is a callable that when given a span, it tries to
# returns a fingerprint. If the strategy does not apply to the span, it
# should return `None` to indicate that the strategy should not be used
# and to try a different strategy. If the strategy does apply, it should
# return a list of strings that will serve as the span fingerprint.
CallableStrategy = Callable[[Span], Optional[Sequence[str]]]


@dataclass(frozen=True)
class SpanGroupingStrategy:
    name: str
    # The strategies to use with the default fingerprint
    strategies: Sequence[CallableStrategy]

    def execute(self, event_data: Any) -> Dict[str, str]:
        spans = event_data.get("spans", [])
        span_groups = {span["span_id"]: self.get_span_group(span) for span in spans}

        # make sure to get the group id for the transaction root span
        span_id = event_data["contexts"]["trace"]["span_id"]
        span_groups[span_id] = self.get_transaction_span_group(event_data)

        return span_groups

    def get_transaction_span_group(self, event_data: Any) -> str:
        result = Hash()
        result.update(event_data["transaction"])
        return result.hexdigest()

    def get_span_group(self, span: Span) -> str:
        fingerprints = span.get("fingerprint") or ["{{ default }}"]

        result = Hash()

        for fingerprint in fingerprints:
            values: Sequence[str] = [fingerprint]

            var = parse_fingerprint_var(fingerprint)
            if var == "default":
                values = self.handle_default_fingerprint(span)

            result.update(values)

        return result.hexdigest()

    def handle_default_fingerprint(self, span: Span) -> Sequence[str]:
        span_group = None

        # Try using all of the strategies in order to generate
        # the appropriate span group. The first strategy that
        # successfully generates a span group will be chosen.
        for strategy in self.strategies:
            span_group = strategy(span)
            if span_group is not None:
                break

        # If no strategies generated a valid span group,
        # fall back to using the raw description strategy
        if span_group is None:
            span_group = raw_description_strategy(span)

        return span_group


def span_op(op_name: Union[str, Sequence[str]]) -> Callable[[CallableStrategy], CallableStrategy]:
    permitted_ops = [op_name] if isinstance(op_name, str) else op_name

    def wrapped(fn: CallableStrategy) -> CallableStrategy:
        return lambda span: fn(span) if span.get("op") in permitted_ops else None

    return wrapped


def raw_description_strategy(span: Span) -> Sequence[str]:
    """The catch-all strategy to use if all other strategies fail. This
    strategy is only effective if the span description is a fixed string.
    Otherwise, this strategy will produce a large number of span groups.
    """
    return [span.get("description") or ""]


IN_CONDITION_PATTERN = re.compile(r" IN \(%s(\s*,\s*%s)*\)")


@span_op(
    [
        "db",
        "db.query",
        "db.sql.query",
        "db.sql.active_record",
        "db.sql.execute",
        "db.sql.transaction",
    ]
)
def normalized_db_span_in_condition_strategy(span: Span) -> Optional[Sequence[str]]:
    """For a `db` query span, the `IN` condition contains the same number of
    elements on the right hand side as the raw query. This results in identical
    queries that have different number of elements on the right hand side to be
    seen as different spans. We want these spans to be seen as similar spans,
    so we normalize the right hand side of `IN` conditions to `(%s) to use in
    the fingerprint."""
    description = span.get("description") or ""
    cleaned, count = IN_CONDITION_PATTERN.subn(" IN (%s)", description)
    if count == 0:
        return None
    return [cleaned]


# Catches sequences like (?, ?, ?), ($1, $2, $3), and (%s, %s, %s)
LOOSE_IN_CONDITION_PATTERN = re.compile(r" IN \(((%s|\$?\d+|\?)(\s*,\s*(%s|\$?\d+|\?))*)\)", re.I)


@span_op(
    [
        "db",
        "db.query",
        "db.sql.query",
        "db.sql.active_record",
        "db.sql.execute",
        "db.sql.transaction",
    ]
)
def loose_normalized_db_span_in_condition_strategy(span: Span) -> Optional[Sequence[str]]:
    """This is identical to the above
    `normalized_db_span_in_condition_strategy` but it uses a looser regular
    expression that catches database spans that come from Laravel and Rails"""
    description = span.get("description") or ""
    cleaned, count = LOOSE_IN_CONDITION_PATTERN.subn(" IN (%s)", description)
    if count == 0:
        return None
    return [cleaned]


def join_regexes(regexes: Sequence[str]) -> str:
    return r"(?:" + r")|(?:".join(regexes) + r")"


DB_PARAMETRIZATION_PATTERN = re.compile(
    join_regexes(
        [
            r"'(?:[^']|'')*?(?:\\'.*|'(?!'))",  # single-quoted strings
            r"-?\b(?:[0-9]+\.)?[0-9]+(?:[eE][+-]?[0-9]+)?\b",  # numbers
            r"\b(?:true|false)\b",  # booleans
        ]
    )
)

DB_SAVEPOINT_PATTERN = re.compile(r'SAVEPOINT (?:(?:"[^"]+")|(?:`[^`]+`)|(?:[a-z]\w+))', re.I)


@span_op(
    [
        "db",
        "db.query",
        "db.sql.query",
        "db.sql.active_record",
        "db.sql.execute",
        "db.sql.transaction",
    ]
)
def parametrize_db_span_strategy(span: Span) -> Optional[Sequence[str]]:
    """First, apply the same IN-condition normalization as
    loose_normalized_db_span_condition_strategy. Then, replace all numeric,
    string, and boolean parameters with placeholders so that queries that only
    differ in their parameters will have the same hash.

    Since we don't know what flavor of SQL is being passed in, we have to be
    conservative with the literals we target. Currently, only single-quoted
    strings are parametrized even though MySQL supports double-quoted strings as
    well, because PG uses double-quoted strings for identifiers."""
    query = span.get("description") or ""
    query, in_count = LOOSE_IN_CONDITION_PATTERN.subn(" IN (%s)", query)
    query, savepoint_count = DB_SAVEPOINT_PATTERN.subn("SAVEPOINT %s", query)
    query, param_count = DB_PARAMETRIZATION_PATTERN.subn("%s", query)
    if param_count + savepoint_count + in_count == 0:
        return None
    return [query.strip()]


HTTP_METHODS = {
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "CONNECT",
    "OPTIONS",
    "TRACE",
    "PATCH",
}


@span_op("http.client")
def remove_http_client_query_string_strategy(span: Span) -> Optional[Sequence[str]]:
    """For a `http.client` span, the fingerprint to use is

    - The http method
    - The url scheme
    - The url domain
    - The url path

    This strategy means that different url path parameters are seen as different
    spans but different url query parameters are seen as same spans.

    For example,

    `GET https://sentry.io/organizations/this-org/issues/` and
    `GET https://sentry.io/organizations/that-org/issues/` differ in the url path.
    Therefore, these are different spans.

    `GET https://sentry.io/organizations/this-org/issues/?id=1` and
    `GET https://sentry.io/organizations/this-org/issues/?id=2` differ in the query
    string. Therefore, these are similar spans.
    """

    # Check the description is of the form `<HTTP METHOD> <URL>`
    description = span.get("description") or ""
    parts = description.split(" ", 1)
    if len(parts) != 2:
        return None

    # Ensure that this is a valid http method
    method, url_str = parts
    method = method.upper()
    if method not in HTTP_METHODS:
        return None

    url = urlparse(url_str)
    return [method, url.scheme, url.netloc, url.path]


@span_op(["redis", "db.redis"])
def remove_redis_command_arguments_strategy(span: Span) -> Optional[Sequence[str]]:
    """For a `redis` span, the fingerprint to use is simply the redis command name.
    The arguments to the redis command is highly variable and therefore not used as
    a part of the fingerprint.
    """
    description = span.get("description") or ""
    parts = description.split(" ", 1)

    # the redis command name is the first word in the description
    return [parts[0]]
