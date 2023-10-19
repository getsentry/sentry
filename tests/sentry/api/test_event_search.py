import datetime
import os
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.test import SimpleTestCase
from django.utils import timezone

from sentry.api.event_search import (
    AggregateFilter,
    AggregateKey,
    SearchConfig,
    SearchFilter,
    SearchKey,
    SearchValue,
    parse_search_query,
)
from sentry.constants import MODULE_ROOT
from sentry.exceptions import InvalidSearchQuery
from sentry.search.utils import parse_datetime_string, parse_duration, parse_numeric_value
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json

fixture_path = "fixtures/search-syntax"
abs_fixtures_path = os.path.join(MODULE_ROOT, os.pardir, os.pardir, fixture_path)


def register_fixture_tests(cls, skipped):
    """
    Registers test fixtures onto a class with a run_test_case method
    """

    def assign_test_case(name, tests):
        if name in skipped:
            return

        def runner(self):
            for case in tests:
                self.run_test_case(name, case)

        setattr(cls, f"test_{name}", runner)

    for file in (f for f in os.listdir(abs_fixtures_path)):
        name = file[: len(".json") * -1]

        with open(os.path.join(abs_fixtures_path, file)) as fp:
            tests = json.load(fp)
        assign_test_case(name, tests)


def result_transformer(result):
    """
    This is used to translate the expected token results from the format used
    in the JSON test data (which is more close to the lossless frontend AST) to
    the backend version, which is much more lossy (meaning spaces, and other
    un-important syntax is removed).

    This includes various transformations (which are tested elsewhere) that are
    done in the SearchVisitor.
    """

    def node_visitor(token):
        if token["type"] == "spaces":
            return None

        if token["type"] == "filter":
            # Filters with an invalid reason raises to signal to the test
            # runner that we should expect this exception
            if token.get("invalid"):
                raise InvalidSearchQuery(token["invalid"]["reason"])

            # Transform the operator to match for list values
            if token["value"]["type"] in ["valueTextList", "valueNumberList"]:
                operator = "NOT IN" if token["negated"] else "IN"
            else:
                # Negate the operator if the filter is negated to match
                operator = token["operator"] or "="
                operator = f"!{operator}" if token["negated"] else operator

            key = node_visitor(token["key"])
            value = node_visitor(token["value"])

            if token["filter"] == "boolean" and token["negated"]:
                operator = "="
                value = SearchValue(raw_value=1 if value.raw_value == 0 else 0)

            return SearchFilter(key, operator, value)

        if token["type"] == "keySimple":
            return SearchKey(name=token["value"])

        if token["type"] == "keyExplicitTag":
            return SearchKey(name=f"tags[{token['key']['value']}]")

        if token["type"] == "keyAggregate":
            name = node_visitor(token["name"]).name
            # Consistent join aggregate function parameters
            args = ", ".join(arg["value"]["value"] for arg in token["args"]["args"])
            return AggregateKey(name=f"{name}({args})")

        if token["type"] == "valueText":
            # Noramlize values by removing the escaped quotes
            value = token["value"].replace('\\"', '"')
            return SearchValue(raw_value=value)

        if token["type"] == "valueNumber":
            return SearchValue(raw_value=parse_numeric_value(token["value"], token["unit"]))

        if token["type"] == "valueTextList":
            return SearchValue(raw_value=[item["value"]["value"] for item in token["items"]])

        if token["type"] == "valueNumberList":
            return SearchValue(raw_value=[item["value"]["rawValue"] for item in token["items"]])

        if token["type"] == "valueIso8601Date":
            return SearchValue(raw_value=parse_datetime_string(token["value"]))

        if token["type"] == "valueDuration":
            return SearchValue(raw_value=parse_duration(token["value"], token["unit"]))

        if token["type"] == "valueRelativeDate":
            return SearchValue(raw_value=parse_duration(token["value"], token["unit"]))

        if token["type"] == "valueBoolean":
            return SearchValue(raw_value=int(token["value"]))

        if token["type"] == "freeText":
            if token["quoted"]:
                # Normalize quotes
                value = token["value"].replace('\\"', '"')
            else:
                # Normalize spacing
                value = token["value"].strip(" ")

            if value == "":
                return None

            return SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value=value),
            )

    return [token for token in map(node_visitor, result) if token is not None]


