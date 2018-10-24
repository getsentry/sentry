from __future__ import absolute_import

from sentry.api.event_search import (
    get_snuba_query_args, parse_search_query, InvalidSearchQuery, SearchFilter, SearchKey, SearchValue
)
from sentry.testutils import TestCase


class EventSearchTest(TestCase):
    def test_parse_search_query(self):
        assert parse_search_query('user.email:foo@example.com release:1.2.1') == [
            SearchFilter(
                key=SearchKey(name='user.email'),
                value=SearchValue(raw_value='foo@example.com', type='string')
            ),
            SearchFilter(
                key=SearchKey(name='release'),
                value=SearchValue(raw_value='1.2.1', type='string')
            )
        ]

    def test_parse_search_query_invalid(self):
        with self.assertRaises(InvalidSearchQuery):
            parse_search_query('fruit:apple release:1.2.1')

    def test_get_snuba_query_args(self):
        assert get_snuba_query_args('user.email:foo@example.com release:1.2.1') == {
            'conditions': [
                ['email', '=', 'foo@example.com'],
                ['sentry:release', '=', '1.2.1'],
            ]
        }
