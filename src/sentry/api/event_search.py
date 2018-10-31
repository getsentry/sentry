from __future__ import absolute_import

from collections import namedtuple

from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar, NodeVisitor

from sentry.search.utils import parse_datetime_string, InvalidQuery

event_search_grammar = Grammar(r"""
# raw_search must come at the end, otherwise other
# search_terms will be treated as a raw query
search          = search_term* raw_search?
search_term     = space? (time_filter / basic_filter) space?
raw_search      = ~r".+$"

# standard key:val filter
basic_filter    = search_key sep search_value
# filter specifically for the timestamp
time_filter     = "timestamp" operator date_formats

search_key      = ~r"[a-z]*\.?[a-z]*"
search_value    = ~r"\S*"

date_formats    = date_time_micro / date_time / date
date            = ~r"\d{4}-\d{2}-\d{2}"
date_time       = ~r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
date_time_micro = ~r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,6}"

# NOTE: the order in which these operators are listed matters
# because for example, if < comes before <= it will match that
# even if the operator is <=
operator        = ">=" / "<=" / ">" / "<" / "=" / "!="
sep             = ":"
space           = ~r"\s"
"""
)

FIELD_LOOKUP = {
    'user.id': {
        'snuba_name': 'user_id',
        'type': 'string',
    },
    'user.email': {
        'snuba_name': 'email',
        'type': 'string',
    },
    'release': {
        'snuba_name': 'sentry:release',
        'type': 'string',
    },
    'message': {
        'snuba_name': 'message',
        'type': 'string',
    },
    'timestamp': {
        'snuba_name': 'timestamp',
        'type': 'timestamp',
    },
    'start': {
        'snuba_name': 'start',
        'type': 'timestamp',
    },
    'end': {
        'snuba_name': 'end',
        'type': 'timestamp',
    },
    'project_id': {
        'snuba_name': 'project_id',
        'type': 'list',
    },
}


class InvalidSearchQuery(Exception):
    pass


class SearchFilter(namedtuple('SearchFilter', 'key operator value')):
    pass


class SearchKey(namedtuple('SearchKey', 'name')):

    @property
    def snuba_name(self):
        return FIELD_LOOKUP[self.name]['snuba_name']


class SearchValue(namedtuple('SearchValue', 'raw_value type')):
    pass


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
            SearchValue(node.text, FIELD_LOOKUP['message']['type']),
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
                SearchValue(search_value, FIELD_LOOKUP[search_key]['type']),
            )
        except KeyError:
            raise InvalidSearchQuery('Unsupported search term: %s' % (search_key,))

    def visit_operator(self, node, children):
        return node.text

    def visit_date_formats(self, node, children):
        return node.text

    def visit_basic_filter(self, node, children):
        search_key, _, search_value = children
        try:
            return SearchFilter(
                SearchKey(search_key),
                "=",
                SearchValue(search_value, FIELD_LOOKUP[search_key]['type']),
            )
        except KeyError:
            raise InvalidSearchQuery('Unsupported search term: %s' % (search_key,))

    def visit_search_key(self, node, children):
        return node.text

    def visit_search_value(self, node, children):
        return node.text

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
            SearchValue(params[key], FIELD_LOOKUP[key]['type']),
        ) for key in params
    ]


def get_snuba_query_args(query=None, params=None):
    # NOTE: this function assumes project permisions check already happened
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
        if _filter.key.snuba_name in ('start', 'end'):
            kwargs[_filter.key.snuba_name] = _filter.value.raw_value

        elif _filter.key.snuba_name == 'project_id':
            kwargs['filter_keys'][_filter.key.snuba_name] = _filter.value.raw_value

        elif _filter.key.snuba_name == 'message':
            # make message search case insensitive
            kwargs['conditions'].append(
                [['positionCaseInsensitive', ['message', "'%s'" %
                                              (_filter.value.raw_value,)]], '!=', 0]
            )

        else:
            kwargs['conditions'].append([
                _filter.key.snuba_name,
                _filter.operator,
                _filter.value.raw_value,
            ])

    return kwargs