class ParseSearchQueryTest(SimpleTestCase):
    """
    All test cases in this class are dynamically defined via the test fixtures
    which are shared with the frontend.

    See the `assign_test_case` function.
    """

    def run_test_case(self, name, case):
        expected = None
        expect_error = None

        query = case["query"]

        # We include the path to the test data in the case of failure
        path = os.path.join(fixture_path, f"{name}.json")
        failure_help = f'Mismatch for query "{query}"\nExpected test data located in {path}'

        # Generically bad search query that is marked to raise an error
        if case.get("raisesError"):
            expect_error = True

        try:
            expected = result_transformer(case["result"])
        except InvalidSearchQuery:
            # If our expected result will raise an InvalidSearchQuery from one
            # of the filters we handle that here
            expect_error = True

        if expect_error:
            with pytest.raises(InvalidSearchQuery):
                parse_search_query(query)
            return

        assert parse_search_query(query) == expected, failure_help


# Shared test cases which should not be run. Usually because we have a test
# case in ParseSearchQueryBackendTest that covers something that differs
# between the backend and frontend parser.
shared_tests_skipped = [
    "rel_time_filter",
    "aggregate_rel_time_filter",
    "specific_time_filter",
    "timestamp_rollup",
    "has_tag",
    "not_has_tag",
    "supported_tags",
    "invalid_aggregate_column_with_duration_filter",
    "invalid_numeric_aggregate_filter",
    "disallow_wildcard_filter",
]

register_fixture_tests(ParseSearchQueryTest, shared_tests_skipped)


