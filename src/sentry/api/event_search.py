from __future__ import absolute_import

import re
import six

from collections import namedtuple

from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar, NodeVisitor

from sentry.search.utils import parse_datetime_string, InvalidQuery
from sentry.utils.snuba import SENTRY_SNUBA_MAP

WILDCARD_CHARS = re.compile(r'[\*\[\]\?]')


def translate(pat):
    """Translate a shell PATTERN to a regular expression.
    There is no way to quote meta-characters.
    modified from: https://github.com/python/cpython/blob/2.7/Lib/fnmatch.py#L85
    """

    i, n = 0, len(pat)
    res = ''
    while i < n:
        c = pat[i]
        i = i + 1
        if c == '*':
            res = res + '.*'
        elif c == '?':
            res = res + '.'
        elif c == '[':
            j = i
            if j < n and pat[j] == '!':
                j = j + 1
            if j < n and pat[j] == ']':
                j = j + 1
            while j < n and pat[j] != ']':
                j = j + 1
            if j >= n:
                res = res + '\\['
            else:
                stuff = pat[i:j].replace('\\', '\\\\')
                i = j + 1
                if stuff[0] == '!':
                    stuff = '^' + stuff[1:]
                elif stuff[0] == '^':
                    stuff = '\\' + stuff
                res = '%s[%s]' % (res, stuff)
        else:
            res = res + re.escape(c)
    return '^' + res + '$'


event_search_grammar = Grammar(r"""
# raw_search must come at the end, otherwise other
# search_terms will be treated as a raw query
search          = search_term* raw_search?
search_term     = space? (time_filter / has_filter / basic_filter) space?
raw_search      = ~r".+$"

# standard key:val filter
basic_filter    = negation? search_key sep search_value
# filter specifically for the timestamp
time_filter     = "timestamp" operator date_format
# has filter for not null type checks
has_filter      = negation? "has" sep (search_key / search_value)

search_key      = key / quoted_key
search_value    = quoted_value / value
value           = ~r"\S*"
quoted_value    = ~r"\"(.*)\""s
key             = ~r"[a-zA-Z0-9_\.-]+"
# only allow colons in quoted keys
quoted_key      = ~r"\"([a-zA-Z0-9_\.:-]+)\""

date_format    = ~r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,6})?)?"

# NOTE: the order in which these operators are listed matters
# because for example, if < comes before <= it will match that
# even if the operator is <=
operator        = ">=" / "<=" / ">" / "<" / "=" / "!="
sep             = ":"
space           = " "
negation        = "!"
""")


# add valid snuba `raw_query` args
SEARCH_MAP = dict({
    'start': 'start',
    'end': 'end',
    'project_id': 'project_id',
}, **SENTRY_SNUBA_MAP)


class InvalidSearchQuery(Exception):
    pass


class SearchFilter(namedtuple('SearchFilter', 'key operator value')):
    pass


class SearchKey(namedtuple('SearchKey', 'name')):

    @property
    def snuba_name(self):
        snuba_name = SEARCH_MAP.get(self.name)
        if snuba_name:
            return snuba_name
        # assume custom tag if not listed
        return 'tags[%s]' % (self.name,)


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

    unwrapped_exceptions = (InvalidSearchQuery,)

    def visit_search(self, node, children):
        # there is a list from search_term and one from raw_search, so flatten them
        children = [child for group in children for child in group]
        return filter(None, children)

    def visit_search_term(self, node, children):
        _, search_term, _ = children
        # search_term is a list because of group
        return search_term[0]

    def visit_raw_search(self, node, children):
        return SearchFilter(
            SearchKey('message'),
            "=",
            SearchValue(node.text),
        )

    def visit_time_filter(self, node, children):
        search_key_node, operator, search_value = children
        search_key = search_key_node.text
        try:
            search_value = parse_datetime_string(search_value)
        except InvalidQuery as exc:
            raise InvalidSearchQuery(exc.message)

        try:
            return SearchFilter(
                SearchKey(search_key),
                operator,
                SearchValue(search_value),
            )
        except KeyError:
            raise InvalidSearchQuery('Unsupported search term: %s' % (search_key,))

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
        negation, search_key, _, search_value = children
        operator = '!=' if self.is_negated(negation) else '='

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

    def visit_search_key(self, node, children):
        return SearchKey(children[0])

    def visit_search_value(self, node, children):
        return SearchValue(children[0])

    def visit_value(self, node, children):
        return node.text

    def visit_key(self, node, children):
        return node.text

    def visit_quoted_value(self, node, children):
        return node.match.groups()[0]

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
        value = _filter.value.value

        if snuba_name in ('start', 'end'):
            kwargs[snuba_name] = value

        elif snuba_name == 'tags[environment]':
            env_conditions = []
            _envs = set(value if isinstance(value, (list, tuple)) else [value])
            # the "no environment" environment is null in snuba
            if '' in _envs:
                _envs.remove('')
                env_conditions.append(['tags[environment]', 'IS NULL', None])

            if _envs:
                env_conditions.append(['tags[environment]', 'IN', list(_envs)])

            kwargs['conditions'].append(env_conditions)

        elif snuba_name == 'project_id':
            kwargs['filter_keys'][snuba_name] = value

        elif snuba_name == 'message':
            # make message search case insensitive
            kwargs['conditions'].append(
                [['positionCaseInsensitive', ['message', "'%s'" % (value,)]], '!=', 0]
            )

        else:
            if _filter.operator == '!=' or _filter.operator == '=' and _filter.value.value == '':
                # Handle null columns on (in)equality comparisons. Any comparison between a value
                # and a null will result to null. There are two cases we handle here:
                # - A column doesn't equal a value. In this case, we need to convert the column to
                # an empty string so that we don't exclude rows that have it set to null
                # - Checking that a value isn't present. In some cases the column will be null,
                # and in other cases an empty string. To generalize this we convert values in the
                # column to an empty string and just check for that.
                snuba_name = ['ifNull', [snuba_name, "''"]]

            if _filter.value.is_wildcard():
                kwargs['conditions'].append(
                    [['match', [snuba_name, "'%s'" % (value,)]], _filter.operator, 1]
                )
            else:
                kwargs['conditions'].append([snuba_name, _filter.operator, value])
    return kwargs
