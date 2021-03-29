import re
from collections import namedtuple, defaultdict
from copy import deepcopy
from datetime import datetime

from django.utils.functional import cached_property
from parsimonious.expressions import Optional
from parsimonious.exceptions import IncompleteParseError, ParseError
from parsimonious.nodes import Node, RegexNode
from parsimonious.grammar import Grammar, NodeVisitor
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE

from sentry import eventstore
from sentry.discover.models import KeyTransaction
from sentry.models import Project
from sentry.models.group import Group
from sentry.search.utils import (
    parse_duration,
    parse_percentage,
    parse_datetime_range,
    parse_datetime_string,
    parse_datetime_value,
    parse_numeric_value,
    parse_release,
    InvalidQuery,
)
from sentry.snuba.dataset import Dataset
from sentry.utils.dates import to_timestamp
from sentry.utils.snuba import (
    DATASETS,
    FUNCTION_TO_OPERATOR,
    get_json_type,
    is_measurement,
    is_duration_measurement,
    OPERATOR_TO_FUNCTION,
    SNUBA_AND,
    SNUBA_OR,
)
from sentry.utils.compat import filter, map, zip


WILDCARD_CHARS = re.compile(r"[\*]")
NEGATION_MAP = {
    "=": "!=",
    "<": ">=",
    "<=": ">",
    ">": "<=",
    ">=": "<",
}

RESULT_TYPES = {"duration", "string", "number", "integer", "percentage", "date"}


def translate(pat):
    """Translate a shell PATTERN to a regular expression.
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
        # TODO: We're disabling everything except for wildcard matching for the
        # moment. Just commenting this code out for the moment, since there's a
        # reasonable chance we'll add this back in in the future.
        # elif c == '?':
        #     res = res + '.'
        # elif c == '[':
        #     j = i
        #     if j < n and pat[j] == '!':
        #         j = j + 1
        #     if j < n and pat[j] == ']':
        #         j = j + 1
        #     while j < n and pat[j] != ']':
        #         j = j + 1
        #     if j >= n:
        #         res = res + '\\['
        #     else:
        #         stuff = pat[i:j].replace('\\', '\\\\')
        #         i = j + 1
        #         if stuff[0] == '!':
        #             stuff = '^' + stuff[1:]
        #         elif stuff[0] == '^':
        #             stuff = '\\' + stuff
        #         res = '%s[%s]' % (res, stuff)
        # In py3.7 only characters that can have special meaning in a regular expression are escaped
        # introduced that here so we don't escape those either
        # https://github.com/python/cpython/blob/3.7/Lib/re.py#L252
        elif c in "()[]?*+-|^$\\.&~# \t\n\r\v\f":
            res += re.escape(c)
        else:
            res += c
    return "^" + res + "$"


# Explanation of quoted string regex, courtesy of Matt
# "              // literal quote
# (              // begin capture group
#   (?:          // begin uncaptured group
#     [^"]       // any character that's not quote
#     |          // or
#     (?<=\\)["] // A quote, preceded by a \ (for escaping)
#   )            // end uncaptured group
#   *            // repeat the uncaptured group
# )              // end captured group
# ?              // allow to be empty (allow empty quotes)
# "              // quote literal

event_search_grammar = Grammar(
    r"""
search               = (boolean_operator / paren_term / search_term)*
boolean_operator     = spaces (or_operator / and_operator) spaces
paren_term           = spaces open_paren spaces (paren_term / boolean_operator / search_term)+ spaces closed_paren spaces
search_term          = key_val_term / quoted_raw_search / raw_search
key_val_term         = spaces (tag_filter / time_filter / rel_time_filter / specific_time_filter
                       / duration_filter / boolean_filter / numeric_filter
                       / aggregate_filter / aggregate_date_filter / aggregate_rel_date_filter
                       / has_filter / is_filter / quoted_basic_filter / basic_filter)
                       spaces
raw_search           = (!key_val_term ~r"\ *(?!(?i)OR(?![^\s]))(?!(?i)AND(?![^\s]))([^\ ^\n ()]+)\ *" )*
quoted_raw_search    = spaces quoted_value spaces

# standard key:val filter
basic_filter         = negation? search_key sep search_value
quoted_basic_filter  = negation? search_key sep quoted_value
# filter for dates
time_filter          = search_key sep? operator (date_format / alt_date_format)
# filter for relative dates
rel_time_filter      = search_key sep rel_date_format
# filter for durations
duration_filter      = search_key sep operator? duration_format
# exact time filter for dates
specific_time_filter = search_key sep (date_format / alt_date_format)
# Numeric comparison filter
numeric_filter       = search_key sep operator? numeric_value
# Boolean comparison filter
boolean_filter       = negation? search_key sep boolean_value
# Aggregate numeric filter
aggregate_filter          = negation? aggregate_key sep operator? (duration_format / numeric_value / percentage_format)
aggregate_date_filter     = negation? aggregate_key sep operator? (date_format / alt_date_format)
aggregate_rel_date_filter = negation? aggregate_key sep operator? rel_date_format

# has filter for not null type checks
has_filter           = negation? "has" sep (search_key / search_value)
is_filter            = negation? "is" sep search_value
tag_filter           = negation? "tags[" search_key "]" sep search_value

aggregate_key        = key open_paren function_arg* closed_paren
search_key           = key / quoted_key
search_value         = quoted_value / value
value                = ~r"[^()\s]*"
numeric_value        = ~r"([-]?[0-9\.]+)([k|m|b])?(?=\s|\)|$)"
boolean_value        = ~r"(true|1|false|0)(?=\s|\)|$)"i
quoted_value         = ~r"\"((?:[^\"]|(?<=\\)[\"])*)?\""s
key                  = ~r"[a-zA-Z0-9_\.-]+"
function_arg         = space? key? comma? space?
# only allow colons in quoted keys
quoted_key           = ~r"\"([a-zA-Z0-9_\.:-]+)\""

date_format          = ~r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,6})?)?Z?(?=\s|\)|$)"
alt_date_format      = ~r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(\+\d{2}:\d{2})?)?(?=\s|\)|$)"
rel_date_format      = ~r"[\+\-][0-9]+[wdhm](?=\s|\)|$)"
duration_format      = ~r"([0-9\.]+)(ms|s|min|m|hr|h|day|d|wk|w)(?=\s|\)|$)"
percentage_format    = ~r"([0-9\.]+)%"

