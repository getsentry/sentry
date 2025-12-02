from __future__ import annotations

import functools
import re
from collections.abc import Callable, Generator, Mapping, Sequence
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal, NamedTuple, TypeIs, overload

from django.utils.functional import cached_property
from parsimonious.exceptions import IncompleteParseError
from parsimonious.grammar import Grammar
from parsimonious.nodes import Node, NodeVisitor

from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events.constants import (
    DURATION_UNITS,
    NOT_HAS_FILTER_ERROR_MESSAGE,
    OPERATOR_NEGATION_MAP,
    SEARCH_MAP,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SIZE_UNITS,
    TAG_KEY_RE,
    TEAM_KEY_TRANSACTION_ALIAS,
    WILDCARD_OPERATOR_MAP,
)
from sentry.search.events.fields import FIELD_ALIASES, FUNCTIONS
from sentry.search.events.types import ParamsType, QueryBuilderConfig
from sentry.search.utils import (
    InvalidQuery,
    parse_datetime_range,
    parse_datetime_string,
    parse_datetime_value,
    parse_duration,
    parse_numeric_value,
    parse_percentage,
    parse_size,
)
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import is_duration_measurement, is_measurement, is_span_op_breakdown
from sentry.utils.validators import is_event_id, is_span_id

# A wildcard is an asterisk prefixed by an even number of back slashes.
# If there are an odd number of back slashes, then the back slash immediately
# before the asterisk is actually escaping the asterisk.
WILDCARD_CHARS = re.compile(r"(?<!\\)(\\\\)*\*")

event_search_grammar = Grammar(
    r"""
search = spaces term*

term = (boolean_operator / paren_group / filter / free_text) spaces

boolean_operator = or_operator / and_operator

paren_group = open_paren spaces term+ closed_paren

free_text          = free_text_quoted / free_text_unquoted
free_text_unquoted = (!filter !boolean_operator (free_parens / ~r"[^()\n ]+") spaces)+
free_text_quoted   = quoted_value
free_parens        = open_paren free_text? closed_paren

# All key:value filter types
filter = date_filter
       / specific_date_filter
       / rel_date_filter
       / duration_filter
       / size_filter
       / boolean_filter
       / numeric_in_filter
       / numeric_filter
       / aggregate_duration_filter
       / aggregate_percentage_filter
       / aggregate_numeric_filter
       / aggregate_size_filter
       / aggregate_date_filter
       / aggregate_rel_date_filter
       / has_filter
       / is_filter
       / text_in_filter
       / text_filter

# filter for dates
date_filter = search_key sep operator iso_8601_date_format

# exact date filter for dates
specific_date_filter = search_key sep iso_8601_date_format

# filter for relative dates
rel_date_filter = search_key sep rel_date_format

# filter for durations
duration_filter = negation? search_key sep operator? duration_format

# filter for size
size_filter = negation? search_key sep operator? size_format

# boolean comparison filter
boolean_filter = negation? search_key sep boolean_value

# numeric in filter
numeric_in_filter = negation? search_key sep numeric_in_list

# numeric comparison filter
numeric_filter = negation? search_key sep operator? numeric_value

# aggregate duration filter
aggregate_duration_filter = negation? aggregate_key sep operator? duration_format

# aggregate size filter
aggregate_size_filter = negation? aggregate_key sep operator? size_format

# aggregate percentage filter
aggregate_percentage_filter = negation? aggregate_key sep operator? percentage_format

# aggregate numeric filter
aggregate_numeric_filter = negation? aggregate_key sep operator? numeric_value

# aggregate for dates
aggregate_date_filter = negation? aggregate_key sep operator? iso_8601_date_format

# aggregate for relative dates
aggregate_rel_date_filter = negation? aggregate_key sep operator? rel_date_format

# has filter for not null type checks
has_filter = negation? &"has:" search_key sep (text_key / search_value)

# is filter. Specific to issue search
is_filter = negation? &"is:" search_key sep search_value

# in filter key:[val1, val2]
text_in_filter = negation? text_key sep wildcard_op? text_in_list

# standard key:val filter
text_filter = negation? text_key sep wildcard_op? operator? search_value

key         = ~r"[a-zA-Z0-9_.-]+"
escaped_key = ~r"[a-zA-Z0-9_.:-]+"
quoted_key  = '"' escaped_key '"'

# the quoted variant is here to for backwards compatibility,
# and can be removed once we're sure it's no longer in use
explicit_flag_key         = "flags" open_bracket escaped_key closed_bracket
explicit_string_flag_key  = "flags" open_bracket escaped_key spaces comma spaces "string" closed_bracket
explicit_number_flag_key  = "flags" open_bracket escaped_key spaces comma spaces "number" closed_bracket

explicit_tag_key        = "tags" open_bracket escaped_key closed_bracket
explicit_string_tag_key = "tags" open_bracket escaped_key spaces comma spaces "string" closed_bracket
explicit_number_tag_key = "tags" open_bracket escaped_key spaces comma spaces "number" closed_bracket

aggregate_key                    = key open_paren spaces function_args? spaces closed_paren
function_args                    = aggregate_param (spaces comma spaces !comma aggregate_param?)*
aggregate_param                  = explicit_tag_key_aggregate_param / quoted_aggregate_param / raw_aggregate_param
raw_aggregate_param              = ~r"[^()\t\n, \"]+"
quoted_aggregate_param           = '"' ('\\"' / ~r'[^\t\n\"]')* '"'
explicit_tag_key_aggregate_param = explicit_tag_key / explicit_number_tag_key / explicit_string_tag_key

search_key             = explicit_number_flag_key / explicit_number_tag_key / key / quoted_key
text_key               = explicit_flag_key / explicit_string_flag_key / explicit_tag_key / explicit_string_tag_key / search_key
value                  = ~r"[^()\t\n ]*"
quoted_value           = '"' ('\\"' / ~r'[^"]')* '"'
in_value               = (&in_value_termination in_value_char)+
text_in_value          = quoted_value / in_value
search_value           = quoted_value / value
numeric_value          = "-"? numeric numeric_unit? &(end_value / comma / closed_bracket)
boolean_value          = ~r"(true|1|false|0)"i &end_value
text_in_list           = open_bracket text_in_value (spaces comma spaces !comma text_in_value?)* closed_bracket &end_value
numeric_in_list        = open_bracket numeric_value (spaces comma spaces !comma numeric_value?)* closed_bracket &end_value
wildcard_op            = wildcard_unicode (contains / starts_with / ends_with) wildcard_unicode

# See: https://stackoverflow.com/a/39617181/790169
in_value_termination = in_value_char (!in_value_end in_value_char)* in_value_end
in_value_char        = ~r"[^(), ]"
in_value_end         = closed_bracket / (spaces comma)

# Formats
date_format = ~r"\d{4}-\d{2}-\d{2}"
time_format = ~r"T\d{2}:\d{2}:\d{2}" ("." ms_format)?
ms_format   = ~r"\d{1,6}"
tz_format   = ~r"[+-]\d{2}:\d{2}"


iso_8601_date_format = date_format time_format? ("Z" / tz_format)? &end_value
rel_date_format      = ~r"[+-][0-9]+[wdhm]" &end_value
duration_format      = numeric ("ms"/"s"/"min"/"m"/"hr"/"h"/"day"/"d"/"wk"/"w") &end_value
size_format          = numeric (size_unit) &end_value
percentage_format    = numeric "%"

numeric_unit         = ~r"[kmb]"i
size_unit            = bits / bytes
bits                 = ~r"bit|kib|mib|gib|tib|pib|eib|zib|yib"i
bytes                = ~r"bytes|nb|kb|mb|gb|tb|pb|eb|zb|yb"i

# NOTE: the order in which these operators are listed matters because for
# example, if < comes before <= it will match that even if the operator is <=
operator             = ">=" / "<=" / ">" / "<" / "=" / "!="
or_operator          = ~r"OR"i  &end_value
and_operator         = ~r"AND"i &end_value
numeric              = ~r"[0-9]+(?:\.[0-9]*)?"
open_paren           = "("
closed_paren         = ")"
open_bracket         = "["
closed_bracket       = "]"
sep                  = ":"
negation             = "!"
# Note: wildcard unicode is defined in src/sentry/search/events/constants.py
wildcard_unicode     = "\uF00D"
contains             = "Contains"
starts_with          = "StartsWith"
ends_with            = "EndsWith"
comma                = ","
spaces               = " "*

end_value = ~r"[\t\n )]|$"
"""
)


