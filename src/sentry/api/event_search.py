from __future__ import absolute_import

import re
from collections import namedtuple
from datetime import datetime

import six
from django.utils.functional import cached_property
from parsimonious.exceptions import ParseError
from parsimonious.nodes import Node
from parsimonious.grammar import Grammar, NodeVisitor

from sentry.search.utils import (
    parse_datetime_range,
    parse_datetime_string,
    parse_datetime_value,
    InvalidQuery,
)
from sentry.utils.dates import to_timestamp
from sentry.utils.snuba import SENTRY_SNUBA_MAP

WILDCARD_CHARS = re.compile(r'[\*]')


def translate(pat):
    """Translate a shell PATTERN to a regular expression.
    modified from: https://github.com/python/cpython/blob/2.7/Lib/fnmatch.py#L85
    """

    i, n = 0, len(pat)
    res = ''
    while i < n:
        c = pat[i]
        i = i + 1
        # fnmatch.translate has no way to handle escaping metacharacters.
        # Applied this basic patch to handle it:
        # https://bugs.python.org/file27570/issue8402.1.patch
        if c == '\\':
            res += re.escape(pat[i])
            i += 1
        elif c == '*':
            res = res + '.*'
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
        else:
            res = res + re.escape(c)
    return '^' + res + '$'


# Explaination of quoted string regex, courtesy of Matt
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


event_search_grammar = Grammar(r"""
search          = search_term*
search_term     = key_val_term / quoted_raw_search / raw_search
key_val_term    = space? (time_filter / rel_time_filter / specific_time_filter
                  / numeric_filter / has_filter / is_filter / basic_filter)
                  space?
raw_search      = (!key_val_term ~r"\ *([^\ ^\n]+)\ *" )*
quoted_raw_search = spaces quoted_value spaces

# standard key:val filter
basic_filter    = negation? search_key sep search_value
# filter for dates
time_filter     = search_key sep? operator date_format
# filter for relative dates
rel_time_filter = search_key sep rel_date_format
# exact time filter for dates
specific_time_filter = search_key sep date_format
# Numeric comparison filter
numeric_filter  = search_key sep operator? ~r"[0-9]+(?=\s|$)"

# has filter for not null type checks
has_filter      = negation? "has" sep (search_key / search_value)
is_filter       = negation? "is" sep search_value

search_key      = key / quoted_key
search_value    = quoted_value / value
value           = ~r"\S*"
quoted_value    = ~r"\"((?:[^\"]|(?<=\\)[\"])*)?\""s
key             = ~r"[a-zA-Z0-9_\.-]+"
# only allow colons in quoted keys
quoted_key      = ~r"\"([a-zA-Z0-9_\.:-]+)\""

date_format     = ~r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,6})?)?Z?(?=\s|$)"
rel_date_format = ~r"[\+\-][0-9]+[wdhm](?=\s|$)"

# NOTE: the order in which these operators are listed matters
# because for example, if < comes before <= it will match that
# even if the operator is <=
operator        = ">=" / "<=" / ">" / "<" / "=" / "!="
sep             = ":"
space           = " "
negation        = "!"
spaces          = ~r"\ *"
""")


# add valid snuba `raw_query` args
SEARCH_MAP = dict({
    'start': 'start',
    'end': 'end',
    'project_id': 'project_id',
    'first_seen': 'first_seen',
    'last_seen': 'last_seen',
    'times_seen': 'times_seen',
}, **SENTRY_SNUBA_MAP)
no_conversion = set(['project_id', 'start', 'end'])


class InvalidSearchQuery(Exception):
    pass


class SearchFilter(namedtuple('SearchFilter', 'key operator value')):

    def __str__(self):
        return ''.join(
            map(six.text_type, (self.key.name, self.operator, self.value.raw_value)),
        )

    @cached_property
    def is_negation(self):
        # Negations are mostly just using != operators. But we also have
        # negations on has: filters, which translate to = '', so handle that
        # case as well.
        return (
            self.operator == '!=' and self.value.raw_value != ''
            or self.operator == '=' and self.value.raw_value == ''
        )


class SearchKey(namedtuple('SearchKey', 'name')):

    @property
    def snuba_name(self):
        snuba_name = SEARCH_MAP.get(self.name)
        if snuba_name:
            return snuba_name
        # assume custom tag if not listed
        return 'tags[%s]' % (self.name,)

    @cached_property
    def is_tag(self):
        return self.name not in SEARCH_MAP


