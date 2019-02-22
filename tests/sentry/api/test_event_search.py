from __future__ import absolute_import

import datetime
from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time
from parsimonious.exceptions import IncompleteParseError

from sentry.api.event_search import (
    convert_endpoint_params, event_search_grammar, get_snuba_query_args,
    parse_search_query, InvalidSearchQuery, SearchFilter, SearchKey,
    SearchValue, SearchVisitor,
)
from sentry.testutils import TestCase


class ParseSearchQueryTest(TestCase):
    def test_simple(self):
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

    def test_timestamp(self):
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

    def test_other_dates(self):
        # test date format with other name
        assert parse_search_query('first_seen>2015-05-18') == [
            SearchFilter(
                key=SearchKey(name='first_seen'),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(
                        2015,
                        5,
                        18,
                        0,
                        0,
                        tzinfo=timezone.utc,
                    ),
                ),
            ),
        ]

        # test colon format
        assert parse_search_query('first_seen:>2015-05-18') == [
            SearchFilter(
                key=SearchKey(name='first_seen'),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(
                        2015,
                        5,
                        18,
                        0,
                        0,
                        tzinfo=timezone.utc,
                    ),
                ),
            ),
        ]

        assert parse_search_query('random:>2015-05-18') == [
            SearchFilter(
                key=SearchKey(name='random'),
                operator="=",
                value=SearchValue('>2015-05-18'),
            ),
        ]

    def test_rel_time_filter(self):
        now = timezone.now()
        with freeze_time(now):
            assert parse_search_query('first_seen:+7d') == [
                SearchFilter(
                    key=SearchKey(name='first_seen'),
                    operator="<=",
                    value=SearchValue(
                        raw_value=now - timedelta(days=7),
                    ),
                ),
            ]
            assert parse_search_query('first_seen:-2w') == [
                SearchFilter(
                    key=SearchKey(name='first_seen'),
                    operator=">=",
                    value=SearchValue(
                        raw_value=now - timedelta(days=14),
                    ),
                ),
            ]
            assert parse_search_query('random:-2w') == [
                SearchFilter(
                    key=SearchKey(name='random'),
                    operator="=",
                    value=SearchValue('-2w'),
                ),
            ]

    def test_specific_time_filter(self):
        assert parse_search_query('first_seen:2018-01-01') == [
            SearchFilter(
                key=SearchKey(name='first_seen'),
                operator=">=",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, tzinfo=timezone.utc),
                ),
            ),
            SearchFilter(
                key=SearchKey(name='first_seen'),
                operator="<",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 2, tzinfo=timezone.utc),
                ),
            ),
        ]

        assert parse_search_query('first_seen:2018-01-01T05:06:07') == [
            SearchFilter(
                key=SearchKey(name='first_seen'),
                operator=">=",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 1, 7, tzinfo=timezone.utc),
                ),
            ),
            SearchFilter(
                key=SearchKey(name='first_seen'),
                operator="<",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 12, 7, tzinfo=timezone.utc),
                ),
            ),
        ]

        assert parse_search_query('random:2018-01-01T05:06:07') == [
            SearchFilter(
                key=SearchKey(name='random'),
                operator="=",
                value=SearchValue(raw_value='2018-01-01T05:06:07'),
            ),
        ]

    def test_quoted_val(self):
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

    def test_quoted_key(self):
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

    def test_newline_within_quote(self):
        assert parse_search_query('release:"a\nrelease"') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a\nrelease')
            ),
        ]

    def test_newline_outside_quote(self):
        with self.assertRaises(IncompleteParseError):
            parse_search_query('release:a\nrelease')

    def test_tab_within_quote(self):
        assert parse_search_query('release:"a\trelease"') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a\trelease')
            ),
        ]

    def test_tab_outside_quote(self):
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

    def test_escaped_quotes(self):
        assert parse_search_query('release:"a\\"thing\\""') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a"thing"')
            ),
        ]
        assert parse_search_query('release:"a\\"\\"release"') == [
            SearchFilter(
                key=SearchKey(name='release'),
                operator='=',
                value=SearchValue(raw_value='a""release')
            ),
        ]

    def test_multiple_quotes(self):
        assert parse_search_query('device.family:"" browser.name:"Chrome"') == [
            SearchFilter(
                key=SearchKey(name='device.family'),
                operator='=',
                value=SearchValue(raw_value=''),
            ),
            SearchFilter(
                key=SearchKey(name='browser.name'),
                operator='=',
                value=SearchValue(raw_value='Chrome'),
            ),
        ]

        assert parse_search_query('device.family:"\\"" browser.name:"Chrome"') == [
            SearchFilter(
                key=SearchKey(name='device.family'),
                operator='=',
                value=SearchValue(raw_value='"'),
            ),
            SearchFilter(
                key=SearchKey(name='browser.name'),
                operator='=',
                value=SearchValue(raw_value='Chrome'),
            ),
        ]

    def test_sooo_many_quotes(self):
        assert parse_search_query('device.family:"\\"\\"\\"\\"\\"\\"\\"\\"\\"\\""') == [
            SearchFilter(
                key=SearchKey(name='device.family'),
                operator='=',
                value=SearchValue(raw_value='""""""""""'),
            ),
        ]

    def test_empty_string(self):
        assert parse_search_query('device.family:""') == [
            SearchFilter(
                key=SearchKey(name='device.family'),
                operator='=',
                value=SearchValue(raw_value=''),
            ),
        ]

    def test_custom_tag(self):
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

    def test_has_tag(self):
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

    def test_not_has_tag(self):
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

    def test_is_query_unsupported(self):
        with self.assertRaises(InvalidSearchQuery):
            parse_search_query('is:unassigned')

    def test_key_remapping(self):
        class RemapVisitor(SearchVisitor):
            key_mappings = {
                'target_value': ['someValue', 'legacy-value'],
            }

        tree = event_search_grammar.parse('someValue:123 legacy-value:456 normal_value:hello')
        assert RemapVisitor().visit(tree) == [
            SearchFilter(
                key=SearchKey(name='target_value'),
                operator='=',
                value=SearchValue('123'),
            ),
            SearchFilter(
                key=SearchKey(name='target_value'),
                operator='=',
                value=SearchValue('456'),
            ),
            SearchFilter(
                key=SearchKey(name='normal_value'),
                operator='=',
                value=SearchValue('hello'),
            ),
        ]

    def test_numeric_filter(self):
        # Numeric format should still return a string if field isn't whitelisted
        assert parse_search_query('random_field:>500') == [
            SearchFilter(
                key=SearchKey(name='random_field'),
                operator="=",
                value=SearchValue(raw_value='>500'),
            ),
        ]

    def test_quotes_filtered_on_raw(self):
        # Enclose the full raw query? Strip it.
        assert parse_search_query('thinger:unknown "what is this?"') == [
            SearchFilter(
                key=SearchKey(name='thinger'),
                operator='=',
                value=SearchValue(raw_value='unknown'),
            ),
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='what is this?'),
            ),
        ]

        # Enclose the full query? Strip it and the whole query is raw.
        assert parse_search_query('"thinger:unknown what is this?"') == [
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='thinger:unknown what is this?'),
            ),
        ]

        # Allow a single quotation at end
        assert parse_search_query('end"') == [
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='end"'),
            ),
        ]

        # Allow a single quotation at beginning
        assert parse_search_query('"beginning') == [
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='"beginning'),
            ),
        ]

        # Allow a single quotation
        assert parse_search_query('"') == [
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='"'),
            ),
        ]

        # Empty quotations become a dropped term
        assert parse_search_query('""') == []

        # Allow a search for space
        assert parse_search_query('" "') == [
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value=' '),
            ),
        ]

        # Strip in a balanced manner
        assert parse_search_query('""woof"') == [
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='"woof'),
            ),
        ]

        # Don't try this at home kids
        assert parse_search_query('"""""""""') == [
            SearchFilter(
                key=SearchKey(name='message'),
                operator='=',
                value=SearchValue(raw_value='"'),
            ),
        ]