def translate_wildcard(pat: str) -> str:
    """
    Translate a shell PATTERN to a regular expression.
    modified from: https://github.com/python/cpython/blob/2.7/Lib/fnmatch.py#L85
    """

    i, n = 0, len(pat)
    res = ""
    while i < n:
        c = pat[i]
        i = i + 1
        # fnmatch.translate has no way to handle escaping metacharacters.
        # Applied this basic patch to handle it:
        # https://bugs.python.org/file27570/issue8402.1.patch
        if c == "\\" and i < n:
            res += re.escape(pat[i])
            i += 1
        elif c == "*":
            res += ".*"
        elif c in "()[]?*+-|^$\\.&~# \t\n\r\v\f":
            res += re.escape(c)
        else:
            res += c
    return "^" + res + "$"


def translate_wildcard_as_clickhouse_pattern(pattern: str) -> str:
    """
    Translate a wildcard pattern to clickhouse pattern.

    See https://clickhouse.com/docs/en/sql-reference/functions/string-search-functions#like
    """
    chars: list[str] = []

    i = 0
    n = len(pattern)

    while i < n:
        c = pattern[i]
        i += 1
        if c == "\\" and i < n:
            c = pattern[i]
            if c not in {"*", "\\"}:
                raise InvalidSearchQuery(f"Unexpected escape character: {c}")
            chars.append(c)
            i += 1
        elif c == "*":
            # sql uses % as the wildcard character
            chars.append("%")
        elif c in {"%", "_"}:
            # these are special characters and need to be escaped
            chars.append("\\")
            chars.append(c)
        else:
            chars.append(c)

    return "".join(chars)


def wrap_free_text(string: str, autowrap: bool) -> str:
    if not autowrap:
        return string
    # Free text already had wildcarding on it, leave it alone
    if string.startswith("*") or string.endswith("*"):
        return string
    # Otherwise always wrap it with wildcarding
    else:
        return f"*{string}*"


def translate_escape_sequences(string: str) -> str:
    """
    A non-wildcard pattern can contain escape sequences that we need to handle.
    - \\* because a single asterisk represents a wildcard, so it needs to be escaped
    """

    i, n = 0, len(string)
    res = ""
    while i < n:
        c = string[i]
        i = i + 1
        if c == "\\" and i < n:
            d = string[i]
            if d == "*":
                i += 1
                res += d
            else:
                res += c
        else:
            res += c
    return res


type QueryOp = Literal["AND", "OR"]
type QueryToken = QueryOp | SearchFilter | AggregateFilter | ParenExpression

type _RecursiveList[T] = list[T] | list[_RecursiveList[T]]


def flatten[T](children: _RecursiveList[T]) -> list[T]:
    def _flatten(seq: _RecursiveList[T]) -> Generator[T]:
        # there is a list from search_term and one from free_text, so flatten them.
        # Flatten each group in the list, since nodes can return multiple items
        for item in seq:
            if isinstance(item, list):
                yield from _flatten(item)
            else:
                yield item

    return [_f for _f in _flatten(children) if _f]


def remove_optional_nodes[T](children: list[T]) -> list[T]:
    return [
        item
        for item in children
        if not (isinstance(item, Node) and not item.text)
        if not (isinstance(item, str) and item.isspace())
    ]


def process_list[T](
    first: T, remaining: tuple[tuple[object, object, object, object, tuple[T]], ...]
) -> list[T]:
    # Empty values become blank nodes
    if any(isinstance(item[4], Node) for item in remaining):
        raise InvalidSearchQuery("Lists should not have empty values")

    return [
        first,
        *(item[4][0] for item in remaining),
    ]


def is_negated(node: Node | tuple[Node]) -> bool:
    # Because negations are always optional, parsimonious returns a list of nodes
    # containing one node when a negation exists, and a single node when it doesn't.
    if isinstance(node, Node):
        text = node.text
    else:
        text = node[0].text

    return text == "!"


def handle_negation(negation: Node | tuple[Node], operator: Node | str | tuple[str]) -> str:
    operator = get_operator_value(operator)
    if is_negated(negation):
        return OPERATOR_NEGATION_MAP.get(operator, "!=")
    return operator


def get_operator_value(operator: Node | list[str] | tuple[str] | str) -> str:
    if isinstance(operator, Node):
        return operator.text or "="
    elif isinstance(operator, (list, tuple)):
        return operator[0]
    else:
        return operator


def has_wildcard_op(node: Node | Sequence[Node]) -> bool:
    if isinstance(node, Node):
        return node.text in WILDCARD_OPERATOR_MAP.values()
    if isinstance(node, Sequence) and len(node) > 0:
        return node[0].text in WILDCARD_OPERATOR_MAP.values()
    return False


def get_wildcard_op(node: Node | Sequence[Node]) -> str:
    if isinstance(node, Node):
        return node.text
    if isinstance(node, Sequence) and len(node) > 0:
        return node[0].text
    return ""


def add_leading_wildcard(value: str) -> str:
    if value.startswith('"') and value.endswith('"'):
        return f"*{value[1:-1]}"
    return f"*{value}"


def add_trailing_wildcard(value: str) -> str:
    if value.startswith('"') and value.endswith('"'):
        return f"{value[1:-1]}*"
    return f"{value}*"


def handle_backslash(value: str) -> str:
    # when working with one of the wildcard operators,
    # we need to ensure we properly handle backslashes
    # by escaping them

    v = []
    n = len(value)

    i = 0
    while i < n:
        c = value[i]
        if c == "\\":
            j = i + 1
            if j < n and value[j] in {"*", "\\"}:
                # found an escaped * or \
                v.append(c)
                i += 1
                c = value[i]
            else:
                # found just a \
                v.append("\\")
        v.append(c)
        i += 1

    return "".join(v)


