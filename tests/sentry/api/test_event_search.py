import datetime
import pytest
import unittest
from datetime import timedelta
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME, SPAN_STATUS_NAME_TO_CODE

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
    parse_function,
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
    assert get_json_meta_type("user_misery_prototype_300", "Float32") == "number"
    assert get_json_meta_type("percentile_transaction_duration_0_95", "Float32") == "duration"
    assert get_json_meta_type("count_thing", "UInt64") == "integer"
    assert get_json_meta_type("count_thing", "String") == "string"
    assert get_json_meta_type("count_thing", "Nullable(String)") == "string"
    assert get_json_meta_type("measurements.size", "Float64") == "number"
    assert get_json_meta_type("measurements.fp", "Float64") == "duration"


def test_parse_function():
    assert parse_function("percentile(transaction.duration, 0.5)") == (
        "percentile",
        ["transaction.duration", "0.5"],
        None,
    )
    assert parse_function("p50()") == (
        "p50",
        [],
        None,
    )
    assert parse_function("p75(measurements.lcp)") == ("p75", ["measurements.lcp"], None)
    assert parse_function("apdex(300)") == ("apdex", ["300"], None)
    assert parse_function("failure_rate()") == ("failure_rate", [], None)
    assert parse_function("histogram(measurements_value, 1,0,1)") == (
        "histogram",
        ["measurements_value", "1", "0", "1"],
        None,
    )
    assert parse_function("count_unique(transaction.status)") == (
        "count_unique",
        ["transaction.status"],
        None,
    )
    assert parse_function("count_unique(some.tag-name)") == (
        "count_unique",
        ["some.tag-name"],
        None,
    )
    assert parse_function("count()") == ("count", [], None)
    assert parse_function("count_at_least(transaction.duration ,200)") == (
        "count_at_least",
        ["transaction.duration", "200"],
        None,
    )
    assert parse_function("min(measurements.foo)") == ("min", ["measurements.foo"], None)
    assert parse_function("absolute_delta(transaction.duration, 400)") == (
        "absolute_delta",
        ["transaction.duration", "400"],
        None,
    )
    assert parse_function(
        "avg_range(transaction.duration, 0.5, 2020-03-13T15:14:15, 2020-03-14T15:14:15) AS p"
    ) == (
        "avg_range",
        ["transaction.duration", "0.5", "2020-03-13T15:14:15", "2020-03-14T15:14:15"],
        "p",
    )
    assert parse_function("t_test(avg_1, avg_2,var_1, var_2, count_1, count_2)") == (
        "t_test",
        ["avg_1", "avg_2", "var_1", "var_2", "count_1", "count_2"],
        None,
    )
    assert parse_function("compare_numeric_aggregate(alias, greater,1234)") == (
        "compare_numeric_aggregate",
        ["alias", "greater", "1234"],
        None,
    )
    assert parse_function(r'to_other(release,"asdf @ \"qwer: (3,2)")') == (
        "to_other",
        ["release", r'"asdf @ \"qwer: (3,2)"'],
        None,
    )


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
            with self.assertRaisesRegexp(InvalidSearchQuery, "Invalid date"):
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

    def test_timestamp_rollup(self):
        assert parse_search_query("timestamp.to_hour:2018-01-01T05:06:07+00:00") == [
            SearchFilter(
                key=SearchKey(name="timestamp.to_hour"),
                operator=">=",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 1, 7, tzinfo=timezone.utc)
                ),
            ),
            SearchFilter(
                key=SearchKey(name="timestamp.to_hour"),
                operator="<",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 12, 7, tzinfo=timezone.utc)
                ),
            ),
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
                f"Invalid quote at '{test[0]}': quotes must enclose text or be escaped.",
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
            assert parse_search_query(f"stack.in_app:{val}") == [
                SearchFilter(
                    key=SearchKey(name="stack.in_app"),
                    operator="=",
                    value=SearchValue(raw_value=1),
                )
            ]
        falsey = ("false", "FALSE", "0")
        for val in falsey:
            assert parse_search_query(f"stack.in_app:{val}") == [
                SearchFilter(
                    key=SearchKey(name="stack.in_app"),
                    operator="=",
                    value=SearchValue(raw_value=0),
                )
            ]

        assert parse_search_query("!stack.in_app:false") == [
            SearchFilter(
                key=SearchKey(name="stack.in_app"),
                operator="=",
                value=SearchValue(raw_value=1),
            )
        ]

    def test_invalid_boolean_filter(self):
        invalid_queries = ["stack.in_app:lol", "stack.in_app:123", "stack.in_app:>true"]
        for invalid_query in invalid_queries:
            with self.assertRaisesRegexp(InvalidSearchQuery, "Invalid boolean"):
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

    def test_numeric_filter_with_decimals(self):
        assert parse_search_query("transaction.duration:>3.1415") == [
            SearchFilter(
                key=SearchKey(name="transaction.duration"),
                operator=">",
                value=SearchValue(raw_value=3.1415),
            )
        ]

    def test_numeric_filter_with_shorthand(self):
        assert parse_search_query("stack.colno:>3k") == [
            SearchFilter(
                key=SearchKey(name="stack.colno"),
                operator=">",
                value=SearchValue(raw_value=3000.0),
            )
        ]
        assert parse_search_query("stack.colno:>3m") == [
            SearchFilter(
                key=SearchKey(name="stack.colno"),
                operator=">",
                value=SearchValue(raw_value=3000000.0),
            )
        ]
        assert parse_search_query("stack.colno:>3b") == [
            SearchFilter(
                key=SearchKey(name="stack.colno"),
                operator=">",
                value=SearchValue(raw_value=3000000000.0),
            )
        ]

    def test_invalid_numeric_fields(self):
        invalid_queries = ["project.id:one", "issue.id:two", "transaction.duration:>hotdog"]
        for invalid_query in invalid_queries:
            with self.assertRaisesRegexp(InvalidSearchQuery, "Invalid number"):
                parse_search_query(invalid_query)

    def test_invalid_numeric_shorthand(self):
        with self.assertRaisesRegexp(
            InvalidSearchQuery, expected_regex="is not a valid number suffix, must be k, m or b"
        ):
            parse_search_query("stack.colno:>3s")

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

    def test_duration_filter_overrides_numeric_shorthand(self):
        # 2m should mean 2 minutes for duration filters (as opposed to 2 million)
        assert parse_search_query("transaction.duration:>2m") == [
            SearchFilter(
                key=SearchKey(name="transaction.duration"),
                operator=">",
                value=SearchValue(raw_value=120000.0),
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

    def test_aggregate_duration_filter_overrides_numeric_shorthand(self):
        # 2m should mean 2 minutes for duration filters (as opposed to 2 million)
        assert parse_search_query("avg(transaction.duration):>2m") == [
            SearchFilter(
                key=AggregateKey(name="avg(transaction.duration)"),
                operator=">",
                value=SearchValue(raw_value=120000.0),
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

        assert parse_search_query("min(measurements.size):<3k") == [
            SearchFilter(
                key=SearchKey(name="min(measurements.size)"),
                operator="<",
                value=SearchValue(raw_value=3000.0),
            )
        ]

        assert parse_search_query("min(measurements.size):2m") == [
            SearchFilter(
                key=SearchKey(name="min(measurements.size)"),
                operator="=",
                value=SearchValue(raw_value=2000000.0),
            )
        ]

    def test_invalid_numeric_aggregate_filter(self):
        with self.assertRaisesRegexp(
            InvalidSearchQuery, expected_regex="is not a valid number suffix, must be k, m or b"
        ):
            parse_search_query("min(measurements.size):3s")

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
    return ["notEquals", [["positionCaseInsensitive", ["message", f"'{x}'"]], 0]]


# message ("foo bar baz") using operators instead of functions
def _om(x):
    return [["positionCaseInsensitive", ["message", f"'{x}'"]], "!=", 0]


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
        super().setUp()
        users = ["foo", "bar", "foobar", "hello", "hi"]
        for u in users:
            self.__setattr__(u, ["equals", ["user.email", f"{u}@example.com"]])
            self.__setattr__(f"o{u}", ["user.email", "=", f"{u}@example.com"])

    def test_simple(self):
        result = get_filter("user.email:foo@example.com OR user.email:bar@example.com")
        assert result.conditions == [[_or(self.foo, self.bar), "=", 1]]

        result = get_filter("user.email:foo@example.com AND user.email:bar@example.com")
        assert result.conditions == [self.ofoo, self.obar]

    def test_words_with_boolean_substrings(self):
        result = get_filter("ORder")
        assert result.conditions == [_om("ORder")]

        result = get_filter("ANDroid")
        assert result.conditions == [_om("ANDroid")]

    def test_single_term(self):
        result = get_filter("user.email:foo@example.com")
        assert result.conditions == [self.ofoo]

    def test_wildcard_array_field(self):
        _filter = get_filter("error.value:Deadlock* OR !stack.filename:*.py")
        assert _filter.conditions == [
            [
                _or(
                    ["like", ["error.value", "Deadlock%"]],
                    ["notLike", ["stack.filename", "%.py"]],
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
            [
                _or(
                    _and(self.foo, self.bar),
                    _and(self.foobar, _and(self.hello, self.hi)),
                ),
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
                _or(
                    _and(self.foo, self.bar),
                    _or(
                        _and(self.foobar, _and(self.hello, self.hi)),
                        _or(
                            _and(self.foo, self.bar),
                            _and(self.foobar, _and(self.hello, self.hi)),
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
            [
                _or(
                    self.foo,
                    _or(self.bar, _or(_and(self.foobar, self.hello), self.hi)),
                ),
                "=",
                1,
            ]
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
            str(error.value)
            == "Parse error at '(user.' (column 1). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter(
                "((user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com)"
            )
        assert (
            str(error.value)
            == "Parse error at '((user' (column 1). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("user.email:foo@example.com OR user.email:bar@example.com)")
        assert (
            str(error.value)
            == "Parse error at '.com)' (column 57). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter(
                "(user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com))"
            )
        assert (
            str(error.value)
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
                                _and(
                                    _or(_eq("cd"), _eq("ef")),
                                    _and(_eq("gh"), _eq("ij")),
                                ),
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
                                _and(
                                    _eq("cd"),
                                    _and(_eq("ef"), _and(_eq("gh"), _eq("ij"))),
                                ),
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
                            _and(
                                _or(_eq("ab"), _eq("cd")),
                                _and(_eq("ef"), _eq("gh")),
                            ),
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
                            _and(_eq("ab"), _and(_eq("cd"), _eq("ef"))),
                            _and(_eq("gh"), _eq("ij")),
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
                            _eq("ab"),
                            _and(_eq("cd"), _or(_eq("ef"), _and(_eq("gh"), _eq("ef")))),
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
            str(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("(count():>1 AND a:b) OR a:b")
        assert (
            str(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("(count():>1 AND a:b) OR (a:b AND count():>2)")
        assert (
            str(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("a:b OR (c:d AND (e:f AND count():>1))")
        assert (
            str(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )

    def test_project_in_condition_filters(self):
        project1 = self.create_project()
        project2 = self.create_project()
        tests = [
            (
                f"project:{project1.slug} OR project:{project2.slug}",
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
                f"(project:{project1.slug} OR project:{project2.slug}) AND a:b",
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
                f"(project:{project1.slug} AND a:b) OR (project:{project1.slug} AND c:d)",
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
            assert set(test[2]) == set(result.project_ids), test[0]

    def test_project_in_condition_filters_not_in_project_filter(self):
        project1 = self.create_project()
        project2 = self.create_project()
        project3 = self.create_project()
        with self.assertRaisesRegexp(
            InvalidSearchQuery,
            f"Project {project3.slug} does not exist or is not an actively selected project.",
        ):
            get_filter(
                f"project:{project1.slug} OR project:{project3.slug}",
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
                f"issue.id:{group1.id} OR issue.id:{group2.id}",
                [],
                [group1.id, group2.id],
            ),
            (f"issue.id:{group1.id} AND issue.id:{group1.id}", [], [group1.id]),
            (
                f"(issue.id:{group1.id} AND issue.id:{group2.id}) OR issue.id:{group3.id}",
                [],
                [group1.id, group2.id, group3.id],
            ),
            (f"issue.id:{group1.id} AND a:b", [_oeq("ab")], [group1.id]),
            # TODO: Using OR with issue.id is broken. These return incorrect results.
            (f"issue.id:{group1.id} OR a:b", [_oeq("ab")], [group1.id]),
            (
                f"(issue.id:{group1.id} AND a:b) OR issue.id:{group2.id}",
                [_oeq("ab")],
                [group1.id, group2.id],
            ),
            (
                f"(issue.id:{group1.id} AND a:b) OR c:d",
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
            f"organization.slug:{self.organization.slug}",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            [["ifNull", ["organization.slug", "''"]], "=", f"{self.organization.slug}"]
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
            "message:*\u716e\u6211\u66f4\u591a\u7684\u98df\u7269\uff0c\u6211\u9913\u4e86."
        )
        assert _filter.conditions == [
            [
                [
                    "match",
                    [
                        "message",
                        "'(?i).*\u716e\u6211\u66f4\u591a\u7684\u98df\u7269\uff0c\u6211\u9913\u4e86\\.'",
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
            [["match", ["user.email", "'(?i)^\\*@example\\.com$'"]], "=", 1],
        ]
        assert get_filter("release:\\\\\\*").conditions == [
            [["match", ["release", "'(?i)^\\\\\\*$'"]], "=", 1]
        ]
        assert get_filter("release:\\\\*").conditions == [
            [["match", ["release", "'(?i)^\\\\.*$'"]], "=", 1]
        ]
        assert get_filter("message:.*?").conditions == [
            [["match", ["message", r"'(?i)\..*\?'"]], "=", 1]
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

    def test_existence_array_field(self):
        _filter = get_filter('has:stack.filename !has:stack.lineno error.value:""')
        assert _filter.conditions == [
            [["notEmpty", ["stack.filename"]], "=", 1],
            [["notEmpty", ["stack.lineno"]], "=", 0],
            [["notEmpty", ["error.value"]], "=", 0],
        ]

    def test_wildcard_with_trailing_backslash(self):
        results = get_filter("title:*misgegaan\\")
        assert results.conditions == [[["match", ["title", "'(?i)^.*misgegaan\\\\$'"]], "=", 1]]

    def test_has(self):
        assert get_filter("has:release").conditions == [[["isNull", ["release"]], "!=", 1]]

    def test_not_has(self):
        assert get_filter("!has:release").conditions == [[["isNull", ["release"]], "=", 1]]

    def test_has_issue(self):
        has_issue_filter = get_filter("has:issue")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [["issue.id", "!=", 0]]

    def test_not_has_issue(self):
        has_issue_filter = get_filter("!has:issue")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [
            [[["isNull", ["issue.id"]], "=", 1], ["issue.id", "=", 0]]
        ]

    def test_has_issue_id(self):
        has_issue_filter = get_filter("has:issue.id")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [["issue.id", "!=", 0]]

    def test_not_has_issue_id(self):
        has_issue_filter = get_filter("!has:issue.id")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [
            [[["isNull", ["issue.id"]], "=", 1], ["issue.id", "=", 0]]
        ]

    def test_message_empty(self):
        assert get_filter("has:message").conditions == [[["equals", ["message", ""]], "!=", 1]]
        assert get_filter("!has:message").conditions == [[["equals", ["message", ""]], "=", 1]]
        assert get_filter('message:""').conditions == [[["equals", ["message", ""]], "=", 1]]
        assert get_filter('!message:""').conditions == [[["equals", ["message", ""]], "!=", 1]]

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
        assert "Invalid value '" in str(err)
        assert "' for 'issue:' filter" in str(err)

    def test_issue_filter(self):
        group = self.create_group(project=self.project)
        _filter = get_filter(
            f"issue:{group.qualified_short_id}", {"organization_id": self.organization.id}
        )
        assert _filter.conditions == [["issue.id", "=", group.id]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_negated_issue_filter(self):
        group = self.create_group(project=self.project)
        _filter = get_filter(
            f"!issue:{group.qualified_short_id}", {"organization_id": self.organization.id}
        )
        assert _filter.conditions == [["issue.id", "!=", group.id]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_unknown_issue_filter(self):
        _filter = get_filter("issue:unknown", {"organization_id": self.organization.id})
        assert _filter.conditions == [[[["isNull", ["issue.id"]], "=", 1], ["issue.id", "=", 0]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        _filter = get_filter("!issue:unknown", {"organization_id": self.organization.id})
        assert _filter.conditions == [["issue.id", "!=", 0]]
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
        _filter = get_filter(f"project.name:{p1.slug}", params)
        assert _filter.conditions == [["project_id", "=", p1.id]]
        assert _filter.filter_keys == {"project_id": [p1.id]}
        assert _filter.project_ids == [p1.id]

        params = {"project_id": [p1.id, p2.id]}
        _filter = get_filter(f"!project.name:{p1.slug}", params)
        assert _filter.conditions == [
            [[["isNull", ["project_id"]], "=", 1], ["project_id", "!=", p1.id]]
        ]
        assert _filter.filter_keys == {"project_id": [p1.id, p2.id]}
        assert _filter.project_ids == [p1.id, p2.id]

        with pytest.raises(InvalidSearchQuery) as exc_info:
            params = {"project_id": []}
            get_filter(f"project.name:{p1.slug}", params)

        exc = exc_info.value
        exc_str = f"{exc}"
        assert (
            f"Invalid query. Project {p1.slug} does not exist or is not an actively selected project"
            in exc_str
        )

    def test_not_has_project(self):
        with pytest.raises(InvalidSearchQuery) as err:
            get_filter("!has:project")
        assert "Invalid query for 'has' search: 'project' cannot be empty." in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            get_filter("!has:project.name")
        assert "Invalid query for 'has' search: 'project' cannot be empty." in str(err)

    def test_transaction_status(self):
        for (key, val) in SPAN_STATUS_CODE_TO_NAME.items():
            result = get_filter(f"transaction.status:{val}")
            assert result.conditions == [["transaction.status", "=", key]]

    def test_transaction_status_no_wildcard(self):
        with pytest.raises(InvalidSearchQuery) as exc_info:
            get_filter("transaction.status:o*")
        exc = exc_info.value
        exc_str = f"{exc}"
        assert "Invalid value" in exc_str
        assert "cancelled," in exc_str

    def test_transaction_status_invalid(self):
        with pytest.raises(InvalidSearchQuery) as exc_info:
            get_filter("transaction.status:lol")
        exc = exc_info.value
        exc_str = f"{exc}"
        assert "Invalid value" in exc_str
        assert "cancelled," in exc_str

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

    def test_function_arguments_with_spaces(self):
        result = get_filter("percentile(     transaction.duration,     0.75   ):>100")
        assert result.having == [["percentile_transaction_duration_0_75", ">", 100]]

        result = get_filter("percentile    (transaction.duration, 0.75):>100")
        assert result.conditions == [
            _om("percentile"),
            _om("transaction.duration, 0.75"),
            _om(":>100"),
        ]
        assert result.having == []

        result = get_filter(
            "epm(       ):>100", {"start": before_now(minutes=5), "end": before_now()}
        )
        assert result.having == [["epm", ">", 100]]

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
        result = get_filter("trace:a0fa8803753e40fd8124b21eeb2986b5")
        assert result.conditions == [["trace", "=", "a0fa8803-753e-40fd-8124-b21eeb2986b5"]]

    def test_group_id_query(self):
        # If a user queries on group_id, make sure it gets turned into a tag not the actual group_id field
        assert get_filter("group_id:not-a-group-id-but-a-string").conditions == [
            [["ifNull", ["tags[group_id]", "''"]], "=", "not-a-group-id-but-a-string"]
        ]

        assert get_filter("group_id:wildcard-string*").conditions == [
            [
                ["match", [["ifNull", ["tags[group_id]", "''"]], "'(?i)^wildcard\\-string.*$'"]],
                "=",
                1,
            ]
        ]


class ResolveFieldListTest(unittest.TestCase):
    def test_non_string_field_error(self):
        fields = [["any", "thing", "lol"]]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter())
        assert "Field names" in str(err)

    def test_tag_fields(self):
        fields = ["tags[test.foo:bar-123]"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "tags[test.foo:bar-123]",
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_invalid_tag_fields(self):
        for fields in [
            ["t[a]gs[test]"],
            ["t(a)gstest"],
            ["tags[te[s]t]"],
            ["tags[test]tags[test]"],
        ]:
            with pytest.raises(InvalidSearchQuery) as err:
                resolve_field_list(fields, eventstore.Filter())
            assert "Invalid character" in str(err)

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
            "stddev(transaction.duration)",
            "latest_event()",
            "last_seen()",
            "apdex(300)",
            "user_misery(300)",
            "user_misery_prototype(300)",
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
            ["stddevSamp", "transaction.duration", "stddev_transaction_duration"],
            ["argMax", ["id", "timestamp"], "latest_event"],
            ["max", "timestamp", "last_seen"],
            ["apdex(duration, 300)", None, "apdex_300"],
            ["uniqIf(user, greater(duration, 1200))", None, "user_misery_300"],
            [
                "ifNull(divide(plus(uniqIf(user, greater(duration, 1200)), 5.8875), plus(uniq(user), 117.75)), 0)",
                None,
                "user_misery_prototype_300",
            ],
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
            "timestamp.to_hour",
            "timestamp.to_day",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["selected_columns"] == [
            "title",
            "issue.id",
            ["coalesce", ["user.email", "user.username", "user.ip"], "user.display"],
            "message",
            ["toStartOfHour", ["timestamp"], "timestamp.to_hour"],
            ["toStartOfDay", ["timestamp"], "timestamp.to_day"],
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
            "timestamp.to_hour",
            "timestamp.to_day",
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
        assert "derp(user) is not a valid function" in str(err)

    def test_aggregate_function_case_sensitive(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["MAX(user)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "MAX(user) is not a valid function" in str(err)

    def test_aggregate_function_invalid_column(self):
        with pytest.raises(InvalidSearchQuery) as exc_info:
            fields = ["min(message)"]
            resolve_field_list(fields, eventstore.Filter())

        exc = exc_info.value
        exc_str = f"{exc}"
        assert "min(message): column argument invalid: message is not a numeric column" == exc_str

    def test_aggregate_function_missing_parameter(self):
        with pytest.raises(InvalidSearchQuery) as exc_info:
            fields = ["count_unique()"]
            resolve_field_list(fields, eventstore.Filter())

        exc = exc_info.value
        exc_str = f"{exc}"
        assert "count_unique(): column argument invalid: a column is required" == exc_str

        with pytest.raises(InvalidSearchQuery):
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
        assert "percentile(0.75): expected 2 argument(s)" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(0.75,)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "percentile(0.75,): expected 2 argument(s)" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(sanchez, 0.75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "percentile(sanchez, 0.75): column argument invalid: sanchez is not a valid column"
            in str(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(id, 0.75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "percentile(id, 0.75): column argument invalid: id is not a numeric column" in str(
            err
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile(transaction.duration, 75)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "percentile(transaction.duration, 75): percentile argument invalid: 75 must be less than 1"
            in str(err)
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
            fields = ["epm(0)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "epm(0): interval argument invalid: 0 must be greater than or equal to 1" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm(-1)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "epm(-1): interval argument invalid: -1 must be greater than or equal to 1" in str(
            err
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm()"]
            resolve_field_list(fields, eventstore.Filter())
        assert "epm(): invalid arguments: function called without default" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["epm()"]
            resolve_field_list(fields, eventstore.Filter(start="abc", end="def"))
        assert "epm(): invalid arguments: function called with invalid default" in str(err)

        fields = ["epm()"]
        result = resolve_field_list(
            fields, eventstore.Filter(start=before_now(hours=2), end=before_now(hours=1))
        )
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["divide(count(), divide(3600, 60))", None, "epm"],
        ]
        assert result["groupby"] == []

    def test_stddev_function(self):
        fields = ["stddev(measurements.fcp)", "stddev(transaction.duration)"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            ["stddevSamp", "measurements.fcp", "stddev_measurements_fcp"],
            ["stddevSamp", "transaction.duration", "stddev_transaction_duration"],
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["stddev(user.id)"]
            resolve_field_list(fields, eventstore.Filter())

        assert "user.id is not a numeric column" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["stddev()"]
            resolve_field_list(fields, eventstore.Filter())

        assert "stddev(): expected 1 argument(s)" in str(err)

    def test_tpm_function_alias(self):
        """ TPM should be functionally identical to EPM except in name """
        fields = ["tpm()"]
        result = resolve_field_list(
            fields, eventstore.Filter(start=before_now(hours=2), end=before_now(hours=1))
        )
        assert result["selected_columns"] == []
        assert result["aggregations"] == [
            ["divide(count(), divide(3600, 60))", None, "tpm"],
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
            in str(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["absolute_delta(transaction.duration,blah)"]
            resolve_field_list(fields, eventstore.Filter())
        assert (
            "absolute_delta(transaction.duration,blah): target argument invalid: blah is not a number"
            in str(err)
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
        assert "eps(0): interval argument invalid: 0 must be greater than or equal to 1" in str(err)

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
        assert "no access to private function" in str(err)

    def test_histogram_function(self):
        fields = ["histogram(measurements_value, 10, 5, 1)"]
        result = resolve_field_list(fields, eventstore.Filter(), functions_acl=["histogram"])
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
                "histogram_measurements_value_10_5_1",
            ],
            "id",
            "project.id",
            [
                "transform",
                [["toString", ["project_id"]], ["array", []], ["array", []], "''"],
                "`project.name`",
            ],
        ]

    def test_histogram_function_no_access(self):
        fields = ["histogram(measurements_value, 10, 5, 1)"]
        with pytest.raises(InvalidSearchQuery) as err:
            resolve_field_list(fields, eventstore.Filter())
        assert "no access to private function" in str(err)

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
            "percentile_range(transaction.duration, 0.5, greater, 2020-05-03T06:48:57) as percentile_range_1"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.50)",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "percentile_range_1",
            ]
        ]
        # Test a non duration field
        fields = [
            "percentile_range(measurements.lcp, 0.5, greater, 2020-05-03T06:48:57) as avg_range_1"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.50)",
                [
                    "measurements.lcp",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "avg_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile_range(transaction.duration, 0.5, greater, tomorrow)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: tomorrow is in the wrong format" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["percentile_range(transaction.duration, 0.5, lessOrEquals, today)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: today is in the wrong format" in str(err)

    def test_average_range(self):
        fields = ["avg_range(transaction.duration, greater, 2020-05-03T06:48:57) as avg_range_1"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "avgIf",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "avg_range_1",
            ]
        ]

        # Test a non duration field
        fields = ["avg_range(measurements.lcp, greater, 2020-05-03T06:48:57) as avg_range_1"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "avgIf",
                [
                    "measurements.lcp",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "avg_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["avg_range(transaction.duration, greater, tomorrow)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: tomorrow is in the wrong format" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["avg_range(transaction.duration, lessOrEquals, today)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: today is in the wrong format" in str(err)

    def test_variance_range(self):
        fields = [
            "variance_range(transaction.duration, greater, 2020-05-03T06:48:57) as variance_range_1"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "varSampIf",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "variance_range_1",
            ]
        ]

        # Test a non duration field
        fields = [
            "variance_range(measurements.lcp, greater, 2020-05-03T06:48:57) as variance_range_1"
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "varSampIf",
                [
                    "measurements.lcp",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "variance_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["variance_range(transaction.duration, greater, tomorrow)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: tomorrow is in the wrong format" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["variance_range(transaction.duration, lessOrEquals, today)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: today is in the wrong format" in str(err)

    def test_count_range(self):
        fields = ["count_range(greater, 2020-05-03T06:48:57) as count_range_1"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]]],
                "count_range_1",
            ]
        ]

        # Test a non duration field
        fields = ["count_range(greater, 2020-05-03T06:48:57) as count_range_1"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]]],
                "count_range_1",
            ]
        ]

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["count_range(greater, tomorrow)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: tomorrow is in the wrong format" in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["count_range(lessOrEquals, today)"]
            resolve_field_list(fields, eventstore.Filter())
        assert "middle argument invalid: today is in the wrong format" in str(err)

    def test_absolute_correlation(self):
        fields = ["absolute_correlation()"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "abs",
                [["corr", [["toUnixTimestamp", ["timestamp"]], "transaction.duration"]]],
                "absolute_correlation",
            ]
        ]

    def test_percentage(self):
        fields = [
            "percentile_range(transaction.duration, 0.95, greater, 2020-05-03T06:48:57) as percentile_range_1",
            "percentile_range(transaction.duration, 0.95, lessOrEquals, 2020-05-03T06:48:57) as percentile_range_2",
            "percentage(percentile_range_2, percentile_range_1) as trend_percentage",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "percentile_range_1",
            ],
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    ["lessOrEquals", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
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
            "percentile_range(transaction.duration, 0.95, greater, 2020-05-03T06:48:57) as percentile_range_1",
            "percentile_range(transaction.duration, 0.95, lessOrEquals, 2020-05-03T06:48:57) as percentile_range_2",
            "minus(percentile_range_2, percentile_range_1) as trend_difference",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    ["greater", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "percentile_range_1",
            ],
            [
                "quantileIf(0.95)",
                [
                    "transaction.duration",
                    ["lessOrEquals", [["toDateTime", ["'2020-05-03T06:48:57'"]], "timestamp"]],
                ],
                "percentile_range_2",
            ],
            ["minus", ["percentile_range_2", "percentile_range_1"], "trend_difference"],
        ]

    def test_invalid_alias(self):
        bad_function_aliases = [
            "count() as ",
            "count() as as as as as",
            "count() as count(",
            "count() as 123",
            "count() as 1",
        ]
        for function in bad_function_aliases:
            with pytest.raises(InvalidSearchQuery) as err:
                resolve_field_list([function], eventstore.Filter())
            assert "Invalid characters in field" in str(err)

    def test_valid_alias(self):
        function_aliases = [
            ("count() as thecount", "thecount"),
            ("count() AS thecount", "thecount"),
            ("count() AS 123count", "123count"),
            ("count() AS count123", "count123"),
            ("count() AS c", "c"),
            ("count() AS c1", "c1"),
            ("count() AS 1c", "1c"),
        ]
        for function, alias in function_aliases:
            result = resolve_field_list([function], eventstore.Filter())
            assert result["aggregations"][0][-1] == alias, function

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
                ["quantile(0.5)", snuba_column, f"p50_{column_alias}".strip("_")],
                ["quantile(0.75)", snuba_column, f"p75_{column_alias}".strip("_")],
                ["quantile(0.95)", snuba_column, f"p95_{column_alias}".strip("_")],
                ["quantile(0.99)", snuba_column, f"p99_{column_alias}".strip("_")],
                ["max", snuba_column, f"p100_{column_alias}".strip("_")],
            ]

    def test_compare_numeric_aggregate(self):
        fields = [
            "compare_numeric_aggregate(p50_transaction_duration,greater,50)",
            "compare_numeric_aggregate(p50_transaction_duration,notEquals,50)",
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "greater(p50_transaction_duration,50.0)",
                None,
                "compare_numeric_aggregate_p50_transaction_duration_greater_50",
            ],
            [
                "notEquals(p50_transaction_duration,50.0)",
                None,
                "compare_numeric_aggregate_p50_transaction_duration_notEquals_50",
            ],
        ]

    def test_invalid_compare_numeric_aggregate(self):
        fields = [
            "compare_numeric_aggregate(p50_transaction_duration,>+,50)",
            "compare_numeric_aggregate(p50_transaction_duration,=,50)",
        ]
        for field in fields:
            with pytest.raises(InvalidSearchQuery) as err:
                resolve_field_list([field], eventstore.Filter())
            assert "is not a valid condition" in str(err), field

        fields = [
            "compare_numeric_aggregate(p50_tr(where,=,50)",
            "compare_numeric_aggregate(a.b.c.d,=,50)",
        ]
        for field in fields:
            with pytest.raises(InvalidSearchQuery) as err:
                resolve_field_list([field], eventstore.Filter())
            assert "is not a valid function alias" in str(err), field

    def test_rollup_with_unaggregated_fields(self):
        with pytest.raises(InvalidSearchQuery) as err:
            fields = ["message"]
            resolve_field_list(fields, eventstore.Filter(rollup=15))
        assert "rollup without an aggregate" in str(err)

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
        assert "Cannot order" in str(err)

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
        """ When there's only aggregates don't sort """
        fields = ["count(id)", "count_unique(user)"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-count(id)"))
        assert result["orderby"] is None
        assert result["aggregations"] == [
            ["count", None, "count_id"],
            ["uniq", "user", "count_unique_user"],
        ]
        assert result["groupby"] == []

    def test_orderby_field_aggregate_only(self):
        fields = ["transaction.name", "count(id)", "count_unique(user)"]
        result = resolve_field_list(fields, eventstore.Filter(orderby="-count(id)"))
        assert result["orderby"] == ["-count_id"]
        assert result["aggregations"] == [
            ["count", None, "count_id"],
            ["uniq", "user", "count_unique_user"],
        ]
        assert result["groupby"] == ["transaction.name"]

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
            "stddev(measurements.foo)",
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

        assert functions["stddev_measurements_foo"].instance.name == "stddev"
        assert functions["stddev_measurements_foo"].arguments == {"column": "measurements.foo"}

    def test_to_other_function_basic(self):
        fields = [
            'to_other(release,"r")',
            'to_other(release,"r",a)',
            'to_other(release,"r",a,b)',
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        functions = result["functions"]

        assert functions["to_other_release__r"].instance.name == "to_other"
        assert functions["to_other_release__r"].arguments == {
            "column": "release",
            "value": "'r'",
            "that": "'that'",
            "this": "'this'",
        }

        assert functions["to_other_release__r__a"].instance.name == "to_other"
        assert functions["to_other_release__r__a"].arguments == {
            "column": "release",
            "value": "'r'",
            "that": "'a'",
            "this": "'this'",
        }

        assert functions["to_other_release__r__a_b"].instance.name == "to_other"
        assert functions["to_other_release__r__a_b"].arguments == {
            "column": "release",
            "value": "'r'",
            "that": "'a'",
            "this": "'b'",
        }

    def test_to_other_function_complex(self):
        fields = [
            'to_other(release,"release.version@1.2.3+4")',
            'to_other(release,"release +-  spaces   &    symbols :")',
            'to_other(release,"release\\"using\'quotes")',
        ]
        result = resolve_field_list(fields, eventstore.Filter())
        functions = result["functions"]

        assert functions["to_other_release__release_version_1_2_3_4"].instance.name == "to_other"
        assert functions["to_other_release__release_version_1_2_3_4"].arguments == {
            "column": "release",
            "value": "'release.version@1.2.3+4'",
            "that": "'that'",
            "this": "'this'",
        }

        assert (
            functions["to_other_release__release_____spaces________symbols"].instance.name
            == "to_other"
        )
        assert functions["to_other_release__release_____spaces________symbols"].arguments == {
            "column": "release",
            "value": "'release +-  spaces   &    symbols :'",
            "that": "'that'",
            "this": "'this'",
        }

        assert functions["to_other_release__release__using_quotes"].instance.name == "to_other"
        assert functions["to_other_release__release__using_quotes"].arguments == {
            "column": "release",
            "value": "'release\"using'quotes'",
            "that": "'that'",
            "this": "'this'",
        }

    def test_to_other_validation(self):
        with self.assertRaises(InvalidSearchQuery):
            resolve_field_list(["to_other(release,a)"], eventstore.Filter())

        with self.assertRaises(InvalidSearchQuery):
            resolve_field_list(['to_other(release,"a)'], eventstore.Filter())

        with self.assertRaises(InvalidSearchQuery):
            resolve_field_list(['to_other(release,a")'], eventstore.Filter())

    def test_failure_count_function(self):
        fields = ["failure_count()"]
        result = resolve_field_list(fields, eventstore.Filter())
        assert result["aggregations"] == [
            [
                "countIf",
                [
                    [
                        "not",
                        [
                            [
                                "has",
                                [
                                    [
                                        "array",
                                        [
                                            SPAN_STATUS_NAME_TO_CODE[name]
                                            for name in ["ok", "cancelled", "unknown"]
                                        ],
                                    ],
                                    "transaction_status",
                                ],
                            ],
                        ],
                    ],
                ],
                "failure_count",
            ],
        ]

    def test_redundant_grouping_errors(self):
        fields = [
            ["last_seen()", "timestamp"],
            ["avg(measurements.lcp)", "measurements.lcp"],
            ["stddev(measurements.lcp)", "measurements.lcp"],
            ["min(timestamp)", "timestamp"],
            ["max(timestamp)", "timestamp"],
            ["p95()", "transaction.duration"],
            ["any(measurements.fcp)", "measurements.fcp"],
        ]
        for field in fields:
            with pytest.raises(InvalidSearchQuery) as error:
                resolve_field_list(field, eventstore.Filter())

            assert "you must first remove the function(s)" in str(error)

        with pytest.raises(InvalidSearchQuery) as error:
            resolve_field_list(
                ["avg(transaction.duration)", "p95()", "transaction.duration"], eventstore.Filter()
            )

        assert "avg(transaction.duration)" in str(error)
        assert "p95" in str(error)
        assert " more." not in str(error)

        with pytest.raises(InvalidSearchQuery) as error:
            resolve_field_list(
                [
                    "avg(transaction.duration)",
                    "p50()",
                    "p75()",
                    "p95()",
                    "p99()",
                    "transaction.duration",
                ],
                eventstore.Filter(),
            )

        assert "and 3 more" in str(error)


def with_type(type, argument):
    argument.get_type = lambda *_: type
    return argument


class FunctionTest(unittest.TestCase):
    def setUp(self):
        self.fn_wo_optionals = Function(
            "wo_optionals",
            required_args=[FunctionArg("arg1"), FunctionArg("arg2")],
            transform="",
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
            InvalidSearchQuery, r"fn_wo_optionals\(\): expected 2 argument\(s\)"
        ):
            self.fn_wo_optionals.validate_argument_count("fn_wo_optionals()", ["arg1"])

    def test_no_optional_too_may_arguments(self):
        with self.assertRaisesRegexp(
            InvalidSearchQuery, r"fn_wo_optionals\(\): expected 2 argument\(s\)"
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
            InvalidSearchQuery, r"fn_w_optionals\(\): expected at least 1 argument\(s\)"
        ):
            self.fn_w_optionals.validate_argument_count("fn_w_optionals()", [])

    def test_optional_too_many_arguments(self):
        with self.assertRaisesRegexp(
            InvalidSearchQuery, r"fn_w_optionals\(\): expected at most 2 argument\(s\)"
        ):
            self.fn_w_optionals.validate_argument_count(
                "fn_w_optionals()", ["arg1", "arg2", "arg3"]
            )

    def test_optional_args_have_default(self):
        with self.assertRaisesRegexp(
            AssertionError, "test: optional argument at index 0 does not have default"
        ):
            Function("test", optional_args=[FunctionArg("arg1")])

    def test_defining_duplicate_args(self):
        with self.assertRaisesRegexp(
            AssertionError, "test: argument arg1 specified more than once"
        ):
            Function(
                "test",
                required_args=[FunctionArg("arg1")],
                optional_args=[with_default("default", FunctionArg("arg1"))],
                transform="",
            )

        with self.assertRaisesRegexp(
            AssertionError, "test: argument arg1 specified more than once"
        ):
            Function(
                "test",
                required_args=[FunctionArg("arg1")],
                calculated_args=[{"name": "arg1", "fn": lambda x: x}],
                transform="",
            )

        with self.assertRaisesRegexp(
            AssertionError, "test: argument arg1 specified more than once"
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
