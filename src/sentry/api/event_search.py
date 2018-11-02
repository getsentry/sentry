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
search_value    = quoted_value / value
value           = ~r"\S*"
quoted_value    = ~r"\"(.*)\""s

date_formats    = date_time_micro / date_time / date
date            = ~r"\d{4}-\d{2}-\d{2}"
date_time       = ~r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
date_time_micro = ~r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,6}"

# NOTE: the order in which these operators are listed matters
# because for example, if < comes before <= it will match that
# even if the operator is <=
operator        = ">=" / "<=" / ">" / "<" / "=" / "!="
sep             = ":"
space           = ~r" "
""")

FIELD_LOOKUP = {
    'user.id': {
        'snuba_name': 'user_id',
        'type': 'string',
    },
    'user.email': {
        'snuba_name': 'email',
        'type': 'string',
    },
    'user.username': {
        'snuba_name': 'username',
        'type': 'string',
    },
    'user.ip': {
        'snuba_name': 'ip_address',
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
    'type': {
        'snuba_name': 'type',
        'type': 'string',
    },
    'environment': {
        'snuba_name': 'environment',
        'type': 'string',
    },
    'platform': {
        'snuba_name': 'platform',
        'type': 'string',
    },
    'stack.filename': {
        'snuba_name': 'exception_frames.filename',
        'type': 'string',
    },
    'stack.module': {
        'snuba_name': 'exception_frames.module',
        'type': 'string',
    },
    'http.url': {
        'snuba_name': 'url',
        'type': 'string',
    },
    'http.method': {
        'snuba_name': 'http_method',
        'type': 'string',
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
        return children[0]

    def visit_value(self, node, children):
        return node.text

    def visit_quoted_value(self, node, children):
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
        snuba_name = _filter.key.snuba_name
        value = _filter.value.raw_value

        if snuba_name in ('start', 'end'):
            kwargs[snuba_name] = value

        # environment can also be passed as a condition
        elif snuba_name in ('project_id', 'environment') and isinstance(value, (list, tuple)):
            kwargs['filter_keys'][snuba_name] = value

        elif snuba_name == 'message':
            # make message search case insensitive
            kwargs['conditions'].append(
                [['positionCaseInsensitive', ['message', "'%s'" % (value,)]], '!=', 0]
            )

        else:
            kwargs['conditions'].append([
                snuba_name,
                _filter.operator,
                value,
            ])

    return kwargs