def gen_wildcard_value(value: str, wildcard_op: str) -> str:
    if value == "" or wildcard_op == "":
        return value
    value = handle_backslash(value)
    value = re.sub(r"(?<!\\)\*", r"\\*", value)
    if wildcard_op == WILDCARD_OPERATOR_MAP["contains"]:
        value = add_leading_wildcard(value)
        value = add_trailing_wildcard(value)
    elif wildcard_op == WILDCARD_OPERATOR_MAP["starts_with"]:
        value = add_trailing_wildcard(value)
    elif wildcard_op == WILDCARD_OPERATOR_MAP["ends_with"]:
        value = add_leading_wildcard(value)
    return value


class SearchBoolean:
    BOOLEAN_AND = "AND"
    BOOLEAN_OR = "OR"

    @staticmethod
    def is_or_operator(value: object) -> TypeIs[Literal["OR"]]:
        return value == SearchBoolean.BOOLEAN_OR

    @staticmethod
    def is_operator(value: object) -> TypeIs[QueryOp]:
        return value == SearchBoolean.BOOLEAN_AND or SearchBoolean.is_or_operator(value)


class ParenExpression(NamedTuple):
    children: Sequence[QueryToken]

    def to_query_string(self) -> str:
        inner = " ".join(
            child if isinstance(child, str) else child.to_query_string() for child in self.children
        )
        return f"({inner})"


class SearchKey(NamedTuple):
    name: str

    @property
    def is_tag(self) -> bool:
        return bool(TAG_KEY_RE.match(self.name)) or (
            self.name not in SEARCH_MAP
            and self.name not in FIELD_ALIASES
            and not self.is_measurement
            and not self.is_span_op_breakdown
        )

    @property
    def is_measurement(self) -> bool:
        return is_measurement(self.name) and self.name not in SEARCH_MAP

    @property
    def is_span_op_breakdown(self) -> bool:
        return is_span_op_breakdown(self.name) and self.name not in SEARCH_MAP


def _is_wildcard(raw_value: object) -> TypeIs[str]:
    if not isinstance(raw_value, str):
        return False
    return bool(WILDCARD_CHARS.search(raw_value))


class SearchValue(NamedTuple):
    raw_value: str | float | datetime | Sequence[float] | Sequence[str]
    # Used for top events where we don't want to modify the raw value at all
    use_raw_value: bool = False

    @property
    def value(self) -> Any:
        if self.use_raw_value:
            return self.raw_value
        elif self.is_wildcard() and isinstance(self.raw_value, str):
            return translate_wildcard(self.raw_value)
        elif self.is_wildcard() and isinstance(self.raw_value, (list, tuple)):
            return f"({"|".join(map(translate_wildcard, self.raw_value))})"
        elif isinstance(self.raw_value, str):
            return translate_escape_sequences(self.raw_value)
        elif isinstance(self.raw_value, (list, tuple)):
            # Non-wildcard lists should also have escape sequences translated
            return [
                translate_escape_sequences(v) if isinstance(v, str) else v for v in self.raw_value
            ]
        return self.raw_value

    def to_query_string(self) -> str:
        # for any sequence (but not string) we want to iterate over the items
        # we do that because a simple str() would not be usable for strings
        # str(["a","b"]) == "['a', 'b']" but we would like "[a,b]"
        if isinstance(self.raw_value, (list, tuple)):
            ret_val = ", ".join(str(x) for x in self.raw_value)
            ret_val = f"[{ret_val}]"
            return ret_val
        elif isinstance(self.raw_value, datetime):
            return self.raw_value.isoformat()
        else:
            return str(self.value)

    def is_wildcard(self) -> bool:
        # If we're using the raw value only it'll never be a wildcard
        if self.use_raw_value:
            return False
        if self.is_str_sequence():
            return isinstance(self.raw_value, list) and any(
                _is_wildcard(value) for value in self.raw_value
            )
        return _is_wildcard(self.raw_value)

    def is_str_sequence(self) -> bool:
        return isinstance(self.raw_value, list) and all(isinstance(e, str) for e in self.raw_value)

    def split_wildcards(self) -> tuple[list[str], list[str]] | None:
        if not self.is_str_sequence():
            return None
        wildcards = []
        non_wildcards = []
        assert isinstance(self.raw_value, list)
        for s in self.raw_value:
            assert isinstance(s, str)
            if _is_wildcard(s) is True:
                wildcards.append(s)
            else:
                non_wildcards.append(s)
        return (non_wildcards, wildcards)

    def classify_and_format_wildcard(
        self,
    ) -> (
        tuple[Literal["prefix", "infix", "suffix"], str]
        | tuple[Literal["other"], str | float | datetime | Sequence[float] | Sequence[str]]
    ):
        if not _is_wildcard(self.raw_value):
            return "other", self.value

        ret = WILDCARD_CHARS.finditer(self.raw_value)

        leading_wildcard = False
        trailing_wildcard = False
        middle_wildcard = False

        for x in ret:
            start, end = x.span()
            if start == 0 and end == 1:
                # It must span exactly [0, 1) because if it spans further,
                # the pattern also matched on some leading slashes.
                leading_wildcard = True
            elif end == len(self.raw_value):
                # It only needs to match on end because if it matches on
                # some slashes before the *, that's okay.
                trailing_wildcard = True
            else:
                # The wildcard happens somewhere in the middle of the value.
                # We care about this because when this happens, it's not
                # trivial to optimize the query, so let it fall back to
                # the existing regex approach.
                middle_wildcard = True

        if not middle_wildcard:
            if leading_wildcard and trailing_wildcard:
                # If it's an infix wildcard, we strip off the first and last character
                # which is always a `*` and match on the rest.
                # no lower() here because we can use `positionCaseInsensitive`
                return "infix", translate_escape_sequences(self.raw_value[1:-1])
            elif leading_wildcard:
                # If it's a suffix wildcard, we strip off the first character
                # which is always a `*` and match on the rest.
                return "suffix", translate_escape_sequences(self.raw_value[1:]).lower()
            elif trailing_wildcard:
                # If it's a prefix wildcard, we strip off the last character
                # which is always a `*` and match on the rest.
                return "prefix", translate_escape_sequences(self.raw_value[:-1]).lower()

        return "other", self.value

    def is_event_id(self) -> bool:
        """Return whether the current value is a valid event id

        Empty strings are valid, so that it can be used for has:id queries
        """
        if isinstance(self.raw_value, list):
            return all(isinstance(value, str) and is_event_id(value) for value in self.raw_value)
        if not isinstance(self.raw_value, str):
            return False
        return is_event_id(self.raw_value) or self.raw_value == ""

    def is_span_id(self) -> bool:
        """Return whether the current value is a valid span id

        Empty strings are valid, so that it can be used for has:trace.span queries
        """
        if isinstance(self.raw_value, list):
            return all(isinstance(value, str) and is_span_id(value) for value in self.raw_value)
        if not isinstance(self.raw_value, str):
            return False
        return is_span_id(self.raw_value) or self.raw_value == ""


