from __future__ import absolute_import

import six

from sentry.api.event_search import (
    InvalidSearchQuery,
    AggregateFilter,
    AggregateKey,
    SearchFilter,
    SearchKey,
    SearchValue,
)
from sentry.api.issue_search import (
    convert_actor_value,
    convert_query_values,
    convert_release_value,
    convert_user_value,
    parse_search_query,
    value_converters,
)
from sentry.constants import STATUS_CHOICES
from sentry.testutils import TestCase


class ParseSearchQueryTest(TestCase):
    def test_key_mappings(self):
        # Test a couple of keys to ensure things are working as expected
        assert parse_search_query("bookmarks:123") == [
            SearchFilter(
                key=SearchKey(name="bookmarked_by"), operator="=", value=SearchValue("123")
            )
        ]
        assert parse_search_query("first-release:123") == [
            SearchFilter(
                key=SearchKey(name="first_release"), operator="=", value=SearchValue("123")
            )
        ]
        assert parse_search_query("first-release:123 non_mapped:456") == [
            SearchFilter(
                key=SearchKey(name="first_release"), operator="=", value=SearchValue("123")
            ),
            SearchFilter(key=SearchKey(name="non_mapped"), operator="=", value=SearchValue("456")),
        ]

    def test_is_query_unassigned(self):
        assert parse_search_query("is:unassigned") == [
            SearchFilter(key=SearchKey(name="unassigned"), operator="=", value=SearchValue(True))
        ]
        assert parse_search_query("is:assigned") == [
            SearchFilter(key=SearchKey(name="unassigned"), operator="=", value=SearchValue(False))
        ]

        assert parse_search_query("!is:unassigned") == [
            SearchFilter(key=SearchKey(name="unassigned"), operator="!=", value=SearchValue(True))
        ]
        assert parse_search_query("!is:assigned") == [
            SearchFilter(key=SearchKey(name="unassigned"), operator="!=", value=SearchValue(False))
        ]

    def test_is_query_status(self):
        for status_string, status_val in STATUS_CHOICES.items():
            assert parse_search_query("is:%s" % status_string) == [
                SearchFilter(
                    key=SearchKey(name="status"), operator="=", value=SearchValue(status_val)
                )
            ]
            assert parse_search_query("!is:%s" % status_string) == [
                SearchFilter(
                    key=SearchKey(name="status"), operator="!=", value=SearchValue(status_val)
                )
            ]

    def test_is_query_invalid(self):
        with self.assertRaises(InvalidSearchQuery) as cm:
            parse_search_query("is:wrong")

        assert six.text_type(cm.exception).startswith(
            'Invalid value for "is" search, valid values are'
        )

    def test_numeric_filter(self):
        # test numeric format
        assert parse_search_query("times_seen:500") == [
            SearchFilter(
                key=SearchKey(name="times_seen"), operator="=", value=SearchValue(raw_value=500)
            )
        ]
        assert parse_search_query("times_seen:>500") == [
            SearchFilter(
                key=SearchKey(name="times_seen"), operator=">", value=SearchValue(raw_value=500)
            )
        ]
        assert parse_search_query("times_seen:<500") == [
            SearchFilter(
                key=SearchKey(name="times_seen"), operator="<", value=SearchValue(raw_value=500)
            )
        ]
        invalid_queries = [
            "times_seen:<hello",
            "times_seen:<512.1.0",
            "times_seen:2018-01-01",
            "times_seen:+7d",
            "times_seen:>2018-01-01",
            'times_seen:"<10"',
        ]
        for invalid_query in invalid_queries:
            with self.assertRaises(
                InvalidSearchQuery, expected_regex="Invalid format for numeric search"
            ):
                parse_search_query(invalid_query)

    def test_boolean_operators_not_allowed(self):
        invalid_queries = [
            "user.email:foo@example.com OR user.email:bar@example.com",
            "user.email:foo@example.com AND user.email:bar@example.com",
            "user.email:foo@example.com OR user.email:bar@example.com OR user.email:foobar@example.com",
            "user.email:foo@example.com AND user.email:bar@example.com AND user.email:foobar@example.com",
        ]
        for invalid_query in invalid_queries:
            with self.assertRaises(
                InvalidSearchQuery,
                expected_regex='Boolean statements containing "OR" or "AND" are not supported in this search',
            ):
                parse_search_query(invalid_query)

    def test_parens_in_query(self):
        assert parse_search_query(
            "TypeError Anonymous function(app/javascript/utils/transform-object-keys)"
        ) == [
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="TypeError Anonymous function"),
            ),
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(raw_value="(app/javascript/utils/transform-object-keys)"),
            ),
        ]


class ConvertQueryValuesTest(TestCase):
    def test_valid_converter(self):
        filters = [SearchFilter(SearchKey("assigned_to"), "=", SearchValue("me"))]
        expected = value_converters["assigned_to"](
            filters[0].value.raw_value, [self.project], self.user, None
        )
        filters = convert_query_values(filters, [self.project], self.user, None)
        assert filters[0].value.raw_value == expected

    def test_no_converter(self):
        search_val = SearchValue("me")
        filters = [SearchFilter(SearchKey("something"), "=", search_val)]
        filters = convert_query_values(filters, [self.project], self.user, None)
        assert filters[0].value.raw_value == search_val.raw_value


class ConvertStatusValueTest(TestCase):
    def test_valid(self):
        for status_string, status_val in STATUS_CHOICES.items():
            filters = [SearchFilter(SearchKey("status"), "=", SearchValue(status_string))]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == status_val

            filters = [SearchFilter(SearchKey("status"), "=", SearchValue(status_val))]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == status_val

    def test_invalid(self):
        filters = [SearchFilter(SearchKey("status"), "=", SearchValue("wrong"))]
        with self.assertRaises(InvalidSearchQuery, expected_regex="invalid status value"):
            convert_query_values(filters, [self.project], self.user, None)

        filters = [AggregateFilter(AggregateKey("count_unique(user)"), ">", SearchValue("1"))]
        with self.assertRaises(
            InvalidSearchQuery,
            expected_regex="Aggregate filters (count_unique(user)) are not supported in issue searches.",
        ):
            convert_query_values(filters, [self.project], self.user, None)


class ConvertActorValueTest(TestCase):
    def test_user(self):
        assert convert_actor_value("me", [self.project], self.user, None) == convert_user_value(
            "me", [self.project], self.user, None
        )

    def test_team(self):
        assert (
            convert_actor_value("#%s" % self.team.slug, [self.project], self.user, None)
            == self.team
        )

    def test_invalid_team(self):
        assert convert_actor_value("#never_upgrade", [self.project], self.user, None).id == 0


class ConvertUserValueTest(TestCase):
    def test_me(self):
        assert convert_user_value("me", [self.project], self.user, None) == self.user

    def test_specified_user(self):
        user = self.create_user()
        assert convert_user_value(user.username, [self.project], self.user, None) == user

    def test_invalid_user(self):
        assert convert_user_value("fake-user", [], None, None).id == 0


class ConvertReleaseValueTest(TestCase):
    def test(self):
        assert convert_release_value("123", [self.project], self.user, None) == "123"

    def test_latest(self):
        release = self.create_release(self.project)
        assert convert_release_value("latest", [self.project], self.user, None) == release.version
