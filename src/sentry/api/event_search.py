from __future__ import absolute_import

import re
from collections import namedtuple
from copy import deepcopy
from datetime import datetime

import six
from django.utils.functional import cached_property
from parsimonious.expressions import Optional
from parsimonious.exceptions import IncompleteParseError, ParseError
from parsimonious.nodes import Node, RegexNode
from parsimonious.grammar import Grammar, NodeVisitor
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE

from sentry import eventstore
from sentry.models import Project
from sentry.models.group import Group
from sentry.search.utils import (
    parse_duration,
    parse_datetime_range,
    parse_datetime_string,
    parse_datetime_value,
    parse_release,
    InvalidQuery,
)
from sentry.snuba.dataset import Dataset
from sentry.utils.dates import to_timestamp
from sentry.utils.snuba import DATASETS, get_json_type
from sentry.utils.compat import map
from sentry.utils.compat import zip
from sentry.utils.compat import filter

WILDCARD_CHARS = re.compile(r"[\*]")
NEGATION_MAP = {
    "=": "!=",
    "<": ">=",
    "<=": ">",
    ">": "<=",
    ">=": "<",
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
search               = (boolean_term / paren_term / search_term)*
boolean_term         = (paren_term / search_term) space? (boolean_operator space? (paren_term / search_term) space?)+
paren_term           = spaces open_paren space? (paren_term / boolean_term)+ space? closed_paren spaces
search_term          = key_val_term / quoted_raw_search / raw_search
key_val_term         = spaces (tag_filter / time_filter / rel_time_filter / specific_time_filter / duration_filter
                       / numeric_filter / aggregate_filter / aggregate_date_filter / aggregate_rel_date_filter / has_filter
                       / is_filter / quoted_basic_filter / basic_filter)
                       spaces
raw_search           = (!key_val_term ~r"\ *([^\ ^\n ()]+)\ *" )*
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
# Aggregate numeric filter
aggregate_filter          = negation? aggregate_key sep operator? (numeric_value / duration_format)
aggregate_date_filter     = negation? aggregate_key sep operator? (date_format / alt_date_format)
aggregate_rel_date_filter = negation? aggregate_key sep operator? rel_date_format

# has filter for not null type checks
has_filter           = negation? "has" sep (search_key / search_value)
is_filter            = negation? "is" sep search_value
tag_filter           = negation? "tags[" search_key "]" sep search_value

aggregate_key        = key space? open_paren space? function_arg* space? closed_paren
function_key         = key space? open_paren space? closed_paren
search_key           = key / quoted_key
search_value         = quoted_value / value
value                = ~r"[^()\s]*"
numeric_value        = ~r"[-]?[0-9\.]+(?=\s|$)"
quoted_value         = ~r"\"((?:[^\"]|(?<=\\)[\"])*)?\""s
key                  = ~r"[a-zA-Z0-9_\.-]+"
function_arg         = space? key? comma? space?
# only allow colons in quoted keys
quoted_key           = ~r"\"([a-zA-Z0-9_\.:-]+)\""

date_format          = ~r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,6})?)?Z?(?=\s|$)"
alt_date_format      = ~r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(\+\d{2}:\d{2})?)?(?=\s|$)"
rel_date_format      = ~r"[\+\-][0-9]+[wdhm](?=\s|$)"
duration_format      = ~r"([0-9\.]+)(ms|s|min|m|hr|h|day|d|wk|w)(?=\s|$)"

# NOTE: the order in which these operators are listed matters
# because for example, if < comes before <= it will match that
# even if the operator is <=
boolean_operator     = "OR" / "AND"
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

no_conversion = set(["start", "end"])

PROJECT_NAME_ALIAS = "project.name"
PROJECT_ALIAS = "project"
ISSUE_ALIAS = "issue"
ISSUE_ID_ALIAS = "issue.id"
USER_ALIAS = "user"
RELEASE_ALIAS = "release"


class InvalidSearchQuery(Exception):
    pass


class SearchBoolean(namedtuple("SearchBoolean", "left_term operator right_term")):
    BOOLEAN_AND = "AND"
    BOOLEAN_OR = "OR"


class SearchFilter(namedtuple("SearchFilter", "key operator value")):
    def __str__(self):
        return "".join(map(six.text_type, (self.key.name, self.operator, self.value.raw_value)))

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
        return TAG_KEY_RE.match(self.name) or self.name not in SEARCH_MAP