class SearchFilter(NamedTuple):
    key: SearchKey
    operator: str
    value: SearchValue

    def __str__(self) -> str:
        return f"{self.key.name}{self.operator}{self.value.raw_value}"

    def to_query_string(self) -> str:
        if self.operator == "IN":
            return f"{self.key.name}:{self.value.to_query_string()}"
        elif self.operator == "NOT IN":
            return f"!{self.key.name}:{self.value.to_query_string()}"
        else:
            return f"{self.key.name}:{self.operator}{self.value.to_query_string()}"

    @property
    def is_negation(self) -> bool:
        # Negations are mostly just using != operators. But we also have
        # negations on has: filters, which translate to = '', so handle that
        # case as well.
        return bool(
            self.operator == "!="
            and self.value.raw_value != ""
            or self.operator == "="
            and self.value.raw_value == ""
            or self.operator == "NOT IN"
            and self.value.raw_value
        )

    @property
    def is_in_filter(self) -> bool:
        return self.operator in ("IN", "NOT IN")


class AggregateKey(NamedTuple):
    name: str


class AggregateFilter(NamedTuple):
    key: AggregateKey
    operator: str
    value: SearchValue

    def to_query_string(self) -> str:
        return f"{self.key.name}:{self.operator}{self.value.to_query_string()}"

    def __str__(self) -> str:
        return f"{self.key.name}{self.operator}{self.value.raw_value}"


@dataclass  # pycqa/pycodestyle#1277
class SearchConfig[TAllowBoolean: (Literal[True], Literal[False]) = Literal[True]]:  # noqa: E251
    """
    Configures how the search parser interprets a search query
    """

    # <target_name>: [<list of source names>]
    key_mappings: Mapping[str, list[str]] = field(default_factory=dict)

    # Text keys we allow operators to be used on
    text_operator_keys: set[str] = field(default_factory=set)

    # Keys which are considered valid for duration filters
    duration_keys: set[str] = field(default_factory=set)

    # Keys considered valid for numeric filter types
    numeric_keys: set[str] = field(default_factory=set)

    # Keys considered valid for date filter types
    date_keys: set[str] = field(default_factory=set)

    # Keys considered valid for boolean filter types
    boolean_keys: set[str] = field(default_factory=set)

    # A mapping of string values that may be provided to `is:<value>` which
    # translates to a pair of SearchKey + SearchValue's. An empty list disables
    # this feature for the search
    is_filter_translation: Mapping[str, tuple[str, Any]] = field(default_factory=dict)

    # Enables boolean filtering (AND / OR)
    allow_boolean: TAllowBoolean = True  # type: ignore[assignment]  # python/mypy#18812

    # Allows us to specify an allowlist of keys we will accept for this search.
    # If empty, allow all keys.
    allowed_keys: set[str] = field(default_factory=set)

    # Allows us to specify a list of keys we will not accept for this search.
    blocked_keys: set[str] = field(default_factory=set)

    # Which key we should return any free text under
    free_text_key = "message"

    # Whether to wrap free_text_keys in asterisks
    wildcard_free_text: bool = False

    # Disallow the use of the !has filter
    allow_not_has_filter: bool = True

    @overload
    @classmethod
    def create_from[TBool: (
        Literal[True],
        Literal[False],
    )](
        cls: type[SearchConfig[Any]],
        search_config: SearchConfig[Any],
        *,
        allow_boolean: TBool,
        **overrides: Any,
    ) -> SearchConfig[TBool]: ...

    @overload
    @classmethod
    def create_from[TBool: (
        Literal[True],
        Literal[False],
    )](
        cls: type[SearchConfig[Any]],
        search_config: SearchConfig[TBool],
        **overrides: Any,
    ) -> SearchConfig[TBool]: ...

    @classmethod
    def create_from(
        cls: type[SearchConfig[Any]], search_config: SearchConfig[Any], **overrides: Any
    ) -> SearchConfig[Any]:
        config = cls(**asdict(search_config))
        for key, val in overrides.items():
            setattr(config, key, val)
        return config