# NOTE: the order in which these operators are listed matters
# because for example, if < comes before <= it will match that
# even if the operator is <=
or_operator          = ~r"OR(?![^\s])"i
and_operator         = ~r"AND(?![^\s])"i
operator             = ">=" / "<=" / ">" / "<" / "=" / "!="
open_paren           = "("
closed_paren         = ")"
sep                  = ":"
space                = " "
negation             = "!"
comma                = ","
spaces               = ~r"\ *"
"""
)


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

no_conversion = {"start", "end"}

PROJECT_NAME_ALIAS = "project.name"
PROJECT_ALIAS = "project"
ISSUE_ALIAS = "issue"
ISSUE_ID_ALIAS = "issue.id"
RELEASE_ALIAS = "release"
USER_DISPLAY_ALIAS = "user.display"
ERROR_UNHANDLED_ALIAS = "error.unhandled"
KEY_TRANSACTION_ALIAS = "key_transaction"
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


class InvalidSearchQuery(Exception):
    pass


class SearchBoolean(namedtuple("SearchBoolean", "left_term operator right_term")):
    BOOLEAN_AND = "AND"
    BOOLEAN_OR = "OR"

    @staticmethod
    def is_operator(value):
        return value == SearchBoolean.BOOLEAN_AND or value == SearchBoolean.BOOLEAN_OR


class ParenExpression(namedtuple("ParenExpression", "children")):
    pass


class SearchFilter(namedtuple("SearchFilter", "key operator value")):
    def __str__(self):
        return "".join(map(str, (self.key.name, self.operator, self.value.raw_value)))

    @cached_property
    def is_negation(self):
        # Negations are mostly just using != operators. But we also have
        # negations on has: filters, which translate to = '', so handle that
        # case as well.
        return (
            self.operator == "!="
            and self.value.raw_value != ""
            or self.operator == "="
            and self.value.raw_value == ""
        )


class SearchKey(namedtuple("SearchKey", "name")):
    @cached_property
    def is_tag(self):
        return TAG_KEY_RE.match(self.name) or (
            self.name not in SEARCH_MAP
            and self.name not in FIELD_ALIASES
            and not self.is_measurement
        )

    @cached_property
    def is_measurement(self):
        return is_measurement(self.name) and self.name not in SEARCH_MAP


class AggregateFilter(namedtuple("AggregateFilter", "key operator value")):
    def __str__(self):
        return "".join(map(str, (self.key.name, self.operator, self.value.raw_value)))


class AggregateKey(namedtuple("AggregateKey", "name")):
    pass


class SearchValue(namedtuple("SearchValue", "raw_value")):
    @property
    def value(self):
        if self.is_wildcard():
            return translate(self.raw_value)
        return self.raw_value

    def is_wildcard(self):
        if not isinstance(self.raw_value, str):
            return False
        return bool(WILDCARD_CHARS.search(self.raw_value))


class SearchVisitor(NodeVisitor):
    # A list of mappers that map source keys to a target name. Format is
    # <target_name>: [<list of source names>],
    key_mappings = {}
    duration_keys = {"transaction.duration"}
    percentage_keys = {"percentage"}
    numeric_keys = {
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
        "user_misery",
        "user_misery_prototype",
    }
    date_keys = {
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
    }
    boolean_keys = {"error.handled", "error.unhandled", "stack.in_app", KEY_TRANSACTION_ALIAS}

    unwrapped_exceptions = (InvalidSearchQuery,)

    def __init__(self, allow_boolean=True, params=None):
        self.allow_boolean = allow_boolean
        self.params = params if params is not None else {}
        super().__init__()

    @cached_property
    def key_mappings_lookup(self):
        lookup = {}
        for target_field, source_fields in self.key_mappings.items():
            for source_field in source_fields:
                lookup[source_field] = target_field
        return lookup

    def flatten(self, children):
        def _flatten(seq):
            # there is a list from search_term and one from raw_search, so flatten them.
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

    def remove_optional_nodes(self, children):
        def is_not_optional(child):
            return not (isinstance(child, Node) and isinstance(child.expr, Optional))

        return filter(is_not_optional, children)

    def remove_space(self, children):
        def is_not_space(child):
            return not (isinstance(child, Node) and child.text == " " * len(child.text))

        return filter(is_not_space, children)

    def is_numeric_key(self, key):
        return key in self.numeric_keys or is_measurement(key)

    def is_duration_key(self, key):
        return key in self.duration_keys or is_duration_measurement(key)

    def is_percentage_key(self, key):
        return key in self.percentage_keys

    def visit_search(self, node, children):
        return self.flatten(children)

    def visit_key_val_term(self, node, children):
        _, key_val_term, _ = children
        # key_val_term is a list because of group
        return key_val_term[0]

    def visit_raw_search(self, node, children):
        value = node.text.strip(" ")
        if not value:
            return None

        return SearchFilter(SearchKey("message"), "=", SearchValue(value))

    def visit_quoted_raw_search(self, node, children):
        value = children[1]
        if not value:
            return None
        return SearchFilter(SearchKey("message"), "=", SearchValue(value))

    def visit_paren_term(self, node, children):
        if not self.allow_boolean:
            # It's possible to have a valid search that includes parens, so we can't just error out when we find a paren expression.
            return self.visit_raw_search(node, children)

        children = self.remove_space(self.remove_optional_nodes(self.flatten(children)))
        children = self.flatten(children[1])
        if len(children) == 0:
            return node.text

        return ParenExpression(children)

    def visit_boolean_filter(self, node, children):
        (negation, search_key, sep, search_value) = children
        is_negated = self.is_negated(negation)

        # Numeric and boolean filters overlap on 1 and 0 values.
        if self.is_numeric_key(search_key.name):
            return self.visit_numeric_filter(node, (search_key, sep, "=", search_value))

        if search_key.name in self.boolean_keys:
            if search_value.text.lower() in ("true", "1"):
                search_value = SearchValue(0 if is_negated else 1)
            elif search_value.text.lower() in ("false", "0"):
                search_value = SearchValue(1 if is_negated else 0)
            else:
                raise InvalidSearchQuery(f"Invalid boolean field: {search_key}")
            return SearchFilter(search_key, "=", search_value)
        else:
            search_value = SearchValue(search_value.text)
            return self._handle_basic_filter(
                search_key, "=" if not is_negated else "!=", search_value
            )

    def visit_numeric_filter(self, node, children):
        (search_key, _, operator, search_value) = children
        operator = operator[0] if not isinstance(operator, Node) else "="

        if self.is_numeric_key(search_key.name):
            try:
                search_value = SearchValue(parse_numeric_value(*search_value.match.groups()))
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator, search_value)
        else:
            search_value = SearchValue(
                operator + search_value.text if operator != "=" else search_value.text
            )
            return self._handle_basic_filter(search_key, "=", search_value)

    def handle_negation(self, negation, operator):
        operator = operator[0] if not isinstance(operator, Node) else "="
        if self.is_negated(negation):
            return NEGATION_MAP.get(operator, "!=")
        return operator

    def visit_aggregate_filter(self, node, children):
        (negation, search_key, _, operator, search_value) = children
        operator = self.handle_negation(negation, operator)
        search_value = search_value[0] if not isinstance(search_value, RegexNode) else search_value

        try:
            aggregate_value = None
            if search_value.expr_name in ["duration_format", "percentage_format"]:
                # Even if the search value matches duration format, only act as duration for certain columns
                function = resolve_field(
                    search_key.name, self.params, functions_acl=FUNCTIONS.keys()
                )
                if function.aggregate is not None:
                    if search_value.expr_name == "percentage_format" and self.is_percentage_key(
                        function.aggregate[0]
                    ):
                        aggregate_value = parse_percentage(*search_value.match.groups())
                    # Extract column and function name out so we can check if we should parse as duration
                    elif search_value.expr_name == "duration_format" and self.is_duration_key(
                        function.aggregate[1]
                    ):
                        aggregate_value = parse_duration(*search_value.match.groups())

            if aggregate_value is None:
                aggregate_value = parse_numeric_value(*search_value.match.groups())
        except ValueError:
            raise InvalidSearchQuery(f"Invalid aggregate query condition: {search_key}")
        except InvalidQuery as exc:
            raise InvalidSearchQuery(str(exc))
        return AggregateFilter(search_key, operator, SearchValue(aggregate_value))

    def visit_aggregate_date_filter(self, node, children):
        (negation, search_key, _, operator, search_value) = children
        search_value = search_value[0]
        operator = self.handle_negation(negation, operator)
        is_date_aggregate = any(key in search_key.name for key in self.date_keys)
        if is_date_aggregate:
            try:
                search_value = parse_datetime_string(search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return AggregateFilter(search_key, operator, SearchValue(search_value))
        else:
            search_value = operator + search_value if operator != "=" else search_value
            return AggregateFilter(search_key, "=", SearchValue(search_value))

    def visit_aggregate_rel_date_filter(self, node, children):
        (negation, search_key, _, operator, search_value) = children
        operator = self.handle_negation(negation, operator)
        is_date_aggregate = any(key in search_key.name for key in self.date_keys)
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
        else:
            search_value = operator + search_value.text if operator != "=" else search_value
            return AggregateFilter(search_key, "=", SearchValue(search_value))

    def visit_time_filter(self, node, children):
        (search_key, _, operator, search_value) = children
        search_value = search_value[0]
        if search_key.name in self.date_keys:
            try:
                search_value = parse_datetime_string(search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator, SearchValue(search_value))
        else:
            search_value = operator + search_value if operator != "=" else search_value
            return self._handle_basic_filter(search_key, "=", SearchValue(search_value))

    def visit_duration_filter(self, node, children):
        (search_key, sep, operator, search_value) = children

        operator = operator[0] if not isinstance(operator, Node) else "="
        if self.is_duration_key(search_key.name):
            try:
                search_value = parse_duration(*search_value.match.groups())
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator, SearchValue(search_value))
        elif self.is_numeric_key(search_key.name):
            return self.visit_numeric_filter(node, (search_key, sep, operator, search_value))
        else:
            search_value = operator + search_value.text if operator != "=" else search_value.text
            return self._handle_basic_filter(search_key, "=", SearchValue(search_value))

    def visit_rel_time_filter(self, node, children):
        (search_key, _, value) = children
        if search_key.name in self.date_keys:
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
        else:
            return self._handle_basic_filter(search_key, "=", SearchValue(value.text))

    def visit_specific_time_filter(self, node, children):
        # If we specify a specific date, it means any event on that day, and if
        # we specify a specific datetime then it means a few minutes interval
        # on either side of that datetime
        (search_key, _, date_value) = children
        date_value = date_value[0]

        if search_key.name not in self.date_keys:
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

    def visit_operator(self, node, children):
        return node.text

    def visit_date_format(self, node, children):
        return node.text

    def visit_alt_date_format(self, node, children):
        return node.text

    def is_negated(self, node):
        # Because negations are always optional, parsimonious returns a list of nodes
        # containing one node when a negation exists, and a single node when it doesn't.
        if isinstance(node, list):
            node = node[0]

        return node.text == "!"

    def visit_quoted_basic_filter(self, node, children):
        (negation, search_key, _, search_value) = children
        operator = "!=" if self.is_negated(negation) else "="
        search_value = SearchValue(search_value)
        return self._handle_basic_filter(search_key, operator, search_value)

    def visit_basic_filter(self, node, children):
        (negation, search_key, _, search_value) = children
        operator = "!=" if self.is_negated(negation) else "="
        if not search_value.raw_value:
            raise InvalidSearchQuery(f"Empty string after '{search_key.name}:'")

        return self._handle_basic_filter(search_key, operator, search_value)

    def _handle_basic_filter(self, search_key, operator, search_value):
        # If a date or numeric key gets down to the basic filter, then it means
        # that the value wasn't in a valid format, so raise here.
        if search_key.name in self.date_keys:
            raise InvalidSearchQuery(
                f"{search_key.name}: Invalid date: {search_value.raw_value}. Expected +/-duration (e.g. +1h) or ISO 8601-like (e.g. {datetime.now().isoformat()[:-4]})."
            )
        if search_key.name in self.boolean_keys:
            raise InvalidSearchQuery(
                f"{search_key.name}: Invalid boolean: {search_value.raw_value}. Expected true, 1, false, or 0."
            )
        if self.is_numeric_key(search_key.name):
            raise InvalidSearchQuery(
                f"{search_key.name}: Invalid number: {search_value.raw_value}. Expected number then optional k, m, or b suffix (e.g. 500k)."
            )

        return SearchFilter(search_key, operator, search_value)

    def visit_has_filter(self, node, children):
        # the key is has here, which we don't need
        negation, _, _, (search_key,) = children

        # if it matched search value instead, it's not a valid key
        if isinstance(search_key, SearchValue):
            raise InvalidSearchQuery(
                'Invalid format for "has" search: was expecting a field or tag instead'
            )

        operator = "=" if self.is_negated(negation) else "!="
        return SearchFilter(search_key, operator, SearchValue(""))

    def visit_tag_filter(self, node, children):
        (negation, _, search_key, _, sep, search_value) = children
        operator = "!=" if self.is_negated(negation) else "="
        return SearchFilter(SearchKey(f"tags[{search_key.name}]"), operator, search_value)

    def visit_is_filter(self, node, children):
        raise InvalidSearchQuery('"is:" queries are only supported in issue search.')

    def visit_search_key(self, node, children):
        key = children[0]
        return SearchKey(self.key_mappings_lookup.get(key, key))

    def visit_aggregate_key(self, node, children):
        children = self.flatten(children)
        children = self.remove_optional_nodes(children)
        children = self.remove_space(children)

        if len(children) == 3:
            (function_name, open_paren, close_paren) = children
            args = ""
        else:
            (function_name, open_paren, args, close_paren) = children

        if isinstance(args, Node):
            args = ""
        elif isinstance(args, list):
            args = "".join(args)

        key = "".join([function_name, open_paren, args, close_paren])
        return AggregateKey(self.key_mappings_lookup.get(key, key))

    def visit_function_arg(self, node, children):
        return node.text

    def visit_search_value(self, node, children):
        return SearchValue(children[0])

    def visit_closed_paren(self, node, children):
        return node.text

    def visit_open_paren(self, node, children):
        return node.text

    def visit_boolean_operator(self, node, children):
        if not self.allow_boolean:
            raise InvalidSearchQuery(
                'Boolean statements containing "OR" or "AND" are not supported in this search'
            )

        children = self.flatten(self.remove_space(children))
        return children[0].text.upper()

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

    def visit_key(self, node, children):
        return node.text

    def visit_quoted_value(self, node, children):
        return node.match.groups()[0].replace('\\"', '"')

    def visit_quoted_key(self, node, children):
        return node.match.groups()[0]

    def generic_visit(self, node, children):
        return children or node


def parse_search_query(query, allow_boolean=True, params=None):
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
    return SearchVisitor(allow_boolean, params=params).visit(tree)


def convert_aggregate_filter_to_snuba_query(aggregate_filter, params):
    name = aggregate_filter.key.name
    value = aggregate_filter.value.value

    if params is not None and name in params.get("aliases", {}):
        return params["aliases"][name].converter(aggregate_filter)

    value = (
        int(to_timestamp(value)) if isinstance(value, datetime) and name != "timestamp" else value
    )

    if aggregate_filter.operator in ("=", "!=") and aggregate_filter.value.value == "":
        return [["isNull", [name]], aggregate_filter.operator, 1]

    function = resolve_field(name, params, functions_acl=FUNCTIONS.keys())
    if function.aggregate is not None:
        name = function.aggregate[-1]

    condition = [name, aggregate_filter.operator, value]
    return condition


def convert_search_filter_to_snuba_query(search_filter, key=None, params=None):
    name = search_filter.key.name if key is None else key
    value = search_filter.value.value

    # We want to use group_id elsewhere so shouldn't be removed from the dataset
    # but if a user has a tag with the same name we want to make sure that works
    if name in {"group_id"}:
        name = f"tags[{name}]"

    if name in no_conversion:
        return
    elif name == "id" and search_filter.value.is_wildcard():
        raise InvalidSearchQuery("Wildcard conditions are not permitted on `id` field.")
    elif name == "environment":
        # conditions added to env_conditions are OR'd
        env_conditions = []

        values = set(value if isinstance(value, (list, tuple)) else [value])
        # the "no environment" environment is null in snuba
        if "" in values:
            values.remove("")
            operator = "IS NULL" if search_filter.operator == "=" else "IS NOT NULL"
            env_conditions.append(["environment", operator, None])
        if len(values) == 1:
            operator = "=" if search_filter.operator == "=" else "!="
            env_conditions.append(["environment", operator, values.pop()])
        elif values:
            operator = "IN" if search_filter.operator == "=" else "NOT IN"
            env_conditions.append(["environment", operator, values])
        return env_conditions
    elif name == "message":
        if search_filter.value.is_wildcard():
            # XXX: We don't want the '^$' values at the beginning and end of
            # the regex since we want to find the pattern anywhere in the
            # message. Strip off here
            value = search_filter.value.value[1:-1]
            return [["match", ["message", f"'(?i){value}'"]], search_filter.operator, 1]
        elif value == "":
            operator = "=" if search_filter.operator == "=" else "!="
            return [["equals", ["message", f"{value}"]], operator, 1]
        else:
            # https://clickhouse.yandex/docs/en/query_language/functions/string_search_functions/#position-haystack-needle
            # positionCaseInsensitive returns 0 if not found and an index of 1 or more if found
            # so we should flip the operator here
            operator = "=" if search_filter.operator == "!=" else "!="
            # make message search case insensitive
            return [["positionCaseInsensitive", ["message", f"'{value}'"]], operator, 0]
    elif (
        name.startswith("stack.") or name.startswith("error.")
    ) and search_filter.value.is_wildcard():
        # Escape and convert meta characters for LIKE expressions.
        raw_value = search_filter.value.raw_value
        like_value = raw_value.replace("%", "\\%").replace("_", "\\_").replace("*", "%")
        operator = "LIKE" if search_filter.operator == "=" else "NOT LIKE"
        return [name, operator, like_value]
    elif name == "transaction.status":
        # Handle "has" queries
        if search_filter.value.raw_value == "":
            return [["isNull", [name]], search_filter.operator, 1]

        internal_value = SPAN_STATUS_NAME_TO_CODE.get(search_filter.value.raw_value)
        if internal_value is None:
            raise InvalidSearchQuery(
                "Invalid value for transaction.status condition. Accepted values are {}".format(
                    ", ".join(SPAN_STATUS_NAME_TO_CODE.keys())
                )
            )
        return [name, search_filter.operator, internal_value]
    elif name == "issue.id":
        # Handle "has" queries
        if search_filter.value.raw_value == "":
            if search_filter.operator == "=":
                # The state of having no issues is represented differently on transactions vs
                # other events. On the transactions table, it is represented by 0 whereas it is
                # represented by NULL everywhere else. This means we have to check for both 0
                # or NULL.
                return [
                    [["isNull", [name]], search_filter.operator, 1],
                    [name, search_filter.operator, 0],
                ]
            else:
                # Based the reasoning above, we should be checking that it is not 0 and not NULL.
                # However, because NULL != 0 evaluates to NULL in Clickhouse, we can simplify it
                # to check just not 0.
                return [name, search_filter.operator, 0]

        # Skip isNull check on group_id value as we want to
        # allow snuba's prewhere optimizer to find this condition.
        return [name, search_filter.operator, value]
    elif name == USER_DISPLAY_ALIAS:
        user_display_expr = FIELD_ALIASES[USER_DISPLAY_ALIAS].get_expression(params)

        # Handle 'has' condition
        if search_filter.value.raw_value == "":
            return [["isNull", [user_display_expr]], search_filter.operator, 1]
        if search_filter.value.is_wildcard():
            return [
                ["match", [user_display_expr, f"'(?i){value}'"]],
                search_filter.operator,
                1,
            ]
        return [user_display_expr, search_filter.operator, value]
    elif name == ERROR_UNHANDLED_ALIAS:
        # This field is the inversion of error.handled, otherwise the logic is the same.
        if search_filter.value.raw_value == "":
            output = 0 if search_filter.operator == "!=" else 1
            return [["isHandled", []], "=", output]
        if value in ("1", 1):
            return [["notHandled", []], "=", 1]
        if value in ("0", 0):
            return [["isHandled", []], "=", 1]
        raise InvalidSearchQuery(
            "Invalid value for error.unhandled condition. Accepted values are 1, 0"
        )
    elif name == "error.handled":
        # Treat has filter as equivalent to handled
        if search_filter.value.raw_value == "":
            output = 1 if search_filter.operator == "!=" else 0
            return [["isHandled", []], "=", output]
        # Null values and 1 are the same, and both indicate a handled error.
        if value in ("1", 1):
            return [["isHandled", []], "=", 1]
        if value in (
            "0",
            0,
        ):
            return [["notHandled", []], "=", 1]
        raise InvalidSearchQuery(
            "Invalid value for error.handled condition. Accepted values are 1, 0"
        )
    elif name == KEY_TRANSACTION_ALIAS:
        key_transaction_expr = FIELD_ALIASES[KEY_TRANSACTION_ALIAS].get_expression(params)

        if search_filter.value.raw_value == "":
            operator = "!=" if search_filter.operator == "!=" else "="
            return [key_transaction_expr, operator, 0]
        if value in ("1", 1):
            return [key_transaction_expr, "=", 1]
        if value in ("0", 0):
            return [key_transaction_expr, "=", 0]
        raise InvalidSearchQuery(
            "Invalid value for key_transaction condition. Accepted values are 1, 0"
        )
    elif name in ARRAY_FIELDS and search_filter.value.raw_value == "":
        return [["notEmpty", [name]], "=", 1 if search_filter.operator == "!=" else 0]
    else:
        # timestamp{,.to_{hour,day}} need a datetime string
        # last_seen needs an integer
        if isinstance(value, datetime) and name not in {
            "timestamp",
            "timestamp.to_hour",
            "timestamp.to_day",
        }:
            value = int(to_timestamp(value)) * 1000

        # most field aliases are handled above but timestamp.to_{hour,day} are
        # handled here
        if name in FIELD_ALIASES:
            name = FIELD_ALIASES[name].get_expression(params)

        # Tags are never null, but promoted tags are columns and so can be null.
        # To handle both cases, use `ifNull` to convert to an empty string and
        # compare so we need to check for empty values.
        if search_filter.key.is_tag:
            name = ["ifNull", [name, "''"]]

        # Handle checks for existence
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            if search_filter.key.is_tag:
                return [name, search_filter.operator, value]
            else:
                # If not a tag, we can just check that the column is null.
                return [["isNull", [name]], search_filter.operator, 1]

        is_null_condition = None
        # TODO(wmak): Skip this for all non-nullable keys not just event.type
        if search_filter.operator == "!=" and not search_filter.key.is_tag and name != "event.type":
            # Handle null columns on inequality comparisons. Any comparison
            # between a value and a null will result to null, so we need to
            # explicitly check for whether the condition is null, and OR it
            # together with the inequality check.
            # We don't need to apply this for tags, since if they don't exist
            # they'll always be an empty string.
            is_null_condition = [["isNull", [name]], "=", 1]

        if search_filter.value.is_wildcard():
            condition = [["match", [name, f"'(?i){value}'"]], search_filter.operator, 1]
        else:
            condition = [name, search_filter.operator, value]

        # We only want to return as a list if we have the check for null
        # present. Returning as a list causes these conditions to be ORed
        # together. Otherwise just return the raw condition, so that it can be
        # used correctly in aggregates.
        if is_null_condition:
            return [is_null_condition, condition]
        else:
            return condition


def to_list(value):
    if isinstance(value, list):
        return value
    return [value]


def format_search_filter(term, params):
    project_to_filter = None  # Used to avoid doing multiple conditions on project ID
    conditions = []
    group_ids = None
    name = term.key.name
    value = term.value.value
    if name in (PROJECT_ALIAS, PROJECT_NAME_ALIAS):
        if term.operator == "=" and value == "":
            raise InvalidSearchQuery("Invalid query for 'has' search: 'project' cannot be empty.")
        project = None
        try:
            project = Project.objects.get(id__in=params.get("project_id", []), slug=value)
        except Exception as e:
            if not isinstance(e, Project.DoesNotExist) or term.operator != "!=":
                raise InvalidSearchQuery(
                    f"Invalid query. Project {value} does not exist or is not an actively selected project."
                )
        else:
            # Create a new search filter with the correct values
            term = SearchFilter(SearchKey("project_id"), term.operator, SearchValue(project.id))
            converted_filter = convert_search_filter_to_snuba_query(term)
            if converted_filter:
                if term.operator == "=":
                    project_to_filter = project.id

                conditions.append(converted_filter)
    elif name == ISSUE_ID_ALIAS and value != "":
        # A blank term value means that this is a has filter
        group_ids = to_list(value)
    elif name == ISSUE_ALIAS:
        operator = term.operator
        if value == "unknown":
            # `unknown` is a special value for when there is no issue associated with the event
            operator = "=" if term.operator == "=" else "!="
            value = ""
        elif value != "" and params and "organization_id" in params:
            try:
                group = Group.objects.by_qualified_short_id(params["organization_id"], value)
            except Exception:
                raise InvalidSearchQuery(f"Invalid value '{value}' for 'issue:' filter")
            else:
                value = group.id
        term = SearchFilter(SearchKey("issue.id"), operator, SearchValue(value))
        converted_filter = convert_search_filter_to_snuba_query(term)
        conditions.append(converted_filter)
    elif name == RELEASE_ALIAS and params and value == "latest":
        converted_filter = convert_search_filter_to_snuba_query(
            SearchFilter(
                term.key,
                term.operator,
                SearchValue(
                    parse_release(
                        value,
                        params["project_id"],
                        params.get("environment_objects"),
                        params.get("organization_id"),
                    )
                ),
            )
        )
        if converted_filter:
            conditions.append(converted_filter)
    else:
        converted_filter = convert_search_filter_to_snuba_query(term, params=params)
        if converted_filter:
            conditions.append(converted_filter)

    return conditions, project_to_filter, group_ids


def convert_condition_to_function(cond):
    function = OPERATOR_TO_FUNCTION.get(cond[1])
    if not function:
        # It's hard to make this error more specific without exposing internals to the end user
        raise InvalidSearchQuery(f"Operator {cond[1]} is not a valid condition operator.")

    return [function, [cond[0], cond[2]]]


def convert_function_to_condition(func):
    operator = FUNCTION_TO_OPERATOR.get(func[0])
    if not operator:
        return [func, "=", 1]

    return [func[1][0], operator, func[1][1]]


def convert_array_to_tree(operator, terms):
    """
    Convert an array of conditions into a binary tree joined by the operator.
    """
    if len(terms) == 1:
        return terms[0]
    elif len(terms) == 2:
        return [operator, terms]

    return [operator, [terms[0], convert_array_to_tree(operator, terms[1:])]]


def flatten_condition_tree(tree, condition_function):
    """
    Take a binary tree of conditions, and flatten all of the terms using the condition function.
    E.g. f( and(and(b, c), and(d, e)), and ) -> [b, c, d, e]
    """
    stack = [tree]
    flattened = []
    while len(stack) > 0:
        item = stack.pop(0)
        if item[0] == condition_function:
            stack.extend(item[1])
        else:
            flattened.append(item)

    return flattened


def is_condition(term):
    return isinstance(term, (tuple, list)) and len(term) == 3 and term[1] in OPERATOR_TO_FUNCTION


def convert_snuba_condition_to_function(term, params=None):
    if isinstance(term, ParenExpression):
        return convert_search_boolean_to_snuba_query(term.children, params)

    group_ids = []
    projects_to_filter = []
    if isinstance(term, SearchFilter):
        conditions, project_to_filter, group_ids = format_search_filter(term, params)
        projects_to_filter = [project_to_filter] if project_to_filter else []
        group_ids = group_ids if group_ids else []
        if conditions:
            conditions_to_and = []
            for cond in conditions:
                if is_condition(cond):
                    conditions_to_and.append(convert_condition_to_function(cond))
                else:
                    conditions_to_and.append(
                        convert_array_to_tree(
                            SNUBA_OR, [convert_condition_to_function(c) for c in cond]
                        )
                    )

            condition_tree = None
            if len(conditions_to_and) == 1:
                condition_tree = conditions_to_and[0]
            elif len(conditions_to_and) > 1:
                condition_tree = convert_array_to_tree(SNUBA_AND, conditions_to_and)
            return condition_tree, None, projects_to_filter, group_ids
    elif isinstance(term, AggregateFilter):
        converted_filter = convert_aggregate_filter_to_snuba_query(term, params)
        return None, convert_condition_to_function(converted_filter), projects_to_filter, group_ids

    return None, None, projects_to_filter, group_ids


def convert_search_boolean_to_snuba_query(terms, params=None):
    if len(terms) == 1:
        return convert_snuba_condition_to_function(terms[0], params)

    # Filter out any ANDs since we can assume anything without an OR is an AND. Also do some
    # basic sanitization of the query: can't have two operators next to each other, and can't
    # start or end a query with an operator.
    prev = None
    new_terms = []
    for term in terms:
        if prev:
            if SearchBoolean.is_operator(prev) and SearchBoolean.is_operator(term):
                raise InvalidSearchQuery(
                    f"Missing condition in between two condition operators: '{prev} {term}'"
                )
        else:
            if SearchBoolean.is_operator(term):
                raise InvalidSearchQuery(
                    f"Condition is missing on the left side of '{term}' operator"
                )

        if term != SearchBoolean.BOOLEAN_AND:
            new_terms.append(term)
        prev = term
    if SearchBoolean.is_operator(term):
        raise InvalidSearchQuery(f"Condition is missing on the right side of '{term}' operator")
    terms = new_terms

    # We put precedence on AND, which sort of counter-intuitevely means we have to split the query
    # on ORs first, so the ANDs are grouped together. Search through the query for ORs and split the
    # query on each OR.
    # We want to maintain a binary tree, so split the terms on the first OR we can find and recurse on
    # the two sides. If there is no OR, split the first element out to AND
    index = None
    lhs, rhs = None, None
    operator = None
    try:
        index = terms.index(SearchBoolean.BOOLEAN_OR)
        lhs, rhs = terms[:index], terms[index + 1 :]
        operator = SNUBA_OR
    except Exception:
        lhs, rhs = terms[:1], terms[1:]
        operator = SNUBA_AND

    (
        lhs_condition,
        lhs_having,
        projects_to_filter,
        group_ids,
    ) = convert_search_boolean_to_snuba_query(lhs, params)
    (
        rhs_condition,
        rhs_having,
        rhs_projects_to_filter,
        rhs_group_ids,
    ) = convert_search_boolean_to_snuba_query(rhs, params)

    projects_to_filter.extend(rhs_projects_to_filter)
    group_ids.extend(rhs_group_ids)

    if operator == SNUBA_OR and (lhs_condition or rhs_condition) and (lhs_having or rhs_having):
        raise InvalidSearchQuery(
            "Having an OR between aggregate filters and normal filters is invalid."
        )

    condition, having = None, None
    if lhs_condition or rhs_condition:
        args = filter(None, [lhs_condition, rhs_condition])
        if not args:
            condition = None
        elif len(args) == 1:
            condition = args[0]
        else:
            condition = [operator, args]

    if lhs_having or rhs_having:
        args = filter(None, [lhs_having, rhs_having])
        if not args:
            having = None
        elif len(args) == 1:
            having = args[0]
        else:
            having = [operator, args]

    return condition, having, projects_to_filter, group_ids


def get_filter(query=None, params=None):
    """
    Returns an eventstore filter given the search text provided by the user and
    URL params
    """
    # NOTE: this function assumes project permissions check already happened
    parsed_terms = []
    if query is not None:
        try:
            parsed_terms = parse_search_query(query, allow_boolean=True, params=params)
        except ParseError as e:
            raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")

    kwargs = {
        "start": None,
        "end": None,
        "conditions": [],
        "having": [],
        "user_id": None,
        "organization_id": None,
        "project_ids": [],
        "group_ids": [],
        "condition_aggregates": [],
        "aliases": params.get("aliases", {}) if params is not None else {},
    }

    projects_to_filter = []
    if any(
        isinstance(term, ParenExpression) or SearchBoolean.is_operator(term)
        for term in parsed_terms
    ):
        (
            condition,
            having,
            found_projects_to_filter,
            group_ids,
        ) = convert_search_boolean_to_snuba_query(parsed_terms, params)

        if condition:
            and_conditions = flatten_condition_tree(condition, SNUBA_AND)
            for func in and_conditions:
                kwargs["conditions"].append(convert_function_to_condition(func))
        if having:
            kwargs["condition_aggregates"] = [
                term.key.name for term in parsed_terms if isinstance(term, AggregateFilter)
            ]
            and_having = flatten_condition_tree(having, SNUBA_AND)
            for func in and_having:
                kwargs["having"].append(convert_function_to_condition(func))
        if found_projects_to_filter:
            projects_to_filter = list(set(found_projects_to_filter))
        if group_ids is not None:
            kwargs["group_ids"].extend(list(set(group_ids)))
    else:
        for term in parsed_terms:
            if isinstance(term, SearchFilter):
                conditions, found_project_to_filter, group_ids = format_search_filter(term, params)
                if len(conditions) > 0:
                    kwargs["conditions"].extend(conditions)
                if found_project_to_filter:
                    projects_to_filter = [found_project_to_filter]
                if group_ids is not None:
                    kwargs["group_ids"].extend(group_ids)
            elif isinstance(term, AggregateFilter):
                converted_filter = convert_aggregate_filter_to_snuba_query(term, params)
                kwargs["condition_aggregates"].append(term.key.name)
                if converted_filter:
                    kwargs["having"].append(converted_filter)

    # Keys included as url params take precedent if same key is included in search
    # They are also considered safe and to have had access rules applied unlike conditions
    # from the query string.
    if params:
        for key in ("start", "end"):
            kwargs[key] = params.get(key, None)
        # OrganizationEndpoint.get_filter() uses project_id, but eventstore.Filter uses project_ids
        if "user_id" in params:
            kwargs["user_id"] = params["user_id"]
        if "organization_id" in params:
            kwargs["organization_id"] = params["organization_id"]
        if "project_id" in params:
            if projects_to_filter:
                kwargs["project_ids"] = projects_to_filter
            else:
                kwargs["project_ids"] = params["project_id"]
        if "environment" in params:
            term = SearchFilter(SearchKey("environment"), "=", SearchValue(params["environment"]))
            kwargs["conditions"].append(convert_search_filter_to_snuba_query(term))
        if "group_ids" in params:
            kwargs["group_ids"] = to_list(params["group_ids"])
        # Deprecated alias, use `group_ids` instead
        if ISSUE_ID_ALIAS in params:
            kwargs["group_ids"] = to_list(params["issue.id"])

    return eventstore.Filter(**kwargs)


class PseudoField:
    def __init__(self, name, alias, expression=None, expression_fn=None, result_type=None):
        self.name = name
        self.alias = alias
        self.expression = expression
        self.expression_fn = expression_fn
        self.result_type = result_type

        self.validate()

    def get_expression(self, params):
        if isinstance(self.expression, (list, tuple)):
            return deepcopy(self.expression)
        elif self.expression_fn is not None:
            return self.expression_fn(params)
        return None

    def get_field(self, params=None):
        expression = self.get_expression(params)
        if expression is not None:
            expression.append(self.alias)
            return expression
        return self.alias

    def validate(self):
        assert self.alias is not None, f"{self.name}: alias is required"
        assert (
            self.expression is None or self.expression_fn is None
        ), f"{self.name}: only one of expression, expression_fn is allowed"


def key_transaction_expression(user_id, organization_id, project_ids):
    """
    This function may be called multiple times, making for repeated data bases queries.
    Lifting the query higher to earlier in the call stack will require a lot more changes
    as there are numerous entry points. So we will leave the duplicate query alone for now.
    """
    if user_id is None or organization_id is None or project_ids is None:
        raise InvalidSearchQuery("Missing necessary meta for key transaction field.")

    key_transactions = (
        KeyTransaction.objects.filter(
            owner_id=user_id,
            organization_id=organization_id,
            project_id__in=project_ids,
        )
        .order_by("transaction", "project_id")
        .values("project_id", "transaction")
    )

    # if there are no key transactions, the value should always be 0
    if not len(key_transactions):
        return ["toInt64", [0]]

    return [
        "has",
        [
            [
                "array",
                [
                    [
                        "tuple",
                        [
                            ["toUInt64", [transaction["project_id"]]],
                            "'{}'".format(transaction["transaction"]),
                        ],
                    ]
                    for transaction in key_transactions
                ],
            ],
            ["tuple", ["project_id", "transaction"]],
        ],
    ]


# When updating this list, also check if the following need to be updated:
# - convert_search_filter_to_snuba_query (otherwise aliased field will be treated as tag)
# - static/app/utils/discover/fields.tsx FIELDS (for discover column list and search box autocomplete)
FIELD_ALIASES = {
    field.name: field
    for field in [
        PseudoField("project", "project.id"),
        PseudoField("issue", "issue.id"),
        PseudoField(
            "timestamp.to_hour", "timestamp.to_hour", expression=["toStartOfHour", ["timestamp"]]
        ),
        PseudoField(
            "timestamp.to_day", "timestamp.to_day", expression=["toStartOfDay", ["timestamp"]]
        ),
        PseudoField(ERROR_UNHANDLED_ALIAS, ERROR_UNHANDLED_ALIAS, expression=["notHandled", []]),
        PseudoField(
            USER_DISPLAY_ALIAS,
            USER_DISPLAY_ALIAS,
            expression=["coalesce", ["user.email", "user.username", "user.ip"]],
        ),
        # the key transaction field is intentially not added to the discover/fields list yet
        # because there needs to be some work on the front end to integrate this into discover
        PseudoField(
            KEY_TRANSACTION_ALIAS,
            KEY_TRANSACTION_ALIAS,
            expression_fn=lambda params: key_transaction_expression(
                params.get("user_id"),
                params.get("organization_id"),
                params.get("project_id"),
            ),
            result_type="boolean",
        ),
    ]
}


def get_json_meta_type(field_alias, snuba_type, function=None):
    alias_definition = FIELD_ALIASES.get(field_alias)
    if alias_definition and alias_definition.result_type is not None:
        return alias_definition.result_type

    snuba_json = get_json_type(snuba_type)
    if snuba_json != "string":
        if function is not None:
            result_type = function.instance.get_result_type(function.field, function.arguments)
            if result_type is not None:
                return result_type

        function_match = FUNCTION_ALIAS_PATTERN.match(field_alias)
        if function_match:
            function_definition = FUNCTIONS.get(function_match.group(1))
            if function_definition:
                result_type = function_definition.get_result_type()
                if result_type is not None:
                    return result_type

    if "duration" in field_alias or is_duration_measurement(field_alias):
        return "duration"
    if is_measurement(field_alias):
        return "number"
    if field_alias == "transaction.status":
        return "string"
    return snuba_json


# Based on general/src/protocol/tags.rs in relay
VALID_FIELD_PATTERN = re.compile(r"^[a-zA-Z0-9_.:-]*$")

# The regex for alias here is to match any word, but exclude anything that is only digits
# eg. 123 doesn't match, but test_123 will match
ALIAS_REGEX = r"(\w+)?(?!\d+)\w+"

ALIAS_PATTERN = re.compile(fr"{ALIAS_REGEX}$")
FUNCTION_PATTERN = re.compile(
    fr"^(?P<function>[^\(]+)\((?P<columns>.*)\)( (as|AS) (?P<alias>{ALIAS_REGEX}))?$"
)


class InvalidFunctionArgument(Exception):
    pass


class ArgValue:
    def __init__(self, arg):
        self.arg = arg


class FunctionArg:
    def __init__(self, name):
        self.name = name
        self.has_default = False

    def get_default(self, params):
        raise InvalidFunctionArgument(f"{self.name} has no defaults")

    def normalize(self, value, params):
        return value

    def get_type(self, value):
        raise InvalidFunctionArgument(f"{self.name} has no type defined")


class FunctionAliasArg(FunctionArg):
    def normalize(self, value, params):
        if not ALIAS_PATTERN.match(value):
            raise InvalidFunctionArgument(f"{value} is not a valid function alias")
        return value


class NullColumn(FunctionArg):
    """
    Convert the provided column to null so that we
    can drop it. Used to make count() not have a
    required argument that we ignore.
    """

    def __init__(self, name):
        super().__init__(name)
        self.has_default = True

    def get_default(self, params):
        return None

    def normalize(self, value, params):
        return None


class CountColumn(FunctionArg):
    def __init__(self, name):
        super().__init__(name)
        self.has_default = True

    def get_default(self, params):
        return None

    def normalize(self, value, params):
        if value is None:
            raise InvalidFunctionArgument("a column is required")

        if value not in FIELD_ALIASES:
            return value

        field = FIELD_ALIASES[value]

        # If the alias has an expression prefer that over the column alias
        # This enables user.display to work in aggregates
        expression = field.get_expression(params)
        if expression is not None:
            return expression
        elif field.alias is not None:
            return field.alias
        return value


class FieldColumn(CountColumn):
    """ Allow any field column, of any type """

    def get_type(self, value):
        if is_duration_measurement(value):
            return "duration"
        elif value == "transaction.duration":
            return "duration"
        elif value == "timestamp":
            return "date"
        return "string"


class StringArg(FunctionArg):
    def __init__(self, name, unquote=False, unescape_quotes=False):
        super().__init__(name)
        self.unquote = unquote
        self.unescape_quotes = unescape_quotes

    def normalize(self, value, params):
        if self.unquote:
            if len(value) < 2 or value[0] != '"' or value[-1] != '"':
                raise InvalidFunctionArgument("string should be quoted")
            value = value[1:-1]
        if self.unescape_quotes:
            value = re.sub(r'\\"', '"', value)
        return f"'{value}'"


class DateArg(FunctionArg):
    date_format = "%Y-%m-%dT%H:%M:%S"

    def normalize(self, value, params):
        try:
            datetime.strptime(value, self.date_format)
        except ValueError:
            raise InvalidFunctionArgument(
                f"{value} is in the wrong format, expected a date like 2020-03-14T15:14:15"
            )
        return f"'{value}'"


class ConditionArg(FunctionArg):
    # List and not a set so the error message is consistent
    VALID_CONDITIONS = [
        "equals",
        "notEquals",
        "lessOrEquals",
        "greaterOrEquals",
        "less",
        "greater",
    ]

    def normalize(self, value, params):
        if value not in self.VALID_CONDITIONS:
            raise InvalidFunctionArgument(
                "{} is not a valid condition, the only supported conditions are: {}".format(
                    value,
                    ",".join(self.VALID_CONDITIONS),
                )
            )

        return value


class Column(FunctionArg):
    def __init__(self, name, allowed_columns=None):
        super().__init__(name)
        # make sure to map the allowed columns to their snuba names
        self.allowed_columns = [SEARCH_MAP.get(col) for col in allowed_columns]

    def normalize(self, value, params):
        snuba_column = SEARCH_MAP.get(value)
        if not snuba_column:
            raise InvalidFunctionArgument(f"{value} is not a valid column")
        elif self.allowed_columns is not None and snuba_column not in self.allowed_columns:
            raise InvalidFunctionArgument(f"{value} is not an allowed column")
        return snuba_column


class ColumnNoLookup(Column):
    def __init__(self, name, allowed_columns=None):
        super().__init__(name, allowed_columns=allowed_columns)

    def normalize(self, value, params):
        super().normalize(value, params)
        return value


class NumericColumn(FunctionArg):
    def _normalize(self, value):
        # This method is written in this way so that `get_type` can always call
        # this even in child classes where `normalize` have been overridden.

        snuba_column = SEARCH_MAP.get(value)
        if not snuba_column and is_measurement(value):
            return value
        if not snuba_column:
            raise InvalidFunctionArgument(f"{value} is not a valid column")
        elif snuba_column not in ["time", "timestamp", "duration"]:
            raise InvalidFunctionArgument(f"{value} is not a numeric column")
        return snuba_column

    def normalize(self, value, params):
        return self._normalize(value)

    def get_type(self, value):
        snuba_column = self._normalize(value)
        if is_duration_measurement(snuba_column):
            return "duration"
        elif snuba_column == "duration":
            return "duration"
        elif snuba_column == "timestamp":
            return "date"
        return "number"


class NumericColumnNoLookup(NumericColumn):
    def __init__(self, name, allow_measurements_value=False):
        super().__init__(name)
        self.allow_measurements_value = allow_measurements_value

    def normalize(self, value, params):
        # `measurement_value` is actually an array of Float64s. But when used
        # in this context, we always want to expand it using `arrayJoin`. The
        # resulting column will be a numeric column of type Float64.
        if self.allow_measurements_value and value == "measurements_value":
            return ["arrayJoin", ["measurements_value"]]

        super().normalize(value, params)
        return value


class DurationColumn(FunctionArg):
    def normalize(self, value, params):
        snuba_column = SEARCH_MAP.get(value)
        if not snuba_column and is_duration_measurement(value):
            return value
        if not snuba_column:
            raise InvalidFunctionArgument(f"{value} is not a valid column")
        elif snuba_column != "duration":
            raise InvalidFunctionArgument(f"{value} is not a duration column")
        return snuba_column


class DurationColumnNoLookup(DurationColumn):
    def normalize(self, value, params):
        super().normalize(value, params)
        return value


class StringArrayColumn(FunctionArg):
    def normalize(self, value, params):
        if value in ["tags.key", "tags.value", "measurements_key"]:
            return value
        raise InvalidFunctionArgument(f"{value} is not a valid string array column")


class NumberRange(FunctionArg):
    def __init__(self, name, start, end):
        super().__init__(name)
        self.start = start
        self.end = end

    def normalize(self, value, params):
        try:
            value = float(value)
        except ValueError:
            raise InvalidFunctionArgument(f"{value} is not a number")

        if self.start and value < self.start:
            raise InvalidFunctionArgument(
                f"{value:g} must be greater than or equal to {self.start:g}"
            )
        elif self.end and value >= self.end:
            raise InvalidFunctionArgument(f"{value:g} must be less than {self.end:g}")

        return value


class IntervalDefault(NumberRange):
    def __init__(self, name, start, end):
        super().__init__(name, start, end)
        self.has_default = True

    def get_default(self, params):
        if not params or not params.get("start") or not params.get("end"):
            raise InvalidFunctionArgument("function called without default")
        elif not isinstance(params.get("start"), datetime) or not isinstance(
            params.get("end"), datetime
        ):
            raise InvalidFunctionArgument("function called with invalid default")

        interval = (params["end"] - params["start"]).total_seconds()
        return int(interval)


def with_default(default, argument):
    argument.has_default = True
    argument.get_default = lambda *_: default
    return argument


class Function:
    def __init__(
        self,
        name,
        required_args=None,
        optional_args=None,
        calculated_args=None,
        column=None,
        aggregate=None,
        transform=None,
        result_type_fn=None,
        default_result_type=None,
        redundant_grouping=False,
        private=False,
    ):
        """
        Specifies a function interface that must be followed when defining new functions

        :param str name: The name of the function, this refers to the name to invoke.
        :param list[FunctionArg] required_args: The list of required arguments to the function.
            If any of these arguments are not specified, an error will be raised.
        :param list[FunctionArg] optional_args: The list of optional arguments to the function.
            If any of these arguments are not specified, they will be filled using their default value.
        :param list[obj] calculated_args: The list of calculated arguments to the function.
            These arguments will be computed based on the list of specified arguments.
        :param [str, [any], str or None] column: The column to be passed to snuba once formatted.
            The arguments will be filled into the column where needed. This must not be an aggregate.
        :param [str, [any], str or None] aggregate: The aggregate to be passed to snuba once formatted.
            The arguments will be filled into the aggregate where needed. This must be an aggregate.
        :param str transform: NOTE: Use aggregate over transform whenever possible.
            An aggregate string to be passed to snuba once formatted. The arguments
            will be filled into the string using `.format(...)`.
        :param str result_type_fn: A function to call with in order to determine the result type.
            This function will be passed the list of argument classes and argument values. This should
            be tried first as the source of truth if available.
        :param str default_result_type: The default resulting type of this function. Must be a type
            defined by RESULTS_TYPES.
        :param bool redundant_grouping: This function will result in redundant grouping if its column
            is included as a field as well.
        :param bool private: Whether or not this function should be disabled for general use.
        """

        self.name = name
        self.required_args = [] if required_args is None else required_args
        self.optional_args = [] if optional_args is None else optional_args
        self.calculated_args = [] if calculated_args is None else calculated_args
        self.column = column
        self.aggregate = aggregate
        self.transform = transform
        self.result_type_fn = result_type_fn
        self.default_result_type = default_result_type
        self.redundant_grouping = redundant_grouping
        self.private = private

        self.validate()

    @property
    def required_args_count(self):
        return len(self.required_args)

    @property
    def optional_args_count(self):
        return len(self.optional_args)

    @property
    def total_args_count(self):
        return self.required_args_count + self.optional_args_count

    @property
    def args(self):
        return self.required_args + self.optional_args

    def alias_as(self, name):
        """ Create a copy of this function to be used as an alias """
        alias = deepcopy(self)
        alias.name = name
        return alias

    def add_default_arguments(self, field, columns, params):
        # make sure to validate the argument count first to
        # ensure the right number of arguments have been passed
        self.validate_argument_count(field, columns)

        columns = [column for column in columns]

        # use default values to populate optional arguments if any
        for argument in self.args[len(columns) :]:
            try:
                default = argument.get_default(params)
            except InvalidFunctionArgument as e:
                raise InvalidSearchQuery(f"{field}: invalid arguments: {e}")

            # Hacky, but we expect column arguments to be strings so easiest to convert it back
            columns.append(str(default) if default else default)

        return columns

    def format_as_arguments(self, field, columns, params):
        columns = self.add_default_arguments(field, columns, params)

        arguments = {}

        # normalize the arguments before putting them in a dict
        for argument, column in zip(self.args, columns):
            try:
                arguments[argument.name] = argument.normalize(column, params)
            except InvalidFunctionArgument as e:
                raise InvalidSearchQuery(f"{field}: {argument.name} argument invalid: {e}")

        # populate any computed args
        for calculation in self.calculated_args:
            arguments[calculation["name"]] = calculation["fn"](arguments)

        return arguments

    def get_result_type(self, field=None, arguments=None):
        if field is None or arguments is None or self.result_type_fn is None:
            return self.default_result_type

        result_type = self.result_type_fn(self.args, arguments)
        if result_type is None:
            return self.default_result_type

        self.validate_result_type(result_type)
        return result_type

    def validate(self):
        # assert that all optional args have defaults available
        for i, arg in enumerate(self.optional_args):
            assert (
                arg.has_default
            ), f"{self.name}: optional argument at index {i} does not have default"

        # assert that the function has only one of the following specified
        # `column`, `aggregate`, or `transform`
        assert (
            sum([self.column is not None, self.aggregate is not None, self.transform is not None])
            == 1
        ), f"{self.name}: only one of column, aggregate, or transform is allowed"

        # assert that no duplicate argument names are used
        names = set()
        for arg in self.args:
            assert (
                arg.name not in names
            ), f"{self.name}: argument {arg.name} specified more than once"
            names.add(arg.name)

        for calculation in self.calculated_args:
            assert (
                calculation["name"] not in names
            ), "{}: argument {} specified more than once".format(self.name, calculation["name"])
            names.add(calculation["name"])

        self.validate_result_type(self.default_result_type)

    def validate_argument_count(self, field, arguments):
        """
        Validate the number of required arguments the function defines against
        provided arguments. Raise an exception if there is a mismatch in the
        number of arguments. Do not return any values.

        There are 4 cases:
            1. provided # of arguments != required # of arguments AND provided # of arguments != total # of arguments (bad, raise an error)
            2. provided # of arguments < required # of arguments (bad, raise an error)
            3. provided # of arguments > total # of arguments (bad, raise an error)
            4. required # of arguments <= provided # of arguments <= total # of arguments (good, pass the validation)
        """
        args_count = len(arguments)
        total_args_count = self.total_args_count
        if args_count != total_args_count:
            required_args_count = self.required_args_count
            if required_args_count == total_args_count:
                raise InvalidSearchQuery(f"{field}: expected {total_args_count:g} argument(s)")
            elif args_count < required_args_count:
                raise InvalidSearchQuery(
                    f"{field}: expected at least {required_args_count:g} argument(s)"
                )
            elif args_count > total_args_count:
                raise InvalidSearchQuery(
                    f"{field}: expected at most {total_args_count:g} argument(s)"
                )

    def validate_result_type(self, result_type):
        assert (
            result_type is None or result_type in RESULT_TYPES
        ), f"{self.name}: result type {result_type} not one of {list(RESULT_TYPES)}"

    def is_accessible(self, acl=None):
        if not self.private:
            return True
        elif not acl:
            return False
        return self.name in acl


def reflective_result_type(index=0):
    def result_type_fn(function_arguments, parameter_values):
        argument = function_arguments[index]
        value = parameter_values[argument.name]
        return argument.get_type(value)

    return result_type_fn


# When updating this list, also check if the following need to be updated:
# - convert_search_filter_to_snuba_query
# - static/app/utils/discover/fields.tsx FIELDS (for discover column list and search box autocomplete)
FUNCTIONS = {
    function.name: function
    for function in [
        Function(
            "percentile",
            required_args=[NumericColumnNoLookup("column"), NumberRange("percentile", 0, 1)],
            aggregate=["quantile({percentile:g})", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p50",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["quantile(0.5)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p75",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["quantile(0.75)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p95",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["quantile(0.95)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p99",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["quantile(0.99)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p100",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["max", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "eps",
            optional_args=[IntervalDefault("interval", 1, None)],
            transform="divide(count(), {interval:g})",
            default_result_type="number",
        ),
        Function(
            "epm",
            optional_args=[IntervalDefault("interval", 1, None)],
            transform="divide(count(), divide({interval:g}, 60))",
            default_result_type="number",
        ),
        Function(
            "last_seen",
            aggregate=["max", "timestamp", "last_seen"],
            default_result_type="date",
            redundant_grouping=True,
        ),
        Function(
            "latest_event",
            aggregate=["argMax", ["id", "timestamp"], "latest_event"],
            default_result_type="string",
        ),
        Function(
            "apdex",
            required_args=[NumberRange("satisfaction", 0, None)],
            transform="apdex(duration, {satisfaction:g})",
            default_result_type="number",
        ),
        Function(
            "user_misery",
            required_args=[NumberRange("satisfaction", 0, None)],
            calculated_args=[{"name": "tolerated", "fn": lambda args: args["satisfaction"] * 4.0}],
            transform="uniqIf(user, greater(duration, {tolerated:g}))",
            default_result_type="number",
        ),
        Function(
            "user_misery_prototype",
            required_args=[NumberRange("satisfaction", 0, None)],
            # To correct for sensitivity to low counts, User Misery is modeled as a Beta Distribution Function.
            # With prior expectations, we have picked the expected mean user misery to be 0.05 and variance
            # to be 0.0004. This allows us to calculate the alpha (5.8875) and beta (111.8625) parameters,
            # with the user misery being adjusted for each fast/slow unique transaction. See:
            # https://stats.stackexchange.com/questions/47771/what-is-the-intuition-behind-beta-distribution
            # for an intuitive explanation of the Beta Distribution Function.
            optional_args=[
                with_default(5.8875, NumberRange("alpha", 0, None)),
                with_default(111.8625, NumberRange("beta", 0, None)),
            ],
            calculated_args=[
                {"name": "tolerated", "fn": lambda args: args["satisfaction"] * 4.0},
                {"name": "parameter_sum", "fn": lambda args: args["alpha"] + args["beta"]},
            ],
            transform="ifNull(divide(plus(uniqIf(user, greater(duration, {tolerated:g})), {alpha}), plus(uniq(user), {parameter_sum})), 0)",
            default_result_type="number",
        ),
        Function("failure_rate", transform="failure_rate()", default_result_type="percentage"),
        Function(
            "failure_count",
            aggregate=[
                "countIf",
                [
                    [
                        "not",
                        [
                            [
                                "has",
                                [
                                    [
                                        "array",
                                        [
                                            SPAN_STATUS_NAME_TO_CODE[name]
                                            for name in ["ok", "cancelled", "unknown"]
                                        ],
                                    ],
                                    "transaction_status",
                                ],
                            ],
                        ],
                    ],
                ],
                None,
            ],
            default_result_type="integer",
        ),
        Function(
            "array_join",
            required_args=[StringArrayColumn("column")],
            column=["arrayJoin", [ArgValue("column")], None],
            default_result_type="string",
            private=True,
        ),
        Function(
            "histogram",
            required_args=[
                NumericColumnNoLookup("column", allow_measurements_value=True),
                # the bucket_size and start_offset should already be adjusted
                # using the multiplier before it is passed here
                NumberRange("bucket_size", 0, None),
                NumberRange("start_offset", 0, None),
                NumberRange("multiplier", 1, None),
            ],
            # floor((x * multiplier - start_offset) / bucket_size) * bucket_size + start_offset
            column=[
                "plus",
                [
                    [
                        "multiply",
                        [
                            [
                                "floor",
                                [
                                    [
                                        "divide",
                                        [
                                            [
                                                "minus",
                                                [
                                                    [
                                                        "multiply",
                                                        [
                                                            ArgValue("column"),
                                                            ArgValue("multiplier"),
                                                        ],
                                                    ],
                                                    ArgValue("start_offset"),
                                                ],
                                            ],
                                            ArgValue("bucket_size"),
                                        ],
                                    ],
                                ],
                            ],
                            ArgValue("bucket_size"),
                        ],
                    ],
                    ArgValue("start_offset"),
                ],
                None,
            ],
            default_result_type="number",
            private=True,
        ),
        Function(
            "count_unique",
            optional_args=[CountColumn("column")],
            aggregate=["uniq", ArgValue("column"), None],
            default_result_type="integer",
        ),
        Function(
            "count",
            optional_args=[NullColumn("column")],
            aggregate=["count", None, None],
            default_result_type="integer",
        ),
        Function(
            "count_at_least",
            required_args=[NumericColumnNoLookup("column"), NumberRange("threshold", 0, None)],
            aggregate=[
                "countIf",
                [["greaterOrEquals", [ArgValue("column"), ArgValue("threshold")]]],
                None,
            ],
            default_result_type="integer",
        ),
        Function(
            "min",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["min", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "max",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["max", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "avg",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["avg", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "var",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["varSamp", ArgValue("column"), None],
            default_result_type="number",
            redundant_grouping=True,
        ),
        Function(
            "stddev",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["stddevSamp", ArgValue("column"), None],
            default_result_type="number",
            redundant_grouping=True,
        ),
        Function(
            "sum",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["sum", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
        ),
        Function(
            "any",
            required_args=[FieldColumn("column")],
            aggregate=["min", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            redundant_grouping=True,
        ),
        # Currently only being used by the baseline PoC
        Function(
            "absolute_delta",
            required_args=[DurationColumnNoLookup("column"), NumberRange("target", 0, None)],
            column=["abs", [["minus", [ArgValue("column"), ArgValue("target")]]], None],
            default_result_type="duration",
        ),
        # These range functions for performance trends, these aren't If functions
        # to avoid allowing arbitrary if statements
        # Not yet supported in Discover, and shouldn't be added to fields.tsx
        Function(
            "percentile_range",
            required_args=[
                NumericColumnNoLookup("column"),
                NumberRange("percentile", 0, 1),
                ConditionArg("condition"),
                DateArg("middle"),
            ],
            aggregate=[
                "quantileIf({percentile:.2f})",
                [
                    ArgValue("column"),
                    # NOTE: This condition is written in this seemingly backwards way
                    # because of how snuba special cases the following syntax
                    # ["a", ["b", ["c", ["d"]]]
                    #
                    # This array is can be interpreted 2 ways
                    # 1. a(b(c(d))) the way snuba interprets it
                    #   - snuba special cases it when it detects an array where the first
                    #     element is a literal, and the second element is an array and
                    #     treats it as a function call rather than 2 separate arguments
                    # 2. a(b, c(d)) the way we want it to be interpreted
                    #
                    # Because of how snuba interprets this expression, it makes it impossible
                    # to specify a function with 2 arguments whose first argument is a literal
                    # and the second argument is an expression.
                    #
                    # Working with this limitation, we have to invert the conditions in
                    # order to express a function whose first argument is an expression while
                    # the second argument is a literal.
                    [ArgValue("condition"), [["toDateTime", [ArgValue("middle")]], "timestamp"]],
                ],
                None,
            ],
            default_result_type="duration",
        ),
        Function(
            "avg_range",
            required_args=[
                NumericColumnNoLookup("column"),
                ConditionArg("condition"),
                DateArg("middle"),
            ],
            aggregate=[
                "avgIf",
                [
                    ArgValue("column"),
                    # see `percentile_range` for why this condition feels backwards
                    [ArgValue("condition"), [["toDateTime", [ArgValue("middle")]], "timestamp"]],
                ],
                None,
            ],
            default_result_type="duration",
        ),
        Function(
            "variance_range",
            required_args=[
                NumericColumnNoLookup("column"),
                ConditionArg("condition"),
                DateArg("middle"),
            ],
            aggregate=[
                "varSampIf",
                [
                    ArgValue("column"),
                    # see `percentile_range` for why this condition feels backwards
                    [ArgValue("condition"), [["toDateTime", [ArgValue("middle")]], "timestamp"]],
                ],
                None,
            ],
            default_result_type="duration",
        ),
        Function(
            "count_range",
            required_args=[ConditionArg("condition"), DateArg("middle")],
            aggregate=[
                "countIf",
                # see `percentile_range` for why this condition feels backwards
                [[ArgValue("condition"), [["toDateTime", [ArgValue("middle")]], "timestamp"]]],
                None,
            ],
            default_result_type="integer",
        ),
        Function(
            "percentage",
            required_args=[FunctionArg("numerator"), FunctionArg("denominator")],
            # Since percentage is only used on aggregates, it needs to be an aggregate and not a column
            # This is because as a column it will be added to the `WHERE` clause instead of the `HAVING` clause
            aggregate=[
                "if(greater({denominator},0),divide({numerator},{denominator}),null)",
                None,
                None,
            ],
            default_result_type="percentage",
        ),
        # Calculate the Welch's t-test value, this is used to help identify which of our trends are significant or not
        Function(
            "t_test",
            required_args=[
                FunctionAliasArg("avg_1"),
                FunctionAliasArg("avg_2"),
                FunctionAliasArg("variance_1"),
                FunctionAliasArg("variance_2"),
                FunctionAliasArg("count_1"),
                FunctionAliasArg("count_2"),
            ],
            aggregate=[
                "divide(minus({avg_1},{avg_2}),sqrt(plus(divide({variance_1},{count_1}),divide({variance_2},{count_2}))))",
                None,
                "t_test",
            ],
            default_result_type="number",
        ),
        Function(
            "minus",
            required_args=[FunctionArg("minuend"), FunctionArg("subtrahend")],
            aggregate=["minus", [ArgValue("minuend"), ArgValue("subtrahend")], None],
            default_result_type="duration",
        ),
        Function(
            "absolute_correlation",
            aggregate=[
                "abs",
                [["corr", [["toUnixTimestamp", ["timestamp"]], "transaction.duration"]]],
                None,
            ],
            default_result_type="number",
        ),
        Function(
            "compare_numeric_aggregate",
            required_args=[
                FunctionAliasArg("aggregate_alias"),
                ConditionArg("condition"),
                NumberRange("value", 0, None),
            ],
            aggregate=[
                # snuba json syntax isn't compatible with this query here
                # this function can't be a column, since we want to use this with aggregates
                "{condition}({aggregate_alias},{value})",
                None,
                None,
            ],
            default_result_type="number",
        ),
        Function(
            "to_other",
            required_args=[
                ColumnNoLookup("column", allowed_columns=["release", "trace.parent_span"]),
                StringArg("value", unquote=True, unescape_quotes=True),
            ],
            optional_args=[
                with_default("that", StringArg("that")),
                with_default("this", StringArg("this")),
            ],
            column=[
                "if",
                [
                    ["equals", [ArgValue("column"), ArgValue("value")]],
                    ArgValue("this"),
                    ArgValue("that"),
                ],
            ],
        ),
    ]
}
# In Performance TPM is used as an alias to EPM
FUNCTION_ALIASES = {
    "tpm": "epm",
    "tps": "eps",
}
for alias, name in FUNCTION_ALIASES.items():
    FUNCTIONS[alias] = FUNCTIONS[name].alias_as(alias)


FUNCTION_ALIAS_PATTERN = re.compile(r"^({}).*".format("|".join(list(FUNCTIONS.keys()))))


def is_function(field):
    function_match = FUNCTION_PATTERN.search(field)
    if function_match:
        return function_match

    return None


def get_function_alias(field):
    match = FUNCTION_PATTERN.search(field)
    if match is None:
        return field

    if match.group("alias") is not None:
        return match.group("alias")
    function = match.group("function")
    columns = parse_arguments(function, match.group("columns"))
    return get_function_alias_with_columns(function, columns)


def get_function_alias_with_columns(function_name, columns):
    columns = re.sub(r"[^\w]", "_", "_".join(columns))
    return f"{function_name}_{columns}".rstrip("_")


def format_column_arguments(column_args, arguments):
    for i in range(len(column_args)):
        if isinstance(column_args[i], (list, tuple)):
            if isinstance(column_args[i][0], ArgValue):
                column_args[i][0] = arguments[column_args[i][0].arg]
            format_column_arguments(column_args[i][1], arguments)
        elif isinstance(column_args[i], str):
            column_args[i] = column_args[i].format(**arguments)
        elif isinstance(column_args[i], ArgValue):
            column_args[i] = arguments[column_args[i].arg]


def parse_arguments(function, columns):
    """
    The to_other function takes a quoted string for one of its arguments
    that may contain commas, so it requires special handling.
    """
    if function != "to_other":
        return [c.strip() for c in columns.split(",") if len(c.strip()) > 0]

    args = []

    quoted = False
    escaped = False

    i, j = 0, 0

    while j < len(columns):
        if i == j and columns[j] == '"':
            # when we see a quote at the beginning of
            # an argument, then this is a quoted string
            quoted = True
        elif quoted and not escaped and columns[j] == "\\":
            # when we see a slash inside a quoted string,
            # the next character is an escape character
            escaped = True
        elif quoted and not escaped and columns[j] == '"':
            # when we see a non-escaped quote while inside
            # of a quoted string, we should end it
            quoted = False
        elif quoted and escaped:
            # when we are inside a quoted string and have
            # begun an escape character, we should end it
            escaped = False
        elif quoted and columns[j] == ",":
            # when we are inside a quoted string and see
            # a comma, it should not be considered an
            # argument separator
            pass
        elif columns[j] == ",":
            # when we see a comma outside of a quoted string
            # it is an argument separator
            args.append(columns[i:j].strip())
            i = j + 1
        j += 1

    if i != j:
        # add in the last argument if any
        args.append(columns[i:].strip())

    return [arg for arg in args if arg]


def parse_function(field, match=None, err_msg=None):
    if not match:
        match = is_function(field)

    if not match or match.group("function") not in FUNCTIONS:
        if err_msg is None:
            err_msg = f"{field} is not a valid function"
        raise InvalidSearchQuery(err_msg)

    function = match.group("function")
    return (
        function,
        parse_arguments(function, match.group("columns")),
        match.group("alias"),
    )


FunctionDetails = namedtuple("FunctionDetails", "field instance arguments")
ResolvedFunction = namedtuple("ResolvedFunction", "details column aggregate")


def resolve_function(field, match=None, params=None, functions_acl=False):
    if params is not None and field in params.get("aliases", {}):
        alias = params["aliases"][field]
        return ResolvedFunction(
            FunctionDetails(field, FUNCTIONS["percentage"], []),
            None,
            alias.aggregate,
        )
    function_name, columns, alias = parse_function(field, match)
    function = FUNCTIONS[function_name]
    if not function.is_accessible(functions_acl):
        raise InvalidSearchQuery(f"{function.name}: no access to private function")

    arguments = function.format_as_arguments(field, columns, params)
    details = FunctionDetails(field, function, arguments)

    if function.transform is not None:
        snuba_string = function.transform.format(**arguments)
        if alias is None:
            alias = get_function_alias_with_columns(function.name, columns)
        return ResolvedFunction(
            details,
            None,
            [snuba_string, None, alias],
        )
    elif function.aggregate is not None:
        aggregate = deepcopy(function.aggregate)

        aggregate[0] = aggregate[0].format(**arguments)
        if isinstance(aggregate[1], (list, tuple)):
            format_column_arguments(aggregate[1], arguments)
        elif isinstance(aggregate[1], ArgValue):
            arg = aggregate[1].arg
            # The aggregate function has only a single argument
            # however that argument is an expression, so we have
            # to make sure to nest it so it doesn't get treated
            # as a list of arguments by snuba.
            if isinstance(arguments[arg], (list, tuple)):
                aggregate[1] = [arguments[arg]]
            else:
                aggregate[1] = arguments[arg]

        if alias is not None:
            aggregate[2] = alias
        elif aggregate[2] is None:
            aggregate[2] = get_function_alias_with_columns(function.name, columns)

        return ResolvedFunction(details, None, aggregate)
    elif function.column is not None:
        # These can be very nested functions, so we need to iterate through all the layers
        addition = deepcopy(function.column)
        addition[0] = addition[0].format(**arguments)
        if isinstance(addition[1], (list, tuple)):
            format_column_arguments(addition[1], arguments)
        if len(addition) < 3:
            if alias is not None:
                addition.append(alias)
            else:
                addition.append(get_function_alias_with_columns(function.name, columns))
        elif len(addition) == 3:
            if alias is not None:
                addition[2] = alias
            elif addition[2] is None:
                addition[2] = get_function_alias_with_columns(function.name, columns)
            else:
                addition[2] = addition[2].format(**arguments)
        return ResolvedFunction(details, addition, None)


def resolve_orderby(orderby, fields, aggregations):
    """
    We accept column names, aggregate functions, and aliases as order by
    values. Aggregates and field aliases need to be resolve/validated.

    TODO(mark) Once we're no longer using the dataset selection function
    should allow all non-tag fields to be used as sort clauses, instead of only
    those that are currently selected.
    """
    orderby = orderby if isinstance(orderby, (list, tuple)) else [orderby]
    validated = []
    for column in orderby:
        bare_column = column.lstrip("-")

        if bare_column in fields:
            validated.append(column)
            continue

        if is_function(bare_column):
            bare_column = get_function_alias(bare_column)

        found = [agg[2] for agg in aggregations if agg[2] == bare_column]
        if found:
            prefix = "-" if column.startswith("-") else ""
            validated.append(prefix + bare_column)
            continue

        if (
            bare_column in FIELD_ALIASES
            and FIELD_ALIASES[bare_column].alias
            and bare_column != PROJECT_ALIAS
        ):
            prefix = "-" if column.startswith("-") else ""
            validated.append(prefix + FIELD_ALIASES[bare_column].alias)
            continue

        found = [
            col[2]
            for col in fields
            if isinstance(col, (list, tuple)) and col[2].strip("`") == bare_column
        ]
        if found:
            prefix = "-" if column.startswith("-") else ""
            validated.append(prefix + bare_column)

    if len(validated) == len(orderby):
        return validated

    raise InvalidSearchQuery("Cannot order by a field that is not selected.")


def get_aggregate_alias(match):
    column = match.group("column").replace(".", "_")
    return "{}_{}".format(match.group("function"), column).rstrip("_")


def resolve_field(field, params=None, functions_acl=None):
    if not isinstance(field, str):
        raise InvalidSearchQuery("Field names must be strings")

    match = is_function(field)
    if match:
        return resolve_function(field, match, params, functions_acl)

    if field in FIELD_ALIASES:
        special_field = FIELD_ALIASES[field]
        return ResolvedFunction(None, special_field.get_field(params), None)

    tag_match = TAG_KEY_RE.search(field)
    tag_field = tag_match.group("tag") if tag_match else field

    if VALID_FIELD_PATTERN.match(tag_field):
        return ResolvedFunction(None, field, None)
    else:
        raise InvalidSearchQuery(f"Invalid characters in field {field}")


def resolve_field_list(
    fields, snuba_filter, auto_fields=True, auto_aggregations=False, functions_acl=None
):
    """
    Expand a list of fields based on aliases and aggregate functions.

    Returns a dist of aggregations, selected_columns, and
    groupby that can be merged into the result of get_snuba_query_args()
    to build a more complete snuba query based on event search conventions.

    Auto aggregates are aggregates that will be automatically added to the
    list of aggregations when they're used in a condition. This is so that
    they can be used in a condition without having to manually add the
    aggregate to a field.
    """
    aggregations = []
    aggregate_fields = defaultdict(set)
    columns = []
    groupby = []
    project_key = ""
    functions = {}

    # If project is requested, we need to map ids to their names since snuba only has ids
    if "project" in fields:
        fields.remove("project")
        project_key = "project"
    # since project.name is more specific, if both are included use project.name instead of project
    if PROJECT_NAME_ALIAS in fields:
        fields.remove(PROJECT_NAME_ALIAS)
        project_key = PROJECT_NAME_ALIAS
    if project_key:
        if "project.id" not in fields:
            fields.append("project.id")

    for field in fields:
        if isinstance(field, str) and field.strip() == "":
            continue
        function = resolve_field(field, snuba_filter.params, functions_acl)
        if function.column is not None and function.column not in columns:
            columns.append(function.column)
            if function.details is not None and isinstance(function.column, (list, tuple)):
                functions[function.column[-1]] = function.details
        elif function.aggregate is not None:
            aggregations.append(function.aggregate)
            if function.details is not None and isinstance(function.aggregate, (list, tuple)):
                functions[function.aggregate[-1]] = function.details
                if function.details.instance.redundant_grouping:
                    aggregate_fields[function.aggregate[1]].add(field)

    # Only auto aggregate when there's one other so the group by is not unexpectedly changed
    if auto_aggregations and snuba_filter.having and len(aggregations) > 0:
        for agg in snuba_filter.condition_aggregates:
            if agg not in snuba_filter.aliases:
                function = resolve_field(agg, snuba_filter.params, functions_acl)
                if function.aggregate is not None and function.aggregate not in aggregations:
                    aggregations.append(function.aggregate)
                    if function.details is not None and isinstance(
                        function.aggregate, (list, tuple)
                    ):
                        functions[function.aggregate[-1]] = function.details

                        if function.details.instance.redundant_grouping:
                            aggregate_fields[function.aggregate[1]].add(field)

    rollup = snuba_filter.rollup
    if not rollup and auto_fields:
        # Ensure fields we require to build a functioning interface
        # are present. We don't add fields when using a rollup as the additional fields
        # would be aggregated away.
        if not aggregations and "id" not in columns:
            columns.append("id")
        if "id" in columns and "project.id" not in columns:
            columns.append("project.id")
            project_key = PROJECT_NAME_ALIAS

    if project_key:
        # Check to see if there's a condition on project ID already, to avoid unnecessary lookups
        filtered_project_ids = None
        if snuba_filter.conditions:
            for cond in snuba_filter.conditions:
                if cond[0] == "project_id":
                    filtered_project_ids = [cond[2]] if cond[1] == "=" else cond[2]

        project_ids = filtered_project_ids or snuba_filter.filter_keys.get("project_id", [])
        projects = Project.objects.filter(id__in=project_ids).values("slug", "id")
        # Clickhouse gets confused when the column contains a period
        # This is specifically for project.name and should be removed once we can stop supporting it
        if "." in project_key:
            project_key = f"`{project_key}`"
        columns.append(
            [
                "transform",
                [
                    # This is a workaround since having the column by itself currently is being treated as a function
                    ["toString", ["project_id"]],
                    ["array", ["'{}'".format(project["id"]) for project in projects]],
                    ["array", ["'{}'".format(project["slug"]) for project in projects]],
                    # Default case, what to do if a project id without a slug is found
                    "''",
                ],
                project_key,
            ]
        )

    if rollup and columns and not aggregations:
        raise InvalidSearchQuery("You cannot use rollup without an aggregate field.")

    orderby = snuba_filter.orderby
    # Only sort if there are columns. When there are only aggregates there's no need to sort
    if orderby and len(columns) > 0:
        orderby = resolve_orderby(orderby, columns, aggregations)
    else:
        orderby = None

    # If aggregations are present all columns
    # need to be added to the group by so that the query is valid.
    if aggregations:
        for column in columns:
            if isinstance(column, (list, tuple)):
                if column[0] == "transform":
                    # When there's a project transform, we already group by project_id
                    continue
                if column[2] == USER_DISPLAY_ALIAS:
                    # user.display needs to be grouped by its coalesce function
                    groupby.append(column)
                    continue
                groupby.append(column[2])
            else:
                if column in aggregate_fields:
                    conflicting_functions = list(aggregate_fields[column])
                    raise InvalidSearchQuery(
                        "A single field cannot be used both inside and outside a function in the same query. To use {field} you must first remove the function(s): {function_msg}".format(
                            field=column,
                            function_msg=", ".join(conflicting_functions[:2])
                            + (
                                f" and {len(conflicting_functions) - 2} more."
                                if len(conflicting_functions) > 2
                                else ""
                            ),
                        )
                    )
                groupby.append(column)

    return {
        "selected_columns": columns,
        "aggregations": aggregations,
        "groupby": groupby,
        "orderby": orderby,
        "functions": functions,
    }


TAG_KEY_RE = re.compile(r"^tags\[(?P<tag>.*)\]$")
