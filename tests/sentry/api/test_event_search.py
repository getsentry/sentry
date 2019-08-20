from __future__ import absolute_import

import datetime
import pytest
import six
import unittest
from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.api.event_search import (
    convert_endpoint_params,
    event_search_grammar,
    get_snuba_query_args,
    resolve_field_list,
    parse_search_query,
    InvalidSearchQuery,
    SearchBoolean,
    SearchFilter,
    SearchKey,
    SearchValue,
    SearchVisitor,
)
from sentry.testutils import TestCase


class ParseSearchQueryTest(unittest.TestCase):
    def test_simple(self):
        # test with raw search query at the end
        assert parse_search_query("user.email:foo@example.com release:1.2.1 hello") == [
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="=",
                value=SearchValue(raw_value="foo@example.com"),
            ),
            SearchFilter(
                key=SearchKey(name="release"), operator="=", value=SearchValue(raw_value="1.2.1")
            ),
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value="hello")
            ),
        ]

        assert parse_search_query("hello user.email:foo@example.com release:1.2.1") == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value="hello")
            ),
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="=",
                value=SearchValue(raw_value="foo@example.com"),
            ),
            SearchFilter(
                key=SearchKey(name="release"), operator="=", value=SearchValue(raw_value="1.2.1")
            ),
        ]

    def test_raw_search_anywhere(self):
        assert parse_search_query(
            "hello what user.email:foo@example.com where release:1.2.1 when"
        ) == [
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="hello what"),
            ),
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="=",
                value=SearchValue(raw_value="foo@example.com"),
            ),
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value="where")
            ),
            SearchFilter(
                key=SearchKey(name="release"), operator="=", value=SearchValue(raw_value="1.2.1")
            ),
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value="when")
            ),
        ]

        assert parse_search_query("hello") == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value="hello")
            )
        ]

        assert parse_search_query("  hello  ") == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value="hello")
            )
        ]

        assert parse_search_query("  hello   there") == [
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="hello   there"),
            )
        ]

        assert parse_search_query("  hello   there:bye") == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value="hello")
            ),
            SearchFilter(
                key=SearchKey(name="there"), operator="=", value=SearchValue(raw_value="bye")
            ),
        ]

    def test_quoted_raw_search_anywhere(self):
        assert parse_search_query('"hello there" user.email:foo@example.com "general kenobi"') == [
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="hello there"),
            ),
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="=",
                value=SearchValue(raw_value="foo@example.com"),
            ),
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="general kenobi"),
            ),
        ]
        assert parse_search_query(' " hello " ') == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value=" hello ")
            )
        ]
        assert parse_search_query(' " he\\"llo " ') == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value=' he"llo ')
            )
        ]

    def test_timestamp(self):
        # test date format
        assert parse_search_query("timestamp>2015-05-18") == [
            SearchFilter(
                key=SearchKey(name="timestamp"),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 18, 0, 0, tzinfo=timezone.utc)
                ),
            )
        ]
        # test date time format
        assert parse_search_query("timestamp>2015-05-18T10:15:01") == [
            SearchFilter(
                key=SearchKey(name="timestamp"),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
                ),
            )
        ]

        # test date time format w microseconds
        assert parse_search_query("timestamp>2015-05-18T10:15:01.103") == [
            SearchFilter(
                key=SearchKey(name="timestamp"),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 18, 10, 15, 1, 103000, tzinfo=timezone.utc)
                ),
            )
        ]

        # test date time format w microseconds and utc marker
        assert parse_search_query("timestamp:>2015-05-18T10:15:01.103Z") == [
            SearchFilter(
                key=SearchKey(name="timestamp"),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 18, 10, 15, 1, 103000, tzinfo=timezone.utc)
                ),
            )
        ]

    def test_other_dates(self):
        # test date format with other name
        assert parse_search_query("first_seen>2015-05-18") == [
            SearchFilter(
                key=SearchKey(name="first_seen"),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 18, 0, 0, tzinfo=timezone.utc)
                ),
            )
        ]

        # test colon format
        assert parse_search_query("first_seen:>2015-05-18") == [
            SearchFilter(
                key=SearchKey(name="first_seen"),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 18, 0, 0, tzinfo=timezone.utc)
                ),
            )
        ]

        assert parse_search_query("random:>2015-05-18") == [
            SearchFilter(
                key=SearchKey(name="random"), operator="=", value=SearchValue(">2015-05-18")
            )
        ]

    def test_rel_time_filter(self):
        now = timezone.now()
        with freeze_time(now):
            assert parse_search_query("first_seen:+7d") == [
                SearchFilter(
                    key=SearchKey(name="first_seen"),
                    operator="<=",
                    value=SearchValue(raw_value=now - timedelta(days=7)),
                )
            ]
            assert parse_search_query("first_seen:-2w") == [
                SearchFilter(
                    key=SearchKey(name="first_seen"),
                    operator=">=",
                    value=SearchValue(raw_value=now - timedelta(days=14)),
                )
            ]
            assert parse_search_query("random:-2w") == [
                SearchFilter(key=SearchKey(name="random"), operator="=", value=SearchValue("-2w"))
            ]

    def test_invalid_date_formats(self):
        invalid_queries = ["first_seen:hello", "first_seen:123", "first_seen:2018-01-01T00:01ZZ"]
        for invalid_query in invalid_queries:
            with self.assertRaises(
                InvalidSearchQuery, expected_regex="Invalid format for numeric search"
            ):
                parse_search_query(invalid_query)

    def test_specific_time_filter(self):
        assert parse_search_query("first_seen:2018-01-01") == [
            SearchFilter(
                key=SearchKey(name="first_seen"),
                operator=">=",
                value=SearchValue(raw_value=datetime.datetime(2018, 1, 1, tzinfo=timezone.utc)),
            ),
            SearchFilter(
                key=SearchKey(name="first_seen"),
                operator="<",
                value=SearchValue(raw_value=datetime.datetime(2018, 1, 2, tzinfo=timezone.utc)),
            ),
        ]

        assert parse_search_query("first_seen:2018-01-01T05:06:07") == [
            SearchFilter(
                key=SearchKey(name="first_seen"),
                operator=">=",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 1, 7, tzinfo=timezone.utc)
                ),
            ),
            SearchFilter(
                key=SearchKey(name="first_seen"),
                operator="<",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 12, 7, tzinfo=timezone.utc)
                ),
            ),
        ]

        assert parse_search_query("random:2018-01-01T05:06:07") == [
            SearchFilter(
                key=SearchKey(name="random"),
                operator="=",
                value=SearchValue(raw_value="2018-01-01T05:06:07"),
            )
        ]

    def test_quoted_val(self):
        assert parse_search_query('release:"a release"') == [
            SearchFilter(
                key=SearchKey(name="release"),
                operator="=",
                value=SearchValue(raw_value="a release"),
            )
        ]
        assert parse_search_query('!release:"a release"') == [
            SearchFilter(
                key=SearchKey(name="release"), operator="!=", value=SearchValue("a release")
            )
        ]

    def test_quoted_key(self):
        assert parse_search_query('"hi:there":value') == [
            SearchFilter(
                key=SearchKey(name="hi:there"), operator="=", value=SearchValue(raw_value="value")
            )
        ]
        assert parse_search_query('!"hi:there":value') == [
            SearchFilter(
                key=SearchKey(name="hi:there"), operator="!=", value=SearchValue(raw_value="value")
            )
        ]

    def test_newline_within_quote(self):
        assert parse_search_query('release:"a\nrelease"') == [
            SearchFilter(
                key=SearchKey(name="release"),
                operator="=",
                value=SearchValue(raw_value="a\nrelease"),
            )
        ]

    def test_newline_outside_quote(self):
        with self.assertRaises(InvalidSearchQuery):
            parse_search_query("release:a\nrelease")

    def test_tab_within_quote(self):
        assert parse_search_query('release:"a\trelease"') == [
            SearchFilter(
                key=SearchKey(name="release"),
                operator="=",
                value=SearchValue(raw_value="a\trelease"),
            )
        ]

    def test_tab_outside_quote(self):
        # tab outside quote
        assert parse_search_query("release:a\trelease") == [
            SearchFilter(
                key=SearchKey(name="release"), operator="=", value=SearchValue(raw_value="a")
            ),
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="\trelease"),
            ),
        ]

    def test_escaped_quotes(self):
        assert parse_search_query('release:"a\\"thing\\""') == [
            SearchFilter(
                key=SearchKey(name="release"), operator="=", value=SearchValue(raw_value='a"thing"')
            )
        ]
        assert parse_search_query('release:"a\\"\\"release"') == [
            SearchFilter(
                key=SearchKey(name="release"),
                operator="=",
                value=SearchValue(raw_value='a""release'),
            )
        ]

    def test_multiple_quotes(self):
        assert parse_search_query('device.family:"" browser.name:"Chrome"') == [
            SearchFilter(
                key=SearchKey(name="device.family"), operator="=", value=SearchValue(raw_value="")
            ),
            SearchFilter(
                key=SearchKey(name="browser.name"),
                operator="=",
                value=SearchValue(raw_value="Chrome"),
            ),
        ]

        assert parse_search_query('device.family:"\\"" browser.name:"Chrome"') == [
            SearchFilter(
                key=SearchKey(name="device.family"), operator="=", value=SearchValue(raw_value='"')
            ),
            SearchFilter(
                key=SearchKey(name="browser.name"),
                operator="=",
                value=SearchValue(raw_value="Chrome"),
            ),
        ]

    def test_sooo_many_quotes(self):
        assert parse_search_query('device.family:"\\"\\"\\"\\"\\"\\"\\"\\"\\"\\""') == [
            SearchFilter(
                key=SearchKey(name="device.family"),
                operator="=",
                value=SearchValue(raw_value='""""""""""'),
            )
        ]

    def test_empty_filter_value(self):
        assert parse_search_query('device.family:""') == [
            SearchFilter(
                key=SearchKey(name="device.family"), operator="=", value=SearchValue(raw_value="")
            )
        ]

    def test_custom_tag(self):
        assert parse_search_query("fruit:apple release:1.2.1") == [
            SearchFilter(
                key=SearchKey(name="fruit"), operator="=", value=SearchValue(raw_value="apple")
            ),
            SearchFilter(
                key=SearchKey(name="release"), operator="=", value=SearchValue(raw_value="1.2.1")
            ),
        ]

    def test_has_tag(self):
        # unquoted key
        assert parse_search_query("has:release") == [
            SearchFilter(
                key=SearchKey(name="release"), operator="!=", value=SearchValue(raw_value="")
            )
        ]

        # quoted key
        assert parse_search_query('has:"hi:there"') == [
            SearchFilter(
                key=SearchKey(name="hi:there"), operator="!=", value=SearchValue(raw_value="")
            )
        ]

        # malformed key
        with self.assertRaises(InvalidSearchQuery):
            parse_search_query('has:"hi there"')

    def test_not_has_tag(self):
        # unquoted key
        assert parse_search_query("!has:release") == [
            SearchFilter(key=SearchKey(name="release"), operator="=", value=SearchValue(""))
        ]

        # quoted key
        assert parse_search_query('!has:"hi:there"') == [
            SearchFilter(key=SearchKey(name="hi:there"), operator="=", value=SearchValue(""))
        ]

    def test_is_query_unsupported(self):
        with self.assertRaises(InvalidSearchQuery):
            parse_search_query("is:unassigned")

    def test_key_remapping(self):
        class RemapVisitor(SearchVisitor):
            key_mappings = {"target_value": ["someValue", "legacy-value"]}

        tree = event_search_grammar.parse("someValue:123 legacy-value:456 normal_value:hello")
        assert RemapVisitor().visit(tree) == [
            SearchFilter(
                key=SearchKey(name="target_value"), operator="=", value=SearchValue("123")
            ),
            SearchFilter(
                key=SearchKey(name="target_value"), operator="=", value=SearchValue("456")
            ),
            SearchFilter(
                key=SearchKey(name="normal_value"), operator="=", value=SearchValue("hello")
            ),
        ]

    def test_numeric_filter(self):
        # Numeric format should still return a string if field isn't whitelisted
        assert parse_search_query("random_field:>500") == [
            SearchFilter(
                key=SearchKey(name="random_field"),
                operator="=",
                value=SearchValue(raw_value=">500"),
            )
        ]

    def test_quotes_filtered_on_raw(self):
        # Enclose the full raw query? Strip it.
        assert parse_search_query('thinger:unknown "what is this?"') == [
            SearchFilter(
                key=SearchKey(name="thinger"), operator="=", value=SearchValue(raw_value="unknown")
            ),
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="what is this?"),
            ),
        ]

        # Enclose the full query? Strip it and the whole query is raw.
        assert parse_search_query('"thinger:unknown what is this?"') == [
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="thinger:unknown what is this?"),
            )
        ]

        # Allow a single quotation at end
        assert parse_search_query('end"') == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value='end"')
            )
        ]

        # Allow a single quotation at beginning
        assert parse_search_query('"beginning') == [
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value='"beginning'),
            )
        ]

        # Allow a single quotation
        assert parse_search_query('"') == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value='"')
            )
        ]

        # Empty quotations become a dropped term
        assert parse_search_query('""') == []

        # Allow a search for space
        assert parse_search_query('" "') == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value=" ")
            )
        ]

        # Strip in a balanced manner
        assert parse_search_query('""woof"') == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value='woof"')
            )
        ]

        # Don't try this at home kids
        assert parse_search_query('"""""""""') == [
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value='"')
            )
        ]

    def _build_search_filter(self, key_name, operator, value):
        return SearchFilter(
            key=SearchKey(name=key_name), operator=operator, value=SearchValue(raw_value=value)
        )

    def test_basic_fallthrough(self):
        # These should all fall through to basic equal searches, even though they
        # look like numeric, date, etc.
        queries = [
            ("random:<hello", self._build_search_filter("random", "=", "<hello")),
            ("random:<512.1.0", self._build_search_filter("random", "=", "<512.1.0")),
            ("random:2018-01-01", self._build_search_filter("random", "=", "2018-01-01")),
            ("random:+7d", self._build_search_filter("random", "=", "+7d")),
            ("random:>2018-01-01", self._build_search_filter("random", "=", ">2018-01-01")),
            ("random:2018-01-01", self._build_search_filter("random", "=", "2018-01-01")),
            ("random:hello", self._build_search_filter("random", "=", "hello")),
            ("random:123", self._build_search_filter("random", "=", "123")),
        ]
        for query, expected in queries:
            assert parse_search_query(query) == [expected]

    def test_empty_string(self):
        # Empty quotations become a dropped term
        assert parse_search_query("") == []