class SearchVisitor(NodeVisitor[list[QueryToken]]):
    # `tuple[...]` is used for the typing of `children` because there isn't
    # a way to represent positional-heterogenous lists -- but they are
    # actually lists

    unwrapped_exceptions = (InvalidSearchQuery, IncompatibleMetricsQuery)

    def __init__(
        self,
        config: SearchConfig[Any],
        params: ParamsType | None = None,
        get_field_type: Callable[[str], str | None] | None = None,
        get_function_result_type: Callable[[str], str | None] | None = None,
    ) -> None:
        super().__init__()

        self.config = config

        if TYPE_CHECKING:
            from sentry.search.events.builder.discover import UnresolvedQuery

        @functools.cache
        def _get_fallback_builder() -> UnresolvedQuery:
            # Avoid circular import
            from sentry.search.events.builder.discover import UnresolvedQuery

            # TODO: read dataset from config
            return UnresolvedQuery(
                dataset=Dataset.Discover,
                params=params if params is not None else {},
                config=QueryBuilderConfig(functions_acl=list(FUNCTIONS)),
            )

        if get_field_type is not None:
            self.get_field_type = get_field_type
        else:
            self.get_field_type = _get_fallback_builder().get_field_type
        if get_function_result_type is not None:
            self.get_function_result_type = get_function_result_type
        else:
            self.get_function_result_type = _get_fallback_builder().get_function_result_type

    @cached_property
    def key_mappings_lookup(self) -> dict[str, str]:
        return {
            source_field: target_field
            for target_field, source_fields in self.config.key_mappings.items()
            for source_field in source_fields
        }

    def is_numeric_key(self, key: str) -> bool:
        return (
            key in self.config.numeric_keys
            or is_measurement(key)
            or is_span_op_breakdown(key)
            or self.get_field_type(key) in ["number", "integer"]
            or self.is_duration_key(key)
            or self.is_size_key(key)
        )

    def is_duration_key(self, key: str) -> bool:
        duration_types = [*DURATION_UNITS, "duration"]
        return (
            key in self.config.duration_keys
            or is_duration_measurement(key)
            or is_span_op_breakdown(key)
            or self.get_field_type(key) in duration_types
        )

    def is_size_key(self, key: str) -> bool:
        return self.get_field_type(key) in SIZE_UNITS

    def is_date_key(self, key: str) -> bool:
        return key in self.config.date_keys

    def is_boolean_key(self, key: str) -> bool:
        return key in self.config.boolean_keys

    def visit_search(
        self,
        node: Node,
        children: tuple[str, Node | _RecursiveList[QueryToken]],
    ) -> list[QueryToken]:
        if isinstance(children[1], Node):  # empty search
            return []
        else:
            return remove_optional_nodes(flatten(children[1]))

    def visit_term(
        self,
        node: Node,
        children: tuple[_RecursiveList[QueryToken], str],
    ) -> list[QueryToken]:
        return remove_optional_nodes(flatten(children[0]))

    def visit_boolean_operator(self, node: Node, children: tuple[QueryOp]) -> QueryOp:
        if not self.config.allow_boolean:
            raise InvalidSearchQuery(
                'Boolean statements containing "OR" or "AND" are not supported in this search'
            )

        return children[0]

    def visit_free_text_unquoted(self, node: Node, children: object) -> str | None:
        return node.text.strip(" ") or None

    def visit_free_text(self, node: Node, children: tuple[str]) -> SearchFilter | None:
        if not children[0]:
            return None
        # Free text searches need to be treated like they were wildcards
        return SearchFilter(
            SearchKey(self.config.free_text_key),
            "=",
            SearchValue(wrap_free_text(children[0], self.config.wildcard_free_text)),
        )

    def visit_paren_group(
        self,
        node: Node,
        children: tuple[
            str,
            str,
            _RecursiveList[QueryToken],
            str,
        ],
    ) -> SearchFilter | ParenExpression | list[QueryToken]:
        if not self.config.allow_boolean:
            # It's possible to have a valid search that includes parens, so we
            # can't just error out when we find a paren expression.
            return SearchFilter(
                SearchKey(self.config.free_text_key),
                "=",
                SearchValue(wrap_free_text(node.text, self.config.wildcard_free_text)),
            )

        flattened = remove_optional_nodes(flatten(children[2]))
        if len(flattened) == 0:
            return []

        return ParenExpression(flattened)

    # --- Start of filter visitors

    def _handle_basic_filter(
        self, search_key: SearchKey, operator: str, search_value: SearchValue
    ) -> SearchFilter:
        # If a date or numeric key gets down to the basic filter, then it means
        # that the value wasn't in a valid format, so raise here.
        if self.is_date_key(search_key.name):
            raise InvalidSearchQuery(
                f"{search_key.name}: Invalid date: {search_value.raw_value}. Expected +/-duration (e.g. +1h) or ISO 8601-like (e.g. {datetime.now().isoformat()[:-4]})."
            )
        if self.is_boolean_key(search_key.name):
            raise InvalidSearchQuery(
                f"{search_key.name}: Invalid boolean: {search_value.raw_value}. Expected true, 1, false, or 0."
            )
        if self.is_numeric_key(search_key.name):
            raise InvalidSearchQuery(
                f"{search_key.name}: Invalid number: {search_value.raw_value}. Expected number then optional k, m, or b suffix (e.g. 500k)."
            )

        return SearchFilter(search_key, operator, search_value)

    def _handle_numeric_filter(
        self, search_key: SearchKey, operator: str, search_value: tuple[str, str]
    ) -> SearchFilter:
        operator = get_operator_value(operator)

        try:
            search_value_obj = SearchValue(parse_numeric_value(*search_value))
        except InvalidQuery as exc:
            raise InvalidSearchQuery(str(exc))
        return SearchFilter(search_key, operator, search_value_obj)

    def visit_date_filter(
        self,
        node: Node,
        children: tuple[
            SearchKey,
            Node,  # :
            str,  # operator
            str,  # datetime value
        ],
    ) -> SearchFilter:
        (search_key, _, operator, search_value_s) = children

        if self.is_date_key(search_key.name):
            try:
                search_value_dt = parse_datetime_string(search_value_s)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator, SearchValue(search_value_dt))

        search_value_s = operator + search_value_s if operator != "=" else search_value_s
        return self._handle_basic_filter(search_key, "=", SearchValue(search_value_s))

    def visit_specific_date_filter(
        self,
        node: Node,
        children: tuple[
            SearchKey,
            Node,  # :
            str,  # date value
        ],
    ) -> SearchFilter | list[SearchFilter]:
        # If we specify a specific date, it means any event on that day, and if
        # we specify a specific datetime then it means a few minutes interval
        # on either side of that datetime
        (search_key, _, date_value) = children

        if not self.is_date_key(search_key.name):
            return self._handle_basic_filter(search_key, "=", SearchValue(date_value))

        try:
            from_val, to_val = parse_datetime_value(date_value)
        except InvalidQuery as exc:
            raise InvalidSearchQuery(str(exc))

        # TODO: Handle negations here. This is tricky because these will be
        # separate filters, and to negate this range we need (< val or >= val).
        # We currently AND all filters together, so we'll need extra logic to
        # handle. Maybe not necessary to allow negations for this.
        return [
            SearchFilter(search_key, ">=", SearchValue(from_val[0])),
            SearchFilter(search_key, "<", SearchValue(to_val[0])),
        ]

    def visit_rel_date_filter(
        self,
        node: Node,
        children: tuple[
            SearchKey,
            Node,  # :
            Node,  # date filter value
        ],
    ) -> SearchFilter:
        (search_key, _, value) = children

        if self.is_date_key(search_key.name):
            try:
                dt_range = parse_datetime_range(value.text)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))

            # TODO: Handle negations
            if dt_range[0] is not None:
                operator = ">="
                search_value = dt_range[0][0]
            else:
                operator = "<="
                search_value = dt_range[1][0]
            return SearchFilter(search_key, operator, SearchValue(search_value))

        return self._handle_basic_filter(search_key, "=", SearchValue(value.text))

    def visit_duration_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            SearchKey,
            Node,  # :
            Node | tuple[str],  # operator if present
            tuple[str, str],  # value and unit
        ],
    ) -> SearchFilter:
        (negation, search_key, _, operator, search_value) = children
        if self.is_duration_key(search_key.name) or self.is_numeric_key(search_key.name):
            operator_s = handle_negation(negation, operator)
        else:
            operator_s = get_operator_value(operator)
        if self.is_duration_key(search_key.name):
            try:
                search_value_f = parse_duration(*search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator_s, SearchValue(search_value_f))

        # Durations overlap with numeric `m` suffixes
        if self.is_numeric_key(search_key.name):
            return self._handle_numeric_filter(search_key, operator_s, search_value)

        search_value_s = "".join(search_value)
        search_value_s = (
            operator_s + search_value_s if operator_s not in ("=", "!=") else search_value_s
        )
        operator_s = "!=" if is_negated(negation) else "="
        return self._handle_basic_filter(search_key, operator_s, SearchValue(search_value_s))

    def visit_size_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            SearchKey,
            Node,  # :
            Node | tuple[str],  # operator if present
            tuple[str, str],  # value and unit
        ],
    ) -> SearchFilter:
        (negation, search_key, _, operator, search_value) = children
        # The only size keys we have are custom measurements right now
        if self.is_size_key(search_key.name):
            operator_s = handle_negation(negation, operator)
        else:
            operator_s = get_operator_value(operator)

        if self.is_size_key(search_key.name):
            search_value_f = parse_size(*search_value)
            return SearchFilter(search_key, operator_s, SearchValue(search_value_f))

        search_value_s = "".join(search_value)
        search_value_s = (
            operator_s + search_value_s if operator_s not in ("=", "!=") else search_value_s
        )
        operator_s = "!=" if is_negated(negation) else "="
        return self._handle_basic_filter(search_key, operator_s, SearchValue(search_value_s))

    def visit_boolean_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            SearchKey,
            Node,  # :
            Node,  # boolean value
        ],
    ) -> SearchFilter:
        (negation, search_key, sep, search_value_node) = children
        negated = is_negated(negation)

        # Numeric and boolean filters overlap on 1 and 0 values.
        if self.is_numeric_key(search_key.name):
            return self._handle_numeric_filter(
                search_key, "!=" if negated else "=", (search_value_node.text, "")
            )

        if self.is_boolean_key(search_key.name):
            if search_value_node.text.lower() in ("true", "1"):
                search_value = SearchValue(0 if negated else 1)
            elif search_value_node.text.lower() in ("false", "0"):
                search_value = SearchValue(1 if negated else 0)
            else:
                raise AssertionError(f"unreachable: {search_value_node.text}")
            return SearchFilter(search_key, "=", search_value)

        search_value = SearchValue(search_value_node.text)
        return self._handle_basic_filter(search_key, "=" if not negated else "!=", search_value)

    def visit_numeric_in_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            SearchKey,
            Node,  # :
            list[tuple[str, str]],  # values
        ],
    ) -> SearchFilter:
        (negation, search_key, _, search_values) = children
        operator = handle_negation(negation, "IN")

        if self.is_numeric_key(search_key.name):
            search_value = SearchValue([parse_numeric_value(*val) for val in search_values])
            return SearchFilter(search_key, operator, search_value)

        search_value = SearchValue(["".join(value) for value in search_values])
        return self._handle_basic_filter(search_key, operator, search_value)

    def visit_numeric_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            SearchKey,
            Node,  # :
            Node | tuple[str],  # operator if present
            tuple[str, str],  # value and unit
        ],
    ) -> SearchFilter:
        (negation, search_key, _, operator, raw_search_value) = children
        if (
            self.is_numeric_key(search_key.name)
            or search_key.name in self.config.text_operator_keys
        ):
            operator_s = handle_negation(negation, operator)
        else:
            operator_s = get_operator_value(operator)

        if self.is_numeric_key(search_key.name):
            return self._handle_numeric_filter(search_key, operator_s, raw_search_value)

        search_value = SearchValue("".join(raw_search_value))
        if operator_s not in ("=", "!=") and search_key.name not in self.config.text_operator_keys:
            search_value = search_value._replace(raw_value=f"{operator_s}{search_value.raw_value}")

        if search_key.name not in self.config.text_operator_keys:
            operator_s = "!=" if is_negated(negation) else "="
        return self._handle_basic_filter(search_key, operator_s, search_value)

    def visit_aggregate_duration_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            AggregateKey,
            Node,  # :
            Node | tuple[str],  # operator if present
            tuple[str, str],  # value and unit
        ],
    ) -> AggregateFilter:
        (negation, search_key, _, operator, search_value) = children
        operator_s = handle_negation(negation, operator)

        # Even if the search value matches duration format, only act as
        # duration for certain columns
        result_type = self.get_function_result_type(search_key.name)

        if result_type == "duration" or result_type in DURATION_UNITS:
            try:
                aggregate_value = parse_duration(*search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
        else:
            # Duration overlaps with numeric values with `m` (million vs
            # minutes). So we fall through to numeric if it's not a
            # duration key
            #
            # TODO(epurkhiser): Should we validate that the field is
            # numeric and do some other fallback if it's not?
            try:
                aggregate_value = parse_numeric_value(*search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))

        return AggregateFilter(search_key, operator_s, SearchValue(aggregate_value))

    def visit_aggregate_size_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            AggregateKey,
            Node,  # :
            Node | tuple[str],  # operator if present
            tuple[str, str],  # value + unit
        ],
    ) -> AggregateFilter:
        (negation, search_key, _, operator, search_value) = children
        operator_s = handle_negation(negation, operator)
        aggregate_value = parse_size(*search_value)
        return AggregateFilter(search_key, operator_s, SearchValue(aggregate_value))

    def visit_aggregate_percentage_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            AggregateKey,
            Node,  # :
            Node | tuple[str],  # operator if present
            str,  # percentage value
        ],
    ) -> AggregateFilter:
        (negation, search_key, _, operator, search_value) = children
        operator_s = handle_negation(negation, operator)

        # Even if the search value matches percentage format, only act as
        # percentage for certain columns
        result_type = self.get_function_result_type(search_key.name)
        if result_type == "percentage":
            aggregate_value = parse_percentage(search_value)
            return AggregateFilter(search_key, operator_s, SearchValue(aggregate_value))

        # Invalid formats fall back to text match
        search_value = operator_s + search_value if operator_s != "=" else search_value
        return AggregateFilter(search_key, "=", SearchValue(search_value))

    def visit_aggregate_numeric_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            AggregateKey,
            Node,  # :
            Node | tuple[str],  # operator if present
            tuple[str, str],  # value
        ],
    ) -> AggregateFilter:
        (negation, search_key, _, operator, search_value) = children
        operator_s = handle_negation(negation, operator)
        aggregate_value = parse_numeric_value(*search_value)
        return AggregateFilter(search_key, operator_s, SearchValue(aggregate_value))

    def visit_aggregate_date_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            AggregateKey,
            Node,  # :
            Node | tuple[str],  # operator if present
            str,  # value
        ],
    ) -> AggregateFilter:
        (negation, search_key, _, operator, search_value) = children
        operator_s = handle_negation(negation, operator)
        is_date_aggregate = any(key in search_key.name for key in self.config.date_keys)
        if is_date_aggregate:
            try:
                search_value_dt = parse_datetime_string(search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return AggregateFilter(search_key, operator_s, SearchValue(search_value_dt))

        # Invalid formats fall back to text match
        search_value = operator_s + search_value if operator_s != "=" else search_value
        return AggregateFilter(search_key, "=", SearchValue(search_value))

    def visit_aggregate_rel_date_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            AggregateKey,
            Node,  # :
            Node | tuple[str],  # operator if present
            Node,  # value
        ],
    ) -> AggregateFilter:
        (negation, search_key, _, operator, search_value) = children
        operator_s = handle_negation(negation, operator)
        is_date_aggregate = any(key in search_key.name for key in self.config.date_keys)
        if is_date_aggregate:
            try:
                dt_range = parse_datetime_range(search_value.text)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))

            if dt_range[0] is not None:
                operator_s = ">="
                search_value_dt = dt_range[0][0]
            else:
                operator_s = "<="
                search_value_dt = dt_range[1][0]

            return AggregateFilter(search_key, operator_s, SearchValue(search_value_dt))

        # Invalid formats fall back to text match
        search_value_s = operator_s + search_value.text if operator_s != "=" else search_value.text
        return AggregateFilter(search_key, "=", SearchValue(search_value_s))

    def visit_has_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            Node,  # has: lookahead
            SearchKey,  # SearchKey('has')
            Node,  # :
            tuple[SearchKey],
        ],
    ) -> SearchFilter:
        # the key is has here, which we don't need
        negation, _, _, _, (search_key,) = children

        # Some datasets do not support the !has filter, but we allow
        # team_key_transaction because we control that field and special
        # case the way it's processed in search
        if (
            not self.config.allow_not_has_filter
            and is_negated(negation)
            and search_key.name != TEAM_KEY_TRANSACTION_ALIAS
        ):
            raise IncompatibleMetricsQuery(NOT_HAS_FILTER_ERROR_MESSAGE)

        # if it matched search value instead, it's not a valid key
        if isinstance(search_key, SearchValue):
            raise InvalidSearchQuery(
                'Invalid format for "has" search: was expecting a field or tag instead'
            )

        operator = "=" if is_negated(negation) else "!="
        return SearchFilter(search_key, operator, SearchValue(""))

    def visit_is_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            Node,  # is: lookahead
            SearchKey,  # SearchKey('is')
            Node,  # :
            SearchValue,
        ],
    ) -> SearchFilter:
        negation, _, _, _, search_value = children

        translators = self.config.is_filter_translation

        if not translators:
            raise InvalidSearchQuery('"is:" queries are not supported in this search.')

        if search_value.raw_value.startswith("["):  # type: ignore[union-attr]  # in progress fixing the value type here
            raise InvalidSearchQuery('"in" syntax invalid for "is" search')

        if search_value.raw_value not in translators:
            valid_keys = sorted(translators.keys())
            raise InvalidSearchQuery(
                f'Invalid value for "is" search, valid values are {valid_keys}'
            )

        search_key_s, search_value_v = translators[search_value.raw_value]  # type: ignore[index]   # in progress fixing the value type here

        operator = "!=" if is_negated(negation) else "="
        search_key = SearchKey(search_key_s)
        search_value = SearchValue(search_value_v)

        return SearchFilter(search_key, operator, search_value)

    def visit_text_in_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            SearchKey,
            Node,  # :
            Node | Sequence[Node],  # wildcard_op if present
            list[str],
        ],
    ) -> SearchFilter:
        (negation, search_key, _sep, wildcard_op, search_value_lst) = children
        operator = "IN"
        search_value = SearchValue(search_value_lst)

        operator = handle_negation(negation, operator)

        if has_wildcard_op(wildcard_op) and isinstance(search_value.raw_value, list):
            wildcarded_values = []
            found_wildcard_op = get_wildcard_op(wildcard_op)
            for value in search_value.raw_value:
                if isinstance(value, str):
                    wildcarded_values.append(gen_wildcard_value(value, found_wildcard_op))

            search_value = search_value._replace(raw_value=wildcarded_values)

        return self._handle_basic_filter(search_key, operator, search_value)

    def visit_text_filter(
        self,
        node: Node,
        children: tuple[
            Node | tuple[Node],  # ! if present
            SearchKey,
            Node,  # :
            Node | Sequence[Node],  # wildcard_op if present
            Node | tuple[str],  # operator if present
            SearchValue,
        ],
    ) -> SearchFilter:
        (negation, search_key, _sep, wildcard_op, operator, search_value) = children
        operator_s = get_operator_value(operator)

        # XXX: We check whether the text in the node itself is actually empty, so
        # we can tell the difference between an empty quoted string and no string
        if not search_value.raw_value and not node.children[5].text:
            raise InvalidSearchQuery(f"Empty string after '{search_key.name}:'")

        if operator_s not in ("=", "!=") and search_key.name not in self.config.text_operator_keys:
            # Operators are not supported in text_filter.
            # Push it back into the value before handing the negation.
            search_value = search_value._replace(raw_value=f"{operator_s}{search_value.raw_value}")
            operator_s = "="

        operator_s = handle_negation(negation, operator_s)

        if has_wildcard_op(wildcard_op) and isinstance(search_value.raw_value, str):
            wildcarded_value = gen_wildcard_value(
                search_value.raw_value, get_wildcard_op(wildcard_op)
            )
            search_value = search_value._replace(raw_value=wildcarded_value)

        return self._handle_basic_filter(search_key, operator_s, search_value)

    # --- End of filter visitors

    def visit_key(self, node: Node, children: object) -> str:
        return node.text

    def visit_escaped_key(self, node: Node, children: object) -> str:
        return node.text

    def visit_quoted_key(self, node: Node, children: tuple[Node, str, Node]) -> str:
        return children[1]

    def visit_explicit_tag_key(
        self,
        node: Node,
        children: tuple[
            Node,  # "tags"
            str,  # '['
            str,  # escaped_key
            str,  # ']'
        ],
    ) -> SearchKey:
        return SearchKey(f"tags[{children[2]}]")

    def visit_explicit_string_tag_key(
        self,
        node: Node,
        children: tuple[
            Node,  # "tags"
            str,  # '['
            str,  # escaped_key
            str,  # ' '
            Node,  # ','
            str,  # ' '
            Node,  # "string"
            str,  # ']'
        ],
    ) -> SearchKey:
        return SearchKey(f"tags[{children[2]},string]")

    def visit_explicit_number_tag_key(
        self,
        node: Node,
        children: tuple[
            Node,  # "tags"
            str,  # '['
            str,  # escaped_key
            str,  # ' '
            Node,  # ','
            str,  # ' '
            Node,  # "number"
            str,  # ']'
        ],
    ) -> SearchKey:
        return SearchKey(f"tags[{children[2]},number]")

    def visit_explicit_flag_key(
        self,
        node: Node,
        children: tuple[
            Node,  # "flags"
            str,  # [
            str,  # escaped_key
            str,  # ]
        ],
    ) -> SearchKey:
        return SearchKey(f"flags[{children[2]}]")

    def visit_explicit_string_flag_key(
        self,
        node: Node,
        children: tuple[
            Node,  # "flags"
            str,  # '['
            str,  # escaped_key
            str,  # ' '
            Node,  # ','
            str,  # ' '
            Node,  # "string"
            str,  # ']'
        ],
    ) -> SearchKey:
        return SearchKey(f"flags[{children[2]},string]")

    def visit_explicit_number_flag_key(
        self,
        node: Node,
        children: tuple[
            Node,  # "flags"
            str,  # '['
            str,  # escaped_key
            str,  # ' '
            Node,  # ','
            str,  # ' '
            Node,  # "number"
            str,  # ']'
        ],
    ) -> SearchKey:
        return SearchKey(f"flags[{children[2]},number]")

    def visit_aggregate_key(
        self,
        node: Node,
        children: tuple[
            str,  # function name
            str,  # open paren
            str,  # space
            Node | tuple[list[str]],  # args if present
            str,  # space
            str,  # close paren
        ],
    ) -> AggregateKey:
        function_name, open_paren, _, args, _, close_paren = children

        if isinstance(args, Node):
            args_s = ""
        else:
            args_s = ", ".join(args[0])

        key = "".join([function_name, open_paren, args_s, close_paren])
        return AggregateKey(self.key_mappings_lookup.get(key, key))

    def visit_function_args(
        self,
        node: Node,
        children: tuple[
            str,  # value
            (Node | tuple[tuple[str, Node, str, Node, tuple[str]], ...]),  # no match  # repeat
        ],
    ) -> list[str]:
        if isinstance(children[1], Node):
            return [children[0]]
        else:
            return process_list(children[0], children[1])

    def visit_aggregate_param(self, node: Node, children: tuple[str]) -> str:
        return children[0]

    def visit_raw_aggregate_param(self, node: Node, children: object) -> str:
        return node.text

    def visit_quoted_aggregate_param(
        self,
        node: Node,
        children: tuple[
            Node,  # "
            Node | _RecursiveList[Node],  # content
            Node,  # "
        ],
    ) -> str:
        if isinstance(children[1], Node):  # empty string
            value = ""
        else:
            value = "".join(node.text for node in flatten(children[1]))

        return f'"{value}"'

    def visit_explicit_tag_key_aggregate_param(
        self,
        node: Node,
        children: tuple[SearchKey],
    ) -> str:
        return children[0].name

    def visit_search_key(self, node: Node, children: tuple[str | SearchKey]) -> SearchKey:
        key = children[0]
        if (
            self.config.allowed_keys
            and key not in self.config.allowed_keys
            or key in self.config.blocked_keys
        ):
            raise InvalidSearchQuery(f"Invalid key for this search: {key}")
        if isinstance(key, SearchKey):
            return key
        return SearchKey(self.key_mappings_lookup.get(key, key))

    def visit_text_key(self, node: Node, children: tuple[SearchKey]) -> SearchKey:
        return children[0]

    def visit_value(self, node: Node, children: object) -> str:
        # A properly quoted value will match the quoted value regex, so any unescaped
        # quotes are errors.
        value = node.text
        idx = value.find('"')
        if idx == 0:
            raise InvalidSearchQuery(
                f"Invalid quote at '{node.text}': quotes must enclose text or be escaped."
            )

        while idx != -1:
            if value[idx - 1] != "\\":
                raise InvalidSearchQuery(
                    f"Invalid quote at '{node.text}': quotes must enclose text or be escaped."
                )

            value = value[idx + 1 :]
            idx = value.find('"')

        return node.text.replace('\\"', '"')

    def visit_quoted_value(
        self,
        node: Node,
        children: tuple[
            Node,  # "
            Node | _RecursiveList[Node],  # content
            Node,  # "
        ],
    ) -> str:
        if isinstance(children[1], Node):  # empty string
            value = ""
        else:
            value = "".join(node.text for node in flatten(children[1]))
        value = value.replace('\\"', '"')

        return value

    def visit_in_value(self, node: Node, children: object) -> str:
        return node.text.replace('\\"', '"')

    def visit_text_in_value(self, node: Node, children: tuple[str]) -> str:
        return children[0]

    def visit_search_value(self, node: Node, children: tuple[str]) -> SearchValue:
        return SearchValue(children[0])

    def visit_numeric_value(
        self,
        node: Node,
        children: tuple[
            Node | list[Node],  # sign
            str,  # value
            Node | list[Node],  # unit
            Node,  # terminating lookahead
        ],
    ) -> list[str]:
        (sign, value, suffix, _) = children
        sign_s = sign[0].text if isinstance(sign, list) else ""
        suffix_s = suffix[0].text if isinstance(suffix, list) else ""

        return [f"{sign_s}{value}", suffix_s]

    def visit_boolean_value(self, node: Node, children: object) -> Node:
        return node

    def visit_text_in_list(
        self,
        node: Node,
        children: tuple[
            str,  # '['
            str,  # value
            tuple[tuple[str, Node, str, Node, tuple[str]], ...],  # repeat
            str,  # ']'
            Node,  # terminating lookahead
        ],
    ) -> list[str]:
        return process_list(children[1], children[2])

    def visit_numeric_in_list(
        self,
        node: Node,
        children: tuple[
            str,  # '['
            tuple[str, str],  # value
            tuple[tuple[str, Node, str, Node, tuple[tuple[str, str]]], ...],  # repeat
            str,  # ']'
            Node,  # terminating lookahead
        ],
    ) -> list[tuple[str, str]]:
        return process_list(children[1], children[2])

    def visit_iso_8601_date_format(self, node: Node, children: object) -> str:
        return node.text

    def visit_rel_date_format(self, node: Node, children: object) -> Node:
        return node

    def visit_duration_format(
        self, node: Node, children: tuple[str, tuple[Node], Node]
    ) -> list[str]:
        return [children[0], children[1][0].text]

    def visit_size_format(self, node: Node, children: tuple[str, tuple[Node]]) -> list[str]:
        return [children[0], children[1][0].text]

    def visit_percentage_format(self, node: Node, children: tuple[str, Node]) -> str:
        return children[0]

    def visit_operator(self, node: Node, children: object) -> str:
        return node.text

    def visit_or_operator(self, node: Node, children: object) -> str:
        return node.text.upper()

    def visit_and_operator(self, node: Node, children: object) -> str:
        return node.text.upper()

    def visit_numeric(self, node: Node, children: object) -> str:
        return node.text

    def visit_open_paren(self, node: Node, children: object) -> str:
        return node.text

    def visit_closed_paren(self, node: Node, children: object) -> str:
        return node.text

    def visit_open_bracket(self, node: Node, children: object) -> str:
        return node.text

    def visit_closed_bracket(self, node: Node, children: object) -> str:
        return node.text

    def visit_sep(self, node: Node, children: object) -> Node:
        return node

    def visit_negation(self, node: Node, children: object) -> Node:
        return node

    def visit_wildcard_op(self, node: Node, children: object) -> Node:
        return node

    def visit_comma(self, node: Node, children: object) -> Node:
        return node

    def visit_spaces(self, node: Node, children: object) -> str:
        return " "

    def generic_visit(self, node: Node, children: Sequence[Any]) -> Any:
        return children or node


