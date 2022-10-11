import unittest

import pytest

from sentry.api.event_search import (
    AggregateFilter,
    AggregateKey,
    SearchFilter,
    SearchKey,
    SearchValue,
)
from sentry.api.issue_search import (
    convert_actor_or_none_value,
    convert_category_value,
    convert_first_release_value,
    convert_query_values,
    convert_release_value,
    convert_type_value,
    convert_user_value,
    parse_search_query,
    value_converters,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import STATUS_QUERY_CHOICES
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.issues import GROUP_CATEGORY_TO_TYPES, GroupCategory


class ParseSearchQueryTest(unittest.TestCase):
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

    def test_is_query_linked(self):
        assert parse_search_query("is:linked") == [
            SearchFilter(key=SearchKey(name="linked"), operator="=", value=SearchValue(True))
        ]
        assert parse_search_query("is:unlinked") == [
            SearchFilter(key=SearchKey(name="linked"), operator="=", value=SearchValue(False))
        ]

        assert parse_search_query("!is:linked") == [
            SearchFilter(key=SearchKey(name="linked"), operator="!=", value=SearchValue(True))
        ]
        assert parse_search_query("!is:unlinked") == [
            SearchFilter(key=SearchKey(name="linked"), operator="!=", value=SearchValue(False))
        ]

    def test_is_query_status(self):
        for status_string, status_val in STATUS_QUERY_CHOICES.items():
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
        with pytest.raises(InvalidSearchQuery) as excinfo:
            parse_search_query("is:wrong")

        assert str(excinfo.value).startswith('Invalid value for "is" search, valid values are')

    def test_is_query_inbox(self):
        assert parse_search_query("is:for_review") == [
            SearchFilter(key=SearchKey(name="for_review"), operator="=", value=SearchValue(True))
        ]

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
            with pytest.raises(InvalidSearchQuery, match="Invalid number"):
                parse_search_query(invalid_query)

    def test_boolean_operators_not_allowed(self):
        invalid_queries = [
            "user.email:foo@example.com OR user.email:bar@example.com",
            "user.email:foo@example.com AND user.email:bar@example.com",
            "user.email:foo@example.com OR user.email:bar@example.com OR user.email:foobar@example.com",
            "user.email:foo@example.com AND user.email:bar@example.com AND user.email:foobar@example.com",
        ]
        for invalid_query in invalid_queries:
            with pytest.raises(
                InvalidSearchQuery,
                match='Boolean statements containing "OR" or "AND" are not supported in this search',
            ):
                parse_search_query(invalid_query)

    def test_parens_in_query(self):
        assert parse_search_query(
            "TypeError Anonymous function(app/javascript/utils/transform-object-keys)"
        ) == [
            SearchFilter(
                key=SearchKey(name="message"),
                operator="=",
                value=SearchValue(
                    raw_value="TypeError Anonymous function(app/javascript/utils/transform-object-keys)"
                ),
            ),
        ]


class ConvertJavaScriptConsoleTagTest(TestCase):
    def test_valid(self):
        filters = [SearchFilter(SearchKey("empty_stacktrace.js_console"), "=", SearchValue(True))]
        with self.feature("organizations:javascript-console-error-tag"):
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value is True

    def test_invalid(self):
        filters = [SearchFilter(SearchKey("empty_stacktrace.js_console"), "=", SearchValue(True))]
        with self.feature({"organizations:javascript-console-error-tag": False}) and pytest.raises(
            InvalidSearchQuery,
            match="The empty_stacktrace.js_console filter is not supported for this organization",
        ):
            convert_query_values(filters, [self.project], self.user, None)


class ConvertQueryValuesTest(TestCase):
    def test_valid_converter(self):
        filters = [SearchFilter(SearchKey("assigned_to"), "=", SearchValue("me"))]
        expected = value_converters["assigned_to"](
            [filters[0].value.raw_value], [self.project], self.user, None
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
        for status_string, status_val in STATUS_QUERY_CHOICES.items():
            filters = [SearchFilter(SearchKey("status"), "=", SearchValue([status_string]))]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == [status_val]

            filters = [SearchFilter(SearchKey("status"), "=", SearchValue([status_val]))]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == [status_val]

    def test_invalid(self):
        filters = [SearchFilter(SearchKey("status"), "=", SearchValue("wrong"))]
        with pytest.raises(InvalidSearchQuery, match="invalid status value"):
            convert_query_values(filters, [self.project], self.user, None)

        filters = [AggregateFilter(AggregateKey("count_unique(user)"), ">", SearchValue("1"))]
        with pytest.raises(
            InvalidSearchQuery,
            match=r"Aggregate filters \(count_unique\(user\)\) are not supported in issue searches.",
        ):
            convert_query_values(filters, [self.project], self.user, None)


class ConvertActorOrNoneValueTest(TestCase):
    def test_user(self):
        assert convert_actor_or_none_value(
            ["me"], [self.project], self.user, None
        ) == convert_user_value(["me"], [self.project], self.user, None)

    def test_none(self):
        assert convert_actor_or_none_value(["none"], [self.project], self.user, None) == [None]

    def test_team(self):
        assert convert_actor_or_none_value(
            [f"#{self.team.slug}"], [self.project], self.user, None
        ) == [self.team]

    def test_invalid_team(self):
        assert (
            convert_actor_or_none_value(["#never_upgrade"], [self.project], self.user, None)[0].id
            == 0
        )


@control_silo_test
class ConvertUserValueTest(TestCase):
    def test_me(self):
        assert convert_user_value(["me"], [self.project], self.user, None) == [self.user]

    def test_specified_user(self):
        user = self.create_user()
        assert convert_user_value([user.username], [self.project], self.user, None) == [user]

    def test_invalid_user(self):
        assert convert_user_value(["fake-user"], [], None, None)[0].id == 0


class ConvertReleaseValueTest(TestCase):
    def test(self):
        assert convert_release_value(["123"], [self.project], self.user, None) == "123"

    def test_latest(self):
        release = self.create_release(self.project)
        assert convert_release_value(["latest"], [self.project], self.user, None) == release.version
        assert convert_release_value(["14.*"], [self.project], self.user, None) == "14.*"


class ConvertFirstReleaseValueTest(TestCase):
    def test(self):
        assert convert_first_release_value(["123"], [self.project], self.user, None) == ["123"]

    def test_latest(self):
        release = self.create_release(self.project)
        assert convert_first_release_value(["latest"], [self.project], self.user, None) == [
            release.version
        ]
        assert convert_first_release_value(["14.*"], [self.project], self.user, None) == ["14.*"]


class ConvertCategoryValueTest(TestCase):
    def test(self):
        with self.feature("organizations:performance-issues"):
            assert set(convert_category_value(["error"], [self.project], self.user, None)) == {
                gt.value for gt in GROUP_CATEGORY_TO_TYPES[GroupCategory.ERROR]
            }
            assert set(
                convert_category_value(["performance"], [self.project], self.user, None)
            ) == {gt.value for gt in GROUP_CATEGORY_TO_TYPES[GroupCategory.PERFORMANCE]}
            assert set(
                convert_category_value(["error", "performance"], [self.project], self.user, None)
            ) == {
                gt.value
                for gt in GROUP_CATEGORY_TO_TYPES[GroupCategory.ERROR]
                + GROUP_CATEGORY_TO_TYPES[GroupCategory.PERFORMANCE]
            }
            with pytest.raises(InvalidSearchQuery):
                convert_category_value(["hellboy"], [self.project], self.user, None)


class ConvertTypeValueTest(TestCase):
    def test(self):
        with self.feature("organizations:performance-issues"):
            assert convert_type_value(["error"], [self.project], self.user, None) == [1]
            assert convert_type_value(
                ["performance_n_plus_one"], [self.project], self.user, None
            ) == [1000]
            assert convert_type_value(
                ["performance_slow_span"], [self.project], self.user, None
            ) == [1001]
            assert convert_type_value(
                ["error", "performance_n_plus_one"], [self.project], self.user, None
            ) == [1, 1000]
            with pytest.raises(InvalidSearchQuery):
                convert_type_value(["hellboy"], [self.project], self.user, None)