class ParseSearchQueryBackendTest(SimpleTestCase):
    """
    These test cases cannot be represented by the test data used to drive the
    ParseSearchQueryTest.
    """

    def test_key_remapping(self):
        config = SearchConfig(key_mappings={"target_value": ["someValue", "legacy-value"]})

        assert parse_search_query(
            "someValue:123 legacy-value:456 normal_value:hello", config=config
        ) == [
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

    @patch("sentry.search.events.builder.QueryBuilder.get_field_type")
    def test_size_filter(self, mock_type):
        config = SearchConfig()
        mock_type.return_value = "gigabyte"

        assert parse_search_query("measurements.foo:>5gb measurements.bar:<3pb", config=config) == [
            SearchFilter(
                key=SearchKey(name="measurements.foo"),
                operator=">",
                value=SearchValue(5 * 1000**3),
            ),
            SearchFilter(
                key=SearchKey(name="measurements.bar"),
                operator="<",
                value=SearchValue(3 * 1000**5),
            ),
        ]

    @patch("sentry.search.events.builder.QueryBuilder.get_field_type")
    def test_ibyte_size_filter(self, mock_type):
        config = SearchConfig()
        mock_type.return_value = "gibibyte"

        assert parse_search_query(
            "measurements.foo:>5gib measurements.bar:<3pib", config=config
        ) == [
            SearchFilter(
                key=SearchKey(name="measurements.foo"),
                operator=">",
                value=SearchValue(5 * 1024**3),
            ),
            SearchFilter(
                key=SearchKey(name="measurements.bar"),
                operator="<",
                value=SearchValue(3 * 1024**5),
            ),
        ]

    @patch("sentry.search.events.builder.QueryBuilder.get_field_type")
    def test_aggregate_size_filter(self, mock_type):
        config = SearchConfig()
        mock_type.return_value = "gigabyte"

        assert parse_search_query(
            "p50(measurements.foo):>5gb p100(measurements.bar):<3pb", config=config
        ) == [
            SearchFilter(
                key=SearchKey(name="p50(measurements.foo)"),
                operator=">",
                value=SearchValue(5 * 1000**3),
            ),
            SearchFilter(
                key=SearchKey(name="p100(measurements.bar)"),
                operator="<",
                value=SearchValue(3 * 1000**5),
            ),
        ]

    @patch("sentry.search.events.builder.QueryBuilder.get_field_type")
    def test_aggregate_ibyte_size_filter(self, mock_type):
        config = SearchConfig()
        mock_type.return_value = "gibibyte"

        assert parse_search_query(
            "p50(measurements.foo):>5gib p100(measurements.bar):<3pib", config=config
        ) == [
            SearchFilter(
                key=SearchKey(name="p50(measurements.foo)"),
                operator=">",
                value=SearchValue(5 * 1024**3),
            ),
            SearchFilter(
                key=SearchKey(name="p100(measurements.bar)"),
                operator="<",
                value=SearchValue(3 * 1024**5),
            ),
        ]

    @patch("sentry.search.events.builder.QueryBuilder.get_field_type")
    def test_duration_measurement_filter(self, mock_type):
        config = SearchConfig()
        mock_type.return_value = "second"

        assert parse_search_query("measurements.foo:>5s measurements.bar:<3m", config=config) == [
            SearchFilter(
                key=SearchKey(name="measurements.foo"),
                operator=">",
                value=SearchValue(5 * 1000),
            ),
            SearchFilter(
                key=SearchKey(name="measurements.bar"),
                operator="<",
                value=SearchValue(3 * 1000 * 60),
            ),
        ]

    @patch("sentry.search.events.builder.QueryBuilder.get_field_type")
    def test_aggregate_duration_measurement_filter(self, mock_type):
        config = SearchConfig()
        mock_type.return_value = "minute"

        assert parse_search_query(
            "p50(measurements.foo):>5s p100(measurements.bar):<3m", config=config
        ) == [
            SearchFilter(
                key=SearchKey(name="p50(measurements.foo)"),
                operator=">",
                value=SearchValue(5 * 1000),
            ),
            SearchFilter(
                key=SearchKey(name="p100(measurements.bar)"),
                operator="<",
                value=SearchValue(3 * 1000 * 60),
            ),
        ]

    @patch("sentry.search.events.builder.QueryBuilder.get_field_type")
    def test_numeric_measurement_filter(self, mock_type):
        config = SearchConfig()
        mock_type.return_value = "number"

        assert parse_search_query("measurements.foo:>5k measurements.bar:<3m", config=config) == [
            SearchFilter(
                key=SearchKey(name="measurements.foo"),
                operator=">",
                value=SearchValue(5 * 1000),
            ),
            SearchFilter(
                key=SearchKey(name="measurements.bar"),
                operator="<",
                value=SearchValue(3 * 1_000_000),
            ),
        ]

    @patch("sentry.search.events.builder.QueryBuilder.get_field_type")
    def test_aggregate_numeric_measurement_filter(self, mock_type):
        config = SearchConfig()
        mock_type.return_value = "number"

        assert parse_search_query(
            "p50(measurements.foo):>5k p100(measurements.bar):<3m", config=config
        ) == [
            SearchFilter(
                key=SearchKey(name="p50(measurements.foo)"),
                operator=">",
                value=SearchValue(5 * 1000),
            ),
            SearchFilter(
                key=SearchKey(name="p100(measurements.bar)"),
                operator="<",
                value=SearchValue(3 * 1_000_000),
            ),
        ]

    def test_rel_time_filter(self):
        now = timezone.now()
        with freeze_time(now):
            assert parse_search_query("time:+7d") == [
                SearchFilter(
                    key=SearchKey(name="time"),
                    operator="<=",
                    value=SearchValue(raw_value=now - timedelta(days=7)),
                )
            ]
            assert parse_search_query("time:-2w") == [
                SearchFilter(
                    key=SearchKey(name="time"),
                    operator=">=",
                    value=SearchValue(raw_value=now - timedelta(days=14)),
                )
            ]
            assert parse_search_query("random:-2w") == [
                SearchFilter(key=SearchKey(name="random"), operator="=", value=SearchValue("-2w"))
            ]

    def test_aggregate_rel_time_filter(self):
        now = timezone.now()
        with freeze_time(now):
            assert parse_search_query("last_seen():+7d") == [
                AggregateFilter(
                    key=AggregateKey(name="last_seen()"),
                    operator="<=",
                    value=SearchValue(raw_value=now - timedelta(days=7)),
                )
            ]
            assert parse_search_query("last_seen():-2w") == [
                AggregateFilter(
                    key=AggregateKey(name="last_seen()"),
                    operator=">=",
                    value=SearchValue(raw_value=now - timedelta(days=14)),
                )
            ]
            assert parse_search_query("random:-2w") == [
                SearchFilter(key=SearchKey(name="random"), operator="=", value=SearchValue("-2w"))
            ]

    def test_specific_time_filter(self):
        assert parse_search_query("time:2018-01-01") == [
            SearchFilter(
                key=SearchKey(name="time"),
                operator=">=",
                value=SearchValue(raw_value=datetime.datetime(2018, 1, 1, tzinfo=timezone.utc)),
            ),
            SearchFilter(
                key=SearchKey(name="time"),
                operator="<",
                value=SearchValue(raw_value=datetime.datetime(2018, 1, 2, tzinfo=timezone.utc)),
            ),
        ]

        assert parse_search_query("time:2018-01-01T05:06:07Z") == [
            SearchFilter(
                key=SearchKey(name="time"),
                operator=">=",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 1, 7, tzinfo=timezone.utc)
                ),
            ),
            SearchFilter(
                key=SearchKey(name="time"),
                operator="<",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 12, 7, tzinfo=timezone.utc)
                ),
            ),
        ]

        assert parse_search_query("time:2018-01-01T05:06:07+00:00") == [
            SearchFilter(
                key=SearchKey(name="time"),
                operator=">=",
                value=SearchValue(
                    raw_value=datetime.datetime(2018, 1, 1, 5, 1, 7, tzinfo=timezone.utc)
                ),
            ),
            SearchFilter(
                key=SearchKey(name="time"),
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
        with pytest.raises(InvalidSearchQuery):
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

    def test_allowed_keys(self):
        config = SearchConfig(allowed_keys=["good_key"])

        assert parse_search_query("good_key:123 bad_key:123 text") == [
            SearchFilter(key=SearchKey(name="good_key"), operator="=", value=SearchValue("123")),
            SearchFilter(key=SearchKey(name="bad_key"), operator="=", value=SearchValue("123")),
            SearchFilter(key=SearchKey(name="message"), operator="=", value=SearchValue("text")),
        ]

        with pytest.raises(InvalidSearchQuery, match="Invalid key for this search"):
            assert parse_search_query("good_key:123 bad_key:123 text", config=config)

        assert parse_search_query("good_key:123 text", config=config) == [
            SearchFilter(key=SearchKey(name="good_key"), operator="=", value=SearchValue("123")),
            SearchFilter(key=SearchKey(name="message"), operator="=", value=SearchValue("text")),
        ]

    def test_blocked_keys(self):
        config = SearchConfig(blocked_keys=["bad_key"])

        assert parse_search_query("some_key:123 bad_key:123 text") == [
            SearchFilter(key=SearchKey(name="some_key"), operator="=", value=SearchValue("123")),
            SearchFilter(key=SearchKey(name="bad_key"), operator="=", value=SearchValue("123")),
            SearchFilter(key=SearchKey(name="message"), operator="=", value=SearchValue("text")),
        ]

        with pytest.raises(InvalidSearchQuery, match="Invalid key for this search: bad_key"):
            assert parse_search_query("some_key:123 bad_key:123 text", config=config)

        assert parse_search_query("some_key:123 some_other_key:456 text", config=config) == [
            SearchFilter(key=SearchKey(name="some_key"), operator="=", value=SearchValue("123")),
            SearchFilter(
                key=SearchKey(name="some_other_key"), operator="=", value=SearchValue("456")
            ),
            SearchFilter(key=SearchKey(name="message"), operator="=", value=SearchValue("text")),
        ]

    def test_invalid_aggregate_column_with_duration_filter(self):
        with self.assertRaisesMessage(
            InvalidSearchQuery,
            expected_message="avg: column argument invalid: stack.colno is not a numeric column",
        ):
            parse_search_query("avg(stack.colno):>500s")

    def test_invalid_numeric_aggregate_filter(self):
        with self.assertRaisesMessage(
            InvalidSearchQuery, "is not a valid number suffix, must be k, m or b"
        ):
            parse_search_query("min(measurements.size):3s")

        with self.assertRaisesMessage(
            InvalidSearchQuery, "is not a valid number suffix, must be k, m or b"
        ):
            parse_search_query("count_if(measurements.fcp, greater, 5s):3s")

    def test_is_query_unsupported(self):
        with pytest.raises(
            InvalidSearchQuery, match=".*queries are not supported in this search.*"
        ):
            parse_search_query("is:unassigned")

    def test_escaping_asterisk(self):
        # the asterisk is escaped with a preceding backslash, so it's a literal and not a wildcard
        search_filters = parse_search_query(r"title:a\*b")
        assert search_filters == [
            SearchFilter(key=SearchKey(name="title"), operator="=", value=SearchValue(r"a\*b"))
        ]
        search_filter = search_filters[0]
        # the slash should be removed in the final value
        assert search_filter.value.value == "a*b"

        # the first and last asterisks arent escaped with a preceding backslash, so they're
        # wildcards and not literals
        search_filters = parse_search_query(r"title:*\**")
        assert search_filters == [
            SearchFilter(key=SearchKey(name="title"), operator="=", value=SearchValue(r"*\**"))
        ]
        search_filter = search_filters[0]
        assert search_filter.value.value == r"^.*\*.*$"

    @pytest.mark.xfail(reason="escaping backslashes is not supported yet")
    def test_escaping_backslashes(self):
        search_filters = parse_search_query(r"title:a\\b")
        assert search_filters == [
            SearchFilter(key=SearchKey(name="title"), operator="=", value=SearchValue(r"a\\b"))
        ]
        search_filter = search_filters[0]
        # the extra slash should be removed in the final value
        assert search_filter.value.value == r"a\b"

    @pytest.mark.xfail(reason="escaping backslashes is not supported yet")
    def test_trailing_escaping_backslashes(self):
        search_filters = parse_search_query(r"title:a\\")
        assert search_filters == [
            SearchFilter(key=SearchKey(name="title"), operator="=", value=SearchValue(r"a\\"))
        ]
        search_filter = search_filters[0]
        # the extra slash should be removed in the final value
        assert search_filter.value.value == "a\\"

    def test_escaping_quotes(self):
        search_filters = parse_search_query(r"title:a\"b")
        assert search_filters == [
            SearchFilter(key=SearchKey(name="title"), operator="=", value=SearchValue(r'a"b'))
        ]
        search_filter = search_filters[0]
        # the slash should be removed in the final value
        assert search_filter.value.value == 'a"b'


@pytest.mark.parametrize(
    "raw,result",
    [
        (r"", r""),
        (r"foo", r"foo"),
        (r"foo*bar", r"^foo.*bar$"),
        (r"foo\*bar", r"foo*bar"),
        (r"foo\\*bar", r"^foo\\.*bar$"),
        (r"foo\\\*bar", r"foo\\*bar"),
        (r"foo*", r"^foo.*$"),
        (r"foo\*", r"foo*"),
        (r"foo\\*", r"^foo\\.*$"),
        (r"foo\\\*", r"foo\\*"),
        (r"*bar", r"^.*bar$"),
        (r"\*bar", r"*bar"),
        (r"\\*bar", r"^\\.*bar$"),
        (r"\\\*bar", r"\\*bar"),
        (r"*\**", r"^.*\*.*$"),
        (r"\*a\*b\*c\*", r"*a*b*c*"),
        (r"\*\*\*aaa\*\*\*", r"***aaa***"),
    ],
)
def test_search_value(raw, result):
    search_value = SearchValue(raw)
    assert search_value.value == result


@pytest.mark.parametrize(
    "query",
    [
        "event.type:=transaction",
        "!event.type:[transaction]",
        "event.type:[transaction, event]",
        "event.type:[1, 2]",
        "transaction.duration:>=1.0",
        "transaction.duration:>1.0",
        "transaction.duration:=1.0",
        "transaction.duration:<=1.0",
        "transaction.duration:<1.0",
    ],
)
def test_search_filter_to_query_string(query):
    """
    Does a round trip (from query string to tokens and back to query string)
    """

    filters = parse_search_query(query)
    assert len(filters) == 1
    actual = filters[0].to_query_string()
    assert actual == query


@pytest.mark.parametrize(
    "value,expected_query_string",
    [
        (1, "1"),
        ("abc", "abc"),
        ([1, 2, 3], "[1, 2, 3]"),
        (["a", "b", "c"], "[a, b, c]"),
        (datetime.datetime(2023, 10, 15, 11, 12, 13), "2023-10-15T11:12:13"),
    ],
)
def test_search_value_to_query_string(value, expected_query_string):
    """
    Test turning a QueryValue back to a string usable in a query string
    """

    search_value = SearchValue(value)
    actual = search_value.to_query_string()

    assert actual == expected_query_string
