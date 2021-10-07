import re
from collections import namedtuple
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, List, Mapping, NamedTuple, Sequence, Set, Tuple, Union

from django.utils.functional import cached_property
from parsimonious.exceptions import IncompleteParseError
from parsimonious.expressions import Optional
from parsimonious.grammar import Grammar, NodeVisitor
from parsimonious.nodes import Node

from sentry.search.events.constants import (
    OPERATOR_NEGATION_MAP,
    SEARCH_MAP,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    TAG_KEY_RE,
    TEAM_KEY_TRANSACTION_ALIAS,
)
from sentry.search.events.fields import FIELD_ALIASES, FUNCTIONS, InvalidSearchQuery, resolve_field
from sentry.search.utils import (
    InvalidQuery,
    parse_datetime_range,
    parse_datetime_string,
    parse_datetime_value,
    parse_duration,
    parse_numeric_value,
    parse_percentage,
)
from sentry.utils.compat import filter, map
from sentry.utils.snuba import is_duration_measurement, is_measurement, is_span_op_breakdown
from sentry.utils.validators import is_event_id

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
       / boolean_filter
       / numeric_in_filter
       / numeric_filter
       / aggregate_duration_filter
       / aggregate_percentage_filter
       / aggregate_numeric_filter
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
duration_filter = search_key sep operator? duration_format

# boolean comparison filter
boolean_filter = negation? search_key sep boolean_value

# numeric in filter
numeric_in_filter = search_key sep numeric_in_list

# numeric comparison filter
numeric_filter = search_key sep operator? numeric_value

# aggregate duration filter
aggregate_duration_filter = negation? aggregate_key sep operator? duration_format

# aggregate percentage filter
aggregate_percentage_filter = negation? aggregate_key sep operator? percentage_format

# aggregate numeric filter
aggregate_numeric_filter = negation? aggregate_key sep operator? numeric_value

# aggregate for dates
aggregate_date_filter = negation? aggregate_key sep operator? iso_8601_date_format

# aggregate for relative dates
aggregate_rel_date_filter = negation? aggregate_key sep operator? rel_date_format

# has filter for not null type checks
has_filter = negation? &"has:" search_key sep (search_key / search_value)

# is filter. Specific to issue search
is_filter  = negation? &"is:" search_key sep search_value

# in filter key:[val1, val2]
text_in_filter = negation? text_key sep text_in_list

# standard key:val filter
text_filter = negation? text_key sep operator? search_value

key                    = ~r"[a-zA-Z0-9_.-]+"
quoted_key             = '"' ~r"[a-zA-Z0-9_.:-]+" '"'
explicit_tag_key       = "tags" open_bracket search_key closed_bracket
aggregate_key          = key open_paren spaces function_args? spaces closed_paren
function_args          = aggregate_param (spaces comma spaces !comma aggregate_param?)*
aggregate_param        = quoted_aggregate_param / raw_aggregate_param
raw_aggregate_param    = ~r"[^()\t\n, \"]+"
quoted_aggregate_param = '"' ('\\"' / ~r'[^\t\n\"]')* '"'
search_key             = key / quoted_key
text_key               = explicit_tag_key / search_key
value                  = ~r"[^()\t\n ]*"
quoted_value           = '"' ('\\"' / ~r'[^"]')* '"'
in_value               = (&in_value_termination in_value_char)+
text_in_value          = quoted_value / in_value
search_value           = quoted_value / value
numeric_value          = "-"? numeric ~r"[kmb]"? &(end_value / comma / closed_bracket)
boolean_value          = ~r"(true|1|false|0)"i &end_value
text_in_list           = open_bracket text_in_value (spaces comma spaces !comma text_in_value?)* closed_bracket &end_value
numeric_in_list        = open_bracket numeric_value (spaces comma spaces !comma numeric_value?)* closed_bracket &end_value

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
percentage_format    = numeric "%"

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


def flatten(children):
    def _flatten(seq):
        # there is a list from search_term and one from free_text, so flatten them.
        # Flatten each group in the list, since nodes can return multiple items
        for item in seq:
            if isinstance(item, list):
                yield from _flatten(item)
            else:
                yield item

    if not (children and isinstance(children, list) and isinstance(children[0], list)):
        return children

    children = [child for group in children for child in _flatten(group)]
    children = [_f for _f in _flatten(children) if _f]

    return children