class AggregateFilter(namedtuple("AggregateFilter", "key operator value")):
    def __str__(self):
        return "".join(map(six.text_type, (self.key.name, self.operator, self.value.raw_value)))


class AggregateKey(namedtuple("AggregateKey", "name")):
    pass


class SearchValue(namedtuple("SearchValue", "raw_value")):
    @property
    def value(self):
        if self.is_wildcard():
            return translate(self.raw_value)
        return self.raw_value

    def is_wildcard(self):
        if not isinstance(self.raw_value, six.string_types):
            return False
        return bool(WILDCARD_CHARS.search(self.raw_value))


class SearchVisitor(NodeVisitor):
    # A list of mappers that map source keys to a target name. Format is
    # <target_name>: [<list of source names>],
    key_mappings = {}
    duration_keys = set(["transaction.duration"])
    numeric_keys = set(
        [
            "project_id",
            "project.id",
            "issue.id",
            "error.handled",
            "stack.colno",
            "stack.in_app",
            "stack.lineno",
            "stack.stack_level",
            "transaction.duration",
            "apdex",
            "impact",
            "p75",
            "p95",
            "p99",
            "failure_rate",
            "user_misery",
        ]
    )
    date_keys = set(
        [
            "start",
            "end",
            "first_seen",
            "last_seen",
            "time",
            "timestamp",
            "transaction.start_time",
            "transaction.end_time",
        ]
    )

    unwrapped_exceptions = (InvalidSearchQuery,)

    def __init__(self, allow_boolean=True):
        self.allow_boolean = allow_boolean
        super(SearchVisitor, self).__init__()

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
                    for sub in _flatten(item):
                        yield sub
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

    def visit_boolean_term(self, node, children):
        def find_next_operator(children, start, end, operator):
            for index in range(start, end):
                if children[index] == operator:
                    return index
            return None

        def build_boolean_tree_branch(children, start, end, operator):
            index = find_next_operator(children, start, end, operator)
            if index is None:
                return None
            left = build_boolean_tree(children, start, index)
            right = build_boolean_tree(children, index + 1, end)
            return SearchBoolean(left, children[index], right)

        def build_boolean_tree(children, start, end):
            if end - start == 1:
                return children[start]

            result = build_boolean_tree_branch(children, start, end, SearchBoolean.BOOLEAN_OR)
            if result is None:
                result = build_boolean_tree_branch(children, start, end, SearchBoolean.BOOLEAN_AND)

            return result

        children = self.flatten(children)
        children = self.remove_optional_nodes(children)
        children = self.remove_space(children)

        return [build_boolean_tree(children, 0, len(children))]

    def visit_paren_term(self, node, children):
        children = self.flatten(children)
        children = self.remove_optional_nodes(children)
        children = self.remove_space(children)
        return self.flatten(children[1])

    def visit_numeric_filter(self, node, children):
        (search_key, _, operator, search_value) = children
        operator = operator[0] if not isinstance(operator, Node) else "="

        if search_key.name in self.numeric_keys:
            try:
                search_value = SearchValue(int(search_value.text))
            except ValueError:
                raise InvalidSearchQuery(u"Invalid numeric query: {}".format(search_key))
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
            if search_value.expr_name == "duration_format":
                # Even if the search value matches duration format, only act as duration for certain columns
                _, agg_additions = resolve_field(search_key.name, None)
                if len(agg_additions) > 0:
                    # Extract column and function name out so we can check if we should parse as duration
                    if agg_additions[0][-2] in self.duration_keys:
                        aggregate_value = parse_duration(*search_value.match.groups())

            if aggregate_value is None:
                aggregate_value = float(search_value.text)
        except ValueError:
            raise InvalidSearchQuery(u"Invalid aggregate query condition: {}".format(search_key))
        except InvalidQuery as exc:
            raise InvalidSearchQuery(six.text_type(exc))
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
                raise InvalidSearchQuery(six.text_type(exc))
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
                raise InvalidSearchQuery(six.text_type(exc))

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
                raise InvalidSearchQuery(six.text_type(exc))
            return SearchFilter(search_key, operator, SearchValue(search_value))
        else:
            search_value = operator + search_value if operator != "=" else search_value
            return self._handle_basic_filter(search_key, "=", SearchValue(search_value))

    def visit_duration_filter(self, node, children):
        (search_key, _, operator, search_value) = children

        operator = operator[0] if not isinstance(operator, Node) else "="
        if search_key.name in self.duration_keys:
            try:
                search_value = parse_duration(*search_value.match.groups())
            except InvalidQuery as exc:
                raise InvalidSearchQuery(six.text_type(exc))
            return SearchFilter(search_key, operator, SearchValue(search_value))
        else:
            search_value = operator + search_value.text if operator != "=" else search_value.text
            return self._handle_basic_filter(search_key, "=", SearchValue(search_value))

    def visit_rel_time_filter(self, node, children):
        (search_key, _, value) = children
        if search_key.name in self.date_keys:
            try:
                from_val, to_val = parse_datetime_range(value.text)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(six.text_type(exc))

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
            raise InvalidSearchQuery(six.text_type(exc))

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
            raise InvalidSearchQuery(u"Empty string after '{}:'".format(search_key.name))

        return self._handle_basic_filter(search_key, operator, search_value)

    def _handle_basic_filter(self, search_key, operator, search_value):
        # If a date or numeric key gets down to the basic filter, then it means
        # that the value wasn't in a valid format, so raise here.
        if search_key.name in self.date_keys:
            raise InvalidSearchQuery("Invalid format for date search")
        if search_key.name in self.numeric_keys:
            raise InvalidSearchQuery("Invalid format for numeric search")

        return SearchFilter(search_key, operator, search_value)

    def visit_has_filter(self, node, children):
        # the key is has here, which we don't need
        negation, _, _, (search_key,) = children

        # if it matched search value instead, it's not a valid key
        if isinstance(search_key, SearchValue):
            raise InvalidSearchQuery(
                u'Invalid format for "has" search: {}'.format(search_key.raw_value)
            )

        operator = "=" if self.is_negated(negation) else "!="
        return SearchFilter(search_key, operator, SearchValue(""))

    def visit_tag_filter(self, node, children):
        (negation, _, search_key, _, sep, search_value) = children
        operator = "!=" if self.is_negated(negation) else "="
        return SearchFilter(SearchKey(u"tags[{}]".format(search_key.name)), operator, search_value)

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
        return node.text

    def visit_value(self, node, children):
        # A properly quoted value will match the quoted value regex, so any unescaped
        # quotes are errors.
        value = node.text
        idx = value.find('"')
        if idx == 0:
            raise InvalidSearchQuery(
                u"Invalid quote at '{}': quotes must enclose text or be escaped.".format(node.text)
            )

        while idx != -1:
            if value[idx - 1] != "\\":
                raise InvalidSearchQuery(
                    u"Invalid quote at '{}': quotes must enclose text or be escaped.".format(
                        node.text
                    )
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


def parse_search_query(query, allow_boolean=True):
    try:
        tree = event_search_grammar.parse(query)
    except IncompleteParseError as e:
        idx = e.column()
        prefix = query[max(0, idx - 5) : idx]
        suffix = query[idx : (idx + 5)]
        raise InvalidSearchQuery(
            u"{} {}".format(
                u"Parse error at '{}{}' (column {:d}).".format(prefix, suffix, e.column()),
                "This is commonly caused by unmatched parentheses. Enclose any text in double quotes.",
            )
        )
    return SearchVisitor(allow_boolean).visit(tree)


def convert_aggregate_filter_to_snuba_query(aggregate_filter, params):
    name = aggregate_filter.key.name
    value = aggregate_filter.value.value

    value = (
        int(to_timestamp(value)) if isinstance(value, datetime) and name != "timestamp" else value
    )

    if aggregate_filter.operator in ("=", "!=") and aggregate_filter.value.value == "":
        return [["isNull", [name]], aggregate_filter.operator, 1]

    _, agg_additions = resolve_field(name, params)
    if len(agg_additions) > 0:
        name = agg_additions[0][-1]

    condition = [name, aggregate_filter.operator, value]
    return condition


def convert_search_filter_to_snuba_query(search_filter, key=None):
    name = search_filter.key.name if key is None else key
    value = search_filter.value.value

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
            return [["match", ["message", u"'(?i){}'".format(value)]], search_filter.operator, 1]
        else:
            # https://clickhouse.yandex/docs/en/query_language/functions/string_search_functions/#position-haystack-needle
            # positionCaseInsensitive returns 0 if not found and an index of 1 or more if found
            # so we should flip the operator here
            operator = "=" if search_filter.operator == "!=" else "!="
            # make message search case insensitive
            return [["positionCaseInsensitive", ["message", u"'{}'".format(value)]], operator, 0]
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
                u"Invalid value for transaction.status condition. Accepted values are {}".format(
                    ", ".join(SPAN_STATUS_NAME_TO_CODE.keys())
                )
            )
        return [name, search_filter.operator, internal_value]
    elif name == "issue.id":
        # Handle "has" queries
        if search_filter.value.raw_value == "":
            if search_filter.operator == "=":
                # Use isNull to get events with no issue (transactions)
                return [["isNull", [name]], search_filter.operator, 1]
            else:
                # Compare to 0 as group_id is not nullable on issues.
                return [name, search_filter.operator, 0]

        # Skip isNull check on group_id value as we want to
        # allow snuba's prewhere optimizer to find this condition.
        return [name, search_filter.operator, value]
    else:
        value = (
            int(to_timestamp(value)) * 1000
            if isinstance(value, datetime) and name != "timestamp"
            else value
        )
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
        if search_filter.operator == "!=" and not search_filter.key.is_tag:
            # Handle null columns on inequality comparisons. Any comparison
            # between a value and a null will result to null, so we need to
            # explicitly check for whether the condition is null, and OR it
            # together with the inequality check.
            # We don't need to apply this for tags, since if they don't exist
            # they'll always be an empty string.
            is_null_condition = [["isNull", [name]], "=", 1]

        if search_filter.value.is_wildcard():
            condition = [["match", [name, u"'(?i){}'".format(value)]], search_filter.operator, 1]
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


