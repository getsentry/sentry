from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from sentry.models.group import GroupStatus
from sentry.models.release import Release, ReleaseProject
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.team import Team
from sentry.search.base import ANY
from sentry.search.utils import (
    DEVICE_CLASS,
    InvalidQuery,
    LatestReleaseOrders,
    convert_user_tag_to_query,
    get_first_last_release_for_group,
    get_latest_release,
    get_numeric_field_value,
    parse_duration,
    parse_query,
    tokenize_query,
)
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.user.serial import serialize_rpc_user
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.silo import control_silo_test, region_silo_test


def test_get_numeric_field_value():
    assert get_numeric_field_value("foo", "10") == {"foo": 10}

    assert get_numeric_field_value("foo", ">10") == {"foo_lower": 10, "foo_lower_inclusive": False}

    assert get_numeric_field_value("foo", ">=10") == {"foo_lower": 10, "foo_lower_inclusive": True}

    assert get_numeric_field_value("foo", "<10") == {"foo_upper": 10, "foo_upper_inclusive": False}

    assert get_numeric_field_value("foo", "<=10") == {"foo_upper": 10, "foo_upper_inclusive": True}

    assert get_numeric_field_value("foo", ">3.5", type=float) == {
        "foo_lower": 3.5,
        "foo_lower_inclusive": False,
    }

    assert get_numeric_field_value("foo", "<=-3.5", type=float) == {
        "foo_upper": -3.5,
        "foo_upper_inclusive": True,
    }


class TestParseDuration(TestCase):
    def test_ms(self):
        assert parse_duration("123", "ms") == 123

    def test_sec(self):
        assert parse_duration("456", "s") == 456000

    def test_minutes(self):
        assert parse_duration("789", "min") == 789 * 60 * 1000
        assert parse_duration("789", "m") == 789 * 60 * 1000

    def test_hours(self):
        assert parse_duration("234", "hr") == 234 * 60 * 60 * 1000
        assert parse_duration("234", "h") == 234 * 60 * 60 * 1000

    def test_days(self):
        assert parse_duration("567", "day") == 567 * 24 * 60 * 60 * 1000
        assert parse_duration("567", "d") == 567 * 24 * 60 * 60 * 1000

    def test_weeks(self):
        assert parse_duration("890", "wk") == 890 * 7 * 24 * 60 * 60 * 1000
        assert parse_duration("890", "w") == 890 * 7 * 24 * 60 * 60 * 1000

    def test_errors(self):
        with pytest.raises(InvalidQuery):
            parse_duration("test", "ms")

        with pytest.raises(InvalidQuery):
            parse_duration("123", "test")

    def test_large_durations(self):
        max_duration = 999999999 * 24 * 60 * 60 * 1000
        assert parse_duration("999999999", "d") == max_duration
        assert parse_duration(str(999999999 * 24), "h") == max_duration
        assert parse_duration(str(999999999 * 24 * 60), "m") == max_duration
        assert parse_duration(str(999999999 * 24 * 60 * 60), "s") == max_duration
        assert parse_duration(str(999999999 * 24 * 60 * 60 * 1000), "ms") == max_duration

    def test_overflow_durations(self):
        with pytest.raises(InvalidQuery):
            assert parse_duration(str(999999999 + 1), "d")

        with pytest.raises(InvalidQuery):
            assert parse_duration(str((999999999 + 1) * 24), "h")

        with pytest.raises(InvalidQuery):
            assert parse_duration(str((999999999 + 1) * 24 * 60 + 1), "m")

        with pytest.raises(InvalidQuery):
            assert parse_duration(str((999999999 + 1) * 24 * 60 * 60 + 1), "s")

        with pytest.raises(InvalidQuery):
            assert parse_duration(str((999999999 + 1) * 24 * 60 * 60 * 1000 + 1), "ms")


