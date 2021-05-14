import re
from collections import namedtuple
from datetime import datetime

from django.utils.functional import cached_property
from parsimonious.exceptions import IncompleteParseError
from parsimonious.expressions import Optional
from parsimonious.grammar import Grammar, NodeVisitor
from parsimonious.nodes import Node, RegexNode

from sentry.search.events.constants import KEY_TRANSACTION_ALIAS, SEARCH_MAP, TAG_KEY_RE
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

WILDCARD_CHARS = re.compile(r"[\*]")
NEGATION_MAP = {
    "=": "!=",
    "<": ">=",
    "<=": ">",
    ">": "<=",
    ">=": "<",
    "IN": "NOT IN",
}


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
key_val_term         = spaces (time_filter / rel_time_filter / specific_time_filter
                       / duration_filter / boolean_filter / numeric_filter
                       / aggregate_filter / aggregate_date_filter / aggregate_rel_date_filter
                       / has_filter / is_filter / text_filter)
                       spaces
raw_search           = (!key_val_term ~r"\ *(?!(?i)OR(?![^\s]))(?!(?i)AND(?![^\s]))([^\ ^\n ()]+)\ *" )*
quoted_raw_search    = spaces quoted_value spaces

# standard key:val filter
text_filter          = negation? text_key sep ((open_bracket text_value (comma space* text_value)* closed_bracket) / search_value)
# filter for dates
time_filter          = search_key sep? operator (date_format / alt_date_format)
# filter for relative dates
rel_time_filter      = search_key sep rel_date_format
# filter for durations
duration_filter      = search_key sep operator? duration_format
# exact time filter for dates
specific_time_filter = search_key sep (date_format / alt_date_format)
# Numeric comparison filter
numeric_filter       = search_key sep ((operator? numeric_value) / (open_bracket numeric_value (comma space* numeric_value)* closed_bracket))
# Boolean comparison filter
boolean_filter       = negation? search_key sep boolean_value
# Aggregate numeric filter
aggregate_filter          = negation? aggregate_key sep operator? (duration_format / numeric_value / percentage_format)
aggregate_date_filter     = negation? aggregate_key sep operator? (date_format / alt_date_format)
aggregate_rel_date_filter = negation? aggregate_key sep operator? rel_date_format

# has filter for not null type checks
has_filter           = negation? "has" sep (search_key / search_value)
is_filter            = negation? "is" sep search_value

aggregate_key        = key open_paren function_arg* closed_paren
search_key           = key / quoted_key
search_value         = quoted_value / value
value                = ~r"[^()\s]*"
in_value             = ~r"[^(),\s]*[^\],\s)]"
numeric_value        = ~r"([-]?[0-9\.]+)([kmb])?(?=\s|\)|$|,|])"
boolean_value        = ~r"(true|1|false|0)(?=\s|\)|$)"i
quoted_value         = ~r"\"((?:[^\"]|(?<=\\)[\"])*)?\""s
key                  = ~r"[a-zA-Z0-9_\.-]+"
function_arg         = space? key? comma? space?
# only allow colons in quoted keys
quoted_key           = ~r"\"([a-zA-Z0-9_\.:-]+)\""
explicit_tag_key     = "tags[" search_key "]"
text_key             = explicit_tag_key / search_key
text_value           = quoted_value / in_value

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
open_bracket         = "["
closed_bracket       = ~r"\](?=\s|$)"
sep                  = ":"
space                = " "
negation             = "!"
comma                = ","
spaces               = ~r"\ *"
"""
)


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
            or self.operator == "NOT IN"
            and self.value.raw_value
        )

    @cached_property
    def is_in_filter(self):
        return self.operator in ("IN", "NOT IN")


class SearchKey(namedtuple("SearchKey", "name")):
    @cached_property
    def is_tag(self):
        return TAG_KEY_RE.match(self.name) or (
            self.name not in SEARCH_MAP
            and self.name not in FIELD_ALIASES
            and not self.is_measurement
            and not self.is_span_op_breakdown
        )

    @cached_property
    def is_measurement(self):
        return is_measurement(self.name) and self.name not in SEARCH_MAP

    @cached_property
    def is_span_op_breakdown(self):
        return is_span_op_breakdown(self.name) and self.name not in SEARCH_MAP


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

    def is_event_id(self):
        """Return whether the current value is a valid event id

        Empty strings are valid, so that it can be used for has:id queries
        """
        if not isinstance(self.raw_value, str):
            return False
        return is_event_id(self.raw_value) or self.raw_value == ""


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
        "count_miserable",
        "user_misery",
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
        return (
            key in self.duration_keys or is_duration_measurement(key) or is_span_op_breakdown(key)
        )

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
            return self.visit_numeric_filter(
                node,
                (
                    search_key,
                    sep,
                    (
                        (
                            "=",
                            search_value,
                        ),
                    ),
                ),
            )

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

    def process_list(self, first, remaining):
        return [
            first,
            *[item[2] for item in remaining],
        ]

    def visit_numeric_filter(self, node, children):
        (search_key, _, (value,)) = children
        operator = value[0]
        if isinstance(operator, Node):
            if isinstance(operator.expr, Optional):
                operator = "="
            else:
                operator = operator.text
        else:
            operator = operator[0]

        if operator == "[":
            operator = "IN"
            search_value = self.process_list(value[1], value[2])
        else:
            search_value = value[1]

        if self.is_numeric_key(search_key.name):
            try:
                search_value = SearchValue(
                    [parse_numeric_value(*val.match.groups()) for val in search_value]
                    if operator == "IN"
                    else parse_numeric_value(*search_value.match.groups())
                )
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
            return SearchFilter(search_key, operator, search_value)
        else:
            if operator != "IN":
                search_value = search_value.text
            else:
                search_value = [v.text for v in search_value]
            search_value = SearchValue(
                operator + search_value if operator not in ("=", "IN") else search_value
            )
            operator = "=" if operator not in ("=", "IN") else operator
            return self._handle_basic_filter(search_key, operator, search_value)

    def handle_negation(self, negation, operator):
        if isinstance(operator, Node):
            operator = "="
        elif not isinstance(operator, str):
            operator = operator[0]
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
            return self.visit_numeric_filter(node, (search_key, sep, ((operator, search_value),)))
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

    def visit_text_filter(self, node, children):
        (negation, search_key, _, (search_value,)) = children
        operator = "="
        if isinstance(search_value, list):
            operator = "IN"
            search_value = SearchValue(
                self.process_list(search_value[1], [(_, _, val) for _, _, val in search_value[2]])
            )
        else:
            # XXX: We check whether the text in the node itself is actually empty, so
            # we can tell the difference between an empty quoted string and no string
            if not search_value.raw_value and not node.children[3].text:
                raise InvalidSearchQuery(f"Empty string after '{search_key.name}:'")

        operator = self.handle_negation(negation, operator)

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

    def visit_in_value(self, node, children):
        return node.text.replace('\\"', '"')

    def visit_quoted_value(self, node, children):
        return node.match.groups()[0].replace('\\"', '"')

    def visit_quoted_key(self, node, children):
        return node.match.groups()[0]

    def visit_explicit_tag_key(self, node, children):
        return SearchKey(f"tags[{children[1].name}]")

    def visit_text_key(self, node, children):
        return children[0]

    def visit_text_value(self, node, children):
        return children[0]

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