class ParseBooleanSearchQueryTest(unittest.TestCase):
    def setUp(self):
        super(ParseBooleanSearchQueryTest, self).setUp()
        self.term1 = SearchFilter(
            key=SearchKey(name="user.email"),
            operator="=",
            value=SearchValue(raw_value="foo@example.com"),
        )
        self.term2 = SearchFilter(
            key=SearchKey(name="user.email"),
            operator="=",
            value=SearchValue(raw_value="bar@example.com"),
        )
        self.term3 = SearchFilter(
            key=SearchKey(name="user.email"),
            operator="=",
            value=SearchValue(raw_value="foobar@example.com"),
        )
        self.term4 = SearchFilter(
            key=SearchKey(name="user.email"),
            operator="=",
            value=SearchValue(raw_value="hello@example.com"),
        )
        self.term5 = SearchFilter(
            key=SearchKey(name="user.email"),
            operator="=",
            value=SearchValue(raw_value="hi@example.com"),
        )

    def test_simple(self):
        assert parse_search_query("user.email:foo@example.com OR user.email:bar@example.com") == [
            SearchBoolean(left_term=self.term1, operator="OR", right_term=self.term2)
        ]

        assert parse_search_query("user.email:foo@example.com AND user.email:bar@example.com") == [
            SearchBoolean(left_term=self.term1, operator="AND", right_term=self.term2)
        ]

    def test_single_term(self):
        assert parse_search_query("user.email:foo@example.com") == [self.term1]

    def test_order_of_operations(self):
        assert parse_search_query(
            "user.email:foo@example.com OR user.email:bar@example.com AND user.email:foobar@example.com"
        ) == [
            SearchBoolean(
                left_term=self.term1,
                operator="OR",
                right_term=SearchBoolean(
                    left_term=self.term2, operator="AND", right_term=self.term3
                ),
            )
        ]
        assert parse_search_query(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com"
        ) == [
            SearchBoolean(
                left_term=SearchBoolean(
                    left_term=self.term1, operator="AND", right_term=self.term2
                ),
                operator="OR",
                right_term=self.term3,
            )
        ]

    def test_multiple_statements(self):
        assert parse_search_query(
            "user.email:foo@example.com OR user.email:bar@example.com OR user.email:foobar@example.com"
        ) == [
            SearchBoolean(
                left_term=self.term1,
                operator="OR",
                right_term=SearchBoolean(
                    left_term=self.term2, operator="OR", right_term=self.term3
                ),
            )
        ]

        assert parse_search_query(
            "user.email:foo@example.com AND user.email:bar@example.com AND user.email:foobar@example.com"
        ) == [
            SearchBoolean(
                left_term=self.term1,
                operator="AND",
                right_term=SearchBoolean(
                    left_term=self.term2, operator="AND", right_term=self.term3
                ),
            )
        ]

        # longer even number of terms
        assert parse_search_query(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com"
        ) == [
            SearchBoolean(
                left_term=SearchBoolean(
                    left_term=self.term1, operator="AND", right_term=self.term2
                ),
                operator="OR",
                right_term=SearchBoolean(
                    left_term=self.term3, operator="AND", right_term=self.term4
                ),
            )
        ]

        # longer odd number of terms
        assert parse_search_query(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com"
        ) == [
            SearchBoolean(
                left_term=SearchBoolean(
                    left_term=self.term1, operator="AND", right_term=self.term2
                ),
                operator="OR",
                right_term=SearchBoolean(
                    left_term=self.term3,
                    operator="AND",
                    right_term=SearchBoolean(
                        left_term=self.term4, operator="AND", right_term=self.term5
                    ),
                ),
            )
        ]

        # absurdly long
        assert parse_search_query(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com OR user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com"
        ) == [
            SearchBoolean(
                left_term=SearchBoolean(
                    left_term=self.term1, operator="AND", right_term=self.term2
                ),
                operator="OR",
                right_term=SearchBoolean(
                    left_term=SearchBoolean(
                        left_term=self.term3,
                        operator="AND",
                        right_term=SearchBoolean(
                            left_term=self.term4, operator="AND", right_term=self.term5
                        ),
                    ),
                    operator="OR",
                    right_term=SearchBoolean(
                        left_term=SearchBoolean(
                            left_term=self.term1, operator="AND", right_term=self.term2
                        ),
                        operator="OR",
                        right_term=SearchBoolean(
                            left_term=self.term3,
                            operator="AND",
                            right_term=SearchBoolean(
                                left_term=self.term4, operator="AND", right_term=self.term5
                            ),
                        ),
                    ),
                ),
            )
        ]

    def test_grouping_simple(self):
        result = parse_search_query("(user.email:foo@example.com OR user.email:bar@example.com)")
        assert result == [SearchBoolean(left_term=self.term1, operator="OR", right_term=self.term2)]
        result = parse_search_query(
            "(user.email:foo@example.com OR user.email:bar@example.com) AND user.email:foobar@example.com"
        )
        assert result == [
            SearchBoolean(
                left_term=SearchBoolean(left_term=self.term1, operator="OR", right_term=self.term2),
                operator="AND",
                right_term=self.term3,
            )
        ]

        result = parse_search_query(
            "user.email:foo@example.com AND (user.email:bar@example.com OR user.email:foobar@example.com)"
        )
        assert result == [
            SearchBoolean(
                left_term=self.term1,
                operator="AND",
                right_term=SearchBoolean(
                    left_term=self.term2, operator="OR", right_term=self.term3
                ),
            )
        ]

    def test_nested_grouping(self):
        result = parse_search_query(
            "(user.email:foo@example.com OR (user.email:bar@example.com OR user.email:foobar@example.com))"
        )
        assert result == [
            SearchBoolean(
                left_term=self.term1,
                operator="OR",
                right_term=SearchBoolean(
                    left_term=self.term2, operator="OR", right_term=self.term3
                ),
            )
        ]
        result = parse_search_query(
            "(user.email:foo@example.com OR (user.email:bar@example.com OR (user.email:foobar@example.com AND user.email:hello@example.com OR user.email:hi@example.com)))"
        )
        assert result == [
            SearchBoolean(
                left_term=self.term1,
                operator="OR",
                right_term=SearchBoolean(
                    left_term=self.term2,
                    operator="OR",
                    right_term=SearchBoolean(
                        left_term=SearchBoolean(
                            left_term=self.term3, operator="AND", right_term=self.term4
                        ),
                        operator="OR",
                        right_term=self.term5,
                    ),
                ),
            )
        ]

    def test_malformed_groups(self):
        with pytest.raises(InvalidSearchQuery) as error:
            parse_search_query("(user.email:foo@example.com OR user.email:bar@example.com")
        assert (
            six.text_type(error.value)
            == "Parse error: 'search' (column 1). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            parse_search_query(
                "((user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com)"
            )
        assert (
            six.text_type(error.value)
            == "Parse error: 'search' (column 1). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            parse_search_query("user.email:foo@example.com OR user.email:bar@example.com)")
        assert (
            six.text_type(error.value)
            == "Parse error: 'search' (column 57). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            parse_search_query(
                "(user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com))"
            )
        assert (
            six.text_type(error.value)
            == "Parse error: 'search' (column 91). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."
        )

    def test_grouping_without_boolean_terms(self):
        with pytest.raises(InvalidSearchQuery) as error:
            parse_search_query("undefined is not an object (evaluating 'function.name')") == [
                SearchFilter(
                    key=SearchKey(name="message"),
                    operator="=",
                    value=SearchValue(
                        raw_value='undefined is not an object (evaluating "function.name")'
                    ),
                )
            ]
        assert (
            six.text_type(error.value)
            == "Parse error: 'search' (column 28). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."
        )