def test_tokenize_query_only_keyed_fields():
    tests = [
        ("a:a", {"a": ["a"]}),
        ("(a:a AND b:b)", {"a": ["a"], "b": ["b"]}),
        ("( a:a AND (b:b OR c:c))", {"a": ["a"], "b": ["b"], "c": ["c"]}),
        ("( a:a AND (b:b OR c:c ) )", {"a": ["a"], "b": ["b"], "c": ["c"]}),
        (
            "(x y a:a AND (b:b OR c:c) z)",
            {"a": ["a"], "b": ["b"], "c": ["c"], "query": ["x", "y", "z"]},
        ),
        (
            "((x y)) a:a AND (b:b OR c:c) z)",
            {"a": ["a"], "b": ["b"], "c": ["c"], "query": ["x", "y", "z"]},
        ),
        (
            "((x y)) a():>a AND (!b:b OR c():<c) z)",
            {"a()": [">a"], "!b": ["b"], "c()": ["<c"], "query": ["x", "y", "z"]},
        ),
        ('a:"\\"a\\""', {"a": ['\\"a\\"']}),
        (
            'a:"i \\" quote" b:"b\\"bb" c:"cc"',
            {"a": ['i \\" quote'], "b": ['b\\"bb'], "c": ["cc"]},
        ),
    ]

    for test in tests:
        assert tokenize_query(test[0]) == test[1], test[0]


def test_get_numeric_field_value_invalid():
    with pytest.raises(InvalidQuery):
        get_numeric_field_value("foo", ">=1k")