default_config = SearchConfig(
    duration_keys={"transaction.duration"},
    text_operator_keys={SEMVER_ALIAS, SEMVER_BUILD_ALIAS},
    # do not put aggregate functions in this list
    numeric_keys={
        "project_id",
        "project.id",
        "issue.id",
        "stack.colno",
        "stack.lineno",
        "stack.stack_level",
        "transaction.duration",
    },
    date_keys={
        "start",
        "end",
        "last_seen()",
        "time",
        "timestamp",
        "timestamp.to_hour",
        "timestamp.to_day",
        "error.received",
    },
    boolean_keys={
        "error.handled",
        "error.unhandled",
        "error.main_thread",
        "stack.in_app",
        "is_application",
        "symbolicated_in_app",
        TEAM_KEY_TRANSACTION_ALIAS,
    },
)


@overload
def parse_search_query(
    query: str,
    *,
    config: SearchConfig[Literal[False]],
    params: ParamsType | None = None,
    get_field_type: Callable[[str], str | None] | None = None,
    get_function_result_type: Callable[[str], str | None] | None = None,
) -> Sequence[SearchFilter | AggregateFilter]: ...


@overload
def parse_search_query(
    query: str,
    *,
    config: SearchConfig[Literal[True]] | None = None,
    params: ParamsType | None = None,
    get_field_type: Callable[[str], str | None] | None = None,
    get_function_result_type: Callable[[str], str | None] | None = None,
) -> Sequence[QueryToken]: ...


def parse_search_query(
    query: str,
    *,
    config: SearchConfig[Any] | None = None,
    params: ParamsType | None = None,
    get_field_type: Callable[[str], str | None] | None = None,
    get_function_result_type: Callable[[str], str | None] | None = None,
) -> Sequence[QueryToken]:
    if config is None:
        config = default_config

    try:
        tree = event_search_grammar.parse(query)
    except IncompleteParseError as e:
        idx = e.column()
        prefix = query[max(0, idx - 5) : idx]
        suffix = query[idx : (idx + 5)]
        raise InvalidSearchQuery(
            "{} {}".format(
                f"Parse error at '{prefix}{suffix}' (column {e.column():d}).",
                "This is commonly caused by unmatched parentheses. Enclose any text in double quotes.",
            )
        )

    return SearchVisitor(
        config,
        params=params,
        get_field_type=get_field_type,
        get_function_result_type=get_function_result_type,
    ).visit(tree)
