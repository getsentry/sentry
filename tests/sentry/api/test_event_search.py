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
    Function,
    FunctionArg,
    with_default,
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
    assert get_json_meta_type("user_misery_300", "Float32") == "number"
    assert get_json_meta_type("percentile_transaction_duration_0_95", "Float32") == "duration"
    assert get_json_meta_type("count_thing", "UInt64") == "integer"
    assert get_json_meta_type("count_thing", "String") == "string"
    assert get_json_meta_type("count_thing", "Nullable(String)") == "string"
    assert get_json_meta_type("measurements.size", "Float64") == "number"
    assert get_json_meta_type("measurements.fp", "Float64") == "duration"


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
            with self.assertRaisesRegexp(InvalidSearchQuery, "Invalid format for date field"):
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

    def test_boolean_filter(self):
        truthy = ("true", "TRUE", "1")
        for val in truthy:
            assert parse_search_query("stack.in_app:{}".format(val)) == [
                SearchFilter(
                    key=SearchKey(name="stack.in_app"),
                    operator="=",
                    value=SearchValue(raw_value=1),
                )
            ]
        falsey = ("false", "FALSE", "0")
        for val in falsey:
            assert parse_search_query("stack.in_app:{}".format(val)) == [
                SearchFilter(
                    key=SearchKey(name="stack.in_app"),
                    operator="=",
                    value=SearchValue(raw_value=0),
                )
            ]

        assert parse_search_query("!stack.in_app:false") == [
            SearchFilter(
                key=SearchKey(name="stack.in_app"), operator="=", value=SearchValue(raw_value=1),
            )
        ]

    def test_invalid_boolean_filter(self):
        invalid_queries = ["stack.in_app:lol", "stack.in_app:123", "stack.in_app:>true"]
        for invalid_query in invalid_queries:
            with self.assertRaisesRegexp(InvalidSearchQuery, "Invalid format for boolean field"):
                parse_search_query(invalid_query)

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
            with self.assertRaisesRegexp(InvalidSearchQuery, "Invalid format for numeric field"):
                parse_search_query(invalid_query)

    def test_negated_on_boolean_values_and_non_boolean_field(self):
        assert parse_search_query("!user.id:true") == [
            SearchFilter(
                key=SearchKey(name="user.id"), operator="!=", value=SearchValue(raw_value="true")
            )
        ]

        assert parse_search_query("!user.id:1") == [
            SearchFilter(
                key=SearchKey(name="user.id"), operator="!=", value=SearchValue(raw_value="1")
            )
        ]

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

    def test_invalid_aggregate_percentage_filter(self):
        with self.assertRaises(InvalidSearchQuery, expected_regex="not a valid percentage value"):
            parse_search_query("percentage(transaction.duration, transaction.duration):>..500%")

    def test_invalid_aggregate_column_with_duration_filter(self):
        with self.assertRaises(InvalidSearchQuery, regex="not a duration column"):
            parse_search_query("avg(stack.colno):>500s")

    def test_numeric_measurements_filter(self):
        # NOTE: can only filter on integers right now
        assert parse_search_query("measurements.size:3.1415") == [
            SearchFilter(
                key=SearchKey(name="measurements.size"),
                operator="=",
                value=SearchValue(raw_value=3.1415),
            )
        ]

        assert parse_search_query("measurements.size:>3.1415") == [
            SearchFilter(
                key=SearchKey(name="measurements.size"),
                operator=">",
                value=SearchValue(raw_value=3.1415),
            )
        ]

        assert parse_search_query("measurements.size:<3.1415") == [
            SearchFilter(
                key=SearchKey(name="measurements.size"),
                operator="<",
                value=SearchValue(raw_value=3.1415),
            )
        ]

    def test_numeric_aggregate_measurements_filter(self):
        assert parse_search_query("min(measurements.size):3.1415") == [
            SearchFilter(
                key=SearchKey(name="min(measurements.size)"),
                operator="=",
                value=SearchValue(raw_value=3.1415),
            )
        ]

        assert parse_search_query("min(measurements.size):>3.1415") == [
            SearchFilter(
                key=SearchKey(name="min(measurements.size)"),
                operator=">",
                value=SearchValue(raw_value=3.1415),
            )
        ]

        assert parse_search_query("min(measurements.size):<3.1415") == [
            SearchFilter(
                key=SearchKey(name="min(measurements.size)"),
                operator="<",
                value=SearchValue(raw_value=3.1415),
            )
        ]

    def test_duration_measurements_filter(self):
        assert parse_search_query("measurements.fp:1.5s") == [
            SearchFilter(
                key=SearchKey(name="measurements.fp"),
                operator="=",
                value=SearchValue(raw_value=1500),
            )
        ]

        assert parse_search_query("measurements.fp:>1.5s") == [
            SearchFilter(
                key=SearchKey(name="measurements.fp"),
                operator=">",
                value=SearchValue(raw_value=1500),
            )
        ]

        assert parse_search_query("measurements.fp:<1.5s") == [
            SearchFilter(
                key=SearchKey(name="measurements.fp"),
                operator="<",
                value=SearchValue(raw_value=1500),
            )
        ]

    def test_duration_aggregate_measurements_filter(self):
        assert parse_search_query("percentile(measurements.fp, 0.5):3.3s") == [
            SearchFilter(
                key=SearchKey(name="percentile(measurements.fp, 0.5)"),
                operator="=",
                value=SearchValue(raw_value=3300),
            )
        ]

        assert parse_search_query("percentile(measurements.fp, 0.5):>3.3s") == [
            SearchFilter(
                key=SearchKey(name="percentile(measurements.fp, 0.5)"),
                operator=">",
                value=SearchValue(raw_value=3300),
            )
        ]

        assert parse_search_query("percentile(measurements.fp, 0.5):<3.3s") == [
            SearchFilter(
                key=SearchKey(name="percentile(measurements.fp, 0.5)"),
                operator="<",
                value=SearchValue(raw_value=3300),
            )
        ]

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


