from __future__ import absolute_import

from sentry.api.event_search import (
    get_snuba_query_args, parse_search_query, InvalidSearchQuery, SearchFilter, SearchKey, SearchValue
)
from sentry.testutils import TestCase


class EventSearchTest(TestCase):
    def test_parse_search_query(self):
        # test with raw search query at the end
        assert parse_search_query('user.email:foo@example.com release:1.2.1 hello') == [
            SearchFilter(
                key=SearchKey(name='user.email'),
                operator="=",
                value=SearchValue(raw_value='foo@example.com', type='string'),
            ),
            SearchFilter(
                key=SearchKey(name='release'),
                operator="=",
                value=SearchValue(raw_value='1.2.1', type='string'),
            ),
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='hello', type='string'),
            )
        ]

        # if the search query starts with the raw query, assume the whole thing is a raw string
        assert parse_search_query('hello user.email:foo@example.com release:1.2.1') == [
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(
                    raw_value='hello user.email:foo@example.com release:1.2.1',
                    type='string'),
            ),
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