def get_filter(query=None, params=None):
    """
    Returns an eventstore filter given the search text provided by the user and
    URL params
    """
    # NOTE: this function assumes project permissions check already happened
    parsed_terms = []
    if query is not None:
        try:
            parsed_terms = parse_search_query(query, allow_boolean=False)
        except ParseError as e:
            raise InvalidSearchQuery(
                u"Parse error: {} (column {:d})".format(e.expr.name, e.column())
            )

    kwargs = {
        "start": None,
        "end": None,
        "conditions": [],
        "having": [],
        "project_ids": [],
        "group_ids": [],
    }

    def to_list(value):
        if isinstance(value, list):
            return value
        return [value]

    # Used to avoid doing multiple conditions on project ID
    project_to_filter = None
    for term in parsed_terms:
        if isinstance(term, SearchFilter):
            name = term.key.name
            value = term.value.value
            if name in (PROJECT_ALIAS, PROJECT_NAME_ALIAS):
                project = None
                try:
                    project = Project.objects.get(id__in=params.get("project_id", []), slug=value)
                except Exception:
                    raise InvalidSearchQuery(
                        u"Invalid query. Project {} does not exist or is not an actively selected project.".format(
                            value
                        )
                    )

                # Create a new search filter with the correct values
                term = SearchFilter(SearchKey("project_id"), term.operator, SearchValue(project.id))
                converted_filter = convert_search_filter_to_snuba_query(term)
                if converted_filter:
                    if term.operator == "=":
                        project_to_filter = project.id

                    kwargs["conditions"].append(converted_filter)
            elif name == ISSUE_ID_ALIAS and value != "":
                # A blank term value means that this is a has filter
                kwargs["group_ids"].extend(to_list(value))
            elif name == ISSUE_ALIAS:
                if value != "" and params and "organization_id" in params:
                    try:
                        group = Group.objects.by_qualified_short_id(
                            params["organization_id"], value
                        )
                    except Exception:
                        raise InvalidSearchQuery(
                            u"Invalid value '{}' for 'issue:' filter".format(value)
                        )
                    else:
                        value = group.id
                term = SearchFilter(SearchKey("issue.id"), term.operator, SearchValue(value))
                converted_filter = convert_search_filter_to_snuba_query(term)
                kwargs["conditions"].append(converted_filter)
            elif name == USER_ALIAS:
                # If the key is user, do an OR across all the different possible user fields
                user_conditions = [
                    convert_search_filter_to_snuba_query(term, key=field)
                    for field in FIELD_ALIASES[USER_ALIAS]["fields"]
                ]
                if term.operator == "!=" and value != "":
                    kwargs["conditions"].extend(user_conditions)
                else:
                    kwargs["conditions"].append(user_conditions)
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
                                params["organization_id"],
                            )
                        ),
                    )
                )
                if converted_filter:
                    kwargs["conditions"].append(converted_filter)
            elif name in FIELD_ALIASES and name != PROJECT_ALIAS:
                if "column_alias" in FIELD_ALIASES[name]:
                    term = SearchFilter(
                        SearchKey(FIELD_ALIASES[name]["column_alias"]), term.operator, term.value
                    )
                converted_filter = convert_aggregate_filter_to_snuba_query(term, params)
                if converted_filter:
                    kwargs["conditions"].append(converted_filter)
            else:
                converted_filter = convert_search_filter_to_snuba_query(term)
                if converted_filter:
                    kwargs["conditions"].append(converted_filter)
        elif isinstance(term, AggregateFilter):
            converted_filter = convert_aggregate_filter_to_snuba_query(term, params)
            if converted_filter:
                kwargs["having"].append(converted_filter)

    # Keys included as url params take precedent if same key is included in search
    # They are also considered safe and to have had access rules applied unlike conditions
    # from the query string.
    if params:
        for key in ("start", "end"):
            kwargs[key] = params.get(key, None)
        # OrganizationEndpoint.get_filter() uses project_id, but eventstore.Filter uses project_ids
        if "project_id" in params:
            if project_to_filter:
                kwargs["project_ids"] = [project_to_filter]
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