class GetSnubaQueryArgsTest(TestCase):
    def test_simple(self):
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

    def test_negation(self):
        assert get_snuba_query_args('!user.email:foo@example.com') == {
            'conditions': [
                [['ifNull', ['email', "''"]], '!=', 'foo@example.com'],
            ],
            'filter_keys': {},
        }

    def test_no_search(self):
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

    def test_wildcard(self):
        assert get_snuba_query_args('release:3.1.* user.email:*@example.com') == {
            'conditions': [
                [['match', ['tags[sentry:release]', "'^3\\.1\\..*$'"]], '=', 1],
                [['match', ['email', "'^.*\\@example\\.com$'"]], '=', 1],
            ],
            'filter_keys': {},
        }

    def test_negated_wildcard(self):
        assert get_snuba_query_args('!release:3.1.* user.email:*@example.com') == {
            'conditions': [
                [['match', [['ifNull', ['tags[sentry:release]', "''"]], "'^3\\.1\\..*$'"]], '!=', 1],
                [['match', ['email', "'^.*\\@example\\.com$'"]], '=', 1],
            ],
            'filter_keys': {},
        }

    def test_has(self):
        assert get_snuba_query_args('has:release') == {
            'filter_keys': {},
            'conditions': [[['ifNull', ['tags[sentry:release]', "''"]], '!=', '']]
        }

    def test_not_has(self):
        assert get_snuba_query_args('!has:release') == {
            'filter_keys': {},
            'conditions': [[['ifNull', ['tags[sentry:release]', "''"]], '=', '']]
        }

    def test_message_negative(self):
        assert get_snuba_query_args('!message:"post_process.process_error HTTPError 403"') == {
            'filter_keys': {},
            'conditions': [[
                ['positionCaseInsensitive', ['message', "'post_process.process_error HTTPError 403'"]],
                '=',
                0,
            ]]
        }


class ConvertEndpointParamsTests(TestCase):
    def test_simple(self):
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