# Helper functions to make reading the expected output from the boolean tests easier to read. #
# a:b
def _eq(xy):
    return ["equals", [["ifNull", [xy[0], "''"]], xy[1]]]


# a:b but using operators instead of functions
def _oeq(xy):
    return [["ifNull", [xy[0], "''"]], "=", xy[1]]


# !a:b using operators instead of functions
def _noeq(xy):
    return [["ifNull", [xy[0], "''"]], "!=", xy[1]]


# message ("foo bar baz")
def _m(x):
    return ["notEquals", [["positionCaseInsensitive", ["message", u"'{}'".format(x)]], 0]]


# message ("foo bar baz") using operators instead of functions
def _om(x):
    return [["positionCaseInsensitive", ["message", "'{}'".format(x)]], "!=", 0]


# x OR y
def _or(x, y):
    return ["or", [x, y]]


# x AND y
def _and(x, y):
    return ["and", [x, y]]


# count():>1
def _c(op, val):
    return [OPERATOR_TO_FUNCTION[op], ["count", val]]


# count():>1 using operators instead of functions
def _oc(op, val):
    return ["count", op, val]


class ParseBooleanSearchQueryTest(TestCase):
    def setUp(self):
        super(ParseBooleanSearchQueryTest, self).setUp()
        users = ["foo", "bar", "foobar", "hello", "hi"]
        for u in users:
            self.__setattr__(u, ["equals", ["user.email", "{}@example.com".format(u)]])
            self.__setattr__("o{}".format(u), ["user.email", "=", "{}@example.com".format(u)])

    def test_simple(self):
        result = get_filter("user.email:foo@example.com OR user.email:bar@example.com")
        assert result.conditions == [[_or(self.foo, self.bar), "=", 1]]

        result = get_filter("user.email:foo@example.com AND user.email:bar@example.com")
        assert result.conditions == [self.ofoo, self.obar]

    def test_single_term(self):
        result = get_filter("user.email:foo@example.com")
        assert result.conditions == [self.ofoo]

    def test_wildcard_array_field(self):
        _filter = get_filter("error.value:Deadlock* OR !stack.filename:*.py")
        assert _filter.conditions == [
            [
                _or(
                    ["like", ["error.value", "Deadlock%"]], ["notLike", ["stack.filename", "%.py"]],
                ),
                "=",
                1,
            ]
        ]
        assert _filter.filter_keys == {}

    def test_order_of_operations(self):
        result = get_filter(
            "user.email:foo@example.com OR user.email:bar@example.com AND user.email:foobar@example.com"
        )
        assert result.conditions == [[_or(self.foo, _and(self.bar, self.foobar)), "=", 1]]

        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com"
        )
        assert result.conditions == [[_or(_and(self.foo, self.bar), self.foobar), "=", 1]]

    def test_multiple_statements(self):
        result = get_filter(
            "user.email:foo@example.com OR user.email:bar@example.com OR user.email:foobar@example.com"
        )
        assert result.conditions == [[_or(self.foo, _or(self.bar, self.foobar)), "=", 1]]

        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com AND user.email:foobar@example.com"
        )
        assert result.conditions == [self.ofoo, self.obar, self.ofoobar]

        # longer even number of terms
        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com"
        )
        assert result.conditions == [
            [_or(_and(self.foo, self.bar), _and(self.foobar, self.hello)), "=", 1]
        ]

        # longer odd number of terms
        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com"
        )
        assert result.conditions == [
            [_or(_and(self.foo, self.bar), _and(self.foobar, _and(self.hello, self.hi)),), "=", 1]
        ]

        # absurdly long
        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com OR user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com"
        )
        assert result.conditions == [
            [
                _or(
                    _and(self.foo, self.bar),
                    _or(
                        _and(self.foobar, _and(self.hello, self.hi)),
                        _or(
                            _and(self.foo, self.bar), _and(self.foobar, _and(self.hello, self.hi)),
                        ),
                    ),
                ),
                "=",
                1,
            ]
        ]

    def test_grouping_boolean_filter(self):
        result = get_filter("(event.type:error) AND (stack.in_app:true)")
        assert result.conditions == [["event.type", "=", "error"], ["stack.in_app", "=", 1]]

    def test_grouping_simple(self):
        result = get_filter("(user.email:foo@example.com OR user.email:bar@example.com)")
        assert result.conditions == [[_or(self.foo, self.bar), "=", 1]]

        result = get_filter(
            "(user.email:foo@example.com OR user.email:bar@example.com) AND user.email:foobar@example.com"
        )
        assert result.conditions == [[_or(self.foo, self.bar), "=", 1], self.ofoobar]

        result = get_filter(
            "user.email:foo@example.com AND (user.email:bar@example.com OR user.email:foobar@example.com)"
        )
        assert result.conditions == [self.ofoo, [_or(self.bar, self.foobar), "=", 1]]

    def test_nested_grouping(self):
        result = get_filter(
            "(user.email:foo@example.com OR (user.email:bar@example.com OR user.email:foobar@example.com))"
        )
        assert result.conditions == [[_or(self.foo, _or(self.bar, self.foobar)), "=", 1]]

        result = get_filter(
            "(user.email:foo@example.com OR (user.email:bar@example.com OR (user.email:foobar@example.com AND user.email:hello@example.com OR user.email:hi@example.com)))"
        )
        assert result.conditions == [
            [_or(self.foo, _or(self.bar, _or(_and(self.foobar, self.hello), self.hi)),), "=", 1]
        ]

    def test_grouping_without_boolean_terms(self):
        result = get_filter("undefined is not an object (evaluating 'function.name')")
        assert result.conditions == [
            _om("undefined is not an object"),
            _om("evaluating 'function.name'"),
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
        tests = [
            (
                "foo bar baz OR fizz buzz bizz",
                [[_or(_m("foo bar baz"), _m("fizz buzz bizz")), "=", 1]],
            ),
            (
                "a:b (c:d OR e:f) g:h i:j OR k:l",
                [
                    [
                        _or(
                            _and(
                                _eq("ab"),
                                _and(_or(_eq("cd"), _eq("ef")), _and(_eq("gh"), _eq("ij")),),
                            ),
                            _eq("kl"),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "a:b OR c:d e:f g:h (i:j OR k:l)",
                [
                    [
                        _or(
                            _eq("ab"),
                            _and(
                                _eq("cd"),
                                _and(_eq("ef"), _and(_eq("gh"), _or(_eq("ij"), _eq("kl")))),
                            ),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            ("(a:b OR c:d) e:f", [[_or(_eq("ab"), _eq("cd")), "=", 1], _oeq("ef")]),
            (
                "a:b OR c:d e:f g:h i:j OR k:l",
                [
                    [
                        _or(
                            _eq("ab"),
                            _or(
                                _and(_eq("cd"), _and(_eq("ef"), _and(_eq("gh"), _eq("ij"))),),
                                _eq("kl"),
                            ),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "(a:b OR c:d) e:f g:h OR i:j k:l",
                [
                    [
                        _or(
                            _and(_or(_eq("ab"), _eq("cd")), _and(_eq("ef"), _eq("gh")),),
                            _and(_eq("ij"), _eq("kl")),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "a:b c:d e:f OR g:h i:j",
                [
                    [
                        _or(
                            _and(_eq("ab"), _and(_eq("cd"), _eq("ef"))), _and(_eq("gh"), _eq("ij")),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "a:b c:d (e:f OR g:h) i:j",
                [_oeq("ab"), _oeq("cd"), [_or(_eq("ef"), _eq("gh")), "=", 1], _oeq("ij")],
            ),
            (
                "!a:b c:d (e:f OR g:h) i:j",
                [_noeq("ab"), _oeq("cd"), [_or(_eq("ef"), _eq("gh")), "=", 1], _oeq("ij")],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert test[1] == result.conditions, test[0]

    def test_nesting_using_parentheses(self):
        tests = [
            (
                "(a:b OR (c:d AND (e:f OR (g:h AND e:f))))",
                [
                    [
                        _or(
                            _eq("ab"), _and(_eq("cd"), _or(_eq("ef"), _and(_eq("gh"), _eq("ef")))),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "(a:b OR c:d) AND (e:f g:h)",
                [[_or(_eq("ab"), _eq("cd")), "=", 1], _oeq("ef"), _oeq("gh")],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert test[1] == result.conditions, test[0]

    def test_aggregate_filter_in_conditions(self):
        tests = [
            ("count():>1 AND count():<=3", [_oc(">", 1), _oc("<=", 3)]),
            ("count():>1 OR count():<=3", [[_or(_c(">", 1), _c("<=", 3)), "=", 1]]),
            (
                "count():>1 OR count():>5 AND count():<=3",
                [[_or(_c(">", 1), _and(_c(">", 5), _c("<=", 3))), "=", 1]],
            ),
            (
                "count():>1 AND count():<=3 OR count():>5",
                [[_or(_and(_c(">", 1), _c("<=", 3)), _c(">", 5)), "=", 1]],
            ),
            (
                "(count():>1 OR count():>2) AND count():<=3",
                [[_or(_c(">", 1), _c(">", 2)), "=", 1], _oc("<=", 3)],
            ),
            (
                "(count():>1 AND count():>5) OR count():<=3",
                [[_or(_and(_c(">", 1), _c(">", 5)), _c("<=", 3)), "=", 1]],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert test[1] == result.having, test[0]

    def test_aggregate_filter_and_normal_filter_in_condition(self):
        tests = [
            ("count():>1 AND a:b", [_oeq("ab")], [_oc(">", 1)]),
            ("count():>1 AND a:b c:d", [_oeq("ab"), _oeq("cd")], [_oc(">", 1)]),
            ("(a:b OR c:d) count():>1", [[_or(_eq("ab"), _eq("cd")), "=", 1]], [_oc(">", 1)]),
            (
                "(count():<3 OR count():>10) a:b c:d",
                [_oeq("ab"), _oeq("cd")],
                [[_or(_c("<", 3), _c(">", 10)), "=", 1]],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert test[1] == result.conditions, "cond: " + test[0]
            assert test[2] == result.having, "having: " + test[0]

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

    def test_project_in_condition_filters(self):
        project1 = self.create_project()
        project2 = self.create_project()
        tests = [
            (
                "project:{} OR project:{}".format(project1.slug, project2.slug),
                [
                    [
                        _or(
                            ["equals", ["project_id", project1.id]],
                            ["equals", ["project_id", project2.id]],
                        ),
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
                        _or(
                            ["equals", ["project_id", project1.id]],
                            ["equals", ["project_id", project2.id]],
                        ),
                        "=",
                        1,
                    ],
                    _oeq("ab"),
                ],
                [project1.id, project2.id],
            ),
            (
                "(project:{} AND a:b) OR (project:{} AND c:d)".format(project1.slug, project1.slug),
                [
                    [
                        _or(
                            _and(["equals", ["project_id", project1.id]], _eq("ab")),
                            _and(["equals", ["project_id", project1.id]], _eq("cd")),
                        ),
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
            ("issue.id:{} AND a:b".format(group1.id), [_oeq("ab")], [group1.id]),
            # TODO: Using OR with issue.id is broken. These return incorrect results.
            ("issue.id:{} OR a:b".format(group1.id), [_oeq("ab")], [group1.id]),
            (
                "(issue.id:{} AND a:b) OR issue.id:{}".format(group1.id, group2.id),
                [_oeq("ab")],
                [group1.id, group2.id],
            ),
            (
                "(issue.id:{} AND a:b) OR c:d".format(group1.id),
                [[_or(_eq("ab"), _eq("cd")), "=", 1]],
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
        result = get_filter(
            "failure_rate():>0.003&& users:>10 event.type:transaction",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            _om("failure_rate"),
            _om(":>0.003&&"),
            [["ifNull", ["users", "''"]], "=", ">10"],
            ["event.type", "=", "transaction"],
        ]

    def test_parens_around_message(self):
        result = get_filter(
            "TypeError Anonymous function(app/javascript/utils/transform-object-keys)",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            _om("TypeError Anonymous function"),
            _om("app/javascript/utils/transform-object-keys"),
        ]

    def test_or_does_not_match_organization(self):
        result = get_filter(
            "organization.slug:{}".format(self.organization.slug),
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            [["ifNull", ["organization.slug", "''"]], "=", "{}".format(self.organization.slug)]
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

    def test_user_display_filter(self):
        _filter = get_filter(
            "user.display:bill@example.com", {"organization_id": self.organization.id}
        )
        assert _filter.conditions == [
            [["coalesce", ["user.email", "user.username", "user.ip"]], "=", "bill@example.com"]
        ]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_user_display_wildcard(self):
        _filter = get_filter("user.display:jill*", {"organization_id": self.organization.id})
        assert _filter.conditions == [
            [
                [
                    "match",
                    [["coalesce", ["user.email", "user.username", "user.ip"]], "'(?i)^jill.*$'"],
                ],
                "=",
                1,
            ]
        ]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_has_user_display(self):
        _filter = get_filter("has:user.display", {"organization_id": self.organization.id})
        assert _filter.conditions == [
            [["isNull", [["coalesce", ["user.email", "user.username", "user.ip"]]]], "!=", 1]
        ]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_not_has_user_display(self):
        _filter = get_filter("!has:user.display", {"organization_id": self.organization.id})
        assert _filter.conditions == [
            [["isNull", [["coalesce", ["user.email", "user.username", "user.ip"]]]], "=", 1]
        ]
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

    def test_error_handled(self):
        result = get_filter("error.handled:true")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("error.handled:false")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        result = get_filter("has:error.handled")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("!has:error.handled")
        assert result.conditions == [[["isHandled", []], "=", 0]]

        result = get_filter("!error.handled:true")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        result = get_filter("!error.handled:false")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("!error.handled:0")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        with pytest.raises(InvalidSearchQuery):
            get_filter("error.handled:99")

        with pytest.raises(InvalidSearchQuery):
            get_filter("error.handled:nope")

    def test_error_unhandled(self):
        result = get_filter("error.unhandled:true")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        result = get_filter("error.unhandled:false")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("has:error.unhandled")
        assert result.conditions == [[["isHandled", []], "=", 0]]

        result = get_filter("!has:error.unhandled")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("!error.unhandled:true")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("!error.unhandled:false")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        result = get_filter("!error.unhandled:0")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        with pytest.raises(InvalidSearchQuery):
            get_filter("error.unhandled:99")

        with pytest.raises(InvalidSearchQuery):
            get_filter("error.unhandled:nope")

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

    def test_release_latest(self):
        result = get_filter(
            "release:latest",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [[["isNull", ["release"]], "=", 1]]

        # When organization id isn't included, project_id should unfortunately be an object
        result = get_filter("release:latest", params={"project_id": [self.project]})
        assert result.conditions == [[["isNull", ["release"]], "=", 1]]

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
            "user_misery(300)",
            "percentile(transaction.duration, 0.75)",
            "percentile(transaction.duration, 0.95)",
            "percentile(transaction.duration, 0.99)",
            "percentile(transaction.duration, 0.995)",
            "percentile(transaction.duration, 0.99900)",
            "percentile(transaction.duration, 0.99999)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())

        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["avg", "transaction.duration", "avg_transaction_duration"],
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["max", "timestamp", "last_seen"],
            ["apdex(duration, 300)", None, "apdex_300"],
            ["uniqIf(user, greater(duration, 1200))", None, "user_misery_300"],
            ["quantile(0.75)", "transaction.duration", "percentile_transaction_duration_0_75"],
            ["quantile(0.95)", "transaction.duration", "percentile_transaction_duration_0_95"],
            ["quantile(0.99)", "transaction.duration", "percentile_transaction_duration_0_99"],
            ["quantile(0.995)", "transaction.duration", "percentile_transaction_duration_0_995"],
            ["quantile(0.999)", "transaction.duration", "percentile_transaction_duration_0_99900"],
            [
                "quantile(0.99999)",
                "transaction.duration",
                "percentile_transaction_duration_0_99999",
            ],
        ]
        assert result["groupby"] == []

    def test_field_alias_expansion(self):
        fields = [
            "title",
            "last_seen()",
            "latest_event()",
            "project",
            "issue",
            "user.display",
            "message",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "title",
            "issue.id",
            ["coalesce", ["user.email", "user.username", "user.ip"], "user.display"],
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
            ["coalesce", ["user.email", "user.username", "user.ip"], "user.display"],
            "message",
            "project.id",
        ]

    def test_field_alias_with_aggregates(self):
        fields = ["event.type", "user.display", "count_unique(title)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "event.type",
            ["coalesce", ["user.email", "user.username", "user.ip"], "user.display"],
        ]
        assert result["aggregations"] == [["uniq", "title", "count_unique_title"]]
        assert result["groupby"] == [
            "event.type",
            ["coalesce", ["user.email", "user.username", "user.ip"], "user.display"],
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

    def test_aggregate_function_complex_field_expansion(self):
        fields = ["count_unique(user.display)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            [
                "uniq",
                [["coalesce", ["user.email", "user.username", "user.ip"]]],
                "count_unique_user_display",
            ],
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

    def test_aggregate_function_missing_parameter(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["count_unique()"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "InvalidSearchQuery: count_unique(): column argument invalid: a column is required"
            in six.text_type(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["count_unique(  )"]
            resolve_field_list(fields, eventstore.Filter())

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
        assert "percentile(0.75): expected 2 argument(s)" in six.text_type(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(0.75,)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "percentile(0.75,): expected 2 argument(s)" in six.text_type(err)

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
            "percentile(id, 0.75): column argument invalid: id is not a numeric column"
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
        fields = ["absolute_delta(transaction.duration,100)", "id"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            [
                "abs",
                [["minus", ["transaction.duration", 100.0]]],
                "absolute_delta_transaction_duration_100",
            ],
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

    def test_array_join_function(self):
        fields = [
            "array_join(tags.key)",
            "array_join(tags.value)",
            "array_join(measurements_key)",
        ]
        result = resolve_field_list(fields, eventstore.Filter(), functions_acl=["array_join"])
        assert result["selected_columns"] == [
            ["arrayJoin", ["tags.key"], "array_join_tags_key"],
            ["arrayJoin", ["tags.value"], "array_join_tags_value"],
            ["arrayJoin", ["measurements_key"], "array_join_measurements_key"],
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_array_join_function_no_access(self):
        fields = ["array_join(tags.key)"]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter())
        assert "no access to private function" in six.text_type(err)

    def test_measurements_histogram_function(self):
        fields = ["measurements_histogram(10, 5, 1)"]
        result = resolve_field_list(
            fields, eventstore.Filter(), functions_acl=["measurements_histogram"]
        )
        assert result["selected_columns"] == [
            [
                "plus",
                [
                    [
                        "multiply",
                        [
                            [
                                "floor",
                                [
                                    [
                                        "divide",
                                        [
                                            [
                                                "minus",
                                                [
                                                    [
                                                        "multiply",
                                                        [["arrayJoin", ["measurements_value"]], 1],
                                                    ],
                                                    5,
                                                ],
                                            ],
                                            10,
                                        ],
                                    ]
                                ],
                            ],
                            10,
                        ],
                    ],
                    5,
                ],
                "measurements_histogram_10_5_1",
            ],
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_measurements_histogram_function_no_access(self):
        fields = ["measurements_histogram(10, 5, 1)"]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter())
        assert "no access to private function" in six.text_type(err)

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
        assert "histogram(transaction.duration, 10): expected 4 argument(s)" in six.text_type(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["histogram(transaction.duration, 1000, 1000, 0)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "histogram(transaction.duration, 1000, 1000, 0): num_buckets argument invalid: 1000 must be less than 500"
            in six.text_type(err)
        )

    def test_count_at_least_function(self):
        fields = ["count_at_least(measurements.baz, 1000)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [["greaterOrEquals", ["measurements.baz", 1000]]],
                "count_at_least_measurements_baz_1000",
            ]
        ]

    def test_percentile_range(self):
        fields = [
            "percentile_range(transaction.duration, 0.5, 2020-05-01T01:12:34, 2020-05-03T06:48:57, percentile_range_1)"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.50)",
                [
                    "transaction.duration",
                    [
                        "and",
                        [
                            [
                                "lessOrEquals",
                                [["toDateTime", ["'2020-05-01T01:12:34'"]], "timestamp"],
                            ],
                            ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                        ],
                    ],
                ],
                "percentile_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = [
                "percentile_range(transaction.duration, 0.5, 2020-05-01T01:12:34, tomorrow, 1)"
            ]
            resolve_field_list(fields, eventstore.Filter())
        assert "end argument invalid: tomorrow is in the wrong format" in six.text_type(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile_range(transaction.duration, 0.5, today, 2020-05-03T06:48:57, 1)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "start argument invalid: today is in the wrong format" in six.text_type(err)

    def test_average_range(self):
        fields = [
            "avg_range(transaction.duration, 2020-05-01T01:12:34, 2020-05-03T06:48:57, avg_range_1)"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "avgIf",
                [
                    "transaction.duration",
                    [
                        "and",
                        [
                            [
                                "lessOrEquals",
                                [["toDateTime", ["'2020-05-01T01:12:34'"]], "timestamp"],
                            ],
                            ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                        ],
                    ],
                ],
                "avg_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["avg_range(transaction.duration, 2020-05-01T01:12:34, tomorrow, 1)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "end argument invalid: tomorrow is in the wrong format" in six.text_type(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["avg_range(transaction.duration, today, 2020-05-03T06:48:57, 1)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "start argument invalid: today is in the wrong format" in six.text_type(err)

    def test_absolute_correlation(self):
        fields = ["absolute_correlation()"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "abs",
                [["corr", [["toUnixTimestamp", ["timestamp"]], "transaction.duration"]]],
                u"absolute_correlation",
            ]
        ]

    def test_percentage(self):
        fields = [
            "percentile_range(transaction.duration, 0.95, 2020-05-01T01:12:34, 2020-05-03T06:48:57, percentile_range_1)",
            "percentile_range(transaction.duration, 0.95, 2020-05-03T06:48:57, 2020-05-05T01:12:34, percentile_range_2)",
            "percentage(percentile_range_2, percentile_range_1, trend_percentage)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    [
                        "and",
                        [
                            [
                                "lessOrEquals",
                                [["toDateTime", ["'2020-05-01T01:12:34'"]], "timestamp"],
                            ],
                            ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                        ],
                    ],
                ],
                "percentile_range_1",
            ],
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    [
                        "and",
                        [
                            [
                                "lessOrEquals",
                                [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"],
                            ],
                            ["greater", [["toDateTime", ["'2020-05-05T01:12:34'"]], "timestamp"]],
                        ],
                    ],
                ],
                "percentile_range_2",
            ],
            [
                "if(greater(percentile_range_1,0),divide(percentile_range_2,percentile_range_1),null)",
                None,
                "trend_percentage",
            ],
        ]

    def test_minus(self):
        fields = [
            "percentile_range(transaction.duration, 0.95, 2020-05-01T01:12:34, 2020-05-03T06:48:57, percentile_range_1)",
            "percentile_range(transaction.duration, 0.95, 2020-05-03T06:48:57, 2020-05-05T01:12:34, percentile_range_2)",
            "minus(percentile_range_2, percentile_range_1, trend_difference)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    [
                        "and",
                        [
                            [
                                "lessOrEquals",
                                [["toDateTime", ["'2020-05-01T01:12:34'"]], "timestamp"],
                            ],
                            ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                        ],
                    ],
                ],
                "percentile_range_1",
            ],
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    [
                        "and",
                        [
                            [
                                "lessOrEquals",
                                [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"],
                            ],
                            ["greater", [["toDateTime", ["'2020-05-05T01:12:34'"]], "timestamp"]],
                        ],
                    ],
                ],
                "percentile_range_2",
            ],
            ["minus", ["percentile_range_2", "percentile_range_1"], "trend_difference"],
        ]

    def test_percentile_shortcuts(self):
        columns = [
            "",  # test default value
            "transaction.duration",
            "measurements.fp",
            "measurements.fcp",
            "measurements.lcp",
            "measurements.fid",
            "measurements.bar",
        ]

        for column in columns:
            # if no column then use transaction.duration
            snuba_column = column if column else "transaction.duration"
            column_alias = column.replace(".", "_")

            fields = [
                field.format(column)
                for field in ["p50({})", "p75({})", "p95({})", "p99({})", "p100({})"]
            ]
            result = resolve_field_list(fields, eventstore.Filter())

            assert result["aggregations"] == [
                ["quantile(0.5)", snuba_column, "p50_{}".format(column_alias).strip("_")],
                ["quantile(0.75)", snuba_column, "p75_{}".format(column_alias).strip("_")],
                ["quantile(0.95)", snuba_column, "p95_{}".format(column_alias).strip("_")],
                ["quantile(0.99)", snuba_column, "p99_{}".format(column_alias).strip("_")],
                ["max", snuba_column, "p100_{}".format(column_alias).strip("_")],
            ]

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

    def test_orderby_user_display_alias(self):
        fields = ["user.display"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-user.display"))
        assert result["selected_columns"] == [
            ["coalesce", ["user.email", "user.username", "user.ip"], "user.display"],
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]
        assert result["orderby"] == ["-user.display"]
        assert result["aggregations"] == []
        assert result["groupby"] == []

    def test_resolves_functions_with_arguments(self):
        fields = [
            "count()",
            "p50()",
            "p50(transaction.duration)",
            "avg(measurements.foo)",
            "percentile(measurements.fcp, 0.5)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        functions = result["functions"]

        assert functions["count"].instance.name == "count"
        assert functions["count"].arguments == {"column": None}

        assert functions["p50"].instance.name == "p50"
        assert functions["p50"].arguments == {"column": "transaction.duration"}

        assert functions["p50_transaction_duration"].instance.name == "p50"
        assert functions["p50_transaction_duration"].arguments == {"column": "transaction.duration"}

        assert functions["avg_measurements_foo"].instance.name == "avg"
        assert functions["avg_measurements_foo"].arguments == {"column": "measurements.foo"}

        assert functions["avg_measurements_foo"].instance.name == "avg"
        assert functions["avg_measurements_foo"].arguments == {"column": "measurements.foo"}

        assert functions["percentile_measurements_fcp_0_5"].instance.name == "percentile"
        assert functions["percentile_measurements_fcp_0_5"].arguments == {
            "column": "measurements.fcp",
            "percentile": 0.5,
        }


def with_type(type, argument):
    argument.get_type = lambda *_: type
    return argument


class FunctionTest(unittest.TestCase):
    def setUp(self):
        self.fn_wo_optionals = Function(
            "wo_optionals", required_args=[FunctionArg("arg1"), FunctionArg("arg2")], transform="",
        )
        self.fn_w_optionals = Function(
            "w_optionals",
            required_args=[FunctionArg("arg1")],
            optional_args=[with_default("default", FunctionArg("arg2"))],
            transform="",
        )

    def test_no_optional_valid(self):
        self.fn_wo_optionals.validate_argument_count("fn_wo_optionals()", ["arg1", "arg2"])

    def test_no_optional_not_enough_arguments(self):
        with self.assertRaisesRegexp(
            InvalidSearchQuery, u"fn_wo_optionals\(\): expected 2 argument\(s\)"
        ):
            self.fn_wo_optionals.validate_argument_count("fn_wo_optionals()", ["arg1"])

    def test_no_optional_too_may_arguments(self):
        with self.assertRaisesRegexp(
            InvalidSearchQuery, u"fn_wo_optionals\(\): expected 2 argument\(s\)"
        ):
            self.fn_wo_optionals.validate_argument_count(
                "fn_wo_optionals()", ["arg1", "arg2", "arg3"]
            )

    def test_optional_valid(self):
        self.fn_w_optionals.validate_argument_count("fn_w_optionals()", ["arg1", "arg2"])
        # because the last argument is optional, we dont need to provide it
        self.fn_w_optionals.validate_argument_count("fn_w_optionals()", ["arg1"])

    def test_optional_not_enough_arguments(self):
        with self.assertRaisesRegexp(
            InvalidSearchQuery, u"fn_w_optionals\(\): expected at least 1 argument\(s\)"
        ):
            self.fn_w_optionals.validate_argument_count("fn_w_optionals()", [])

    def test_optional_too_many_arguments(self):
        with self.assertRaisesRegexp(
            InvalidSearchQuery, u"fn_w_optionals\(\): expected at most 2 argument\(s\)"
        ):
            self.fn_w_optionals.validate_argument_count(
                "fn_w_optionals()", ["arg1", "arg2", "arg3"]
            )

    def test_optional_args_have_default(self):
        with self.assertRaisesRegexp(
            AssertionError, u"test: optional argument at index 0 does not have default"
        ):
            Function("test", optional_args=[FunctionArg("arg1")])

    def test_defining_duplicate_args(self):
        with self.assertRaisesRegexp(
            AssertionError, u"test: argument arg1 specified more than once"
        ):
            Function(
                "test",
                required_args=[FunctionArg("arg1")],
                optional_args=[with_default("default", FunctionArg("arg1"))],
                transform="",
            )

        with self.assertRaisesRegexp(
            AssertionError, u"test: argument arg1 specified more than once"
        ):
            Function(
                "test",
                required_args=[FunctionArg("arg1")],
                calculated_args=[{"name": "arg1", "fn": lambda x: x}],
                transform="",
            )

        with self.assertRaisesRegexp(
            AssertionError, u"test: argument arg1 specified more than once"
        ):
            Function(
                "test",
                optional_args=[with_default("default", FunctionArg("arg1"))],
                calculated_args=[{"name": "arg1", "fn": lambda x: x}],
                transform="",
            )

    def test_default_result_type(self):
        fn = Function("fn", transform="")
        assert fn.get_result_type() is None

        fn = Function("fn", transform="", default_result_type="number")
        assert fn.get_result_type() == "number"

    def test_result_type_fn(self):
        fn = Function("fn", transform="", result_type_fn=lambda *_: None)
        assert fn.get_result_type("fn()", []) is None

        fn = Function("fn", transform="", result_type_fn=lambda *_: "number")
        assert fn.get_result_type("fn()", []) == "number"

        fn = Function(
            "fn",
            required_args=[with_type("number", FunctionArg("arg1"))],
            transform="",
            result_type_fn=lambda args, columns: args[0].get_type(columns[0]),
        )
        assert fn.get_result_type("fn()", ["arg1"]) == "number"

    def test_private_function(self):
        fn = Function("fn", transform="", result_type_fn=lambda *_: None, private=True)
        assert fn.is_accessible() is False
        assert fn.is_accessible(None) is False
        assert fn.is_accessible([]) is False
        assert fn.is_accessible(["other_fn"]) is False
        assert fn.is_accessible(["fn"]) is True