# When adding aliases to this list please also update
# static/app/views/eventsV2/eventQueryParams.tsx so that
# the UI builder stays in sync.
FIELD_ALIASES = {
    "project": {"fields": ["project.id"], "column_alias": "project.id"},
    "issue": {"fields": ["issue.id"], "column_alias": "issue.id"},
    "user": {"fields": ["user.email", "user.username", "user.ip", "user.id"]},
}


def get_json_meta_type(field_alias, snuba_type):
    alias_definition = FIELD_ALIASES.get(field_alias)
    if alias_definition and alias_definition.get("result_type"):
        return alias_definition.get("result_type")
    snuba_json = get_json_type(snuba_type)
    function_match = FUNCTION_ALIAS_PATTERN.match(field_alias)
    if function_match and snuba_json != "string":
        function_definition = FUNCTIONS.get(function_match.group(1))
        if function_definition and function_definition.get("result_type"):
            return function_definition.get("result_type")
    if "duration" in field_alias:
        return "duration"
    if field_alias == "transaction.status":
        return "string"
    return snuba_json


FUNCTION_PATTERN = re.compile(r"^(?P<function>[^\(]+)\((?P<columns>[^\)]*)\)$")


class InvalidFunctionArgument(Exception):
    pass


class ArgValue(object):
    def __init__(self, arg):
        self.arg = arg