def remove_optional_nodes(children):
    def is_not_optional(child):
        return not (isinstance(child, Node) and isinstance(child.expr, Optional))

    return filter(is_not_optional, children)


def remove_space(children):
    def is_not_space(text):
        return not (isinstance(text, str) and text == " " * len(text))

    return filter(is_not_space, children)


def process_list(first, remaining):
    # Empty values become blank nodes
    if any(isinstance(item[4], Node) for item in remaining):
        raise InvalidSearchQuery("Lists should not have empty values")

    return [
        first,
        *(item[4][0] for item in remaining),
    ]


def is_negated(node):
    # Because negations are always optional, parsimonious returns a list of nodes
    # containing one node when a negation exists, and a single node when it doesn't.
    if isinstance(node, list):
        node = node[0]

    return node.text == "!"


def handle_negation(negation, operator):
    if isinstance(operator, Node):
        operator = "="
    elif not isinstance(operator, str):
        operator = operator[0]
    if is_negated(negation):
        return OPERATOR_NEGATION_MAP.get(operator, "!=")
    return operator


class SearchBoolean(namedtuple("SearchBoolean", "left_term operator right_term")):
    BOOLEAN_AND = "AND"
    BOOLEAN_OR = "OR"

    @staticmethod
    def is_operator(value):
        return value == SearchBoolean.BOOLEAN_AND or value == SearchBoolean.BOOLEAN_OR


class ParenExpression(namedtuple("ParenExpression", "children")):
    pass


