from __future__ import absolute_import

import datetime
import pytest
import six
import unittest
from datetime import timedelta
from semaphore.consts import SPAN_STATUS_CODE_TO_NAME

from django.utils import timezone
from freezegun import freeze_time

from sentry.api.event_search import (
    event_search_grammar,
    get_filter,
    resolve_field_list,
    parse_search_query,
    get_json_meta_type,
    InvalidSearchQuery,
    SearchBoolean,
    SearchFilter,
    SearchKey,
    SearchValue,
    SearchVisitor,
)
from sentry.testutils.cases import TestCase


def test_get_json_meta_type():
    assert get_json_meta_type("project_id", "UInt8") == "boolean"
    assert get_json_meta_type("project_id", "UInt16") == "integer"
    assert get_json_meta_type("project_id", "UInt32") == "integer"
    assert get_json_meta_type("project_id", "UInt64") == "integer"
    assert get_json_meta_type("project_id", "Float32") == "number"
    assert get_json_meta_type("project_id", "Float64") == "number"
    assert get_json_meta_type("value", "Nullable(Float64)") == "number"
    assert get_json_meta_type("exception_stacks.type", "Array(String)") == "array"
    assert get_json_meta_type("transaction", "Char") == "string"
    assert get_json_meta_type("foo", "unknown") == "string"
    assert get_json_meta_type("other", "") == "string"
    assert get_json_meta_type("p99", "number") == "duration"
    assert get_json_meta_type("p95", "number") == "duration"
    assert get_json_meta_type("p75", "number") == "duration"
    assert get_json_meta_type("avg_duration", "number") == "duration"
    assert get_json_meta_type("duration", "number") == "duration"


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

    def test_custom_explicit_tag(self):
        assert parse_search_query("tags[fruit]:apple release:1.2.1 tags[project_id]:123") == [
            SearchFilter(
                key=SearchKey(name="tags[fruit]"),
                operator="=",
                value=SearchValue(raw_value="apple"),
            ),
            SearchFilter(
                key=SearchKey(name="release"), operator="=", value=SearchValue(raw_value="1.2.1")
            ),
            SearchFilter(
                key=SearchKey(name="tags[project_id]"),
                operator="=",
                value=SearchValue(raw_value="123"),
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

    def test_invalid_numeric_fields(self):
        invalid_queries = ["project.id:one", "issue.id:two", "transaction.duration:>hotdog"]
        for invalid_query in invalid_queries:
            with self.assertRaises(
                InvalidSearchQuery, expected_regex="Invalid format for numeric search"
            ):
                parse_search_query(invalid_query)

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
        filter = get_filter(
            "user.email:foo@example.com release:1.2.1 fruit:apple hello",
            {
                "project_id": [1, 2, 3],
                "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
                "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
            },
        )

        assert filter.conditions == [
            ["user.email", "=", "foo@example.com"],
            ["release", "=", "1.2.1"],
            [["ifNull", ["fruit", "''"]], "=", "apple"],
            [["positionCaseInsensitive", ["message", "'hello'"]], "!=", 0],
        ]
        assert filter.start == datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        assert filter.end == datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc)
        assert filter.filter_keys == {"project_id": [1, 2, 3]}
        assert filter.project_ids == [1, 2, 3]
        assert not filter.group_ids
        assert not filter.event_ids

    def test_negation(self):
        filter = get_filter("!user.email:foo@example.com")
        assert filter.conditions == [
            [[["isNull", ["user.email"]], "=", 1], ["user.email", "!=", "foo@example.com"]]
        ]
        assert filter.filter_keys == {}

    def test_implicit_and_explicit_tags(self):
        assert get_filter("tags[fruit]:apple").conditions == [
            [["ifNull", ["tags[fruit]", "''"]], "=", "apple"]
        ]

        assert get_filter("fruit:apple").conditions == [[["ifNull", ["fruit", "''"]], "=", "apple"]]

        assert get_filter("tags[project_id]:123").conditions == [
            [["ifNull", ["tags[project_id]", "''"]], "=", "123"]
        ]

    def test_no_search(self):
        filter = get_filter(
            params={
                "project_id": [1, 2, 3],
                "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
                "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
            }
        )
        assert not filter.conditions
        assert filter.filter_keys == {"project_id": [1, 2, 3]}
        assert filter.start == datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        assert filter.end == datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc)

    def test_wildcard(self):
        filter = get_filter("release:3.1.* user.email:*@example.com")
        assert filter.conditions == [
            [["match", ["release", "'(?i)^3\\.1\\..*$'"]], "=", 1],
            [["match", ["user.email", "'(?i)^.*\\@example\\.com$'"]], "=", 1],
        ]
        assert filter.filter_keys == {}

    def test_negated_wildcard(self):
        filter = get_filter("!release:3.1.* user.email:*@example.com")
        assert filter.conditions == [
            [
                [["isNull", ["release"]], "=", 1],
                [["match", ["release", "'(?i)^3\\.1\\..*$'"]], "!=", 1],
            ],
            [["match", ["user.email", "'(?i)^.*\\@example\\.com$'"]], "=", 1],
        ]
        assert filter.filter_keys == {}

    def test_escaped_wildcard(self):
        assert get_filter("release:3.1.\\* user.email:\\*@example.com").conditions == [
            [["match", ["release", "'(?i)^3\\.1\\.\\*$'"]], "=", 1],
            [["match", ["user.email", "'(?i)^\*\\@example\\.com$'"]], "=", 1],
        ]
        assert get_filter("release:\\\\\\*").conditions == [
            [["match", ["release", "'(?i)^\\\\\\*$'"]], "=", 1]
        ]
        assert get_filter("release:\\\\*").conditions == [
            [["match", ["release", "'(?i)^\\\\.*$'"]], "=", 1]
        ]

    def test_wildcard_array_field(self):
        filter = get_filter(
            "error.value:Deadlock* stack.filename:*.py stack.abs_path:%APP_DIR%/th_ing*"
        )
        assert filter.conditions == [
            ["error.value", "LIKE", "Deadlock%"],
            ["stack.filename", "LIKE", "%.py"],
            ["stack.abs_path", "LIKE", "\\%APP\\_DIR\\%/th\\_ing%"],
        ]
        assert filter.filter_keys == {}

    def test_has(self):
        assert get_filter("has:release").conditions == [[["isNull", ["release"]], "!=", 1]]

    def test_not_has(self):
        assert get_filter("!has:release").conditions == [[["isNull", ["release"]], "=", 1]]

    def test_message_negative(self):
        assert get_filter('!message:"post_process.process_error HTTPError 403"').conditions == [
            [
                [
                    "positionCaseInsensitive",
                    ["message", "'post_process.process_error HTTPError 403'"],
                ],
                "=",
                0,
            ]
        ]

    def test_malformed_groups(self):
        with pytest.raises(InvalidSearchQuery):
            get_filter("(user.email:foo@example.com OR user.email:bar@example.com")

    def test_issue_filter(self):
        filter = get_filter("issue.id:1")
        assert not filter.conditions
        assert filter.filter_keys == {"group_id": [1]}
        assert filter.group_ids == [1]

        filter = get_filter("issue.id:1 issue.id:2 issue.id:3")
        assert not filter.conditions
        assert filter.filter_keys == {"group_id": [1, 2, 3]}
        assert filter.group_ids == [1, 2, 3]

        filter = get_filter("issue.id:1 user.email:foo@example.com")
        assert filter.conditions == [["user.email", "=", "foo@example.com"]]
        assert filter.filter_keys == {"group_id": [1]}
        assert filter.group_ids == [1]

    def test_environment_param(self):
        params = {"environment": ["", "prod"]}
        filter = get_filter("", params)
        # Should generate OR conditions
        assert filter.conditions == [
            [["environment", "IS NULL", None], ["environment", "=", "prod"]]
        ]
        assert filter.filter_keys == {}
        assert filter.group_ids == []

        params = {"environment": ["dev", "prod"]}
        filter = get_filter("", params)
        assert filter.conditions == [[["environment", "IN", {"dev", "prod"}]]]
        assert filter.filter_keys == {}
        assert filter.group_ids == []

    def test_environment_condition_string(self):
        filter = get_filter("environment:dev")
        assert filter.conditions == [[["environment", "=", "dev"]]]
        assert filter.filter_keys == {}
        assert filter.group_ids == []

        filter = get_filter("!environment:dev")
        assert filter.conditions == [[["environment", "!=", "dev"]]]
        assert filter.filter_keys == {}
        assert filter.group_ids == []

        filter = get_filter("environment:dev environment:prod")
        # Will generate conditions that will never find anything
        assert filter.conditions == [[["environment", "=", "dev"]], [["environment", "=", "prod"]]]
        assert filter.filter_keys == {}
        assert filter.group_ids == []

        filter = get_filter("environment: ")
        # The '' environment is Null in snuba
        assert filter.conditions == [[["environment", "IS NULL", None]]]
        assert filter.filter_keys == {}
        assert filter.group_ids == []

    def test_project_name(self):
        p1 = self.create_project(organization=self.organization)
        p2 = self.create_project(organization=self.organization)

        params = {"project_id": [p1.id, p2.id]}
        filter = get_filter("project.name:{}".format(p1.slug), params)
        filter.conditions == [["project_id", "=", p1.id]]
        filter.filter_keys == {"project_id": [p1.id, p2.id]}
        filter.project_ids == [p1.id, p2.id]

        params = {"project_id": []}
        filter = get_filter("!project.name:{}".format(p1.slug), params)
        filter.conditions == [["project_id", "!=", p1.id]]
        filter.filter_keys == {}
        filter.project_ids == []

    def test_transaction_status(self):
        for (key, val) in SPAN_STATUS_CODE_TO_NAME.items():
            result = get_filter("transaction.status:{}".format(val))
            assert result.conditions == [["transaction.status", "=", key]]

    def test_transaction_status_no_wildcard(self):
        with pytest.raises(InvalidSearchQuery) as err:
            get_filter("transaction.status:o*")
        assert "Invalid value" in six.text_type(err)
        assert "cancelled," in six.text_type(err)

    def test_transaction_status_invalid(self):
        with pytest.raises(InvalidSearchQuery) as err:
            get_filter("transaction.status:lol")
        assert "Invalid value" in six.text_type(err)
        assert "cancelled," in six.text_type(err)


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
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["argMax", ["project.id", "timestamp"], "projectid"],
        ]
        assert result["groupby"] == ["title"]

    def test_field_alias_duration_expansion(self):
        fields = ["avg(transaction.duration)", "apdex", "impact", "p75", "p95", "p99"]
        result = resolve_field_list(fields, {})
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["avg", "transaction.duration", "avg_transaction_duration"],
            ["apdex(duration, 300)", "", "apdex"],
            [
                "(1 - ((countIf(duration < 300) + (countIf((duration > 300) AND (duration < 1200)) / 2)) / count())) + ((1 - 1 / sqrt(uniq(user))) * 3)",
                "",
                "impact",
            ],
            ["quantile(0.75)(duration)", None, "p75"],
            ["quantile(0.95)(duration)", None, "p95"],
            ["quantile(0.99)(duration)", None, "p99"],
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["argMax", ["project.id", "timestamp"], "projectid"],
        ]
        assert result["groupby"] == []

    def test_field_alias_expansion(self):
        fields = ["title", "last_seen", "latest_event", "project", "user", "message"]
        result = resolve_field_list(fields, {})
        assert result["selected_columns"] == [
            "title",
            "project.id",
            "user.id",
            "user.username",
            "user.email",
            "user.ip",
            "message",
        ]
        assert result["aggregations"] == [
            ["max", "timestamp", "last_seen"],
            ["argMax", ["id", "timestamp"], "latest_event"],
        ]
        assert result["groupby"] == [
            "title",
            "project.id",
            "user.id",
            "user.username",
            "user.email",
            "user.ip",
            "message",
        ]

    def test_aggregate_function_expansion(self):
        fields = ["count_unique(user)", "count(id)", "min(timestamp)"]
        result = resolve_field_list(fields, {})
        # Automatic fields should be inserted, count() should have its column dropped.
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["uniq", "user", "count_unique_user"],
            ["count", None, "count_id"],
            ["min", "timestamp", "min_timestamp"],
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["argMax", ["project.id", "timestamp"], "projectid"],
        ]
        assert result["groupby"] == []

    def test_count_function_expansion(self):
        fields = ["count(id)", "count(user)", "count(transaction.duration)"]
        result = resolve_field_list(fields, {})
        # Automatic fields should be inserted, count() should have its column dropped.
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["count", None, "count_id"],
            ["count", None, "count_user"],
            ["count", None, "count_transaction_duration"],
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["argMax", ["project.id", "timestamp"], "projectid"],
        ]
        assert result["groupby"] == []

    def test_aggregate_function_dotted_argument(self):
        fields = ["count_unique(user.id)"]
        result = resolve_field_list(fields, {})
        assert result["aggregations"] == [
            ["uniq", "user.id", "count_unique_user_id"],
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["argMax", ["project.id", "timestamp"], "projectid"],
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
            fields = ["min(message)"]
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

        assert result["aggregations"] == [["count", None, "count"]]
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
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["argMax", ["project.id", "timestamp"], "projectid"],
        ]
        assert result["groupby"] == []

    def test_orderby_field_aggregate(self):
        fields = ["count(id)", "count_unique(user)"]
        snuba_args = {"orderby": "-count(id)"}
        result = resolve_field_list(fields, snuba_args)
        assert result["orderby"] == ["-count_id"]
        assert result["aggregations"] == [
            ["count", None, "count_id"],
            ["uniq", "user", "count_unique_user"],
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["argMax", ["project.id", "timestamp"], "projectid"],
        ]
        assert result["groupby"] == []