class FunctionArg(object):
    def __init__(self, name):
        self.name = name

    def normalize(self, value):
        return value

    def has_default(self, params):
        return False


class CountColumn(FunctionArg):
    def has_default(self, params):
        return None

    def normalize(self, value):
        if value is None:
            return value

        # If we use an alias inside an aggregate, resolve it here
        if value in FIELD_ALIASES:
            value = FIELD_ALIASES[value].get("column_alias", value)

        return value


class NumericColumn(FunctionArg):
    def normalize(self, value):
        snuba_column = SEARCH_MAP.get(value)
        if not snuba_column:
            raise InvalidFunctionArgument(u"{} is not a valid column".format(value))
        elif snuba_column not in ["time", "timestamp", "duration"]:
            raise InvalidFunctionArgument(u"{} is not a numeric column".format(value))
        return snuba_column


class NumericColumnNoLookup(NumericColumn):
    def normalize(self, value):
        super(NumericColumnNoLookup, self).normalize(value)
        return value


class DurationColumn(FunctionArg):
    def normalize(self, value):
        snuba_column = SEARCH_MAP.get(value)
        if not snuba_column:
            raise InvalidFunctionArgument(u"{} is not a valid column".format(value))
        elif snuba_column != "duration":
            raise InvalidFunctionArgument(u"{} is not a duration column".format(value))
        return snuba_column


class DurationColumnNoLookup(DurationColumn):
    def normalize(self, value):
        super(DurationColumnNoLookup, self).normalize(value)
        return value