class SearchValue(namedtuple('SearchValue', 'raw_value')):

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
    numeric_keys = set([
        'device.battery_level', 'device.charging', 'device.online',
        'device.simulator', 'error.handled', 'issue.id', 'stack.colno',
        'stack.in_app', 'stack.lineno', 'stack.stack_level',

    ])
    date_keys = set([
        'start', 'end', 'first_seen', 'last_seen', 'time', 'timestamp',
    ])

    unwrapped_exceptions = (InvalidSearchQuery,)

    @cached_property
    def key_mappings_lookup(self):
        lookup = {}
        for target_field, source_fields in self.key_mappings.items():
            for source_field in source_fields:
                lookup[source_field] = target_field
        return lookup

    def visit_search(self, node, children):
        # there is a list from search_term and one from raw_search, so flatten them.
        # Flatten each group in the list, since nodes can return multiple items
        def _flatten(seq):
            for item in seq:
                if isinstance(item, list):
                    for sub in _flatten(item):
                        yield sub
                else:
                    yield item
        children = [child for group in children for child in _flatten(group)]
        children = filter(None, _flatten(children))

        return children

    def visit_key_val_term(self, node, children):
        _, key_val_term, _ = children
        # key_val_term is a list because of group
        return key_val_term[0]

    def visit_raw_search(self, node, children):
        value = node.text.strip(' ')

        if not value:
            return None

        return SearchFilter(
            SearchKey('message'),
            "=",
            SearchValue(value),
        )

    def visit_quoted_raw_search(self, node, children):
        value = children[1]
        if not value:
            return None
        return SearchFilter(SearchKey('message'), "=", SearchValue(value))

    def visit_numeric_filter(self, node, children):
        (search_key, _, operator, search_value) = children
        operator = operator[0] if not isinstance(operator, Node) else '='

        if search_key.name in self.numeric_keys:
            try:
                search_value = SearchValue(int(search_value.text))
            except ValueError:
                raise InvalidSearchQuery('Invalid numeric query: %s' % (search_key,))
            return SearchFilter(search_key, operator, search_value)
        else:
            search_value = SearchValue(
                operator + search_value.text if operator != '=' else search_value.text,
            )
            return self._handle_basic_filter(search_key, '=', search_value)

    def visit_time_filter(self, node, children):
        (search_key, _, operator, search_value) = children
        if search_key.name in self.date_keys:
            try:
                search_value = parse_datetime_string(search_value)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(exc.message)
            return SearchFilter(search_key, operator, SearchValue(search_value))
        else:
            search_value = operator + search_value if operator != '=' else search_value
            return self._handle_basic_filter(search_key, '=', SearchValue(search_value))

    def visit_rel_time_filter(self, node, children):
        (search_key, _, value) = children
        if search_key.name in self.date_keys:
            try:
                from_val, to_val = parse_datetime_range(value.text)
            except InvalidQuery as exc:
                raise InvalidSearchQuery(exc.message)

            # TODO: Handle negations
            if from_val is not None:
                operator = '>='
                search_value = from_val[0]
            else:
                operator = '<='
                search_value = to_val[0]
            return SearchFilter(search_key, operator, SearchValue(search_value))
        else:
            return self._handle_basic_filter(search_key, '=', SearchValue(value.text))

    def visit_specific_time_filter(self, node, children):
        # If we specify a specific date, it means any event on that day, and if
        # we specify a specific datetime then it means a few minutes interval
        # on either side of that datetime
        (search_key, _, date_value) = children
        if search_key.name not in self.date_keys:
            return self._handle_basic_filter(search_key, '=', SearchValue(date_value))

        try:
            from_val, to_val = parse_datetime_value(date_value)
        except InvalidQuery as exc:
            raise InvalidSearchQuery(exc.message)

        # TODO: Handle negations here. This is tricky because these will be
        # separate filters, and to negate this range we need (< val or >= val).
        # We currently AND all filters together, so we'll need extra logic to
        # handle. Maybe not necessary to allow negations for this.
        return [
            SearchFilter(
                search_key,
                '>=',
                SearchValue(from_val[0]),
            ),
            SearchFilter(
                search_key,
                '<',
                SearchValue(to_val[0]),
            ),
        ]

    def visit_operator(self, node, children):
        return node.text

    def visit_date_format(self, node, children):
        return node.text

    def is_negated(self, node):
        # Because negations are always optional, parsimonious returns a list of nodes
        # containing one node when a negation exists, and a single node when it doesn't.
        if isinstance(node, list):
            node = node[0]

        return node.text == '!'

    def visit_basic_filter(self, node, children):
        (negation, search_key, _, search_value) = children
        operator = '!=' if self.is_negated(negation) else '='
        return self._handle_basic_filter(search_key, operator, search_value)

    def _handle_basic_filter(self, search_key, operator, search_value):
        # If a date or numeric key gets down to the basic filter, then it means
        # that the value wasn't in a valid format, so raise here.
        if search_key.name in self.date_keys:
            raise InvalidSearchQuery('Invalid format for date search')
        if search_key.name in self.numeric_keys:
            raise InvalidSearchQuery('Invalid format for numeric search')

        return SearchFilter(search_key, operator, search_value)

    def visit_has_filter(self, node, children):
        # the key is has here, which we don't need
        negation, _, _, (search_key,) = children

        # if it matched search value instead, it's not a valid key
        if isinstance(search_key, SearchValue):
            raise InvalidSearchQuery(
                'Invalid format for "has" search: %s' %
                (search_key.raw_value,))

        operator = '=' if self.is_negated(negation) else '!='

        return SearchFilter(
            search_key,
            operator,
            SearchValue(''),
        )

    def visit_is_filter(self, node, children):
        raise InvalidSearchQuery('"is" queries are not supported on this search')

    def visit_search_key(self, node, children):
        key = children[0]
        return SearchKey(self.key_mappings_lookup.get(key, key))

    def visit_search_value(self, node, children):
        return SearchValue(children[0])

    def visit_value(self, node, children):
        return node.text

    def visit_key(self, node, children):
        return node.text

    def visit_quoted_value(self, node, children):
        return node.match.groups()[0].replace('\\"', '"')

    def visit_quoted_key(self, node, children):
        return node.match.groups()[0]

    def generic_visit(self, node, children):
        return children or node