class SearchKey(NamedTuple):
    name: str

    @property
    def is_tag(self) -> bool:
        return TAG_KEY_RE.match(self.name) or (
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


class SearchValue(NamedTuple):
    raw_value: Union[str, int, datetime, Sequence[int], Sequence[str]]

    @property
    def value(self):
        if self.is_wildcard():
            return translate_wildcard(self.raw_value)
        elif isinstance(self.raw_value, str):
            return translate_escape_sequences(self.raw_value)
        return self.raw_value

    def is_wildcard(self) -> bool:
        if not isinstance(self.raw_value, str):
            return False
        return bool(WILDCARD_CHARS.search(self.raw_value))

    def is_event_id(self) -> bool:
        """Return whether the current value is a valid event id

        Empty strings are valid, so that it can be used for has:id queries
        """
        if not isinstance(self.raw_value, str):
            return False
        return is_event_id(self.raw_value) or self.raw_value == ""


class SearchFilter(NamedTuple):
    key: SearchKey
    operator: str
    value: SearchValue

    def __str__(self):
        return "".join(map(str, (self.key.name, self.operator, self.value.raw_value)))

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


class AggregateFilter(NamedTuple):
    key: SearchKey
    operator: str
    value: SearchValue

    def __str__(self):
        return "".join(map(str, (self.key.name, self.operator, self.value.raw_value)))


class AggregateKey(NamedTuple):
    name: str


@dataclass
class SearchConfig:
    """
    Configures how the search parser interprets a search query
    """

    # <target_name>: [<list of source names>]
    key_mappings: Mapping[str, List[str]] = field(default_factory=dict)

    # Text keys we allow operators to be used on
    text_operator_keys: Set[str] = field(default_factory=set)

    # Keys which are considered valid for duration filters
    duration_keys: Set[str] = field(default_factory=set)

    # Keys considered valid for the percentage aggregate and may have
    # percentage search values
    percentage_keys: Set[str] = field(default_factory=set)

    # Keys considered valid for numeric filter types
    numeric_keys: Set[str] = field(default_factory=set)

    # Keys considered valid for date filter types
    date_keys: Set[str] = field(default_factory=set)

    # Keys considered valid for boolean filter types
    boolean_keys: Set[str] = field(default_factory=set)

    # A mapping of string values that may be provided to `is:<value>` which
    # translates to a pair of SearchKey + SearchValue's. An empty list disables
    # this feature for the search
    is_filter_translation: Mapping[str, Tuple[str, Any]] = field(default_factory=dict)

    # Enables boolean filtering (AND / OR)
    allow_boolean = True

    # Allows us to specify an allowlist of keys we will accept for this search.
    # If empty, allow all keys.
    allowed_keys: Set[str] = field(default_factory=set)

    # Which key we should return any free text under
    free_text_key = "message"

    @classmethod
    def create_from(cls, search_config: "SearchConfig", **overrides):
        config = cls(**asdict(search_config))
        for key, val in overrides.items():
            setattr(config, key, val)
        return config


class SearchVisitor(NodeVisitor):
    unwrapped_exceptions = (InvalidSearchQuery,)

    def __init__(self, config=None, params=None):
        super().__init__()

        if config is None:
            config = SearchConfig()
        self.config = config
        self.params = params if params is not None else {}

    @cached_property
    def key_mappings_lookup(self):
        lookup = {}
        for target_field, source_fields in self.config.key_mappings.items():
            for source_field in source_fields:
                lookup[source_field] = target_field
        return lookup

    def is_numeric_key(self, key):
        return key in self.config.numeric_keys or is_measurement(key) or is_span_op_breakdown(key)

    def is_duration_key(self, key):
        return (
            key in self.config.duration_keys
            or is_duration_measurement(key)
            or is_span_op_breakdown(key)
        )

    def is_date_key(self, key):
        return key in self.config.date_keys

    def is_boolean_key(self, key):
        return key in self.config.boolean_keys

    def is_percentage_key(self, key):
        return key in self.config.percentage_keys

    def visit_search(self, node, children):
        return flatten(remove_space(children[1]))

    def visit_term(self, node, children):
        return flatten(remove_space(children[0]))

    def visit_boolean_operator(self, node, children):
        if not self.config.allow_boolean:
            raise InvalidSearchQuery(
                'Boolean statements containing "OR" or "AND" are not supported in this search'
            )

        return children[0]

    def visit_free_text_unquoted(self, node, children):
        return node.text.strip(" ") or None

    def visit_free_text(self, node, children):
        if not children[0]:
            return None
        return SearchFilter(SearchKey(self.config.free_text_key), "=", SearchValue(children[0]))

    def visit_paren_group(self, node, children):
        if not self.config.allow_boolean:
            # It's possible to have a valid search that includes parens, so we
            # can't just error out when we find a paren expression.
            return SearchFilter(SearchKey(self.config.free_text_key), "=", SearchValue(node.text))

        children = remove_space(remove_optional_nodes(flatten(children)))
        children = flatten(children[1])
        if len(children) == 0:
            return node.text

        return ParenExpression(children)

    # --- Start of filter visitors

    def _handle_basic_filter(self, search_key, operator, search_value):
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

    def _handle_numeric_filter(self, search_key, operator, search_value):
        if isinstance(operator, Node):
            operator = "=" if isinstance(operator.expr, Optional) else operator.text
        else:
            operator = operator[0]

        if self.is_numeric_key(search_key.name):
            try:
                search_value = SearchValue(parse_numeric_value(*search_value))
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator, search_value)

        return self._handle_text_filter(search_key, operator, SearchValue("".join(search_value)))

    def visit_date_filter(self, node, children):
        (search_key, _, operator, search_value) = children

        if self.is_date_key(search_key.name):
            try:
                search_value = parse_datetime_string(search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator, SearchValue(search_value))

        search_value = operator + search_value if operator != "=" else search_value
        return self._handle_basic_filter(search_key, "=", SearchValue(search_value))

    def visit_specific_date_filter(self, node, children):
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

    def visit_rel_date_filter(self, node, children):
        (search_key, _, value) = children

        if self.is_date_key(search_key.name):
            try:
                from_val, to_val = parse_datetime_range(value.text)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))

            # TODO: Handle negations
            if from_val is not None:
                operator = ">="
                search_value = from_val[0]
            else:
                operator = "<="
                search_value = to_val[0]
            return SearchFilter(search_key, operator, SearchValue(search_value))

        return self._handle_basic_filter(search_key, "=", SearchValue(value.text))

    def visit_duration_filter(self, node, children):
        (search_key, sep, operator, search_value) = children

        operator = operator[0] if not isinstance(operator, Node) else "="
        if self.is_duration_key(search_key.name):
            try:
                search_value = parse_duration(*search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator, SearchValue(search_value))

        # Durations overlap with numeric `m` suffixes
        if self.is_numeric_key(search_key.name):
            return self._handle_numeric_filter(search_key, operator, search_value)

        search_value = "".join(search_value)
        search_value = operator + search_value if operator != "=" else search_value
        return self._handle_basic_filter(search_key, "=", SearchValue(search_value))

    def visit_boolean_filter(self, node, children):
        (negation, search_key, sep, search_value) = children
        negated = is_negated(negation)

        # Numeric and boolean filters overlap on 1 and 0 values.
        if self.is_numeric_key(search_key.name):
            return self._handle_numeric_filter(search_key, "=", [search_value.text, ""])

        if self.is_boolean_key(search_key.name):
            if search_value.text.lower() in ("true", "1"):
                search_value = SearchValue(0 if negated else 1)
            elif search_value.text.lower() in ("false", "0"):
                search_value = SearchValue(1 if negated else 0)
            else:
                raise InvalidSearchQuery(f"Invalid boolean field: {search_key}")
            return SearchFilter(search_key, "=", search_value)

        search_value = SearchValue(search_value.text)
        return self._handle_basic_filter(search_key, "=" if not negated else "!=", search_value)

    def visit_numeric_in_filter(self, node, children):
        (search_key, _, search_value) = children
        operator = "IN"

        if self.is_numeric_key(search_key.name):
            try:
                search_value = SearchValue([parse_numeric_value(*val) for val in search_value])
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator, search_value)

        search_value = SearchValue(["".join(value) for value in search_value])
        return self._handle_basic_filter(search_key, operator, search_value)

    def visit_numeric_filter(self, node, children):
        (search_key, _, operator, search_value) = children
        return self._handle_numeric_filter(search_key, operator, search_value)

    def visit_aggregate_duration_filter(self, node, children):
        (negation, search_key, _, operator, search_value) = children
        operator = handle_negation(negation, operator)

        try:
            # Even if the search value matches duration format, only act as
            # duration for certain columns
            function = resolve_field(search_key.name, self.params, functions_acl=FUNCTIONS.keys())

            is_duration_key = False
            if function.aggregate is not None:
                args = function.aggregate[1]
                if isinstance(args, list):
                    is_duration_key = all(self.is_duration_key(arg) for arg in args)
                else:
                    is_duration_key = self.is_duration_key(args)

            if is_duration_key:
                aggregate_value = parse_duration(*search_value)
            else:
                # Duration overlaps with numeric values with `m` (million vs
                # minutes). So we fall through to numeric if it's not a
                # duration key
                #
                # TODO(epurkhsier): Should we validate that the field is
                # numeric and do some other fallback if it's not?
                aggregate_value = parse_numeric_value(*search_value)
        except ValueError:
            raise InvalidSearchQuery(f"Invalid aggregate query condition: {search_key}")
        except InvalidQuery as exc:
            raise InvalidSearchQuery(str(exc))

        return AggregateFilter(search_key, operator, SearchValue(aggregate_value))

    def visit_aggregate_percentage_filter(self, node, children):
        (negation, search_key, _, operator, search_value) = children
        operator = handle_negation(negation, operator)

        aggregate_value = None

        try:
            # Even if the search value matches percentage format, only act as
            # percentage for certain columns
            function = resolve_field(search_key.name, self.params, functions_acl=FUNCTIONS.keys())
            if function.aggregate is not None and self.is_percentage_key(function.aggregate[0]):
                aggregate_value = parse_percentage(search_value)
        except ValueError:
            raise InvalidSearchQuery(f"Invalid aggregate query condition: {search_key}")
        except InvalidQuery as exc:
            raise InvalidSearchQuery(str(exc))

        if aggregate_value is not None:
            return AggregateFilter(search_key, operator, SearchValue(aggregate_value))

        # Invalid formats fall back to text match
        search_value = operator + search_value if operator != "=" else search_value
        return AggregateFilter(search_key, "=", SearchValue(search_value))

    def visit_aggregate_numeric_filter(self, node, children):
        (negation, search_key, _, operator, search_value) = children
        operator = handle_negation(negation, operator)

        try:
            aggregate_value = parse_numeric_value(*search_value)
        except InvalidQuery as exc:
            raise InvalidSearchQuery(str(exc))

        return AggregateFilter(search_key, operator, SearchValue(aggregate_value))

    def visit_aggregate_date_filter(self, node, children):
        (negation, search_key, _, operator, search_value) = children
        operator = handle_negation(negation, operator)
        is_date_aggregate = any(key in search_key.name for key in self.config.date_keys)
        if is_date_aggregate:
            try:
                search_value = parse_datetime_string(search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return AggregateFilter(search_key, operator, SearchValue(search_value))

        # Invalid formats fall back to text match
        search_value = operator + search_value if operator != "=" else search_value
        return AggregateFilter(search_key, "=", SearchValue(search_value))

    def visit_aggregate_rel_date_filter(self, node, children):
        (negation, search_key, _, operator, search_value) = children
        operator = handle_negation(negation, operator)
        is_date_aggregate = any(key in search_key.name for key in self.config.date_keys)
        if is_date_aggregate:
            try:
                from_val, to_val = parse_datetime_range(search_value.text)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))

            if from_val is not None:
                operator = ">="
                search_value = from_val[0]
            else:
                operator = "<="
                search_value = to_val[0]

            return AggregateFilter(search_key, operator, SearchValue(search_value))

        # Invalid formats fall back to text match
        search_value = operator + search_value.text if operator != "=" else search_value
        return AggregateFilter(search_key, "=", SearchValue(search_value))

    def visit_has_filter(self, node, children):
        # the key is has here, which we don't need
        negation, _, _, _, (search_key,) = children

        # if it matched search value instead, it's not a valid key
        if isinstance(search_key, SearchValue):
            raise InvalidSearchQuery(
                'Invalid format for "has" search: was expecting a field or tag instead'
            )

        operator = "=" if is_negated(negation) else "!="
        return SearchFilter(search_key, operator, SearchValue(""))

    def visit_is_filter(self, node, children):
        negation, _, _, _, search_value = children

        translators = self.config.is_filter_translation

        if not translators:
            raise InvalidSearchQuery('"is:" queries are not supported in this search.')

        if search_value.raw_value.startswith("["):
            raise InvalidSearchQuery('"in" syntax invalid for "is" search')

        if search_value.raw_value not in translators:
            valid_keys = sorted(translators.keys())
            raise InvalidSearchQuery(
                f'Invalid value for "is" search, valid values are {valid_keys}'
            )

        search_key, search_value = translators[search_value.raw_value]

        operator = "!=" if is_negated(negation) else "="
        search_key = SearchKey(search_key)
        search_value = SearchValue(search_value)

        return SearchFilter(search_key, operator, search_value)

    def visit_text_in_filter(self, node, children):
        (negation, search_key, _, search_value) = children
        operator = "IN"
        search_value = SearchValue(search_value)

        operator = handle_negation(negation, operator)

        return self._handle_basic_filter(search_key, operator, search_value)

    def visit_text_filter(self, node, children):
        (negation, search_key, _, operator, search_value) = children
        if isinstance(operator, Node):
            operator = "="
        else:
            operator = operator[0]

        # XXX: We check whether the text in the node itself is actually empty, so
        # we can tell the difference between an empty quoted string and no string
        if not search_value.raw_value and not node.children[4].text:
            raise InvalidSearchQuery(f"Empty string after '{search_key.name}:'")

        if operator not in ("=", "!=") and search_key.name not in self.config.text_operator_keys:
            # Operators are not supported in text_filter.
            # Push it back into the value before handing the negation.
            search_value = search_value._replace(raw_value=f"{operator}{search_value.raw_value}")
            operator = "="

        operator = handle_negation(negation, operator)

        return self._handle_text_filter(search_key, operator, search_value)

    def _handle_text_filter(self, search_key, operator, search_value):
        if operator not in ("=", "!=") and search_key.name not in self.config.text_operator_keys:
            # If operators aren't allowed for this key then push it back into the value
            search_value = search_value._replace(raw_value=f"{operator}{search_value.raw_value}")
            operator = "="

        return self._handle_basic_filter(search_key, operator, search_value)

    # --- End of filter visitors

    def visit_key(self, node, children):
        return node.text

    def visit_quoted_key(self, node, children):
        return children[1].text

    def visit_explicit_tag_key(self, node, children):
        return SearchKey(f"tags[{children[2].name}]")

    def visit_aggregate_key(self, node, children):
        children = remove_optional_nodes(children)
        children = remove_space(children)

        if len(children) == 3:
            (function_name, open_paren, close_paren) = children
            args = ""
        else:
            (function_name, open_paren, args, close_paren) = children
            args = ", ".join(args[0])

        key = "".join([function_name, open_paren, args, close_paren])
        return AggregateKey(self.key_mappings_lookup.get(key, key))

    def visit_function_args(self, node, children):
        return process_list(children[0], children[1])

    def visit_aggregate_param(self, node, children):
        return children[0]

    def visit_raw_aggregate_param(self, node, children):
        return node.text

    def visit_quoted_aggregate_param(self, node, children):
        value = "".join(node.text for node in flatten(children[1]))

        return f'"{value}"'

    def visit_search_key(self, node, children):
        key = children[0]
        if self.config.allowed_keys and key not in self.config.allowed_keys:
            raise InvalidSearchQuery("Invalid key for this search")
        return SearchKey(self.key_mappings_lookup.get(key, key))

    def visit_text_key(self, node, children):
        return children[0]

    def visit_value(self, node, children):
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

    def visit_quoted_value(self, node, children):
        value = "".join(node.text for node in flatten(children[1]))
        value = value.replace('\\"', '"')

        return value

    def visit_in_value(self, node, children):
        return node.text.replace('\\"', '"')

    def visit_text_in_value(self, node, children):
        return children[0]

    def visit_search_value(self, node, children):
        return SearchValue(children[0])

    def visit_numeric_value(self, node, children):
        (sign, value, suffix, _) = children
        sign = sign[0].text if isinstance(sign, list) else ""
        suffix = suffix[0].text if isinstance(suffix, list) else ""

        return [f"{sign}{value}", suffix]

    def visit_boolean_value(self, node, children):
        return node

    def visit_text_in_list(self, node, children):
        return process_list(children[1], children[2])

    def visit_numeric_in_list(self, node, children):
        return process_list(children[1], children[2])

    def visit_iso_8601_date_format(self, node, children):
        return node.text

    def visit_rel_date_format(self, node, children):
        return node

    def visit_duration_format(self, node, children):
        return [children[0], children[1][0].text]

    def visit_percentage_format(self, node, children):
        return children[0]

    def visit_operator(self, node, children):
        return node.text

    def visit_or_operator(self, node, children):
        return node.text.upper()

    def visit_and_operator(self, node, children):
        return node.text.upper()

    def visit_numeric(self, node, children):
        return node.text

    def visit_open_paren(self, node, children):
        return node.text

    def visit_closed_paren(self, node, children):
        return node.text

    def visit_open_bracket(self, node, children):
        return node.text

    def visit_closed_bracket(self, node, children):
        return node.text

    def visit_sep(self, node, children):
        return node

    def visit_negation(self, node, children):
        return node

    def visit_comma(self, node, children):
        return node

    def visit_spaces(self, node, children):
        return " "

    def generic_visit(self, node, children):
        return children or node


default_config = SearchConfig(
    duration_keys={"transaction.duration"},
    percentage_keys={"percentage"},
    text_operator_keys={SEMVER_ALIAS, SEMVER_BUILD_ALIAS},
    numeric_keys={
        "project_id",
        "project.id",
        "issue.id",
        "stack.colno",
        "stack.lineno",
        "stack.stack_level",
        "transaction.duration",
        "apdex",
        "p75",
        "p95",
        "p99",
        "failure_rate",
        "count_miserable",
        "user_misery",
        "count_miserable_new",
        "user_miser_new",
    },
    date_keys={
        "start",
        "end",
        "first_seen",
        "last_seen",
        "time",
        "timestamp",
        "timestamp.to_hour",
        "timestamp.to_day",
        "transaction.start_time",
        "transaction.end_time",
    },
    boolean_keys={
        "error.handled",
        "error.unhandled",
        "stack.in_app",
        TEAM_KEY_TRANSACTION_ALIAS,
    },
)


def parse_search_query(query, config=None, params=None) -> Sequence[SearchFilter]:
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
    return SearchVisitor(config, params=params).visit(tree)
