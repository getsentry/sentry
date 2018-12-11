from __future__ import absolute_import

import datetime

from django.utils import timezone
from parsimonious.exceptions import IncompleteParseError

from sentry.api.event_search import (
    convert_endpoint_params, get_snuba_query_args, parse_search_query,
    InvalidSearchQuery, SearchFilter, SearchKey, SearchValue
)
from sentry.testutils import TestCase


class EventSearchTest(TestCase):
    def test_parse_search_query(self):
        # test with raw search query at the end
        assert parse_search_query('user.email:foo@example.com release:1.2.1 hello') == [
            SearchFilter(
                key=SearchKey(name='user.email'),
                operator="=",
                value=SearchValue(raw_value='foo@example.com'),
            ),
            SearchFilter(
                key=SearchKey(name='release'),
                operator="=",
                value=SearchValue(raw_value='1.2.1'),
            ),
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='hello'),
            )
        ]

        # if the search query starts with the raw query, assume the whole thing is a raw string
        assert parse_search_query('hello user.email:foo@example.com release:1.2.1') == [
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='hello user.email:foo@example.com release:1.2.1'),
            ),
        ]

    def test_parse_search_query_timestamp(self):
        # test date format
        assert parse_search_query('timestamp>2015-05-18') == [
            SearchFilter(
                key=SearchKey(name='timestamp'),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(
                        2015,
                        5,
                        18,
                        0,
                        0,
                        tzinfo=timezone.utc),
                ),
            ),
        ]
        # test date time format
        assert parse_search_query('timestamp>2015-05-18T10:15:01') == [
            SearchFilter(
                key=SearchKey(name='timestamp'),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(
                        2015,
                        5,
                        18,
                        10,
                        15,
                        1,
                        tzinfo=timezone.utc),
                ),
            ),
        ]

        # test date time format w microseconds
        assert parse_search_query('timestamp>2015-05-18T10:15:01.103') == [
            SearchFilter(
                key=SearchKey(name='timestamp'),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(
                        2015,
                        5,
                        18,
                        10,
                        15,
                        1,
                        103000,
                        tzinfo=timezone.utc),
                ),
            ),
        ]

    def test_parse_search_query_quoted_val(self):
        assert parse_search_query('release:"a release"') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a release'),
            ),
        ]
        assert parse_search_query('!release:"a release"') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='!=',
                value=SearchValue('a release'),
            ),
        ]

    def test_parse_search_query_quoted_key(self):
        assert parse_search_query('"hi:there":value') == [
            SearchFilter(
                key=SearchKey(name='hi:there'),
                operator='=',
                value=SearchValue(raw_value='value'),
            ),
        ]
        assert parse_search_query('!"hi:there":value') == [
            SearchFilter(
                key=SearchKey(name='hi:there'),
                operator='!=',
                value=SearchValue(raw_value='value'),
            ),
        ]

    def test_parse_search_query_weird_values(self):
        # quotes within quotes
        assert parse_search_query('release:"a"thing""') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a"thing"'),
            ),
        ]

        # newline within quote
        assert parse_search_query('release:"a\nrelease"') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a\nrelease')
            ),
        ]
        # newline outside quote
        with self.assertRaises(IncompleteParseError):
            parse_search_query('release:a\nrelease')

        # tab within quote
        assert parse_search_query('release:"a\trelease"') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a\trelease')
            ),
        ]
        # tab outside quote
        assert parse_search_query('release:a\trelease') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a'),
            ),
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='\trelease')
            ),
        ]

        # escaped quotes
        assert parse_search_query('release:"a\"thing\""') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a"thing"')
            ),
        ]
        assert parse_search_query('release:"a\"\"release"') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a""release')
            ),
        ]

        # poorly escaped quotes
        assert parse_search_query('release:"a release\"') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a release')
            ),
        ]
        assert parse_search_query('release:\"a release "') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a release ')
            ),
        ]

    def test_parse_search_query_custom_tag(self):
        assert parse_search_query('fruit:apple release:1.2.1') == [
            SearchFilter(
                key=SearchKey(name='fruit'),
                operator='=',
                value=SearchValue(raw_value='apple'),
            ),
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='1.2.1'),
            ),
        ]

    def test_parse_search_query_has_tag(self):
        # unquoted key
        assert parse_search_query('has:release') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='!=',
                value=SearchValue(raw_value=''),
            ),
        ]

        # quoted key
        assert parse_search_query('has:"hi:there"') == [
            SearchFilter(
                key=SearchKey(name='hi:there'),
                operator='!=',
                value=SearchValue(raw_value=''),
            ),
        ]

        # malformed key
        with self.assertRaises(InvalidSearchQuery):
            parse_search_query('has:"hi there"')

    def test_parse_search_query_not_has_tag(self):
        # unquoted key
        assert parse_search_query('!has:release') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(''),
            ),
        ]

        # quoted key
        assert parse_search_query('!has:"hi:there"') == [
            SearchFilter(
                key=SearchKey(name='hi:there'),
                operator='=',
                value=SearchValue(''),
            ),
        ]

    def test_get_snuba_query_args(self):
        assert get_snuba_query_args('user.email:foo@example.com release:1.2.1 fruit:apple hello', {
            'project_id': [1, 2, 3],
            'start': datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
            'end': datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
        }) == {
            'conditions': [
                ['email', '=', 'foo@example.com'],
                ['tags[sentry:release]', '=', '1.2.1'],
                ['tags[fruit]', '=', 'apple'],
                [['positionCaseInsensitive', ['message', "'hello'"]], '!=', 0],
            ],
            'filter_keys': {'project_id': [1, 2, 3]},
            'start': datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
            'end': datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
        }

    def test_negation_get_snuba_query_args(self):
        assert get_snuba_query_args('!user.email:foo@example.com') == {
            'conditions': [
                [['ifNull', ['email', "''"]], '!=', 'foo@example.com'],
            ],
            'filter_keys': {},
        }

    def test_get_snuba_query_args_no_search(self):
        assert get_snuba_query_args(params={
            'project_id': [1, 2, 3],
            'start': datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
            'end': datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
        }) == {
            'conditions': [],
            'filter_keys': {'project_id': [1, 2, 3]},
            'start': datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
            'end': datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
        }

    def test_get_snuba_query_args_wildcard(self):
        assert get_snuba_query_args('release:3.1.* user.email:*@example.com') == {
            'conditions': [
                [['match', ['tags[sentry:release]', "'^3\\.1\\..*$'"]], '=', 1],
                [['match', ['email', "'^.*\\@example\\.com$'"]], '=', 1],
            ],
            'filter_keys': {},
        }

    def test_get_snuba_query_args_negated_wildcard(self):
        assert get_snuba_query_args('!release:3.1.* user.email:*@example.com') == {
            'conditions': [
                [['match', [['ifNull', ['tags[sentry:release]', "''"]], "'^3\\.1\\..*$'"]], '!=', 1],
                [['match', ['email', "'^.*\\@example\\.com$'"]], '=', 1],
            ],
            'filter_keys': {},
        }

    def test_get_snuba_query_args_has(self):
        assert get_snuba_query_args('has:release') == {
            'filter_keys': {},
            'conditions': [[['ifNull', ['tags[sentry:release]', "''"]], '!=', '']]
        }

    def test_get_snuba_query_args_not_has(self):
        assert get_snuba_query_args('!has:release') == {
            'filter_keys': {},
            'conditions': [[['ifNull', ['tags[sentry:release]', "''"]], '=', '']]
        }

    def test_convert_endpoint_params(self):
        assert convert_endpoint_params({
            'project_id': [1, 2, 3],
            'start': datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
            'end': datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
        }) == [
            SearchFilter(
                key=SearchKey(name='start'),
                operator='=',
                value=SearchValue(
                    raw_value=datetime.datetime(
                        2015,
                        5,
                        18,
                        10,
                        15,
                        1,
                        tzinfo=timezone.utc),
                )
            ),
            SearchFilter(
                key=SearchKey(name='project_id'),
                operator='=',
                value=SearchValue(raw_value=[1, 2, 3])
            ),
            SearchFilter(
                key=SearchKey(name='end'),
                operator='=',
                value=SearchValue(
                    raw_value=datetime.datetime(
                        2015,
                        5,
                        19,
                        10,
                        15,
                        1,
                        tzinfo=timezone.utc),
                )
            ),
        ]