@region_silo_test
class ParseQueryTest(APITestCase, SnubaTestCase):
    @property
    def rpc_user(self):
        return user_service.get_user(user_id=self.user.id)

    @property
    def current_rpc_user(self):
        # This doesn't include useremails. Used in filters
        # where the current user is passed back
        return serialize_rpc_user(self.user)

    def parse_query(self, query):
        return parse_query([self.project], query, self.user, [])

    def test_simple(self):
        result = self.parse_query("foo bar")
        assert result == {"tags": {}, "query": "foo bar"}

    def test_useless_prefix(self):
        result = self.parse_query("foo: bar")
        assert result == {"tags": {}, "query": "foo: bar"}

    def test_useless_prefix_with_symbol(self):
        result = self.parse_query("foo:  @ba$r")
        assert result == {"tags": {}, "query": "foo:  @ba$r"}

    def test_useless_prefix_with_colon(self):
        result = self.parse_query("foo:  :ba:r::foo:")
        assert result == {"tags": {}, "query": "foo:  :ba:r::foo:"}

    def test_handles_space_separation_after_useless_prefix_exception(self):
        result = self.parse_query("foo: bar foo:bar")
        assert result == {"tags": {"foo": "bar"}, "query": "foo: bar"}

    def test_handles_period_in_tag_key(self):
        result = self.parse_query("foo.bar:foobar")
        assert result == {"tags": {"foo.bar": "foobar"}, "query": ""}

    def test_handles_dash_in_tag_key(self):
        result = self.parse_query("foo-bar:foobar")
        assert result == {"tags": {"foo-bar": "foobar"}, "query": ""}

    # TODO: update docs to include minutes, days, and weeks suffixes
    @freeze_time("2016-01-01")
    def test_age_tag_negative_value(self):
        start = datetime.now(timezone.utc)
        expected = start - timedelta(hours=12)
        result = self.parse_query("age:-12h")
        assert result == {"tags": {}, "query": "", "age_from": expected, "age_from_inclusive": True}

    @freeze_time("2016-01-01")
    def test_age_tag_positive_value(self):
        start = datetime.now(timezone.utc)
        expected = start - timedelta(hours=12)
        result = self.parse_query("age:+12h")
        assert result == {"tags": {}, "query": "", "age_to": expected, "age_to_inclusive": True}

    @freeze_time("2016-01-01")
    def test_age_tag_weeks(self):
        start = datetime.now(timezone.utc)
        expected = start - timedelta(days=35)
        result = self.parse_query("age:+5w")
        assert result == {"tags": {}, "query": "", "age_to": expected, "age_to_inclusive": True}

    @freeze_time("2016-01-01")
    def test_age_tag_days(self):
        start = datetime.now(timezone.utc)
        expected = start - timedelta(days=10)
        result = self.parse_query("age:+10d")
        assert result == {"tags": {}, "query": "", "age_to": expected, "age_to_inclusive": True}

    @freeze_time("2016-01-01")
    def test_age_tag_hours(self):
        start = datetime.now(timezone.utc)
        expected = start - timedelta(hours=10)
        result = self.parse_query("age:+10h")
        assert result == {"tags": {}, "query": "", "age_to": expected, "age_to_inclusive": True}

    @freeze_time("2016-01-01")
    def test_age_tag_minutes(self):
        start = datetime.now(timezone.utc)
        expected = start - timedelta(minutes=30)
        result = self.parse_query("age:+30m")
        assert result == {"tags": {}, "query": "", "age_to": expected, "age_to_inclusive": True}

    @freeze_time("2016-01-01")
    def test_two_age_tags(self):
        start = datetime.now(timezone.utc)
        expected_to = start - timedelta(hours=12)
        expected_from = start - timedelta(hours=24)
        result = self.parse_query("age:+12h age:-24h")
        assert result == {
            "tags": {},
            "query": "",
            "age_to": expected_to,
            "age_from": expected_from,
            "age_to_inclusive": True,
            "age_from_inclusive": True,
        }

    def test_event_timestamp_syntax(self):
        result = self.parse_query("event.timestamp:2016-01-02")
        assert result == {
            "query": "",
            "date_from": datetime(2016, 1, 2, tzinfo=timezone.utc),
            "date_from_inclusive": True,
            "date_to": datetime(2016, 1, 3, tzinfo=timezone.utc),
            "date_to_inclusive": False,
            "tags": {},
        }

    def test_times_seen_syntax(self):
        result = self.parse_query("timesSeen:10")
        assert result == {"tags": {}, "times_seen": 10, "query": ""}

    # TODO: query parser for '>' timestamp should set inclusive to False.
    @pytest.mark.xfail
    def test_greater_than_comparator(self):
        result = self.parse_query("timesSeen:>10 event.timestamp:>2016-01-02")
        assert result == {
            "tags": {},
            "query": "",
            "times_seen_lower": 10,
            "times_seen_lower_inclusive": False,
            "date_from": datetime(2016, 1, 2, tzinfo=timezone.utc),
            "date_from_inclusive": False,
        }

    def test_greater_than_equal_comparator(self):
        result = self.parse_query("timesSeen:>=10 event.timestamp:>=2016-01-02")
        assert result == {
            "tags": {},
            "query": "",
            "times_seen_lower": 10,
            "times_seen_lower_inclusive": True,
            "date_from": datetime(2016, 1, 2, tzinfo=timezone.utc),
            "date_from_inclusive": True,
        }

    def test_less_than_comparator(self):
        result = self.parse_query("event.timestamp:<2016-01-02 timesSeen:<10")
        assert result == {
            "tags": {},
            "query": "",
            "times_seen_upper": 10,
            "times_seen_upper_inclusive": False,
            "date_to": datetime(2016, 1, 2, tzinfo=timezone.utc),
            "date_to_inclusive": False,
        }

    # TODO: query parser for '<=' timestamp should set inclusive to True.
    @pytest.mark.xfail
    def test_less_than_equal_comparator(self):
        result = self.parse_query("event.timestamp:<=2016-01-02 timesSeen:<=10")
        assert result == {
            "tags": {},
            "query": "",
            "times_seen_upper": 10,
            "times_seen_upper_inclusive": True,
            "date_to": datetime(2016, 1, 2, tzinfo=timezone.utc),
            "date_to_inclusive": True,
        }

    def test_handles_underscore_in_tag_key(self):
        result = self.parse_query("foo_bar:foobar")
        assert result == {"tags": {"foo_bar": "foobar"}, "query": ""}

    def test_mix_tag_and_query(self):
        result = self.parse_query("foo bar key:value")
        assert result == {"tags": {"key": "value"}, "query": "foo bar"}

    def test_single_tag(self):
        result = self.parse_query("key:value")
        assert result == {"tags": {"key": "value"}, "query": ""}

    def test_tag_with_colon_in_value(self):
        result = self.parse_query("url:http://example.com")
        assert result == {"tags": {"url": "http://example.com"}, "query": ""}

    def test_single_space_in_value(self):
        result = self.parse_query('key:"value1 value2"')
        assert result == {"tags": {"key": "value1 value2"}, "query": ""}

    def test_multiple_spaces_in_value(self):
        result = self.parse_query('key:"value1  value2"')
        assert result == {"tags": {"key": "value1  value2"}, "query": ""}

    def test_invalid_tag_as_query(self):
        result = self.parse_query("Resque::DirtyExit")
        assert result == {"tags": {}, "query": "Resque::DirtyExit"}

    def test_colons_in_tag_value(self):
        result = self.parse_query("key:Resque::DirtyExit")
        assert result == {"tags": {"key": "Resque::DirtyExit"}, "query": ""}

    def test_multiple_tags(self):
        result = self.parse_query("foo:bar key:value")
        assert result == {"tags": {"key": "value", "foo": "bar"}, "query": ""}

    def test_single_tag_with_quotes(self):
        result = self.parse_query('foo:"bar"')
        assert result == {"tags": {"foo": "bar"}, "query": ""}

    def test_tag_with_quotes_and_query(self):
        result = self.parse_query('key:"a value" hello')
        assert result == {"tags": {"key": "a value"}, "query": "hello"}

    def test_is_resolved(self):
        result = self.parse_query("is:resolved")
        assert result == {"status": GroupStatus.RESOLVED, "tags": {}, "query": ""}

    def test_assigned_me(self):
        result = self.parse_query("assigned:me")
        assert result == {"assigned_to": self.current_rpc_user, "tags": {}, "query": ""}

    def test_assigned_none(self):
        result = self.parse_query("assigned:none")
        assert result == {"assigned_to": None, "tags": {}, "query": ""}

    def test_assigned_email(self):
        result = self.parse_query(f"assigned:{self.user.email}")
        assert result == {"assigned_to": self.rpc_user, "tags": {}, "query": ""}

    def test_assigned_unknown_user(self):
        result = self.parse_query("assigned:fake@example.com")
        assert isinstance(result["assigned_to"], RpcUser)
        assert result["assigned_to"].id == 0

    def test_assigned_valid_team(self):
        result = self.parse_query(f"assigned:#{self.team.slug}")
        assert result["assigned_to"] == self.team

    def test_assigned_unassociated_team(self):
        team2 = self.create_team(organization=self.organization)
        result = self.parse_query(f"assigned:#{team2.slug}")
        assert isinstance(result["assigned_to"], Team)
        assert result["assigned_to"].id == 0

    def test_assigned_invalid_team(self):
        result = self.parse_query("assigned:#invalid")
        assert isinstance(result["assigned_to"], Team)
        assert result["assigned_to"].id == 0

    def test_bookmarks_me(self):
        result = self.parse_query("bookmarks:me")
        assert result == {"bookmarked_by": self.current_rpc_user, "tags": {}, "query": ""}

    def test_bookmarks_email(self):
        result = self.parse_query(f"bookmarks:{self.user.email}")
        assert result == {"bookmarked_by": self.rpc_user, "tags": {}, "query": ""}

    def test_bookmarks_unknown_user(self):
        result = self.parse_query("bookmarks:fake@example.com")
        assert result["bookmarked_by"].id == 0

    def test_first_release(self):
        result = self.parse_query("first-release:bar")
        assert result == {"first_release": ["bar"], "tags": {}, "query": ""}

    def test_first_release_latest(self):
        result = self.parse_query("first-release:latest")
        assert result == {"first_release": [""], "tags": {}, "query": ""}
        release = self.create_release(
            project=self.project,
            version="older_release",
            date_added=datetime.now() - timedelta(days=1),
        )
        result = self.parse_query("first-release:latest")
        assert result == {"first_release": [release.version], "tags": {}, "query": ""}
        release = self.create_release(
            project=self.project, version="new_release", date_added=datetime.now()
        )
        result = self.parse_query("first-release:latest")
        assert result == {"first_release": [release.version], "tags": {}, "query": ""}

    def test_release(self):
        result = self.parse_query("release:bar")
        assert result == {"tags": {"sentry:release": ["bar"]}, "query": ""}

    def test_release_latest(self):
        result = self.parse_query("release:latest")
        assert result == {"tags": {"sentry:release": [""]}, "query": ""}

        release = self.create_release(
            project=self.project,
            version="older_release",
            date_added=datetime.now() - timedelta(days=1),
        )
        result = self.parse_query("release:latest")
        assert result == {"tags": {"sentry:release": [release.version]}, "query": ""}
        release = self.create_release(
            project=self.project, version="new_release", date_added=datetime.now()
        )
        result = self.parse_query("release:latest")
        assert result == {"tags": {"sentry:release": [release.version]}, "query": ""}

    def test_dist(self):
        result = self.parse_query("dist:123")
        assert result == {"tags": {"sentry:dist": "123"}, "query": ""}

    def test_padded_spacing(self):
        result = self.parse_query("release:bar  foo   bar")
        assert result == {"tags": {"sentry:release": ["bar"]}, "query": "foo bar"}

    def test_unknown_user_with_dot_query(self):
        result = self.parse_query("user.email:fake@example.com")
        assert result["tags"]["sentry:user"] == "email:fake@example.com"

    def test_unknown_user_value(self):
        result = self.parse_query("user.xxxxxx:example")
        assert result["tags"]["sentry:user"] == "xxxxxx:example"

    def test_user_lookup_with_dot_query(self):
        self.project.date_added = timezone.now() - timedelta(minutes=10)
        self.project.save()

        self.store_event(
            data={
                "user": {
                    "id": 1,
                    "email": "foo@example.com",
                    "username": "foobar",
                    "ip_address": "127.0.0.1",
                },
                "timestamp": iso_format(before_now(seconds=10)),
            },
            project_id=self.project.id,
        )
        result = self.parse_query("user.username:foobar")
        assert result["tags"]["sentry:user"] == "id:1"

    def test_unknown_user_legacy_syntax(self):
        result = self.parse_query("user:email:fake@example.com")
        assert result["tags"]["sentry:user"] == "email:fake@example.com"

    def test_user_lookup_legacy_syntax(self):
        self.project.date_added = timezone.now() - timedelta(minutes=10)
        self.project.save()

        self.store_event(
            data={
                "user": {
                    "id": 1,
                    "email": "foo@example.com",
                    "username": "foobar",
                    "ip_address": "127.0.0.1",
                },
                "timestamp": iso_format(before_now(seconds=10)),
            },
            project_id=self.project.id,
        )
        result = self.parse_query("user:username:foobar")
        assert result["tags"]["sentry:user"] == "id:1"

    def test_is_unassigned(self):
        result = self.parse_query("is:unassigned")
        assert result == {"unassigned": True, "tags": {}, "query": ""}

    def test_is_assigned(self):
        result = self.parse_query("is:assigned")
        assert result == {"unassigned": False, "tags": {}, "query": ""}

    def test_is_inbox(self):
        result = self.parse_query("is:for_review")
        assert result == {"for_review": True, "tags": {}, "query": ""}

    def test_is_unlinked(self):
        result = self.parse_query("is:unlinked")
        assert result == {"linked": False, "tags": {}, "query": ""}

    def test_is_linked(self):
        result = self.parse_query("is:linked")
        assert result == {"linked": True, "tags": {}, "query": ""}

    def test_age_from(self):
        result = self.parse_query("age:-24h")
        assert result["age_from"] > timezone.now() - timedelta(hours=25)
        assert result["age_from"] < timezone.now() - timedelta(hours=23)
        assert not result.get("age_to")

    def test_age_to(self):
        result = self.parse_query("age:+24h")
        assert result["age_to"] > timezone.now() - timedelta(hours=25)
        assert result["age_to"] < timezone.now() - timedelta(hours=23)
        assert not result.get("age_from")

    def test_age_range(self):
        result = self.parse_query("age:-24h age:+12h")
        assert result["age_from"] > timezone.now() - timedelta(hours=25)
        assert result["age_from"] < timezone.now() - timedelta(hours=23)
        assert result["age_to"] > timezone.now() - timedelta(hours=13)
        assert result["age_to"] < timezone.now() - timedelta(hours=11)

    def test_first_seen_range(self):
        result = self.parse_query("firstSeen:-24h firstSeen:+12h")
        assert result["age_from"] > timezone.now() - timedelta(hours=25)
        assert result["age_from"] < timezone.now() - timedelta(hours=23)
        assert result["age_to"] > timezone.now() - timedelta(hours=13)
        assert result["age_to"] < timezone.now() - timedelta(hours=11)

    def test_date_range(self):
        result = self.parse_query("event.timestamp:>2016-01-01 event.timestamp:<2016-01-02")
        assert result["date_from"] == datetime(2016, 1, 1, tzinfo=timezone.utc)
        assert result["date_from_inclusive"] is False
        assert result["date_to"] == datetime(2016, 1, 2, tzinfo=timezone.utc)
        assert result["date_to_inclusive"] is False

    def test_date_range_with_timezone(self):
        result = self.parse_query(
            "event.timestamp:>2016-01-01T10:00:00-03:00 event.timestamp:<2016-01-02T10:00:00+02:00"
        )
        assert result["date_from"] == datetime(2016, 1, 1, 13, 0, 0, tzinfo=timezone.utc)
        assert result["date_from_inclusive"] is False
        assert result["date_to"] == datetime(2016, 1, 2, 8, 0, tzinfo=timezone.utc)
        assert result["date_to_inclusive"] is False

    def test_date_range_with_z_timezone(self):
        result = self.parse_query(
            "event.timestamp:>2016-01-01T10:00:00Z event.timestamp:<2016-01-02T10:00:00Z"
        )
        assert result["date_from"] == datetime(2016, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        assert result["date_from_inclusive"] is False
        assert result["date_to"] == datetime(2016, 1, 2, 10, 0, tzinfo=timezone.utc)
        assert result["date_to_inclusive"] is False

    def test_date_range_inclusive(self):
        result = self.parse_query("event.timestamp:>=2016-01-01 event.timestamp:<=2016-01-02")
        assert result["date_from"] == datetime(2016, 1, 1, tzinfo=timezone.utc)
        assert result["date_from_inclusive"] is True
        assert result["date_to"] == datetime(2016, 1, 2, tzinfo=timezone.utc)
        assert result["date_to_inclusive"] is True

    def test_date_approx_day(self):
        date_value = datetime(2016, 1, 1, tzinfo=timezone.utc)
        result = self.parse_query("event.timestamp:2016-01-01")
        assert result["date_from"] == date_value
        assert result["date_from_inclusive"]
        assert result["date_to"] == date_value + timedelta(days=1)
        assert not result["date_to_inclusive"]

    def test_date_approx_precise(self):
        date_value = datetime(2016, 1, 1, tzinfo=timezone.utc)
        result = self.parse_query("event.timestamp:2016-01-01T00:00:00")
        assert result["date_from"] == date_value - timedelta(minutes=5)
        assert result["date_from_inclusive"]
        assert result["date_to"] == date_value + timedelta(minutes=6)
        assert not result["date_to_inclusive"]

    def test_date_approx_precise_with_timezone(self):
        date_value = datetime(2016, 1, 1, 5, 0, 0, tzinfo=timezone.utc)
        result = self.parse_query("event.timestamp:2016-01-01T00:00:00-05:00")
        assert result["date_from"] == date_value - timedelta(minutes=5)
        assert result["date_from_inclusive"]
        assert result["date_to"] == date_value + timedelta(minutes=6)
        assert not result["date_to_inclusive"]

    def test_last_seen_range(self):
        result = self.parse_query("lastSeen:-24h lastSeen:+12h")
        assert result["last_seen_from"] > timezone.now() - timedelta(hours=25)
        assert result["last_seen_from"] < timezone.now() - timedelta(hours=23)
        assert result["last_seen_to"] > timezone.now() - timedelta(hours=13)
        assert result["last_seen_to"] < timezone.now() - timedelta(hours=11)

    def test_has_tag(self):
        result = self.parse_query("has:foo")
        assert result["tags"]["foo"] == ANY

        result = self.parse_query("has:foo foo:value")
        assert result["tags"]["foo"] == "value"

    def test_has_user(self):
        result = self.parse_query("has:user")
        assert result["tags"]["sentry:user"] == ANY

    def test_has_release(self):
        result = self.parse_query("has:release")
        assert result["tags"]["sentry:release"] == ANY

    def test_quoted_string(self):
        result = self.parse_query('"release:foo"')
        assert result == {"tags": {}, "query": "release:foo"}

    def test_quoted_tag_value(self):
        result = self.parse_query('event.type:error title:"QueryExecutionError: Code: 141."')
        assert result["query"] == ""
        assert result["tags"]["title"] == "QueryExecutionError: Code: 141."
        assert result["tags"]["event.type"] == "error"

    def test_leading_colon(self):
        result = self.parse_query("country:canada :unresolved")
        assert result["query"] == ":unresolved"
        assert result["tags"]["country"] == "canada"

    def test_assigned_or_suggested_me(self):
        result = self.parse_query("assigned_or_suggested:me")
        assert result == {"assigned_or_suggested": self.current_rpc_user, "tags": {}, "query": ""}

    def test_assigned_or_suggested_none(self):
        result = self.parse_query("assigned_or_suggested:none")
        assert result == {
            "assigned_or_suggested": None,
            "tags": {},
            "query": "",
        }

    def test_owner_email(self):
        result = self.parse_query(f"assigned_or_suggested:{self.user.email}")
        assert result == {"assigned_or_suggested": self.rpc_user, "tags": {}, "query": ""}

    def test_assigned_or_suggested_unknown_user(self):
        result = self.parse_query("assigned_or_suggested:fake@example.com")
        assert isinstance(result["assigned_or_suggested"], RpcUser)
        assert result["assigned_or_suggested"].id == 0

    def test_owner_valid_team(self):
        result = self.parse_query(f"assigned_or_suggested:#{self.team.slug}")
        assert result["assigned_or_suggested"] == self.team

    def test_assigned_or_suggested_unassociated_team(self):
        team2 = self.create_team(organization=self.organization)
        result = self.parse_query(f"assigned_or_suggested:#{team2.slug}")
        assert isinstance(result["assigned_or_suggested"], Team)
        assert result["assigned_or_suggested"].id == 0

    def test_owner_invalid_team(self):
        result = self.parse_query("assigned_or_suggested:#invalid")
        assert isinstance(result["assigned_or_suggested"], Team)
        assert result["assigned_or_suggested"].id == 0


@region_silo_test
class GetLatestReleaseTest(TestCase):
    def test(self):
        with pytest.raises(Release.DoesNotExist):
            # no releases exist period
            environment = None
            get_latest_release([self.project], environment)

        old = self.create_release(version="old")
        new_date = old.date_added + timedelta(minutes=1)
        new = self.create_release(
            version="new-but-in-environment",
            environments=[self.environment],
            date_released=new_date,
        )
        newest = self.create_release(
            version="newest-overall", date_released=old.date_added + timedelta(minutes=5)
        )

        # latest overall (no environment filter)
        environment = None
        result = get_latest_release([self.project], environment)
        assert result == [newest.version]

        # latest in environment
        environment = self.environment
        result = get_latest_release([self.project], [environment])
        assert result == [new.version]

        assert get_latest_release([self.project.id], [environment]) == []
        assert get_latest_release(
            [self.project.id], [environment], self.project.organization_id
        ) == [new.version]

        # Verify that not passing an environment correctly gets the latest one
        assert get_latest_release([self.project], None) == [newest.version]
        assert get_latest_release([self.project], []) == [newest.version]

        with pytest.raises(Release.DoesNotExist):
            # environment with no releases
            new_environment = self.create_environment()
            get_latest_release([self.project], [new_environment])

        project_2 = self.create_project()
        other_project_env_release = self.create_release(
            project_2, version="other_project_env", environments=[self.environment]
        )
        other_project_release = self.create_release(project_2, version="other_project")
        assert get_latest_release([project_2], None) == [other_project_release.version]
        assert get_latest_release([project_2], [environment]) == [other_project_env_release.version]
        assert get_latest_release([self.project, project_2], None) == [
            newest.version,
            other_project_release.version,
        ]
        assert get_latest_release([self.project, project_2], [environment]) == [
            new.version,
            other_project_env_release.version,
        ]

        with pytest.raises(Release.DoesNotExist):
            assert get_latest_release([self.project, project_2], [environment], adopted=True) == [
                new.version,
                other_project_env_release.version,
            ]

        ReleaseProjectEnvironment.objects.filter(
            release__in=[new, other_project_env_release]
        ).update(adopted=datetime.now())

        assert get_latest_release([self.project, project_2], [environment], adopted=True) == [
            new.version,
            other_project_env_release.version,
        ]

    def test_semver(self):
        project_2 = self.create_project()
        release_1 = self.create_release(version="test@2.0.0", environments=[self.environment])
        env_2 = self.create_environment()
        self.create_release(version="test@1.3.2", environments=[env_2])
        self.create_release(version="test@1.0.0", environments=[self.environment, env_2])

        # Check when we're using a single project that we sort by semver
        assert get_latest_release([self.project], None) == [release_1.version]
        assert get_latest_release([project_2, self.project], None) == [release_1.version]
        release_3 = self.create_release(
            project_2, version="test@1.3.3", environments=[self.environment, env_2]
        )
        assert get_latest_release([project_2, self.project], None) == [
            release_3.version,
            release_1.version,
        ]

        with pytest.raises(Release.DoesNotExist):
            get_latest_release([project_2, self.project], [self.environment, env_2], adopted=True)

        ReleaseProjectEnvironment.objects.filter(release__in=[release_3, release_1]).update(
            adopted=datetime.now()
        )
        assert get_latest_release(
            [project_2, self.project], [self.environment, env_2], adopted=True
        ) == [
            release_3.version,
            release_1.version,
        ]
        assert get_latest_release([project_2, self.project], [env_2], adopted=True) == [
            release_3.version,
        ]
        # Make sure unadopted releases are ignored
        ReleaseProjectEnvironment.objects.filter(release__in=[release_3]).update(
            unadopted=datetime.now()
        )
        assert get_latest_release(
            [project_2, self.project], [self.environment, env_2], adopted=True
        ) == [
            release_1.version,
        ]

        ReleaseProject.objects.filter(release__in=[release_1]).update(adopted=datetime.now())
        assert get_latest_release([project_2, self.project], None, adopted=True) == [
            release_1.version,
        ]

    def test_multiple_projects_mixed_versions(self):
        project_2 = self.create_project()
        release_1 = self.create_release(version="test@2.0.0")
        self.create_release(project_2, version="not_semver")
        release_2 = self.create_release(project_2, version="not_semver_2")
        self.create_release(version="test@1.0.0")
        assert get_latest_release([project_2, self.project], None) == [
            release_2.version,
            release_1.version,
        ]


@region_silo_test
class GetFirstLastReleaseForGroupTest(TestCase):
    def test_date(self):
        with pytest.raises(Release.DoesNotExist):
            get_first_last_release_for_group(self.group, LatestReleaseOrders.DATE, True)

        oldest = self.create_release(version="old")
        self.create_group_release(group=self.group, release=oldest)
        newest = self.create_release(
            version="newest", date_released=oldest.date_added + timedelta(minutes=5)
        )
        self.create_group_release(group=self.group, release=newest)

        assert newest == get_first_last_release_for_group(
            self.group, LatestReleaseOrders.DATE, True
        )
        assert oldest == get_first_last_release_for_group(
            self.group, LatestReleaseOrders.DATE, False
        )

        group_2 = self.create_group()
        with pytest.raises(Release.DoesNotExist):
            get_first_last_release_for_group(group_2, LatestReleaseOrders.DATE, True)
        self.create_group_release(group=group_2, release=oldest)
        assert oldest == get_first_last_release_for_group(group_2, LatestReleaseOrders.DATE, True)
        assert oldest == get_first_last_release_for_group(group_2, LatestReleaseOrders.DATE, False)

    def test_semver(self):
        with pytest.raises(Release.DoesNotExist):
            get_first_last_release_for_group(self.group, LatestReleaseOrders.SEMVER, True)

        latest = self.create_release(version="test@2.0.0")
        middle = self.create_release(version="test@1.3.2")
        earliest = self.create_release(
            version="test@1.0.0", date_released=latest.date_added + timedelta(minutes=5)
        )
        self.create_group_release(group=self.group, release=latest)
        self.create_group_release(group=self.group, release=middle)
        self.create_group_release(group=self.group, release=earliest)

        assert latest == get_first_last_release_for_group(
            self.group, LatestReleaseOrders.SEMVER, True
        )
        assert earliest == get_first_last_release_for_group(
            self.group, LatestReleaseOrders.DATE, True
        )
        assert earliest == get_first_last_release_for_group(
            self.group, LatestReleaseOrders.SEMVER, False
        )
        assert latest == get_first_last_release_for_group(
            self.group, LatestReleaseOrders.DATE, False
        )

        group_2 = self.create_group()
        with pytest.raises(Release.DoesNotExist):
            get_first_last_release_for_group(group_2, LatestReleaseOrders.SEMVER, True)
        self.create_group_release(group=group_2, release=latest)
        self.create_group_release(group=group_2, release=middle)
        assert latest == get_first_last_release_for_group(group_2, LatestReleaseOrders.SEMVER, True)
        assert middle == get_first_last_release_for_group(
            group_2, LatestReleaseOrders.SEMVER, False
        )


@control_silo_test
class ConvertUserTagTest(TestCase):
    def test_simple_user_tag(self):
        assert convert_user_tag_to_query("user", "id:123456") == 'user.id:"123456"'

    def test_user_tag_with_quote(self):
        assert convert_user_tag_to_query("user", 'id:123"456') == 'user.id:"123\\"456"'

    def test_user_tag_with_space(self):
        assert convert_user_tag_to_query("user", "id:123 456") == 'user.id:"123 456"'

    def test_non_user_tag(self):
        assert convert_user_tag_to_query("user", 'fake:123"456') is None


def test_valid_device_class_mapping():
    assert set(DEVICE_CLASS.keys()) == {"low", "medium", "high"}, "Only 3 possible classes"

    # should all be integers
    device_classes = {key: {int(value) for value in values} for key, values in DEVICE_CLASS.items()}

    assert all(
        0 not in values for values in device_classes.values()
    ), "`0` is not a valid classes as it represents unclassified"