class GetSnubaQueryArgsTest(TestCase):
    def test_simple(self):
        assert get_snuba_query_args(
            "user.email:foo@example.com release:1.2.1 fruit:apple hello",
            {
                "project_id": [1, 2, 3],
                "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
                "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
            },
        ) == {
            "conditions": [
                ["email", "=", "foo@example.com"],
                ["tags[sentry:release]", "=", "1.2.1"],
                [["ifNull", ["tags[fruit]", "''"]], "=", "apple"],
                [["positionCaseInsensitive", ["message", "'hello'"]], "!=", 0],
            ],
            "filter_keys": {"project_id": [1, 2, 3]},
            "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
            "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
        }

    def test_negation(self):
        assert get_snuba_query_args("!user.email:foo@example.com") == {
            "conditions": [[[["isNull", ["email"]], "=", 1], ["email", "!=", "foo@example.com"]]],
            "filter_keys": {},
        }

    def test_no_search(self):
        assert get_snuba_query_args(
            params={
                "project_id": [1, 2, 3],
                "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
                "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
            }
        ) == {
            "conditions": [],
            "filter_keys": {"project_id": [1, 2, 3]},
            "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
            "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
        }

    def test_wildcard(self):
        assert get_snuba_query_args("release:3.1.* user.email:*@example.com") == {
            "conditions": [
                [["match", ["tags[sentry:release]", "'(?i)^3\\.1\\..*$'"]], "=", 1],
                [["match", ["email", "'(?i)^.*\\@example\\.com$'"]], "=", 1],
            ],
            "filter_keys": {},
        }

    def test_negated_wildcard(self):
        assert get_snuba_query_args("!release:3.1.* user.email:*@example.com") == {
            "conditions": [
                [
                    [["isNull", ["tags[sentry:release]"]], "=", 1],
                    [["match", ["tags[sentry:release]", "'(?i)^3\\.1\\..*$'"]], "!=", 1],
                ],
                [["match", ["email", "'(?i)^.*\\@example\\.com$'"]], "=", 1],
            ],
            "filter_keys": {},
        }

    def test_escaped_wildcard(self):
        assert get_snuba_query_args("release:3.1.\\* user.email:\\*@example.com") == {
            "conditions": [
                [["match", ["tags[sentry:release]", "'(?i)^3\\.1\\.\\*$'"]], "=", 1],
                [["match", ["email", "'(?i)^\*\\@example\\.com$'"]], "=", 1],
            ],
            "filter_keys": {},
        }
        assert get_snuba_query_args("release:\\\\\\*") == {
            "conditions": [[["match", ["tags[sentry:release]", "'(?i)^\\\\\\*$'"]], "=", 1]],
            "filter_keys": {},
        }
        assert get_snuba_query_args("release:\\\\*") == {
            "conditions": [[["match", ["tags[sentry:release]", "'(?i)^\\\\.*$'"]], "=", 1]],
            "filter_keys": {},
        }

    def test_has(self):
        assert get_snuba_query_args("has:release") == {
            "filter_keys": {},
            "conditions": [[["isNull", ["tags[sentry:release]"]], "!=", 1]],
        }

    def test_not_has(self):
        assert get_snuba_query_args("!has:release") == {
            "filter_keys": {},
            "conditions": [[["isNull", ["tags[sentry:release]"]], "=", 1]],
        }

    def test_message_negative(self):
        assert get_snuba_query_args('!message:"post_process.process_error HTTPError 403"') == {
            "filter_keys": {},
            "conditions": [
                [
                    [
                        "positionCaseInsensitive",
                        ["message", "'post_process.process_error HTTPError 403'"],
                    ],
                    "=",
                    0,
                ]
            ],
        }

    def test_malformed_groups(self):
        with pytest.raises(InvalidSearchQuery):
            get_snuba_query_args("(user.email:foo@example.com OR user.email:bar@example.com")

    def test_boolean_term_simple(self):
        assert get_snuba_query_args(
            "user.email:foo@example.com AND user.email:bar@example.com"
        ) == {
            "conditions": [
                ["and", [["email", "=", "foo@example.com"], ["email", "=", "bar@example.com"]]]
            ],
            "filter_keys": {},
            "has_boolean_terms": True,
        }
        assert get_snuba_query_args("user.email:foo@example.com OR user.email:bar@example.com") == {
            "conditions": [
                ["or", [["email", "=", "foo@example.com"], ["email", "=", "bar@example.com"]]]
            ],
            "filter_keys": {},
            "has_boolean_terms": True,
        }
        assert get_snuba_query_args(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com OR user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com"
        ) == {
            "conditions": [
                [
                    "or",
                    [
                        [
                            "and",
                            [["email", "=", "foo@example.com"], ["email", "=", "bar@example.com"]],
                        ],
                        [
                            "or",
                            [
                                [
                                    "and",
                                    [
                                        ["email", "=", "foobar@example.com"],
                                        [
                                            "and",
                                            [
                                                ["email", "=", "hello@example.com"],
                                                ["email", "=", "hi@example.com"],
                                            ],
                                        ],
                                    ],
                                ],
                                [
                                    "or",
                                    [
                                        [
                                            "and",
                                            [
                                                ["email", "=", "foo@example.com"],
                                                ["email", "=", "bar@example.com"],
                                            ],
                                        ],
                                        [
                                            "and",
                                            [
                                                ["email", "=", "foobar@example.com"],
                                                [
                                                    "and",
                                                    [
                                                        ["email", "=", "hello@example.com"],
                                                        ["email", "=", "hi@example.com"],
                                                    ],
                                                ],
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ]
            ],
            "filter_keys": {},
            "has_boolean_terms": True,
        }

    def test_issue_filter(self):
        assert get_snuba_query_args("issue.id:1") == {
            "conditions": [],
            "filter_keys": {"issue": [1]},
        }

        assert get_snuba_query_args("issue.id:1 issue.id:2 issue.id:3") == {
            "conditions": [],
            "filter_keys": {"issue": [1, 2, 3]},
        }

        assert get_snuba_query_args("issue.id:1 user.email:foo@example.com") == {
            "conditions": [["email", "=", "foo@example.com"]],
            "filter_keys": {"issue": [1]},
        }

    def test_project_name(self):
        p1 = self.create_project(organization=self.organization)
        p2 = self.create_project(organization=self.organization)

        params = {"project_id": [p1.id, p2.id]}
        assert get_snuba_query_args("project.name:{}".format(p1.slug), params) == {
            "conditions": [["project_id", "=", p1.id]],
            "filter_keys": {"project_id": [p1.id, p2.id]},
        }


class ConvertEndpointParamsTests(unittest.TestCase):
    def test_simple(self):
        assert convert_endpoint_params(
            {
                "project_id": [1, 2, 3],
                "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
                "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
            }
        ) == [
            SearchFilter(
                key=SearchKey(name="start"),
                operator="=",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
                ),
            ),
            SearchFilter(
                key=SearchKey(name="project_id"),
                operator="=",
                value=SearchValue(raw_value=[1, 2, 3]),
            ),
            SearchFilter(
                key=SearchKey(name="end"),
                operator="=",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc)
                ),
            ),
        ]


class ResolveFieldListTest(unittest.TestCase):
    def test_non_string_field_error(self):
        fields = [["any", "thing", "lol"]]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, {})
        assert "Field names" in six.text_type(err)

    def test_automatic_fields_no_aggregates(self):
        fields = ["event.type", "message"]
        result = resolve_field_list(fields, {})
        assert result["selected_columns"] == ["event.type", "message", "id", "project.id"]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_automatic_fields_with_aggregate_aliases(self):
        fields = ["title", "last_seen"]
        result = resolve_field_list(fields, {})
        # Automatic fields should be inserted
        assert result["selected_columns"] == ["title"]
        assert result["aggregations"] == [
            ["max", "timestamp", "last_seen"],
            ["argMax(event_id, timestamp)", "", "latest_event"],
            ["argMax(project_id, timestamp)", "", "projectid"],
        ]
        assert result["groupby"] == ["title"]

    def test_field_alias_expansion(self):
        fields = ["title", "last_seen", "latest_event", "project", "user", "message"]
        result = resolve_field_list(fields, {})
        assert result["selected_columns"] == [
            "title",
            "project.id",
            "user.id",
            "user.name",
            "user.username",
            "user.email",
            "user.ip",
            "message",
        ]
        assert result["aggregations"] == [
            ["max", "timestamp", "last_seen"],
            ["argMax(event_id, timestamp)", "", "latest_event"],
        ]
        assert result["groupby"] == [
            "title",
            "project.id",
            "user.id",
            "user.name",
            "user.username",
            "user.email",
            "user.ip",
            "message",
        ]

    def test_aggregate_function_expansion(self):
        fields = ["count_unique(user)", "count(id)", "min(timestamp)"]
        result = resolve_field_list(fields, {})
        # Automatic fields should be inserted
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["uniq", "user", "count_unique_user"],
            ["count", "id", "count_id"],
            ["min", "timestamp", "min_timestamp"],
            ["argMax(event_id, timestamp)", "", "latest_event"],
            ["argMax(project_id, timestamp)", "", "projectid"],
        ]
        assert result["groupby"] == []

    def test_aggregate_function_dotted_argument(self):
        fields = ["count_unique(user.id)"]
        result = resolve_field_list(fields, {})
        assert result["aggregations"] == [
            ["uniq", "user.id", "count_unique_user_id"],
            ["argMax(event_id, timestamp)", "", "latest_event"],
            ["argMax(project_id, timestamp)", "", "projectid"],
        ]

    def test_aggregate_function_invalid_name(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["derp(user)"]
            resolve_field_list(fields, {})
        assert "Unknown aggregate" in six.text_type(err)

    def test_aggregate_function_case_sensitive(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["MAX(user)"]
            resolve_field_list(fields, {})
        assert "Unknown aggregate" in six.text_type(err)

    def test_aggregate_function_invalid_column(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["p75(message)"]
            resolve_field_list(fields, {})
        assert "Invalid column" in six.text_type(err)

    def test_rollup_with_unaggregated_fields(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["message"]
            snuba_args = {"rollup": 15}
            resolve_field_list(fields, snuba_args)
        assert "rollup without an aggregate" in six.text_type(err)

    def test_rollup_with_basic_and_aggregated_fields(self):
        fields = ["message", "count()"]
        snuba_args = {"rollup": 15}
        result = resolve_field_list(fields, snuba_args)

        assert result["aggregations"] == [["count", "", "count"]]
        assert result["selected_columns"] == ["message"]
        assert result["groupby"] == ["message"]

    def test_rollup_with_aggregated_fields(self):
        fields = ["count_unique(user)"]
        snuba_args = {"rollup": 15}
        result = resolve_field_list(fields, snuba_args)
        assert result["aggregations"] == [["uniq", "user", "count_unique_user"]]
        assert result["selected_columns"] == []
        assert result["groupby"] == []

    def test_orderby_unselected_field(self):
        fields = ["message"]
        snuba_args = {"orderby": "timestamp"}
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, snuba_args)
        assert "Cannot order" in six.text_type(err)

    def test_orderby_basic_field(self):
        fields = ["message"]
        snuba_args = {"orderby": "-message"}
        result = resolve_field_list(fields, snuba_args)
        assert result["selected_columns"] == ["message", "id", "project.id"]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_orderby_field_alias(self):
        fields = ["last_seen"]
        snuba_args = {"orderby": "-last_seen"}
        result = resolve_field_list(fields, snuba_args)
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["max", "timestamp", "last_seen"],
            ["argMax(event_id, timestamp)", "", "latest_event"],
            ["argMax(project_id, timestamp)", "", "projectid"],
        ]
        assert result["groupby"] == []

    def test_orderby_field_aggregate(self):
        fields = ["count(id)", "count_unique(user)"]
        snuba_args = {"orderby": "-count(id)"}
        result = resolve_field_list(fields, snuba_args)
        assert result["orderby"] == ["-count_id"]
        assert result["aggregations"] == [
            ["count", "id", "count_id"],
            ["uniq", "user", "count_unique_user"],
            ["argMax(event_id, timestamp)", "", "latest_event"],
            ["argMax(project_id, timestamp)", "", "projectid"],
        ]
        assert result["groupby"] == []