class NumberRange(FunctionArg):
    def __init__(self, name, start, end):
        super(NumberRange, self).__init__(name)
        self.start = start
        self.end = end

    def normalize(self, value):
        try:
            value = float(value)
        except ValueError:
            raise InvalidFunctionArgument(u"{} is not a number".format(value))

        if self.start and value < self.start:
            raise InvalidFunctionArgument(
                u"{:g} must be greater than or equal to {:g}".format(value, self.start)
            )
        elif self.end and value >= self.end:
            raise InvalidFunctionArgument(u"{:g} must be less than {:g}".format(value, self.end))

        return value


class IntervalDefault(NumberRange):
    def has_default(self, params):
        if not params or not params.get("start") or not params.get("end"):
            raise InvalidFunctionArgument("function called without default")
        elif not isinstance(params.get("start"), datetime) or not isinstance(
            params.get("end"), datetime
        ):
            raise InvalidFunctionArgument("function called with invalid default")

        interval = (params["end"] - params["start"]).total_seconds()
        return int(interval)


# When adding functions to this list please also update
# static/sentry/app/utils/discover/fields.tsx so that
# the UI builder stays in sync.
FUNCTIONS = {
    "percentile": {
        "name": "percentile",
        "args": [DurationColumnNoLookup("column"), NumberRange("percentile", 0, 1)],
        "aggregate": [u"quantile({percentile:.2f})", u"{column}", None],
        "result_type": "duration",
    },
    "p50": {
        "name": "p50",
        "args": [],
        "aggregate": [u"quantile(0.5)", "transaction.duration", None],
        "result_type": "duration",
    },
    "p75": {
        "name": "p75",
        "args": [],
        "aggregate": [u"quantile(0.75)", "transaction.duration", None],
        "result_type": "duration",
    },
    "p95": {
        "name": "p95",
        "args": [],
        "aggregate": [u"quantile(0.95)", "transaction.duration", None],
        "result_type": "duration",
    },
    "p99": {
        "name": "p99",
        "args": [],
        "aggregate": [u"quantile(0.99)", "transaction.duration", None],
        "result_type": "duration",
    },
    "p100": {
        "name": "p100",
        "args": [],
        "aggregate": [u"max", "transaction.duration", None],
        "result_type": "duration",
    },
    "eps": {
        "name": "eps",
        "args": [IntervalDefault("interval", 1, None)],
        "transform": u"divide(count(), {interval:g})",
        "result_type": "number",
    },
    "epm": {
        "name": "epm",
        "args": [IntervalDefault("interval", 60, None)],
        "transform": u"divide(count(), divide({interval:g}, 60))",
        "result_type": "number",
    },
    "last_seen": {
        "name": "last_seen",
        "args": [],
        "aggregate": ["max", "timestamp", "last_seen"],
        "result_type": "date",
    },
    "latest_event": {
        "name": "latest_event",
        "args": [],
        "aggregate": ["argMax", ["id", "timestamp"], "latest_event"],
        "result_type": "string",
    },
    "apdex": {
        "name": "apdex",
        "args": [NumberRange("satisfaction", 0, None)],
        "transform": u"apdex(duration, {satisfaction:g})",
        "result_type": "number",
    },
    "impact": {
        "name": "impact",
        "args": [NumberRange("satisfaction", 0, None)],
        "calculated_args": [{"name": "tolerated", "fn": lambda args: args["satisfaction"] * 4.0}],
        # Snuba is not able to parse Clickhouse infix expressions. We should pass aggregations
        # in a format Snuba can parse so query optimizations can be applied.
        # It has a minimal prefix parser though to bridge the gap between the current state
        # and when we will have an easier syntax.
        "transform": u"plus(minus(1, divide(plus(countIf(less(duration, {satisfaction:g})),divide(countIf(and(greater(duration, {satisfaction:g}),less(duration, {tolerated:g}))),2)),count())),multiply(minus(1,divide(1,sqrt(uniq(user)))),3))",
        "result_type": "number",
    },
    "user_misery": {
        "name": "user_misery",
        "args": [NumberRange("satisfaction", 0, None)],
        "calculated_args": [{"name": "tolerated", "fn": lambda args: args["satisfaction"] * 4.0}],
        "transform": u"uniqIf(user, greater(duration, {tolerated:g}))",
        "result_type": "number",
    },
    "failure_rate": {
        "name": "failure_rate",
        "args": [],
        "transform": "failure_rate()",
        "result_type": "percentage",
    },
    # The user facing signature for this function is histogram(<column>, <num_buckets>)
    # Internally, snuba.discover.query() expands the user request into this value by
    # calculating the bucket size and start_offset.
    "histogram": {
        "name": "histogram",
        "args": [
            DurationColumnNoLookup("column"),
            NumberRange("num_buckets", 1, 500),
            NumberRange("bucket_size", 0, None),
            NumberRange("start_offset", 0, None),
        ],
        "column": [
            "multiply",
            [
                ["floor", [["divide", [u"{column}", ArgValue("bucket_size")]]]],
                ArgValue("bucket_size"),
            ],
            None,
        ],
        "result_type": "number",
    },
    "count_unique": {
        "name": "count_unique",
        "args": [CountColumn("column")],
        "aggregate": ["uniq", u"{column}", None],
        "result_type": "integer",
    },
    # TODO(evanh) Count doesn't accept parameters in the frontend, but we support it here
    # for backwards compatibility. Once we've migrated existing queries this should get
    # changed to accept no parameters.
    "count": {
        "name": "count",
        "args": [CountColumn("column")],
        "aggregate": ["count", None, None],
        "result_type": "integer",
    },
    "min": {
        "name": "min",
        "args": [NumericColumnNoLookup("column")],
        "aggregate": ["min", u"{column}", None],
    },
    "max": {
        "name": "max",
        "args": [NumericColumnNoLookup("column")],
        "aggregate": ["max", u"{column}", None],
    },
    "avg": {
        "name": "avg",
        "args": [DurationColumnNoLookup("column")],
        "aggregate": ["avg", u"{column}", None],
        "result_type": "duration",
    },
    "sum": {
        "name": "sum",
        "args": [DurationColumnNoLookup("column")],
        "aggregate": ["sum", u"{column}", None],
        "result_type": "duration",
    },
    # Currently only being used by the baseline PoC
    "absolute_delta": {
        "name": "absolute_delta",
        "args": [DurationColumn("column"), NumberRange("target", 0, None)],
        "transform": u"abs(minus({column}, {target:g}))",
        "result_type": "duration",
    },
}


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
    columns = [c.strip() for c in match.group("columns").split(",") if len(c.strip()) > 0]
    return get_function_alias_with_columns(match.group("function"), columns)