def parse_search_query(query):
    tree = event_search_grammar.parse(query)
    return SearchVisitor().visit(tree)


def convert_endpoint_params(params):
    return [
        SearchFilter(
            SearchKey(key),
            '=',
            SearchValue(params[key]),
        ) for key in params
    ]


def convert_search_filter_to_snuba_query(search_filter):
    snuba_name = search_filter.key.snuba_name
    value = search_filter.value.value

    if snuba_name in no_conversion:
        return
    elif snuba_name == 'tags[environment]':
        env_conditions = []
        _envs = set(value if isinstance(value, (list, tuple)) else [value])
        # the "no environment" environment is null in snuba
        if '' in _envs:
            _envs.remove('')
            operator = 'IS NULL' if search_filter.operator == '=' else 'IS NOT NULL'
            env_conditions.append(['tags[environment]', operator, None])

        if _envs:
            env_conditions.append(['tags[environment]', 'IN', list(_envs)])

        return env_conditions

    elif snuba_name == 'message':
        if search_filter.value.is_wildcard():
            # XXX: We don't want the '^$' values at the beginning and end of
            # the regex since we want to find the pattern anywhere in the
            # message. Strip off here
            value = search_filter.value.value[1:-1]
            return [['match', ['message', "'(?i)%s'" % (value,)]], search_filter.operator, 1]
        else:
            # https://clickhouse.yandex/docs/en/query_language/functions/string_search_functions/#position-haystack-needle
            # positionCaseInsensitive returns 0 if not found and an index of 1 or more if found
            # so we should flip the operator here
            operator = '=' if search_filter.operator == '!=' else '!='
            # make message search case insensitive
            return [['positionCaseInsensitive', ['message', "'%s'" % (value,)]], operator, 0]

    else:
        value = int(to_timestamp(value)) * 1000 if isinstance(value,
                                                              datetime) and snuba_name != 'timestamp' else value

        # Tags are never null, but promoted tags are columns and so can be null.
        # To handle both cases, use `ifNull` to convert to an empty string and
        # compare so we need to check for empty values.
        if search_filter.key.is_tag:
            snuba_name = ['ifNull', [snuba_name, "''"]]

        # Handle checks for existence
        if search_filter.operator in ('=', '!=') and search_filter.value.value == '':
            if search_filter.key.is_tag:
                return [snuba_name, search_filter.operator, value]
            else:
                # If not a tag, we can just check that the column is null.
                return [['isNull', [snuba_name]], search_filter.operator, 1]

        is_null_condition = None
        if search_filter.operator == '!=' and not search_filter.key.is_tag:
            # Handle null columns on inequality comparisons. Any comparison
            # between a value and a null will result to null, so we need to
            # explicitly check for whether the condition is null, and OR it
            # together with the inequality check.
            # We don't need to apply this for tags, since if they don't exist
            # they'll always be an empty string.
            is_null_condition = [['isNull', [snuba_name]], '=', 1]

        if search_filter.value.is_wildcard():
            condition = [['match', [snuba_name, "'(?i)%s'" % (value,)]], search_filter.operator, 1]
        else:
            condition = [snuba_name, search_filter.operator, value]

        # We only want to return as a list if we have the check for null
        # present. Returning as a list causes these conditions to be ORed
        # together. Otherwise just return the raw condition, so that it can be
        # used correctly in aggregates.
        if is_null_condition:
            return [is_null_condition, condition]
        else:
            return condition


def get_snuba_query_args(query=None, params=None):
    # NOTE: this function assumes project permissions check already happened
    parsed_filters = []
    if query is not None:
        try:
            parsed_filters = parse_search_query(query)
        except ParseError as e:
            raise InvalidSearchQuery(
                u'Parse error: %r (column %d)' % (e.expr.name, e.column())
            )

    # Keys included as url params take precedent if same key is included in search
    if params is not None:
        parsed_filters.extend(convert_endpoint_params(params))

    kwargs = {
        'conditions': [],
        'filter_keys': {},
    }
    for _filter in parsed_filters:
        snuba_name = _filter.key.snuba_name

        if snuba_name in ('start', 'end'):
            kwargs[snuba_name] = _filter.value.value
        elif snuba_name in ('project_id', 'issue'):
            kwargs['filter_keys'][snuba_name] = _filter.value.value
        else:
            converted_filter = convert_search_filter_to_snuba_query(_filter)
            kwargs['conditions'].append(converted_filter)
    return kwargs
