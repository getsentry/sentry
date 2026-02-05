import unittest

import pytest

from sentry.api.event_search import (
    AggregateFilter,
    AggregateKey,
    SearchFilter,
    SearchKey,
    SearchValue,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.issues.grouptype import GroupCategory
from sentry.issues.grouptype import registry as GROUP_TYPE_REGISTRY
from sentry.issues.issue_search import (
    convert_actor_or_none_value,
    convert_category_value,
    convert_device_class_value,
    convert_first_release_value,
    convert_query_values,
    convert_release_value,
    convert_type_value,
    convert_user_value,
    parse_search_query,
    value_converters,
)
from sentry.models.group import GROUP_SUBSTATUS_TO_STATUS_MAP, STATUS_QUERY_CHOICES, GroupStatus
from sentry.models.release import ReleaseStatus
from sentry.search.utils import get_teams_for_users
from sentry.seer.autofix.constants import FixabilityScoreThresholds
from sentry.testutils.cases import TestCase
from sentry.types.group import SUBSTATUS_UPDATE_CHOICES, GroupSubStatus, PriorityLevel


class ParseSearchQueryTest(unittest.TestCase):
    def test_key_mappings(self) -> None:
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

    def test_is_query_unassigned(self) -> None:
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

    def test_is_query_linked(self) -> None:
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

    def test_is_query_status(self) -> None:
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

    def test_is_query_invalid(self) -> None:
        with pytest.raises(InvalidSearchQuery) as excinfo:
            parse_search_query("is:wrong")

        assert str(excinfo.value).startswith('Invalid value for "is" search, valid values are')

    def test_is_query_inbox(self) -> None:
        assert parse_search_query("is:for_review") == [
            SearchFilter(key=SearchKey(name="for_review"), operator="=", value=SearchValue(True))
        ]

    def test_numeric_filter(self) -> None:
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

    def test_boolean_operators_allowed(self) -> None:
        # Test that boolean operators are now supported
        result = parse_search_query("user.email:foo@example.com OR user.email:bar@example.com")
        assert len(result) == 3  # Two filters + one OR operator
        
        result = parse_search_query("user.email:foo@example.com AND user.email:bar@example.com")
        assert len(result) == 3  # Two filters + one AND operator
    
    def test_first_release_with_or_operator(self) -> None:
        # Test that OR operator works with firstRelease
        result = parse_search_query("firstRelease:1.0.0 OR firstRelease:1.0.1")
        assert len(result) == 3  # Two filters + one OR operator
        
        result = parse_search_query("first-release:1.0.0 OR first-release:1.0.1")
        assert len(result) == 3  # Two filters + one OR operator

    def test_parens_in_query(self) -> None:
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


class ConvertQueryValuesTest(TestCase):
    def test_valid_assign_me_converter(self) -> None:
        raw_value = "me"
        filters = [SearchFilter(SearchKey("assigned_to"), "=", SearchValue(raw_value))]
        expected = value_converters["assigned_to"]([raw_value], [self.project], self.user, None)
        filters = convert_query_values(filters, [self.project], self.user, None)
        assert filters[0].value.raw_value == expected

    def test_valid_assign_me_no_converter(self) -> None:
        search_val = SearchValue("me")
        filters = [SearchFilter(SearchKey("something"), "=", search_val)]
        filters = convert_query_values(filters, [self.project], self.user, None)
        assert filters[0].value.raw_value == search_val.raw_value

    def test_valid_assign_my_teams_converter(self) -> None:
        raw_value = "my_teams"
        filters = [SearchFilter(SearchKey("assigned_to"), "=", SearchValue(raw_value))]
        expected = value_converters["assigned_to"]([raw_value], [self.project], self.user, None)
        filters = convert_query_values(filters, [self.project], self.user, None)
        assert filters[0].value.raw_value == expected

    def test_valid_assign_my_teams_no_converter(self) -> None:
        search_val = SearchValue("my_teams")
        filters = [SearchFilter(SearchKey("something"), "=", search_val)]
        filters = convert_query_values(filters, [self.project], self.user, None)
        assert filters[0].value.raw_value == search_val.raw_value

    def test_valid_converter(self) -> None:
        raw_value = "me"
        filters = [SearchFilter(SearchKey("assigned_to"), "=", SearchValue(raw_value))]
        expected = value_converters["assigned_to"]([raw_value], [self.project], self.user, None)
        filters = convert_query_values(filters, [self.project], self.user, None)
        assert filters[0].value.raw_value == expected

    def test_no_converter(self) -> None:
        search_val = SearchValue("me")
        filters = [SearchFilter(SearchKey("something"), "=", search_val)]
        filters = convert_query_values(filters, [self.project], self.user, None)
        assert filters[0].value.raw_value == search_val.raw_value


class ConvertStatusValueTest(TestCase):
    def test_valid(self) -> None:
        for status_string, status_val in STATUS_QUERY_CHOICES.items():
            filters = [SearchFilter(SearchKey("status"), "=", SearchValue([status_string]))]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == [status_val]

            filters = [SearchFilter(SearchKey("status"), "=", SearchValue([status_val]))]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == [status_val]

    def test_invalid(self) -> None:
        filters = [SearchFilter(SearchKey("status"), "=", SearchValue("wrong"))]
        with pytest.raises(InvalidSearchQuery, match="invalid status value"):
            convert_query_values(filters, [self.project], self.user, None)

        with pytest.raises(
            InvalidSearchQuery,
            match=r"Aggregate filters \(count_unique\(user\)\) are not supported in issue searches.",
        ):
            convert_query_values(
                [AggregateFilter(AggregateKey("count_unique(user)"), ">", SearchValue("1"))],
                [self.project],
                self.user,
                None,
            )


class ConvertSubStatusValueTest(TestCase):
    def test_valid(self) -> None:
        for substatus_string, substatus_val in SUBSTATUS_UPDATE_CHOICES.items():
            filters = [SearchFilter(SearchKey("substatus"), "=", SearchValue([substatus_string]))]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == [substatus_val]
            assert result[1].value.raw_value == [GROUP_SUBSTATUS_TO_STATUS_MAP.get(substatus_val)]

            filters = [SearchFilter(SearchKey("substatus"), "=", SearchValue([substatus_val]))]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == [substatus_val]
            assert result[1].value.raw_value == [GROUP_SUBSTATUS_TO_STATUS_MAP.get(substatus_val)]

    def test_invalid(self) -> None:
        filters = [SearchFilter(SearchKey("substatus"), "=", SearchValue("wrong"))]
        with pytest.raises(InvalidSearchQuery, match="invalid substatus value"):
            convert_query_values(filters, [self.project], self.user, None)

    def test_mixed_substatus(self) -> None:
        filters = [
            SearchFilter(SearchKey("substatus"), "=", SearchValue(["ongoing"])),
            SearchFilter(SearchKey("substatus"), "=", SearchValue(["archived_until_escalating"])),
        ]
        result = convert_query_values(filters, [self.project], self.user, None)
        assert [(sf.key.name, sf.operator, sf.value.raw_value) for sf in result] == [
            ("substatus", "IN", [GroupSubStatus.ONGOING]),
            ("substatus", "IN", [GroupSubStatus.UNTIL_ESCALATING]),
            ("status", "IN", [GroupStatus.UNRESOLVED]),
        ]

    def test_mixed_with_status(self) -> None:
        filters = [
            SearchFilter(SearchKey("substatus"), "=", SearchValue(["ongoing"])),
            SearchFilter(SearchKey("status"), "=", SearchValue(["unresolved"])),
            SearchFilter(SearchKey("substatus"), "=", SearchValue(["archived_until_escalating"])),
        ]
        result = convert_query_values(filters, [self.project], self.user, None)
        assert [(sf.key.name, sf.operator, sf.value.raw_value) for sf in result] == [
            ("substatus", "IN", [GroupSubStatus.ONGOING]),
            ("status", "IN", [GroupStatus.UNRESOLVED]),
            ("substatus", "IN", [GroupSubStatus.UNTIL_ESCALATING]),
        ]

    def test_mixed_incl_excl_substatus(self) -> None:
        filters = [
            SearchFilter(SearchKey("substatus"), "=", SearchValue(["ongoing"])),
            SearchFilter(SearchKey("substatus"), "!=", SearchValue(["archived_until_escalating"])),
        ]
        result = convert_query_values(filters, [self.project], self.user, None)
        assert [(sf.key.name, sf.operator, sf.value.raw_value) for sf in result] == [
            ("substatus", "IN", [GroupSubStatus.ONGOING]),
            ("substatus", "NOT IN", [GroupSubStatus.UNTIL_ESCALATING]),
            ("status", "IN", [GroupStatus.UNRESOLVED]),
        ]

    def test_mixed_incl_excl_substatus_with_status(self) -> None:
        filters = [
            SearchFilter(SearchKey("substatus"), "=", SearchValue(["ongoing"])),
            SearchFilter(SearchKey("substatus"), "!=", SearchValue(["archived_until_escalating"])),
            SearchFilter(SearchKey("status"), "=", SearchValue(["ignored"])),
        ]
        result = convert_query_values(filters, [self.project], self.user, None)
        assert [(sf.key.name, sf.operator, sf.value.raw_value) for sf in result] == [
            ("substatus", "IN", [GroupSubStatus.ONGOING]),
            ("substatus", "NOT IN", [GroupSubStatus.UNTIL_ESCALATING]),
            ("status", "IN", [GroupStatus.IGNORED]),
        ]

    def test_mixed_excl_excl_substatus(self) -> None:
        filters = [
            SearchFilter(SearchKey("substatus"), "!=", SearchValue(["ongoing"])),
            SearchFilter(SearchKey("substatus"), "!=", SearchValue(["archived_until_escalating"])),
        ]
        result = convert_query_values(filters, [self.project], self.user, None)
        assert [(sf.key.name, sf.operator, sf.value.raw_value) for sf in result] == [
            ("substatus", "NOT IN", [GroupSubStatus.ONGOING]),
            ("substatus", "NOT IN", [GroupSubStatus.UNTIL_ESCALATING]),
            ("status", "NOT IN", [GroupStatus.UNRESOLVED]),
        ]


class ConvertPriorityValueTest(TestCase):
    def test_valid(self) -> None:
        for priority in PriorityLevel:
            filters = [
                SearchFilter(SearchKey("issue.priority"), "=", SearchValue([priority.to_str()]))
            ]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == [priority]

    def test_invalid(self) -> None:
        filters = [SearchFilter(SearchKey("issue.priority"), "=", SearchValue("wrong"))]
        with pytest.raises(InvalidSearchQuery):
            convert_query_values(filters, [self.project], self.user, None)


class ConvertSeerActionabilityValueTest(TestCase):
    def test_valid(self) -> None:
        for fixability_score in FixabilityScoreThresholds:
            filters = [
                SearchFilter(
                    SearchKey("issue.seer_actionability"),
                    "=",
                    SearchValue([fixability_score.name.lower()]),
                )
            ]
            result = convert_query_values(filters, [self.project], self.user, None)
            assert result[0].value.raw_value == [fixability_score.value]

    def test_invalid(self) -> None:
        filters = [SearchFilter(SearchKey("issue.seer_actionability"), "=", SearchValue("wrong"))]
        with pytest.raises(InvalidSearchQuery):
            convert_query_values(filters, [self.project], self.user, None)


class ConvertDetectorValueTest(TestCase):
    def test_valid(self) -> None:
        filters = [SearchFilter(SearchKey("detector"), "=", SearchValue("412345"))]
        result = convert_query_values(filters, [self.project], self.user, None)
        assert result[0].value.raw_value == ["412345"]


class ConvertActorOrNoneValueTest(TestCase):
    def test_user(self) -> None:
        assert convert_actor_or_none_value(
            ["me"], [self.project], self.user, None
        ) == convert_user_value(["me"], [self.project], self.user, None)

    def test_my_team(self) -> None:
        assert convert_actor_or_none_value(
            ["my_teams"], [self.project], self.user, None
        ) == get_teams_for_users([self.project], [self.user])

    def test_none(self) -> None:
        assert convert_actor_or_none_value(["none"], [self.project], self.user, None) == [None]

    def test_team(self) -> None:
        assert convert_actor_or_none_value(
            [f"#{self.team.slug}"], [self.project], self.user, None
        ) == [self.team]

    def test_invalid_team(self) -> None:
        ret = convert_actor_or_none_value(["#never_upgrade"], [self.project], self.user, None)[0]
        assert ret is not None
        assert ret.id == 0


class ConvertUserValueTest(TestCase):
    def test_me(self) -> None:
        result = convert_user_value(["me"], [self.project], self.user, None)
        assert result[0].id == self.user.id
        assert result[0].username == self.user.username

    def test_specified_user(self) -> None:
        user = self.create_user()
        result = convert_user_value([user.username], [self.project], self.user, None)
        assert result[0].id == user.id
        assert result[0].username == user.username

    def test_invalid_user(self) -> None:
        assert convert_user_value(["fake-user"], [], self.user, None)[0].id == 0


class ConvertReleaseValueTest(TestCase):
    def test(self) -> None:
        assert convert_release_value(["123"], [self.project], self.user, None) == "123"

    def test_latest(self) -> None:
        release = self.create_release(self.project)
        assert convert_release_value(["latest"], [self.project], self.user, None) == release.version
        assert convert_release_value(["14.*"], [self.project], self.user, None) == "14.*"

    def test_latest_archived(self) -> None:
        open_release = self.create_release(self.project, version="1.0", status=ReleaseStatus.OPEN)
        self.create_release(self.project, version="1.1", status=ReleaseStatus.ARCHIVED)

        # The archived release is more recent, but we should still pick the open one
        assert (
            convert_release_value(["latest"], [self.project], self.user, None)
            == open_release.version
        )


class ConvertFirstReleaseValueTest(TestCase):
    def test(self) -> None:
        assert convert_first_release_value(["123"], [self.project], self.user, None) == ["123"]

    def test_latest(self) -> None:
        release = self.create_release(self.project)
        assert convert_first_release_value(["latest"], [self.project], self.user, None) == [
            release.version
        ]
        assert convert_first_release_value(["14.*"], [self.project], self.user, None) == ["14.*"]


class ConvertCategoryValueTest(TestCase):
    def test(self) -> None:
        error_group_types = GROUP_TYPE_REGISTRY.get_by_category(GroupCategory.ERROR.value)
        perf_group_types = GROUP_TYPE_REGISTRY.get_by_category(GroupCategory.PERFORMANCE.value)
        assert (
            set(convert_category_value(["error"], [self.project], self.user, None))
            == error_group_types
        )
        assert (
            set(convert_category_value(["performance"], [self.project], self.user, None))
            == perf_group_types
        )
        assert (
            set(convert_category_value(["error", "performance"], [self.project], self.user, None))
            == error_group_types | perf_group_types
        )

        # Also works with new categories
        assert set(
            convert_category_value(["outage"], [self.project], self.user, None)
        ) == GROUP_TYPE_REGISTRY.get_by_category(GroupCategory.OUTAGE.value)
        assert set(
            convert_category_value(["DB_QUERY"], [self.project], self.user, None)
        ) == GROUP_TYPE_REGISTRY.get_by_category(GroupCategory.DB_QUERY.value)

        # Should raise an error for invalid values
        with pytest.raises(InvalidSearchQuery):
            convert_category_value(["hellboy"], [self.project], self.user, None)


class ConvertTypeValueTest(TestCase):
    def test(self) -> None:
        assert convert_type_value(["error"], [self.project], self.user, None) == [1]
        assert convert_type_value(
            ["performance_n_plus_one_db_queries"], [self.project], self.user, None
        ) == [1006]
        assert convert_type_value(
            ["performance_slow_db_query"], [self.project], self.user, None
        ) == [1001]
        assert convert_type_value(
            ["error", "performance_n_plus_one_db_queries"], [self.project], self.user, None
        ) == [1, 1006]
        with pytest.raises(InvalidSearchQuery):
            convert_type_value(["hellboy"], [self.project], self.user, None)


class DeviceClassValueTest(TestCase):
    def test(self) -> None:
        assert convert_device_class_value(["high"], [self.project], self.user, None) == ["3"]
        assert convert_device_class_value(["medium"], [self.project], self.user, None) == ["2"]
        assert convert_device_class_value(["low"], [self.project], self.user, None) == ["1"]
        assert sorted(
            convert_device_class_value(["medium", "high"], [self.project], self.user, None)
        ) == [
            "2",
            "3",
        ]
        assert sorted(
            convert_device_class_value(["low", "medium", "high"], [self.project], self.user, None)
        ) == ["1", "2", "3"]