def get_function_alias_with_columns(function_name, columns):
    columns = "_".join(columns).replace(".", "_")
    return u"{}_{}".format(function_name, columns).rstrip("_")


def format_column_arguments(column, arguments):
    args = column[1]
    for i in range(len(args)):
        if isinstance(args[i], (list, tuple)):
            format_column_arguments(args[i], arguments)
        elif isinstance(args[i], six.string_types):
            args[i] = args[i].format(**arguments)
        elif isinstance(args[i], ArgValue):
            args[i] = arguments[args[i].arg]


def resolve_function(field, match=None, params=None):
    if not match:
        match = FUNCTION_PATTERN.search(field)

    if not match or match.group("function") not in FUNCTIONS:
        raise InvalidSearchQuery(u"{} is not a valid function".format(field))

    function = FUNCTIONS[match.group("function")]
    columns = [c.strip() for c in match.group("columns").split(",") if len(c.strip()) > 0]

    # Some functions can optionally take no parameters (epm(), eps()). In that case use the
    # passed in params to create a default argument if necessary.
    used_default = False
    if len(columns) == 0 and len(function["args"]) == 1:
        try:
            default = function["args"][0].has_default(params)
        except InvalidFunctionArgument as e:
            raise InvalidSearchQuery(u"{}: invalid arguments: {}".format(field, e))

        # Hacky, but we expect column arguments to be strings so easiest to convert it back
        if default is not False:
            columns = [six.text_type(default) if default else default]
            used_default = True

    if len(columns) != len(function["args"]):
        raise InvalidSearchQuery(
            u"{}: expected {:g} arguments".format(field, len(function["args"]))
        )

    arguments = {}
    for column_value, argument in zip(columns, function["args"]):
        try:
            normalized_value = argument.normalize(column_value)
            arguments[argument.name] = normalized_value
        except InvalidFunctionArgument as e:
            raise InvalidSearchQuery(u"{}: {} argument invalid: {}".format(field, argument.name, e))

    if "calculated_args" in function:
        for calculation in function["calculated_args"]:
            arguments[calculation["name"]] = calculation["fn"](arguments)

    if "transform" in function:
        snuba_string = function["transform"].format(**arguments)
        return (
            [],
            [
                [
                    snuba_string,
                    None,
                    get_function_alias_with_columns(
                        function["name"], columns if not used_default else []
                    ),
                ]
            ],
        )
    elif "aggregate" in function:
        aggregate = deepcopy(function["aggregate"])

        aggregate[0] = aggregate[0].format(**arguments)
        if isinstance(aggregate[1], six.string_types):
            aggregate[1] = aggregate[1].format(**arguments)

        if aggregate[2] is None:
            aggregate[2] = get_function_alias_with_columns(
                function["name"], columns if not used_default else []
            )

        return ([], [aggregate])
    elif "column" in function:
        # These can be very nested functions, so we need to iterate through all the layers
        addition = deepcopy(function["column"])
        format_column_arguments(addition, arguments)
        if len(addition) < 3:
            addition.append(
                get_function_alias_with_columns(
                    function["name"], columns if not used_default else []
                )
            )
        elif len(addition) == 3 and addition[2] is None:
            addition[2] = get_function_alias_with_columns(
                function["name"], columns if not used_default else []
            )
        return ([addition], [])


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
            and FIELD_ALIASES[bare_column].get("column_alias")
            and bare_column != PROJECT_ALIAS
        ):
            prefix = "-" if column.startswith("-") else ""
            validated.append(prefix + FIELD_ALIASES[bare_column]["column_alias"])
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
    return u"{}_{}".format(match.group("function"), column).rstrip("_")


