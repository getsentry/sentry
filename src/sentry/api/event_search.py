from __future__ import absolute_import

from collections import namedtuple
from parsimonious.grammar import Grammar, NodeVisitor


event_search_grammar = Grammar(r"""

search          = filter+
filter          = space? search_key sep search_value space?
search_key      = ~r"[a-z]*\.?[a-z]*"
search_value    = ~r"\S*"

sep     = ":"
space   = ~r"\s"
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
    }
}


class InvalidSearchQuery(Exception):
    pass


class SearchFilter(namedtuple('SearchFilter', 'key value')):
    pass


class SearchKey(namedtuple('SearchKey', 'name')):

    @property
    def snuba_name(self):
        return FIELD_LOOKUP[self.name]['snuba_name']


class SearchValue(namedtuple('SearchValue', 'raw_value type')):

    @property
    def parsed_value(self):
        # TODO(jess): support parsing timestamps
        return self.raw_value


class SearchVisitor(NodeVisitor):

    unwrapped_exceptions = (InvalidSearchQuery,)

    def visit_search(self, node, children):
        return filter(None, children)

    def visit_filter(self, node, children):
        search_key = children[1]
        search_value = children[3]
        try:
            return SearchFilter(
                SearchKey(search_key),
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


def get_snuba_query_args(query):
    parsed_filters = parse_search_query(query)
    conditions = []
    for _filter in parsed_filters:
        conditions.append([
            _filter.key.snuba_name,
            '=',
            _filter.value.parsed_value,
        ])

    return {'conditions': conditions}
