from __future__ import absolute_import

from collections import namedtuple
from parsimonious.grammar import Grammar, NodeVisitor


event_search_grammar = Grammar(r"""

search          = search_term* raw_search?
search_term     = space? basic_filter space?
raw_search      = ~r".+$"
# standard key:val filter
basic_filter    = search_key sep search_value
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
    },
    'message': {
        'snuba_name': 'message',
        'type': 'string',
    }
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

    @property
    def parsed_value(self):
        # TODO(jess): support parsing timestamps
        return self.raw_value


class SearchVisitor(NodeVisitor):

    unwrapped_exceptions = (InvalidSearchQuery,)

    def visit_search(self, node, children):
        # there is a list from search_term and one from raw_search, so flatten them
        children = [child for group in children for child in group]
        return filter(None, children)

    def visit_search_term(self, node, children):
        _, search_term, _ = children
        return search_term

    def visit_raw_search(self, node, children):
        return SearchFilter(
            SearchKey('message'),
            "=",
            SearchValue(node.text, FIELD_LOOKUP['message']['type']),
        )

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


def get_snuba_query_args(query):
    parsed_filters = parse_search_query(query)
    conditions = []
    for _filter in parsed_filters:
        conditions.append([
            _filter.key.snuba_name,
            _filter.operator,
            _filter.value.parsed_value,
        ])

    return {'conditions': conditions}
