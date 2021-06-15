import datetime
import unittest
from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.api.event_search import (
    AggregateKey,
    SearchConfig,
    SearchFilter,
    SearchKey,
    SearchValue,
    parse_search_query,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.constants import SEMVER_ALIAS


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

    def test_simple_in(self):
        assert parse_search_query("user.email:[test@test.com] test:[hello]") == [
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="IN",
                value=SearchValue(raw_value=["test@test.com"]),
            ),
            SearchFilter(
                key=SearchKey(name="test"),
                operator="IN",
                value=SearchValue(raw_value=["hello"]),
            ),
        ]
        assert parse_search_query(
            "user.email:[test@test.com,test2@test.com,test3@test.com] test:[hello]"
        ) == [
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="IN",
                value=SearchValue(raw_value=["test@test.com", "test2@test.com", "test3@test.com"]),
            ),
            SearchFilter(
                key=SearchKey(name="test"),
                operator="IN",
                value=SearchValue(raw_value=["hello"]),
            ),
        ]
        assert parse_search_query(
            "!user.email:[test@test.com, test@test2.com,     test@test3.com] test:[hello]"
        ) == [
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="NOT IN",
                value=SearchValue(raw_value=["test@test.com", "test@test2.com", "test@test3.com"]),
            ),
            SearchFilter(
                key=SearchKey(name="test"),
                operator="IN",
                value=SearchValue(raw_value=["hello"]),
            ),
        ]
        # Make sure brackets still work in normal values
        assert parse_search_query("test:h[e]llo]") == [
            SearchFilter(
                key=SearchKey(name="test"),
                operator="=",
                value=SearchValue(raw_value="h[e]llo]"),
            ),
        ]
        assert parse_search_query("test:[h[e]llo") == [
            SearchFilter(
                key=SearchKey(name="test"),
                operator="=",
                value=SearchValue(raw_value="[h[e]llo"),
            ),
        ]
        assert parse_search_query('test:"[h]"') == [
            SearchFilter(
                key=SearchKey(name="test"),
                operator="=",
                value=SearchValue(raw_value="[h]"),
            ),
        ]
        assert parse_search_query("test:[h]*") == [
            SearchFilter(
                key=SearchKey(name="test"),
                operator="=",
                value=SearchValue(raw_value="[h]*"),
            ),
        ]
        assert parse_search_query("test:[h e]") == [
            SearchFilter(
                key=SearchKey(name="test"),
                operator="=",
                value=SearchValue(raw_value="[h"),
            ),
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="e]"),
            ),
        ]
        assert parse_search_query("test:[]") == [
            SearchFilter(
                key=SearchKey(name="test"),
                operator="=",
                value=SearchValue(raw_value="[]"),
            ),
        ]
        assert parse_search_query('user.email:[test@test.com, "hi", 1]') == [
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="IN",
                value=SearchValue(raw_value=["test@test.com", "hi", "1"]),
            )
        ]
        assert parse_search_query('user.email:[test@test.com, "hi", 1.0]') == [
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="IN",
                value=SearchValue(raw_value=["test@test.com", "hi", "1.0"]),
            )
        ]
        assert parse_search_query("test:[[h]]") == [
            SearchFilter(
                key=SearchKey(name="test"),
                operator="IN",
                value=SearchValue(raw_value=["[h]"]),
            ),
        ]
        assert parse_search_query("test:[a, [h]]") == [
            SearchFilter(
                key=SearchKey(name="test"),
                operator="IN",
                value=SearchValue(raw_value=["a", "[h]"]),
            ),
        ]

        assert parse_search_query("user.email:[test@test.com]user.email:hello@hello.com") == [
            SearchFilter(
                key=SearchKey(name="user.email"),
                operator="=",
                value=SearchValue(raw_value="[test@test.com]user.email:hello@hello.com"),
            ),
        ]

    def test_free_text_search_anywhere(self):
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

    def test_quoted_free_text_search_anywhere(self):
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
        assert parse_search_query("timestamp:>2015-05-18") == [
            SearchFilter(
                key=SearchKey(name="timestamp"),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 18, 0, 0, tzinfo=timezone.utc)
                ),
            )
        ]
        # test date time format
        assert parse_search_query("timestamp:>2015-05-18T10:15:01") == [
            SearchFilter(
                key=SearchKey(name="timestamp"),
                operator=">",
                value=SearchValue(
                    raw_value=datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
                ),
            )
        ]

        # test date time format w microseconds
        assert parse_search_query("timestamp:>2015-05-18T10:15:01.103") == [
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
        assert parse_search_query('release:["a release"]') == [
            SearchFilter(
                key=SearchKey(name="release"),
                operator="IN",
                value=SearchValue(raw_value=["a release"]),
            )
        ]
        assert parse_search_query('release:["a release","b release"]') == [
            SearchFilter(
                key=SearchKey(name="release"),
                operator="IN",
                value=SearchValue(raw_value=["a release", "b release"]),
            )
        ]
        assert parse_search_query('release:["a release",    "b release", "c release"]') == [
            SearchFilter(
                key=SearchKey(name="release"),
                operator="IN",
                value=SearchValue(raw_value=["a release", "b release", "c release"]),
            )
        ]
        assert parse_search_query('!release:["a release","b release"]') == [
            SearchFilter(
                key=SearchKey(name="release"),
                operator="NOT IN",
                value=SearchValue(raw_value=["a release", "b release"]),
            )
        ]
        assert parse_search_query('release:["a release"] hello:["123"]') == [
            SearchFilter(
                key=SearchKey(name="release"),
                operator="IN",
                value=SearchValue(raw_value=["a release"]),
            ),
            SearchFilter(
                key=SearchKey(name="hello"),
                operator="IN",
                value=SearchValue(raw_value=["123"]),
            ),
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

    def test_explicit_tags_in_filter(self):
        assert parse_search_query("tags[fruit]:[apple, pear]") == [
            SearchFilter(
                key=SearchKey(name="tags[fruit]"),
                operator="IN",
                value=SearchValue(raw_value=["apple", "pear"]),
            ),
        ]
        assert parse_search_query('tags[fruit]:["apple wow", "pear"]') == [
            SearchFilter(
                key=SearchKey(name="tags[fruit]"),
                operator="IN",
                value=SearchValue(raw_value=["apple wow", "pear"]),
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
            InvalidSearchQuery, ".*queries are not supported in this search.*"
        ):
            parse_search_query("is:unassigned")

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

        assert parse_search_query("project_id:1") == [
            SearchFilter(
                key=SearchKey(name="project_id"),
                operator="=",
                value=SearchValue(raw_value=1),
            )
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
        assert parse_search_query("project_id:-500") == [
            SearchFilter(
                key=SearchKey(name="project_id"),
                operator="=",
                value=SearchValue(raw_value=-500),
            )
        ]

    def test_numeric_in_filter(self):
        assert parse_search_query("project_id:[500,501,502]") == [
            SearchFilter(
                key=SearchKey(name="project_id"),
                operator="IN",
                value=SearchValue(raw_value=[500, 501, 502]),
            )
        ]
        assert parse_search_query("project_id:[500, 501,     502]") == [
            SearchFilter(
                key=SearchKey(name="project_id"),
                operator="IN",
                value=SearchValue(raw_value=[500, 501, 502]),
            )
        ]
        assert parse_search_query("project_id:[500, 501 ,502]") == [
            SearchFilter(
                key=SearchKey(name="project_id"),
                operator="IN",
                value=SearchValue(raw_value=[500, 501, 502]),
            ),
        ]
        assert parse_search_query("project_id:[500,501,502] issue.id:[100]") == [
            SearchFilter(
                key=SearchKey(name="project_id"),
                operator="IN",
                value=SearchValue(raw_value=[500, 501, 502]),
            ),
            SearchFilter(
                key=SearchKey(name="issue.id"),
                operator="IN",
                value=SearchValue(raw_value=[100]),
            ),
        ]
        # Numeric format should still return a string if field isn't
        # allowed
        assert parse_search_query("project_id:[500,501,502] random_field:[500,501,502]") == [
            SearchFilter(
                key=SearchKey(name="project_id"),
                operator="IN",
                value=SearchValue(raw_value=[500, 501, 502]),
            ),
            SearchFilter(
                key=SearchKey(name="random_field"),
                operator="IN",
                value=SearchValue(raw_value=["500", "501", "502"]),
            ),
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

    def test_semver(self):
        assert parse_search_query(f"{SEMVER_ALIAS}:>1.2.3") == [
            SearchFilter(
                key=SearchKey(name=SEMVER_ALIAS), operator=">", value=SearchValue(raw_value="1.2.3")
            )
        ]
        assert parse_search_query(f"{SEMVER_ALIAS}:>1.2.3-hi") == [
            SearchFilter(
                key=SearchKey(name=SEMVER_ALIAS),
                operator=">",
                value=SearchValue(raw_value="1.2.3-hi"),
            )
        ]
        assert parse_search_query(f"{SEMVER_ALIAS}:>=1.2.3-hi") == [
            SearchFilter(
                key=SearchKey(name=SEMVER_ALIAS),
                operator=">=",
                value=SearchValue(raw_value="1.2.3-hi"),
            )
        ]
        assert parse_search_query(f"{SEMVER_ALIAS}:1.2.3-hi") == [
            SearchFilter(
                key=SearchKey(name=SEMVER_ALIAS),
                operator="=",
                value=SearchValue(raw_value="1.2.3-hi"),
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

    def test_conditional_apdex_filter(self):
        assert parse_search_query("apdex(400):>0.5") == [
            SearchFilter(
                key=AggregateKey(name="apdex(400)"),
                operator=">",
                value=SearchValue(raw_value=0.5),
            )
        ]

        assert parse_search_query("apdex():>0.5") == [
            SearchFilter(
                key=AggregateKey(name="apdex()"),
                operator=">",
                value=SearchValue(raw_value=0.5),
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
        assert parse_search_query("avg(transaction.duration):>..500s") == [
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="avg(transaction.duration):>..500s"),
            )
        ]

    def test_invalid_aggregate_percentage_filter(self):
        assert parse_search_query(
            "percentage(transaction.duration, transaction.duration):>..500%"
        ) == [
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(
                    raw_value="percentage(transaction.duration, transaction.duration):>..500%"
                ),
            )
        ]

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

    def test_numeric_aggregate_op_breakdowns_filter(self):
        assert parse_search_query("min(spans.browser):3.1415") == [
            SearchFilter(
                key=SearchKey(name="min(spans.browser)"),
                operator="=",
                value=SearchValue(raw_value=3.1415),
            )
        ]

        assert parse_search_query("min(spans.browser):>3.1415") == [
            SearchFilter(
                key=SearchKey(name="min(spans.browser)"),
                operator=">",
                value=SearchValue(raw_value=3.1415),
            )
        ]

        assert parse_search_query("min(spans.browser):<3.1415") == [
            SearchFilter(
                key=SearchKey(name="min(spans.browser)"),
                operator="<",
                value=SearchValue(raw_value=3.1415),
            )
        ]

        assert parse_search_query("min(spans.browser):<3k") == [
            SearchFilter(
                key=SearchKey(name="min(spans.browser)"),
                operator="<",
                value=SearchValue(raw_value=3000.0),
            )
        ]

        assert parse_search_query("min(spans.browser):2m") == [
            SearchFilter(
                key=SearchKey(name="min(spans.browser)"),
                operator="=",
                value=SearchValue(raw_value=120000.0),
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

    def test_duration_op_breakdowns_filter(self):
        assert parse_search_query("spans.browser:1.5s") == [
            SearchFilter(
                key=SearchKey(name="spans.browser"),
                operator="=",
                value=SearchValue(raw_value=1500),
            )
        ]

        assert parse_search_query("spans.browser:>1.5s") == [
            SearchFilter(
                key=SearchKey(name="spans.browser"),
                operator=">",
                value=SearchValue(raw_value=1500),
            )
        ]

        assert parse_search_query("spans.browser:<1.5s") == [
            SearchFilter(
                key=SearchKey(name="spans.browser"),
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

    def test_duration_aggregate_op_breakdowns_filter(self):
        assert parse_search_query("percentile(spans.browser, 0.5):3.3s") == [
            SearchFilter(
                key=SearchKey(name="percentile(spans.browser, 0.5)"),
                operator="=",
                value=SearchValue(raw_value=3300),
            )
        ]

        assert parse_search_query("percentile(spans.browser, 0.5):>3.3s") == [
            SearchFilter(
                key=SearchKey(name="percentile(spans.browser, 0.5)"),
                operator=">",
                value=SearchValue(raw_value=3300),
            )
        ]

        assert parse_search_query("percentile(spans.browser, 0.5):<3.3s") == [
            SearchFilter(
                key=SearchKey(name="percentile(spans.browser, 0.5)"),
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
