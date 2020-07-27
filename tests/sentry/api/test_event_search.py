from __future__ import absolute_import

import datetime
import pytest
import six
import unittest
from datetime import timedelta
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME

from django.utils import timezone
from freezegun import freeze_time

from sentry import eventstore
from sentry.api.event_search import (
    AggregateKey,
    event_search_grammar,
    get_filter,
    resolve_field_list,
    parse_search_query,
    get_json_meta_type,
    InvalidSearchQuery,
    OPERATOR_TO_FUNCTION,
    SearchFilter,
    SearchKey,
    SearchValue,
    SearchVisitor,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


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
    assert get_json_meta_type("avg_duration", "") == "duration"
    assert get_json_meta_type("duration", "UInt64") == "duration"
    assert get_json_meta_type("p50", "Float32") == "duration"
    assert get_json_meta_type("p75", "Float32") == "duration"
    assert get_json_meta_type("p95", "Float32") == "duration"
    assert get_json_meta_type("p99", "Float32") == "duration"
    assert get_json_meta_type("p100", "Float32") == "duration"
    assert get_json_meta_type("apdex_transaction_duration_300", "Float32") == "number"
    assert get_json_meta_type("failure_rate", "Float32") == "percentage"
    assert get_json_meta_type("impact_300", "Float32") == "number"
    assert get_json_meta_type("user_misery_300", "Float32") == "number"
    assert get_json_meta_type("percentile_transaction_duration_0_95", "Float32") == "duration"
    assert get_json_meta_type("count_thing", "UInt64") == "integer"
    assert get_json_meta_type("count_thing", "String") == "string"
    assert get_json_meta_type("count_thing", "Nullable(String)") == "string"


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

    def test_empty_spaces_stripped_correctly(self):
        assert parse_search_query(
            "event.type:transaction   transaction:/organizations/:orgId/discover/results/"
        ) == [
            SearchFilter(
                key=SearchKey(name="event.type"),
                operator="=",
                value=SearchValue(raw_value="transaction"),
            ),
            SearchFilter(
                key=SearchKey(name="transaction"),
                operator="=",
                value=SearchValue(raw_value="/organizations/:orgId/discover/results/"),
            ),
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

        assert parse_search_query("first_seen:>2018-01-01T05:06:07+00:00") == [
            SearchFilter(
                key=SearchKey(name="first_seen"),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 6, 7, tzinfo=timezone.utc)
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
            with self.assertRaisesRegexp(InvalidSearchQuery, "Invalid format for date search"):
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

        assert parse_search_query("first_seen:2018-01-01T05:06:07Z") == [
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

        assert parse_search_query("first_seen:2018-01-01T05:06:07+00:00") == [
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
        with self.assertRaisesRegexp(InvalidSearchQuery, "Empty string after 'device.family:'"):
            parse_search_query("device.family:")

    def test_escaped_quote_value(self):
        assert parse_search_query('device.family:\\"') == [
            SearchFilter(
                key=SearchKey(name="device.family"), operator="=", value=SearchValue(raw_value='"')
            )
        ]

        assert parse_search_query('device.family:te\\"st') == [
            SearchFilter(
                key=SearchKey(name="device.family"),
                operator="=",
                value=SearchValue(raw_value='te"st'),
            )
        ]

        # This is a weird case. I think this should be an error, but it doesn't seem trivial to rewrite
        # the grammar to handle that.
        assert parse_search_query('url:"te"st') == [
            SearchFilter(
                key=SearchKey(name="url"), operator="=", value=SearchValue(raw_value="te")
            ),
            SearchFilter(
                key=SearchKey(name="message"), operator="=", value=SearchValue(raw_value="st")
            ),
        ]

    def test_trailing_quote_value(self):
        tests = [
            ('"test', "device.family:{}"),
            ('test"', "url:{}"),
            ('"test', "url:{} transaction:abadcafe"),
            ('te"st', "url:{} transaction:abadcafe"),
        ]

        for test in tests:
            with self.assertRaisesRegexp(
                InvalidSearchQuery,
                "Invalid quote at '{}': quotes must enclose text or be escaped.".format(test[0]),
            ):
                parse_search_query(test[1].format(test[0]))

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
        with self.assertRaisesRegexp(
            InvalidSearchQuery, ".*queries are only supported in issue search.*"
        ):
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
        # Numeric format should still return a string if field isn't
        # allowed
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
            with self.assertRaisesRegexp(InvalidSearchQuery, "Invalid format for numeric search"):
                parse_search_query(invalid_query)

    def test_duration_on_non_duration_field(self):
        assert parse_search_query("user.id:500s") == [
            SearchFilter(
                key=SearchKey(name="user.id"), operator="=", value=SearchValue(raw_value="500s")
            )
        ]

    def test_negated_duration_on_non_duration_field(self):
        assert parse_search_query("!user.id:500s") == [
            SearchFilter(
                key=SearchKey(name="user.id"), operator="!=", value=SearchValue(raw_value="500s")
            )
        ]

    def test_duration_filter(self):
        assert parse_search_query("transaction.duration:>500s") == [
            SearchFilter(
                key=SearchKey(name="transaction.duration"),
                operator=">",
                value=SearchValue(raw_value=500000.0),
            )
        ]

    def test_aggregate_duration_filter(self):
        assert parse_search_query("avg(transaction.duration):>500s") == [
            SearchFilter(
                key=AggregateKey(name="avg(transaction.duration)"),
                operator=">",
                value=SearchValue(raw_value=500000.0),
            )
        ]

    def test_invalid_duration_filter(self):
        with self.assertRaises(InvalidSearchQuery, expected_regex="not a valid duration value"):
            parse_search_query("transaction.duration:>..500s")

    def test_invalid_aggregate_duration_filter(self):
        with self.assertRaises(InvalidSearchQuery, expected_regex="not a valid duration value"):
            parse_search_query("avg(transaction.duration):>..500s")

    def test_invalid_aggregate_column_with_duration_filter(self):
        with self.assertRaises(InvalidSearchQuery, regex="not a duration column"):
            parse_search_query("avg(stack.colno):>500s")

    def test_aggregate_rel_time_filter(self):
        now = timezone.now()
        with freeze_time(now):
            assert parse_search_query("last_seen():+7d") == [
                SearchFilter(
                    key=SearchKey(name="last_seen()"),
                    operator="<=",
                    value=SearchValue(raw_value=now - timedelta(days=7)),
                )
            ]
            assert parse_search_query("last_seen():-2w") == [
                SearchFilter(
                    key=SearchKey(name="last_seen()"),
                    operator=">=",
                    value=SearchValue(raw_value=now - timedelta(days=14)),
                )
            ]
            assert parse_search_query("random:-2w") == [
                SearchFilter(key=SearchKey(name="random"), operator="=", value=SearchValue("-2w"))
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


class ParseBooleanSearchQueryTest(TestCase):
    def setUp(self):
        super(ParseBooleanSearchQueryTest, self).setUp()
        self.foo = ["equals", ["user.email", "foo@example.com"]]
        self.bar = ["equals", ["user.email", "bar@example.com"]]
        self.foobar = ["equals", ["user.email", "foobar@example.com"]]
        self.hello = ["equals", ["user.email", "hello@example.com"]]
        self.hi = ["equals", ["user.email", "hi@example.com"]]

    def test_simple(self):
        result = get_filter("user.email:foo@example.com OR user.email:bar@example.com")
        assert result.conditions == [[["or", [self.foo, self.bar]], "=", 1]]

        result = get_filter("user.email:foo@example.com AND user.email:bar@example.com")
        assert result.conditions == [[["and", [self.foo, self.bar]], "=", 1]]

    def test_single_term(self):
        result = get_filter("user.email:foo@example.com")
        assert result.conditions == [["user.email", "=", "foo@example.com"]]

    def test_order_of_operations(self):
        result = get_filter(
            "user.email:foo@example.com OR user.email:bar@example.com AND user.email:foobar@example.com"
        )
        assert result.conditions == [[["or", [self.foo, ["and", [self.bar, self.foobar]]]], "=", 1]]

        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com"
        )
        assert result.conditions == [[["or", [["and", [self.foo, self.bar]], self.foobar]], "=", 1]]

    def test_multiple_statements(self):
        result = get_filter(
            "user.email:foo@example.com OR user.email:bar@example.com OR user.email:foobar@example.com"
        )
        assert result.conditions == [[["or", [self.foo, ["or", [self.bar, self.foobar]]]], "=", 1]]

        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com AND user.email:foobar@example.com"
        )
        assert result.conditions == [
            [["and", [self.foo, ["and", [self.bar, self.foobar]]]], "=", 1]
        ]

        # longer even number of terms
        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com"
        )
        assert result.conditions == [
            [["or", [["and", [self.foo, self.bar]], ["and", [self.foobar, self.hello]]]], "=", 1]
        ]

        # longer odd number of terms
        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com"
        )
        assert result.conditions == [
            [
                [
                    "or",
                    [
                        ["and", [self.foo, self.bar]],
                        ["and", [self.foobar, ["and", [self.hello, self.hi]]]],
                    ],
                ],
                "=",
                1,
            ]
        ]

        # absurdly long
        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com OR user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com"
        )
        assert result.conditions == [
            [
                [
                    "or",
                    [
                        ["and", [self.foo, self.bar]],
                        [
                            "or",
                            [
                                ["and", [self.foobar, ["and", [self.hello, self.hi]]]],
                                [
                                    "or",
                                    [
                                        ["and", [self.foo, self.bar]],
                                        ["and", [self.foobar, ["and", [self.hello, self.hi]]]],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                "=",
                1,
            ]
        ]

    def test_grouping_simple(self):
        result = get_filter("(user.email:foo@example.com OR user.email:bar@example.com)")
        assert result.conditions == [[["or", [self.foo, self.bar]], "=", 1]]

        result = get_filter(
            "(user.email:foo@example.com OR user.email:bar@example.com) AND user.email:foobar@example.com"
        )
        assert result.conditions == [[["and", [["or", [self.foo, self.bar]], self.foobar]], "=", 1]]

        result = get_filter(
            "user.email:foo@example.com AND (user.email:bar@example.com OR user.email:foobar@example.com)"
        )
        assert result.conditions == [[["and", [self.foo, ["or", [self.bar, self.foobar]]]], "=", 1]]

    def test_nested_grouping(self):
        result = get_filter(
            "(user.email:foo@example.com OR (user.email:bar@example.com OR user.email:foobar@example.com))"
        )
        assert result.conditions == [[["or", [self.foo, ["or", [self.bar, self.foobar]]]], "=", 1]]

        result = get_filter(
            "(user.email:foo@example.com OR (user.email:bar@example.com OR (user.email:foobar@example.com AND user.email:hello@example.com OR user.email:hi@example.com)))"
        )
        assert result.conditions == [
            [
                [
                    "or",
                    [
                        self.foo,
                        ["or", [self.bar, ["or", [["and", [self.foobar, self.hello]], self.hi]]]],
                    ],
                ],
                "=",
                1,
            ]
        ]

    def test_grouping_without_boolean_terms(self):
        result = get_filter("undefined is not an object (evaluating 'function.name')")
        assert result.conditions == [
            [
                [
                    "and",
                    [
                        [
                            "notEquals",
                            [
                                [
                                    "positionCaseInsensitive",
                                    ["message", u"'undefined is not an object'"],
                                ],
                                0,
                            ],
                        ],
                        [
                            "notEquals",
                            [
                                [
                                    "positionCaseInsensitive",
                                    ["message", u"'evaluating 'function.name''"],
                                ],
                                0,
                            ],
                        ],
                    ],
                ],
                "=",
                1,
            ]
        ]

    def test_malformed_groups(self):
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("(user.email:foo@example.com OR user.email:bar@example.com")
        assert (
            six.text_type(error.value)
            == "Parse error at '(user.' (column 1). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter(
                "((user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com)"
            )
        assert (
            six.text_type(error.value)
            == "Parse error at '((user' (column 1). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("user.email:foo@example.com OR user.email:bar@example.com)")
        assert (
            six.text_type(error.value)
            == "Parse error at '.com)' (column 57). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter(
                "(user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com))"
            )
        assert (
            six.text_type(error.value)
            == "Parse error at 'com))' (column 91). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )

    def test_combining_normal_terms_with_boolean(self):
        def _eq(xy):
            return ["equals", [["ifNull", [xy[0], "''"]], xy[1]]]

        def _neq(xy):
            return ["notEquals", [["ifNull", [xy[0], "''"]], xy[1]]]

        def _m(x):
            return ["notEquals", [["positionCaseInsensitive", ["message", u"'{}'".format(x)]], 0]]

        tests = [
            ("foo bar baz OR fizz buzz bizz", ["or", [_m("foo bar baz"), _m("fizz buzz bizz")]]),
            (
                "a:b (c:d OR e:f) g:h i:j OR k:l",
                [
                    "or",
                    [
                        [
                            "and",
                            [
                                _eq("ab"),
                                [
                                    "and",
                                    [
                                        ["or", [_eq("cd"), _eq("ef")]],
                                        ["and", [_eq("gh"), _eq("ij")]],
                                    ],
                                ],
                            ],
                        ],
                        _eq("kl"),
                    ],
                ],
            ),
            (
                "a:b OR c:d e:f g:h (i:j OR k:l)",
                [
                    "or",
                    [
                        _eq("ab"),
                        [
                            "and",
                            [
                                _eq("cd"),
                                [
                                    "and",
                                    [
                                        _eq("ef"),
                                        ["and", [_eq("gh"), ["or", [_eq("ij"), _eq("kl")]]]],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ),
            ("(a:b OR c:d) e:f", ["and", [["or", [_eq("ab"), _eq("cd")]], _eq("ef")]]),
            (
                "a:b OR c:d e:f g:h i:j OR k:l",
                [
                    "or",
                    [
                        _eq("ab"),
                        [
                            "or",
                            [
                                [
                                    "and",
                                    [
                                        _eq("cd"),
                                        ["and", [_eq("ef"), ["and", [_eq("gh"), _eq("ij")]]]],
                                    ],
                                ],
                                _eq("kl"),
                            ],
                        ],
                    ],
                ],
            ),
            (
                "(a:b OR c:d) e:f g:h OR i:j k:l",
                [
                    "or",
                    [
                        ["and", [["or", [_eq("ab"), _eq("cd")]], ["and", [_eq("ef"), _eq("gh")]]]],
                        ["and", [_eq("ij"), _eq("kl")]],
                    ],
                ],
            ),
            (
                "a:b c:d e:f OR g:h i:j",
                [
                    "or",
                    [
                        ["and", [_eq("ab"), ["and", [_eq("cd"), _eq("ef")]]]],
                        ["and", [_eq("gh"), _eq("ij")]],
                    ],
                ],
            ),
            (
                "a:b c:d (e:f OR g:h) i:j",
                [
                    "and",
                    [
                        _eq("ab"),
                        ["and", [_eq("cd"), ["and", [["or", [_eq("ef"), _eq("gh")]], _eq("ij")]]]],
                    ],
                ],
            ),
            (
                "!a:b c:d (e:f OR g:h) i:j",
                [
                    "and",
                    [
                        _neq("ab"),
                        ["and", [_eq("cd"), ["and", [["or", [_eq("ef"), _eq("gh")]], _eq("ij")]]]],
                    ],
                ],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert [[test[1], "=", 1]] == result.conditions, test[0]

    def test_nesting_using_parentheses(self):
        def _eq(xy):
            return ["equals", [["ifNull", [xy[0], "''"]], xy[1]]]

        tests = [
            (
                "(a:b OR (c:d AND (e:f OR (g:h AND e:f))))",
                [
                    "or",
                    [
                        _eq("ab"),
                        ["and", [_eq("cd"), ["or", [_eq("ef"), ["and", [_eq("gh"), _eq("ef")]]]]]],
                    ],
                ],
            ),
            (
                "(a:b OR c:d) AND (e:f g:h)",
                ["and", [["or", [_eq("ab"), _eq("cd")]], ["and", [_eq("ef"), _eq("gh")]]]],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert [[test[1], "=", 1]] == result.conditions, test[0]

    def test_aggregate_filter_in_conditions(self):
        def _c(op, val):
            return [OPERATOR_TO_FUNCTION[op], ["count", val]]

        tests = [
            ("count():>1 AND count():<=3", ["and", [_c(">", 1), _c("<=", 3)]]),
            ("count():>1 OR count():<=3", ["or", [_c(">", 1), _c("<=", 3)]]),
            (
                "count():>1 OR count():>5 AND count():<=3",
                ["or", [_c(">", 1), ["and", [_c(">", 5), _c("<=", 3)]]]],
            ),
            (
                "count():>1 AND count():<=3 OR count():>5",
                ["or", [["and", [_c(">", 1), _c("<=", 3)]], _c(">", 5)]],
            ),
            (
                "(count():>1 OR count():>2) AND count():<=3",
                ["and", [["or", [_c(">", 1), _c(">", 2)]], _c("<=", 3)]],
            ),
            (
                "(count():>1 AND count():>5) OR count():<=3",
                ["or", [["and", [_c(">", 1), _c(">", 5)]], _c("<=", 3)]],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert [[test[1], "=", 1]] == result.having, test[0]

    def test_aggregate_filter_and_normal_filter_in_condition(self):
        def _eq(xy):
            return ["equals", [["ifNull", [xy[0], "''"]], xy[1]]]

        def _c(op, val):
            return [OPERATOR_TO_FUNCTION[op], ["count", val]]

        tests = [
            ("count():>1 AND a:b", _eq("ab"), _c(">", 1)),
            ("count():>1 AND a:b c:d", ["and", [_eq("ab"), _eq("cd")]], _c(">", 1),),
            ("(a:b OR c:d) count():>1", ["or", [_eq("ab"), _eq("cd")]], _c(">", 1),),
            (
                "(count():<3 OR count():>10) a:b c:d",
                ["and", [_eq("ab"), _eq("cd")]],
                ["or", [_c("<", 3), _c(">", 10)]],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert [[test[1], "=", 1]] == result.conditions, "cond: " + test[0]
            assert [[test[2], "=", 1]] == result.having, "having: " + test[0]

    def test_aggregate_filter_and_normal_filter_in_condition_with_or(self):
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("count():>1 OR a:b")
        assert (
            six.text_type(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("(count():>1 AND a:b) OR a:b")
        assert (
            six.text_type(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("(count():>1 AND a:b) OR (a:b AND count():>2)")
        assert (
            six.text_type(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("a:b OR (c:d AND (e:f AND count():>1))")
        assert (
            six.text_type(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )

    def test_user_alias_in_conditions(self):
        def _eq(k, v):
            return ["equals", ["user.{}".format(k), "{}@example.com".format(v)]]

        def _teq(xy):
            return ["equals", [["ifNull", [xy[0], "''"]], xy[1]]]

        def _neq(k, v):
            return [
                ["equals", [["isNull", ["user.{}".format(k)]], 1]],
                ["notEquals", ["user.{}".format(k), "{}@example.com".format(v)]],
            ]

        tests = [
            (
                "user:foo@example.com OR user:bar@example.com",
                [
                    "or",
                    [
                        [
                            "or",
                            [
                                _eq("email", "foo"),
                                [
                                    "or",
                                    [
                                        _eq("username", "foo"),
                                        ["or", [_eq("ip", "foo"), _eq("id", "foo")]],
                                    ],
                                ],
                            ],
                        ],
                        [
                            "or",
                            [
                                _eq("email", "bar"),
                                [
                                    "or",
                                    [
                                        _eq("username", "bar"),
                                        ["or", [_eq("ip", "bar"), _eq("id", "bar")]],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ),
            (
                "user:foo@example.com AND user:bar@example.com",
                [
                    "and",
                    [
                        [
                            "or",
                            [
                                _eq("email", "foo"),
                                [
                                    "or",
                                    [
                                        _eq("username", "foo"),
                                        ["or", [_eq("ip", "foo"), _eq("id", "foo")]],
                                    ],
                                ],
                            ],
                        ],
                        [
                            "or",
                            [
                                _eq("email", "bar"),
                                [
                                    "or",
                                    [
                                        _eq("username", "bar"),
                                        ["or", [_eq("ip", "bar"), _eq("id", "bar")]],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ),
            (
                "(user:foo@example.com OR user:bar@example.com) a:b",
                [
                    "and",
                    [
                        [
                            "or",
                            [
                                [
                                    "or",
                                    [
                                        _eq("email", "foo"),
                                        [
                                            "or",
                                            [
                                                _eq("username", "foo"),
                                                ["or", [_eq("ip", "foo"), _eq("id", "foo")]],
                                            ],
                                        ],
                                    ],
                                ],
                                [
                                    "or",
                                    [
                                        _eq("email", "bar"),
                                        [
                                            "or",
                                            [
                                                _eq("username", "bar"),
                                                ["or", [_eq("ip", "bar"), _eq("id", "bar")]],
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        _teq("ab"),
                    ],
                ],
            ),
            (
                "(user:foo@example.com OR user:bar@example.com) a:b",
                [
                    "and",
                    [
                        [
                            "or",
                            [
                                [
                                    "or",
                                    [
                                        _eq("email", "foo"),
                                        [
                                            "or",
                                            [
                                                _eq("username", "foo"),
                                                ["or", [_eq("ip", "foo"), _eq("id", "foo")]],
                                            ],
                                        ],
                                    ],
                                ],
                                [
                                    "or",
                                    [
                                        _eq("email", "bar"),
                                        [
                                            "or",
                                            [
                                                _eq("username", "bar"),
                                                ["or", [_eq("ip", "bar"), _eq("id", "bar")]],
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        _teq("ab"),
                    ],
                ],
            ),
            (
                "!user:foo@example.com OR !user:bar@example.com",
                [
                    "or",
                    [
                        [
                            "and",
                            [
                                ["or", _neq("email", "foo")],
                                [
                                    "and",
                                    [
                                        ["or", _neq("username", "foo")],
                                        [
                                            "and",
                                            [["or", _neq("ip", "foo")], ["or", _neq("id", "foo")]],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        [
                            "and",
                            [
                                ["or", _neq("email", "bar")],
                                [
                                    "and",
                                    [
                                        ["or", _neq("username", "bar")],
                                        [
                                            "and",
                                            [["or", _neq("ip", "bar")], ["or", _neq("id", "bar")]],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ),
            (
                "!user:foo@example.com AND !user:bar@example.com",
                [
                    "and",
                    [
                        [
                            "and",
                            [
                                ["or", _neq("email", "foo")],
                                [
                                    "and",
                                    [
                                        ["or", _neq("username", "foo")],
                                        [
                                            "and",
                                            [["or", _neq("ip", "foo")], ["or", _neq("id", "foo")]],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        [
                            "and",
                            [
                                ["or", _neq("email", "bar")],
                                [
                                    "and",
                                    [
                                        ["or", _neq("username", "bar")],
                                        [
                                            "and",
                                            [["or", _neq("ip", "bar")], ["or", _neq("id", "bar")]],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ),
            (
                "(user:foo@example.com OR !user:bar@example.com) AND user:foobar@example.com ",
                [
                    "and",
                    [
                        [
                            "or",
                            [
                                [
                                    "or",
                                    [
                                        _eq("email", "foo"),
                                        [
                                            "or",
                                            [
                                                _eq("username", "foo"),
                                                ["or", [_eq("ip", "foo"), _eq("id", "foo")]],
                                            ],
                                        ],
                                    ],
                                ],
                                [
                                    "and",
                                    [
                                        ["or", _neq("email", "bar")],
                                        [
                                            "and",
                                            [
                                                ["or", _neq("username", "bar")],
                                                [
                                                    "and",
                                                    [
                                                        ["or", _neq("ip", "bar")],
                                                        ["or", _neq("id", "bar")],
                                                    ],
                                                ],
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        [
                            "or",
                            [
                                _eq("email", "foobar"),
                                [
                                    "or",
                                    [
                                        _eq("username", "foobar"),
                                        ["or", [_eq("ip", "foobar"), _eq("id", "foobar")]],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert [[test[1], "=", 1]] == result.conditions, "cond: " + test[0]

    def test_project_in_condition_filters(self):
        def _eq(xy):
            return ["equals", [["ifNull", [xy[0], "''"]], xy[1]]]

        project1 = self.create_project()
        project2 = self.create_project()
        tests = [
            (
                "project:{} OR project:{}".format(project1.slug, project2.slug),
                [
                    [
                        [
                            "or",
                            [
                                ["equals", ["project_id", project1.id]],
                                ["equals", ["project_id", project2.id]],
                            ],
                        ],
                        "=",
                        1,
                    ]
                ],
                [project1.id, project2.id],
            ),
            (
                "(project:{} OR project:{}) AND a:b".format(project1.slug, project2.slug),
                [
                    [
                        [
                            "and",
                            [
                                [
                                    "or",
                                    [
                                        ["equals", ["project_id", project1.id]],
                                        ["equals", ["project_id", project2.id]],
                                    ],
                                ],
                                _eq("ab"),
                            ],
                        ],
                        "=",
                        1,
                    ]
                ],
                [project1.id, project2.id],
            ),
            (
                "(project:{} AND a:b) OR (project:{} AND c:d)".format(project1.slug, project1.slug),
                [
                    [
                        [
                            "or",
                            [
                                ["and", [["equals", ["project_id", project1.id]], _eq("ab")]],
                                ["and", [["equals", ["project_id", project1.id]], _eq("cd")]],
                            ],
                        ],
                        "=",
                        1,
                    ]
                ],
                [project1.id],
            ),
        ]

        for test in tests:
            result = get_filter(
                test[0],
                params={
                    "organization_id": self.organization.id,
                    "project_id": [project1.id, project2.id],
                },
            )
            assert test[1] == result.conditions, test[0]
            assert test[2] == result.project_ids, test[0]

    def test_project_in_condition_filters_not_in_project_filter(self):
        project1 = self.create_project()
        project2 = self.create_project()
        project3 = self.create_project()
        with self.assertRaisesRegexp(
            InvalidSearchQuery,
            "Project {} does not exist or is not an actively selected project.".format(
                project3.slug
            ),
        ):
            get_filter(
                "project:{} OR project:{}".format(project1.slug, project3.slug),
                params={
                    "organization_id": self.organization.id,
                    "project_id": [project1.id, project2.id],
                },
            )

    def test_issue_id_alias_in_condition_filters(self):
        def _eq(xy):
            return ["equals", [["ifNull", [xy[0], "''"]], xy[1]]]

        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        group3 = self.create_group(project=self.project)
        tests = [
            (
                "issue.id:{} OR issue.id:{}".format(group1.id, group2.id),
                [],
                [group1.id, group2.id],
            ),
            ("issue.id:{} AND issue.id:{}".format(group1.id, group1.id), [], [group1.id]),
            (
                "(issue.id:{} AND issue.id:{}) OR issue.id:{}".format(
                    group1.id, group2.id, group3.id
                ),
                [],
                [group1.id, group2.id, group3.id],
            ),
            ("issue.id:{} OR a:b".format(group1.id), [[_eq("ab"), "=", 1]], [group1.id]),
            ("issue.id:{} AND a:b".format(group1.id), [[_eq("ab"), "=", 1]], [group1.id]),
            (
                "(issue.id:{} AND a:b) OR issue.id:{}".format(group1.id, group2.id),
                [[_eq("ab"), "=", 1]],
                [group1.id, group2.id],
            ),
            (
                "(issue.id:{} AND a:b) OR c:d".format(group1.id),
                [[["or", [_eq("ab"), _eq("cd")]], "=", 1]],
                [group1.id],
            ),
        ]

        for test in tests:
            result = get_filter(
                test[0],
                params={"organization_id": self.organization.id, "project_id": [self.project.id]},
            )
            assert test[1] == result.conditions, test[0]
            assert test[2] == result.group_ids, test[0]

    def test_invalid_conditional_filters(self):
        with self.assertRaisesRegexp(
            InvalidSearchQuery, "Condition is missing on the left side of 'OR' operator"
        ):
            get_filter("OR a:b")

        with self.assertRaisesRegexp(
            InvalidSearchQuery, "Missing condition in between two condition operators: 'OR AND'"
        ):
            get_filter("a:b Or And c:d")

        with self.assertRaisesRegexp(
            InvalidSearchQuery, "Condition is missing on the right side of 'AND' operator"
        ):
            get_filter("a:b AND c:d AND")

        with self.assertRaisesRegexp(
            InvalidSearchQuery, "Condition is missing on the left side of 'OR' operator"
        ):
            get_filter("(OR a:b) AND c:d")

    # TODO (evanh): The situation with the next two tests is not ideal, since we should
    # be matching the entire query instead of splitting on the brackets. However it's
    # very difficult to write a regex that can tell the difference between a ParenExpression
    # and a arbitrary search with parens in it. Once we switch tokenizers we can have something
    # that can correctly classify these expressions.
    def test_empty_parens_in_message_not_boolean_search(self):
        def _m(x):
            return [["positionCaseInsensitive", ["message", "'{}'".format(x)]], "!=", 0]

        result = get_filter(
            "failure_rate():>0.003&& users:>10 event.type:transaction",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            _m("failure_rate"),
            _m(":>0.003&&"),
            [["ifNull", ["users", "''"]], "=", ">10"],
            ["event.type", "=", "transaction"],
        ]

    def test_parens_around_message(self):
        def _m(x):
            return ["notEquals", [["positionCaseInsensitive", ["message", u"'{}'".format(x)]], 0]]

        result = get_filter(
            "TypeError Anonymous function(app/javascript/utils/transform-object-keys)",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            [
                [
                    "and",
                    [
                        _m("TypeError Anonymous function"),
                        _m("app/javascript/utils/transform-object-keys"),
                    ],
                ],
                "=",
                1,
            ],
        ]


class GetSnubaQueryArgsTest(TestCase):
    def test_simple(self):
        _filter = get_filter(
            "user.email:foo@example.com release:1.2.1 fruit:apple hello",
            {
                "project_id": [1, 2, 3],
                "organization_id": 1,
                "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
                "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
            },
        )

        assert _filter.conditions == [
            ["user.email", "=", "foo@example.com"],
            ["release", "=", "1.2.1"],
            [["ifNull", ["fruit", "''"]], "=", "apple"],
            [["positionCaseInsensitive", ["message", "'hello'"]], "!=", 0],
        ]
        assert _filter.start == datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        assert _filter.end == datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc)
        assert _filter.filter_keys == {"project_id": [1, 2, 3]}
        assert _filter.project_ids == [1, 2, 3]
        assert not _filter.group_ids
        assert not _filter.event_ids

    def test_negation(self):
        _filter = get_filter("!user.email:foo@example.com")
        assert _filter.conditions == [
            [[["isNull", ["user.email"]], "=", 1], ["user.email", "!=", "foo@example.com"]]
        ]
        assert _filter.filter_keys == {}

    def test_implicit_and_explicit_tags(self):
        assert get_filter("tags[fruit]:apple").conditions == [
            [["ifNull", ["tags[fruit]", "''"]], "=", "apple"]
        ]

        assert get_filter("fruit:apple").conditions == [[["ifNull", ["fruit", "''"]], "=", "apple"]]

        assert get_filter("tags[project_id]:123").conditions == [
            [["ifNull", ["tags[project_id]", "''"]], "=", "123"]
        ]

    def test_no_search(self):
        _filter = get_filter(
            params={
                "project_id": [1, 2, 3],
                "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
                "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
            }
        )
        assert not _filter.conditions
        assert _filter.filter_keys == {"project_id": [1, 2, 3]}
        assert _filter.start == datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        assert _filter.end == datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc)

    def test_wildcard(self):
        _filter = get_filter("release:3.1.* user.email:*@example.com")
        assert _filter.conditions == [
            [["match", ["release", "'(?i)^3\\.1\\..*$'"]], "=", 1],
            [["match", ["user.email", "'(?i)^.*@example\\.com$'"]], "=", 1],
        ]
        assert _filter.filter_keys == {}

    def test_wildcard_with_unicode(self):
        _filter = get_filter(
            u"message:*\u716e\u6211\u66f4\u591a\u7684\u98df\u7269\uff0c\u6211\u9913\u4e86."
        )
        assert _filter.conditions == [
            [
                [
                    "match",
                    [
                        "message",
                        u"'(?i).*\u716e\u6211\u66f4\u591a\u7684\u98df\u7269\uff0c\u6211\u9913\u4e86\\.'",
                    ],
                ],
                "=",
                1,
            ]
        ]
        assert _filter.filter_keys == {}

    def test_wildcard_event_id(self):
        with self.assertRaises(InvalidSearchQuery):
            get_filter("id:deadbeef*")

    def test_negated_wildcard(self):
        _filter = get_filter("!release:3.1.* user.email:*@example.com")
        assert _filter.conditions == [
            [
                [["isNull", ["release"]], "=", 1],
                [["match", ["release", "'(?i)^3\\.1\\..*$'"]], "!=", 1],
            ],
            [["match", ["user.email", "'(?i)^.*@example\\.com$'"]], "=", 1],
        ]
        assert _filter.filter_keys == {}

    def test_escaped_wildcard(self):
        assert get_filter("release:3.1.\\* user.email:\\*@example.com").conditions == [
            [["match", ["release", "'(?i)^3\\.1\\.\\*$'"]], "=", 1],
            [["match", ["user.email", "'(?i)^\*@example\\.com$'"]], "=", 1],
        ]
        assert get_filter("release:\\\\\\*").conditions == [
            [["match", ["release", "'(?i)^\\\\\\*$'"]], "=", 1]
        ]
        assert get_filter("release:\\\\*").conditions == [
            [["match", ["release", "'(?i)^\\\\.*$'"]], "=", 1]
        ]
        assert get_filter("message:.*?").conditions == [
            [["match", ["message", "'(?i)\..*\?'"]], "=", 1]
        ]

    def test_wildcard_array_field(self):
        _filter = get_filter(
            "error.value:Deadlock* stack.filename:*.py stack.abs_path:%APP_DIR%/th_ing*"
        )
        assert _filter.conditions == [
            ["error.value", "LIKE", "Deadlock%"],
            ["stack.filename", "LIKE", "%.py"],
            ["stack.abs_path", "LIKE", "\\%APP\\_DIR\\%/th\\_ing%"],
        ]
        assert _filter.filter_keys == {}

    def test_wildcard_with_trailing_backslash(self):
        results = get_filter("title:*misgegaan\\")
        assert results.conditions == [[["match", ["title", u"'(?i)^.*misgegaan\\\\$'"]], "=", 1]]

    def test_has(self):
        assert get_filter("has:release").conditions == [[["isNull", ["release"]], "!=", 1]]

    def test_not_has(self):
        assert get_filter("!has:release").conditions == [[["isNull", ["release"]], "=", 1]]

    def test_has_issue_id(self):
        has_issue_filter = get_filter("has:issue.id")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [["issue.id", "!=", 0]]

    def test_not_has_issue_id(self):
        has_issue_filter = get_filter("!has:issue.id")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [[["isNull", ["issue.id"]], "=", 1]]

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

    def test_message_with_newlines(self):
        assert get_filter('message:"nice \n a newline\n"').conditions == [
            [["positionCaseInsensitive", ["message", "'nice \n a newline\n'"]], "!=", 0]
        ]

    def test_malformed_groups(self):
        with pytest.raises(InvalidSearchQuery):
            get_filter("(user.email:foo@example.com OR user.email:bar@example.com")

    def test_issue_id_filter(self):
        _filter = get_filter("issue.id:1")
        assert not _filter.conditions
        assert _filter.filter_keys == {"group_id": [1]}
        assert _filter.group_ids == [1]

        _filter = get_filter("issue.id:1 issue.id:2 issue.id:3")
        assert not _filter.conditions
        assert _filter.filter_keys == {"group_id": [1, 2, 3]}
        assert _filter.group_ids == [1, 2, 3]

        _filter = get_filter("issue.id:1 user.email:foo@example.com")
        assert _filter.conditions == [["user.email", "=", "foo@example.com"]]
        assert _filter.filter_keys == {"group_id": [1]}
        assert _filter.group_ids == [1]

    def test_issue_filter_invalid(self):
        with pytest.raises(InvalidSearchQuery) as err:
            get_filter("issue:1", {"organization_id": 1})
        assert "Invalid value '" in six.text_type(err)
        assert "' for 'issue:' filter" in six.text_type(err)

    def test_issue_filter(self):
        group = self.create_group(project=self.project)
        _filter = get_filter(
            "issue:{}".format(group.qualified_short_id), {"organization_id": self.organization.id}
        )
        assert _filter.conditions == [["issue.id", "=", group.id]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_negated_issue_filter(self):
        group = self.create_group(project=self.project)
        _filter = get_filter(
            "!issue:{}".format(group.qualified_short_id), {"organization_id": self.organization.id}
        )
        assert _filter.conditions == [["issue.id", "!=", group.id]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_environment_param(self):
        params = {"environment": ["", "prod"]}
        _filter = get_filter("", params)
        # Should generate OR conditions
        assert _filter.conditions == [
            [["environment", "IS NULL", None], ["environment", "=", "prod"]]
        ]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        params = {"environment": ["dev", "prod"]}
        _filter = get_filter("", params)
        assert _filter.conditions == [[["environment", "IN", {"dev", "prod"}]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_environment_condition_string(self):
        _filter = get_filter("environment:dev")
        assert _filter.conditions == [[["environment", "=", "dev"]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        _filter = get_filter("!environment:dev")
        assert _filter.conditions == [[["environment", "!=", "dev"]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        _filter = get_filter("environment:dev environment:prod")
        # Will generate conditions that will never find anything
        assert _filter.conditions == [[["environment", "=", "dev"]], [["environment", "=", "prod"]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        _filter = get_filter('environment:""')
        # The '' environment is Null in snuba
        assert _filter.conditions == [[["environment", "IS NULL", None]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_project_name(self):
        p1 = self.create_project(organization=self.organization)
        p2 = self.create_project(organization=self.organization)

        params = {"project_id": [p1.id, p2.id]}
        _filter = get_filter("project.name:{}".format(p1.slug), params)
        assert _filter.conditions == [["project_id", "=", p1.id]]
        assert _filter.filter_keys == {"project_id": [p1.id]}
        assert _filter.project_ids == [p1.id]

        params = {"project_id": [p1.id, p2.id]}
        _filter = get_filter("!project.name:{}".format(p1.slug), params)
        assert _filter.conditions == [
            [[["isNull", ["project_id"]], "=", 1], ["project_id", "!=", p1.id]]
        ]
        assert _filter.filter_keys == {"project_id": [p1.id, p2.id]}
        assert _filter.project_ids == [p1.id, p2.id]

        with pytest.raises(InvalidSearchQuery) as err:
            params = {"project_id": []}
            get_filter("project.name:{}".format(p1.slug), params)
        assert (
            "Invalid query. Project %s does not exist or is not an actively selected project"
            % p1.slug
            in six.text_type(err)
        )

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

    def test_general_user_field(self):
        conditions = get_filter("user:123").conditions
        assert len(conditions) == 1
        assert ["user.id", "=", "123"] in conditions[0]
        assert ["user.username", "=", "123"] in conditions[0]
        assert ["user.email", "=", "123"] in conditions[0]
        assert ["user.ip", "=", "123"] in conditions[0]

    def test_general_negative_user_field(self):
        conditions = get_filter("!user:123").conditions
        assert len(conditions) == 4
        assert [[["isNull", ["user.email"]], "=", 1], ["user.email", "!=", "123"]] == conditions[0]
        assert [
            [["isNull", ["user.username"]], "=", 1],
            ["user.username", "!=", "123"],
        ] == conditions[1]
        assert [[["isNull", ["user.ip"]], "=", 1], ["user.ip", "!=", "123"]] == conditions[2]
        assert [[["isNull", ["user.id"]], "=", 1], ["user.id", "!=", "123"]] == conditions[3]

    def test_function_negation(self):
        result = get_filter("!p95():5s")
        assert result.having == [["p95", "!=", 5000.0]]

        result = get_filter("!p95():>5s")
        assert result.having == [["p95", "<=", 5000.0]]

        result = get_filter("!p95():>=5s")
        assert result.having == [["p95", "<", 5000.0]]

        result = get_filter("!p95():<5s")
        assert result.having == [["p95", ">=", 5000.0]]

        result = get_filter("!p95():<=5s")
        assert result.having == [["p95", ">", 5000.0]]

    def test_function_with_default_arguments(self):
        result = get_filter("epm():>100", {"start": before_now(minutes=5), "end": before_now()})
        assert result.having == [["epm", ">", 100]]

    def test_function_with_alias(self):
        result = get_filter("percentile(transaction.duration, 0.95):>100")
        assert result.having == [["percentile_transaction_duration_0_95", ">", 100]]

    def test_function_arguments(self):
        result = get_filter("percentile(transaction.duration, 0.75):>100")
        assert result.having == [["percentile_transaction_duration_0_75", ">", 100]]

    def test_function_with_float_arguments(self):
        result = get_filter("apdex(300):>0.5")
        assert result.having == [["apdex_300", ">", 0.5]]

    def test_function_with_negative_arguments(self):
        result = get_filter("apdex(300):>-0.5")
        assert result.having == [["apdex_300", ">", -0.5]]

    def test_function_with_date_arguments(self):
        result = get_filter("last_seen():2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", "=", 1585769692]]

    def test_function_with_date_negation(self):
        result = get_filter("!last_seen():2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", "!=", 1585769692]]

        result = get_filter("!last_seen():>2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", "<=", 1585769692]]

        result = get_filter("!last_seen():>=2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", "<", 1585769692]]

        result = get_filter("!last_seen():<2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", ">=", 1585769692]]

        result = get_filter("!last_seen():<=2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", ">", 1585769692]]

    @pytest.mark.xfail(reason="this breaks issue search so needs to be redone")
    def test_trace_id(self):
        result = get_filter("trace:{}".format("a0fa8803753e40fd8124b21eeb2986b5"))
        assert result.conditions == [["trace", "=", "a0fa8803-753e-40fd-8124-b21eeb2986b5"]]


class ResolveFieldListTest(unittest.TestCase):
    def test_non_string_field_error(self):
        fields = [["any", "thing", "lol"]]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter())
        assert "Field names" in six.text_type(err)

    def test_blank_field_ignored(self):
        fields = ["", "title", "   "]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "title",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_automatic_fields_no_aggregates(self):
        fields = ["event.type", "message"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "event.type",
            "message",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_field_alias_duration_expansion_with_brackets(self):
        fields = [
            "avg(transaction.duration)",
            "latest_event()",
            "last_seen()",
            "apdex(300)",
            "impact(300)",
            "user_misery(300)",
            "percentile(transaction.duration, 0.75)",
            "percentile(transaction.duration, 0.95)",
            "percentile(transaction.duration, 0.99)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())

        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["avg", "transaction.duration", "avg_transaction_duration"],
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["max", "timestamp", "last_seen"],
            ["apdex(duration, 300)", None, "apdex_300"],
            [
                "plus(minus(1, divide(plus(countIf(less(duration, 300)),divide(countIf(and(greater(duration, 300),less(duration, 1200))),2)),count())),multiply(minus(1,divide(1,sqrt(uniq(user)))),3))",
                None,
                "impact_300",
            ],
            ["uniqIf(user, greater(duration, 1200))", None, "user_misery_300"],
            ["quantile(0.75)", "transaction.duration", "percentile_transaction_duration_0_75"],
            ["quantile(0.95)", "transaction.duration", "percentile_transaction_duration_0_95"],
            ["quantile(0.99)", "transaction.duration", "percentile_transaction_duration_0_99"],
        ]
        assert result["groupby"] == []

    def test_field_alias_expansion(self):
        fields = ["title", "last_seen()", "latest_event()", "project", "issue", "user", "message"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "title",
            "issue.id",
            "user.email",
            "user.username",
            "user.ip",
            "user.id",
            "message",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "project",
            ],
        ]
        assert result["aggregations"] == [
            ["max", "timestamp", "last_seen"],
            ["argMax", ["id", "timestamp"], "latest_event"],
        ]
        assert result["groupby"] == [
            "title",
            "issue.id",
            "user.email",
            "user.username",
            "user.ip",
            "user.id",
            "message",
            "project.id",
        ]

    def test_aggregate_function_expansion(self):
        fields = ["count_unique(user)", "count(id)", "min(timestamp)"]
        result = resolve_field_list(fields, eventstore.Filter())
        # Automatic fields should be inserted, count() should have its column dropped.
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["uniq", "user", "count_unique_user"],
            ["count", None, "count_id"],
            ["min", "timestamp", "min_timestamp"],
        ]
        assert result["groupby"] == []

    def test_count_function_expansion(self):
        fields = ["count(id)", "count(user)", "count(transaction.duration)"]
        result = resolve_field_list(fields, eventstore.Filter())
        # Automatic fields should be inserted, count() should have its column dropped.
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["count", None, "count_id"],
            ["count", None, "count_user"],
            ["count", None, "count_transaction_duration"],
        ]
        assert result["groupby"] == []

    def test_aggregate_function_dotted_argument(self):
        fields = ["count_unique(user.id)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            ["uniq", "user.id", "count_unique_user_id"],
        ]

    def test_aggregate_function_invalid_name(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["derp(user)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "derp(user) is not a valid function" in six.text_type(err)

    def test_aggregate_function_case_sensitive(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["MAX(user)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "MAX(user) is not a valid function" in six.text_type(err)

    def test_aggregate_function_invalid_column(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["min(message)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "InvalidSearchQuery: min(message): column argument invalid: message is not a numeric column"
            in six.text_type(err)
        )

    def test_percentile_function(self):
        fields = ["percentile(transaction.duration, 0.75)"]
        result = resolve_field_list(fields, eventstore.Filter())

        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["quantile(0.75)", "transaction.duration", "percentile_transaction_duration_0_75"],
        ]
        assert result["groupby"] == []

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(0.75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "percentile(0.75): expected 2 arguments" in six.text_type(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(0.75,)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "percentile(0.75,): expected 2 arguments" in six.text_type(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(sanchez, 0.75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "percentile(sanchez, 0.75): column argument invalid: sanchez is not a valid column"
            in six.text_type(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(id, 0.75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "percentile(id, 0.75): column argument invalid: id is not a duration column"
            in six.text_type(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(transaction.duration, 75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "percentile(transaction.duration, 75): percentile argument invalid: 75 must be less than 1"
            in six.text_type(err)
        )

    def test_epm_function(self):
        fields = ["epm(3600)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["divide(count(), divide(3600, 60))", None, "epm_3600"],
        ]
        assert result["groupby"] == []

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm(30)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "epm(30): interval argument invalid: 30 must be greater than or equal to 60"
            in six.text_type(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm()"]
            resolve_field_list(fields, eventstore.Filter())
        assert "epm(): invalid arguments: function called without default" in six.text_type(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm()"]
            resolve_field_list(fields, eventstore.Filter(start="abc", end="def"))
        assert "epm(): invalid arguments: function called with invalid default" in six.text_type(
            err
        )

        fields = ["epm()"]
        result = resolve_field_list(
            fields, eventstore.Filter(start=before_now(hours=2), end=before_now(hours=1))
        )
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["divide(count(), divide(3600, 60))", None, "epm"],
        ]
        assert result["groupby"] == []

    def test_absolute_delta_function(self):
        fields = ["absolute_delta(transaction.duration,100)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["abs(minus(duration, 100))", None, "absolute_delta_transaction_duration_100"],
        ]
        assert result["groupby"] == []

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["absolute_delta(transaction,100)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "absolute_delta(transaction,100): column argument invalid: transaction is not a duration column"
            in six.text_type(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["absolute_delta(transaction.duration,blah)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "absolute_delta(transaction.duration,blah): target argument invalid: blah is not a number"
            in six.text_type(err)
        )

    def test_eps_function(self):
        fields = ["eps(3600)"]
        result = resolve_field_list(fields, eventstore.Filter())

        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["divide(count(), 3600)", None, "eps_3600"],
        ]
        assert result["groupby"] == []

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["eps(0)"]
            result = resolve_field_list(fields, eventstore.Filter())
        assert (
            "eps(0): interval argument invalid: 0 must be greater than or equal to 1"
            in six.text_type(err)
        )

    def test_histogram_function(self):
        fields = ["histogram(transaction.duration, 10, 1000, 0)", "count()"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            [
                "multiply",
                [["floor", [["divide", ["transaction.duration", 1000]]]], 1000],
                "histogram_transaction_duration_10_1000_0",
            ]
        ]
        assert result["aggregations"] == [
            ["count", None, "count"],
        ]
        assert result["groupby"] == ["histogram_transaction_duration_10_1000_0"]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["histogram(stack.colno, 10, 1000, 0)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "histogram(stack.colno, 10, 1000, 0): column argument invalid: stack.colno is not a duration column"
            in six.text_type(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["histogram(transaction.duration, 10)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "histogram(transaction.duration, 10): expected 4 arguments" in six.text_type(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["histogram(transaction.duration, 1000, 1000, 0)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "histogram(transaction.duration, 1000, 1000, 0): num_buckets argument invalid: 1000 must be less than 500"
            in six.text_type(err)
        )

    def test_rollup_with_unaggregated_fields(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["message"]
            resolve_field_list(fields, eventstore.Filter(rollup=15))
        assert "rollup without an aggregate" in six.text_type(err)

    def test_rollup_with_basic_and_aggregated_fields(self):
        fields = ["message", "count()"]
        result = resolve_field_list(fields, eventstore.Filter(rollup=15))

        assert result["aggregations"] == [["count", None, "count"]]
        assert result["selected_columns"] == ["message"]
        assert result["groupby"] == ["message"]

    def test_rollup_with_aggregated_fields(self):
        fields = ["count_unique(user)"]
        result = resolve_field_list(fields, eventstore.Filter(rollup=15))
        assert result["aggregations"] == [["uniq", "user", "count_unique_user"]]
        assert result["selected_columns"] == []
        assert result["groupby"] == []

    def test_orderby_unselected_field(self):
        fields = ["message"]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter(orderby="timestamp"))
        assert "Cannot order" in six.text_type(err)

    def test_orderby_unselected_field_with_histogram(self):
        fields = ["histogram(transaction.duration, 10, 1000, 0)", "message"]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter(orderby="timestamp"))
        assert "Cannot order" in six.text_type(err)

    def test_orderby_basic_field(self):
        fields = ["message"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-message"))
        assert result["selected_columns"] == [
            "message",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_orderby_field_aggregate(self):
        fields = ["count(id)", "count_unique(user)"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-count(id)"))
        assert result["orderby"] == ["-count_id"]
        assert result["aggregations"] == [
            ["count", None, "count_id"],
            ["uniq", "user", "count_unique_user"],
        ]
        assert result["groupby"] == []

    def test_orderby_issue_alias(self):
        fields = ["issue"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-issue"))
        assert result["orderby"] == ["-issue.id"]
        assert result["selected_columns"] == [
            "issue.id",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_orderby_project_alias(self):
        fields = ["project"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-project"))
        assert result["selected_columns"] == [
            "project.id",
            "id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "project",
            ],
        ]
        assert result["orderby"] == ["-project"]
        assert result["aggregations"] == []
        assert result["groupby"] == []