def resolve_field(field, params=None):
    if not isinstance(field, six.string_types):
        raise InvalidSearchQuery("Field names must be strings")

    match = is_function(field)
    if match:
        return resolve_function(field, match, params)

    if field in FIELD_ALIASES:
        special_field = deepcopy(FIELD_ALIASES[field])
        return (special_field.get("fields", []), None)
    return ([field], None)


def resolve_field_list(fields, snuba_filter, auto_fields=True):
    """
    Expand a list of fields based on aliases and aggregate functions.

    Returns a dist of aggregations, selected_columns, and
    groupby that can be merged into the result of get_snuba_query_args()
    to build a more complete snuba query based on event search conventions.
    """
    aggregations = []
    columns = []
    groupby = []
    project_key = ""

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
        if isinstance(field, six.string_types) and field.strip() == "":
            continue
        column_additions, agg_additions = resolve_field(field, snuba_filter.date_params)
        if column_additions:
            columns.extend([column for column in column_additions if column not in columns])

        if agg_additions:
            aggregations.extend(agg_additions)

    rollup = snuba_filter.rollup
    if not rollup and auto_fields:
        # Ensure fields we require to build a functioning interface
        # are present. We don't add fields when using a rollup as the additional fields
        # would be aggregated away.
        if not aggregations and "id" not in columns:
            columns.append("id")
        if not aggregations and "project.id" not in columns:
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
            project_key = "`{}`".format(project_key)
        columns.append(
            [
                "transform",
                [
                    # This is a workaround since having the column by itself currently is being treated as a function
                    ["toString", ["project_id"]],
                    ["array", [u"'{}'".format(project["id"]) for project in projects]],
                    ["array", [u"'{}'".format(project["slug"]) for project in projects]],
                    # Default case, what to do if a project id without a slug is found
                    "''",
                ],
                project_key,
            ]
        )

    if rollup and columns and not aggregations:
        raise InvalidSearchQuery("You cannot use rollup without an aggregate field.")

    orderby = snuba_filter.orderby
    if orderby:
        orderby = resolve_orderby(orderby, columns, aggregations)

    # If aggregations are present all columns
    # need to be added to the group by so that the query is valid.
    if aggregations:
        for column in columns:
            if isinstance(column, (list, tuple)):
                if column[0] == "transform":
                    # When there's a project transform, we already group by project_id
                    continue
                groupby.append(column[2])
            else:
                groupby.append(column)

    return {
        "selected_columns": columns,
        "aggregations": aggregations,
        "groupby": groupby,
        "orderby": orderby,
    }


TAG_KEY_RE = re.compile(r"^tags\[(.*)\]$")
