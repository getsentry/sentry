from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.exceptions import InvalidSearchQuery
from sentry.models.releaseprojectenvironment import ReleaseStages
from sentry.search.events.constants import (
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.search.events.types import SnubaParams
from sentry.snuba import errors
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data

ARRAY_COLUMNS = ["measurements", "span_op_breakdowns"]


class ErrorsQueryIntegrationTest(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.environment = self.create_environment(self.project, name="prod")
        self.release = self.create_release(self.project, version="first-release")
        self.now = before_now()
        self.one_min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)

        self.event_time = self.one_min_ago
        # error event
        self.event = self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": self.event_time.isoformat(),
                "tags": [["key1", "value1"]],
            },
            project_id=self.project.id,
        )

        # transaction event
        data = load_data("transaction", timestamp=self.event_time)
        data["transaction"] = "a" * 32
        data["user"] = {"id": "99", "email": "bruce@example.com", "username": "brucew"}
        data["release"] = "first-release"
        data["environment"] = self.environment.name
        data["tags"] = [["key1", "value1"]]
        self.store_event(data=data, project_id=self.project.id)

        self.snuba_params = SnubaParams(
            organization=self.organization,
            projects=[self.project],
            start=before_now(days=1),
            end=self.now,
        )

    def test_errors_query(self):
        result = errors.query(
            selected_columns=["transaction"],
            query="",
            snuba_params=self.snuba_params,
            referrer="test_errors_query",
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0] == {"transaction": ""}

    def test_project_mapping(self):
        other_project = self.create_project(organization=self.organization)
        self.snuba_params.projects = [other_project]
        self.store_event(
            data={"message": "hello", "timestamp": self.one_min_ago.isoformat()},
            project_id=other_project.id,
        )

        result = errors.query(
            selected_columns=["project", "message"],
            query="",
            snuba_params=self.snuba_params,
            orderby=["project"],
            referrer="errors",
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["project"] == other_project.slug

    def test_issue_short_id_mapping(self):
        tests = [
            ("issue", f"issue:{self.event.group.qualified_short_id}"),
            ("issue", f"issue.id:{self.event.group_id}"),
            ("issue.id", f"issue:{self.event.group.qualified_short_id}"),
            ("issue.id", f"issue.id:{self.event.group_id}"),
        ]

        for column, query in tests:
            result = errors.query(
                selected_columns=[column],
                query=query,
                referrer="errors",
                snuba_params=self.snuba_params,
            )
            data = result["data"]
            assert len(data) == 1
            # The query will translate `issue` into `issue.id`. Additional post processing
            # is required to insert the `issue` column.
            assert [item["issue.id"] for item in data] == [self.event.group_id]

    def test_issue_filters(self):
        tests = [
            "has:issue",
            "has:issue.id",
            f"issue:[{self.event.group.qualified_short_id}]",
            f"issue.id:[{self.event.group_id}]",
        ]

        for query in tests:
            result = errors.query(
                selected_columns=["issue", "issue.id"],
                query=query,
                snuba_params=self.snuba_params,
                referrer="errors",
            )
            data = result["data"]
            assert len(data) == 1
            # The query will translate `issue` into `issue.id`. Additional post processing
            # is required to insert the `issue` column.
            assert [item["issue.id"] for item in data] == [self.event.group_id]

    def test_tags_orderby(self):
        self.event = self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": self.event_time.isoformat(),
                "tags": [["key1", "value2"]],
            },
            project_id=self.project.id,
        )

        tests = [
            ("key1", "key1", ["value1", "value2"]),
            ("key1", "-key1", ["value2", "value1"]),
            ("tags[key1]", "tags[key1]", ["value1", "value2"]),
            ("tags[key1]", "-tags[key1]", ["value2", "value1"]),
        ]

        for column, orderby, expected in tests:
            result = errors.query(
                selected_columns=[column],
                query="",
                snuba_params=self.snuba_params,
                orderby=[orderby],
                referrer="test_discover_query",
            )
            data = result["data"]
            assert len(data) == len(expected)
            assert [item[column] for item in data] == expected

    def test_tags_filter(self):
        self.event = self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": self.event_time.isoformat(),
                "tags": [["key1", "value2"]],
            },
            project_id=self.project.id,
        )

        tests: list[tuple[str, str, list[str]]] = [
            ("key1", "", ["value1", "value2"]),
            ("key1", "has:key1", ["value1", "value2"]),
            ("key1", "!has:key1", []),
            ("key1", "key1:value1", ["value1"]),
            ("key1", "key1:value2", ["value2"]),
            ("key1", 'key1:""', []),
            ("key1", "key1:value*", ["value1", "value2"]),
            ("key1", 'key1:["value1"]', ["value1"]),
            ("key1", 'key1:["value1", "value2"]', ["value1", "value2"]),
            ("tags[key1]", "", ["value1", "value2"]),
            # has does not work with tags[...] syntax
            # ("tags[key1]", 'has:"tags[key1]"', ["value1", "value2"]),
            # ("tags[key1]", '!has:"tags[key1]"', []),
            ("tags[key1]", "tags[key1]:value1", ["value1"]),
            ("tags[key1]", "tags[key1]:value2", ["value2"]),
            ("tags[key1]", 'tags[key1]:""', []),
            ("tags[key1]", "tags[key1]:value*", ["value1", "value2"]),
            ("tags[key1]", 'tags[key1]:["value1"]', ["value1"]),
            ("tags[key1]", 'tags[key1]:["value1", "value2"]', ["value1", "value2"]),
        ]

        for column, query, expected in tests:
            result = errors.query(
                selected_columns=[column],
                query=query,
                snuba_params=self.snuba_params,
                orderby=[column],
                referrer="test_discover_query",
            )
            data = result["data"]
            assert len(data) == len(expected), (column, query, expected)
            assert [item[column] for item in data] == expected

    def test_tags_colliding_with_fields(self):
        event = self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": self.event_time.isoformat(),
                "tags": [["id", "new"]],
            },
            project_id=self.project.id,
        )

        tests = [
            ("id", "", sorted([self.event.event_id, event.event_id])),
            ("id", f"id:{event.event_id}", [event.event_id]),
            ("tags[id]", "", ["", "new"]),
            ("tags[id]", "tags[id]:new", ["new"]),
        ]

        for column, query, expected in tests:
            result = errors.query(
                selected_columns=[column],
                query=query,
                snuba_params=self.snuba_params,
                orderby=[column],
                referrer="test_discover_query",
            )
            data = result["data"]
            assert len(data) == len(expected), (query, expected)
            assert [item[column] for item in data] == expected

    def test_reverse_sorting_issue(self):
        other_event = self.store_event(
            data={
                "message": "whoopsies",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": self.event_time.isoformat(),
            },
            project_id=self.project.id,
        )

        tests = [
            # issue is not sortable
            # "issue",
            "issue.id",
        ]

        for column in tests:
            for direction in ["", "-"]:
                result = errors.query(
                    selected_columns=[column],
                    query="",
                    snuba_params=self.snuba_params,
                    orderby=[f"{direction}{column}"],
                    referrer="errors",
                )
                data = result["data"]
                assert len(data) == 2
                expected = [self.event.group_id, other_event.group_id]
                if direction == "-":
                    expected.reverse()
                assert [item["issue.id"] for item in data] == expected

    def test_timestamp_rounding_fields(self):
        result = errors.query(
            selected_columns=["timestamp.to_hour", "timestamp.to_day"],
            query="",
            snuba_params=self.snuba_params,
            referrer="test_discover_query",
        )
        data = result["data"]
        assert len(data) == 1

        hour = self.event_time.replace(minute=0, second=0, microsecond=0)
        day = hour.replace(hour=0)
        assert [item["timestamp.to_hour"] for item in data] == [hour.isoformat()]
        assert [item["timestamp.to_day"] for item in data] == [day.isoformat()]

    def test_timestamp_rounding_filters(self):
        one_day_ago = before_now(days=1)
        two_day_ago = before_now(days=2)
        three_day_ago = before_now(days=3)
        self.snuba_params.start = three_day_ago

        self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": two_day_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        result = errors.query(
            selected_columns=["timestamp.to_hour", "timestamp.to_day"],
            query=f"timestamp.to_hour:<{one_day_ago.isoformat()} timestamp.to_day:<{one_day_ago.isoformat()}",
            snuba_params=self.snuba_params,
            referrer="test_discover_query",
        )
        data = result["data"]
        assert len(data) == 1

        hour = two_day_ago.replace(minute=0, second=0, microsecond=0)
        day = hour.replace(hour=0)
        assert [item["timestamp.to_hour"] for item in data] == [hour.isoformat()]
        assert [item["timestamp.to_day"] for item in data] == [day.isoformat()]

    def test_user_display(self):
        # `user.display` should give `username`
        self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"username": "brucew", "id": "1234", "ip": "127.0.0.1"},
                "timestamp": self.event_time.isoformat(),
            },
            project_id=self.project.id,
        )

        # `user.display` should give `id`
        self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "1234", "ip": "127.0.0.1"},
                "timestamp": self.event_time.isoformat(),
            },
            project_id=self.project.id,
        )

        # `user.display` should give `ip`
        self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"ip_address": "127.0.0.1"},
                "timestamp": self.event_time.isoformat(),
            },
            project_id=self.project.id,
        )

        result = errors.query(
            selected_columns=["user.display"],
            query="",
            snuba_params=self.snuba_params,
            referrer="test_discover_query",
        )
        data = result["data"]
        assert len(data) == 4
        assert {item["user.display"] for item in data} == {
            "bruce@example.com",
            "brucew",
            "1234",
            "127.0.0.1",
        }

    def test_user_display_filter(self):
        # `user.display` should give `username`
        self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"username": "brucew", "ip": "127.0.0.1"},
                "timestamp": self.event_time.isoformat(),
            },
            project_id=self.project.id,
        )

        result = errors.query(
            selected_columns=["user.display"],
            query="has:user.display user.display:bruce@example.com",
            snuba_params=self.snuba_params,
            referrer="test_discover_query",
        )
        data = result["data"]
        assert len(data) == 1
        assert [item["user.display"] for item in data] == ["bruce@example.com"]

    def test_message_orderby(self):
        self.event = self.store_event(
            data={
                "message": "oh yeah",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": self.event_time.isoformat(),
            },
            project_id=self.project.id,
        )

        tests = [
            ("message", ["oh no", "oh yeah"]),
            ("-message", ["oh yeah", "oh no"]),
        ]

        for orderby, expected in tests:
            result = errors.query(
                selected_columns=["message"],
                query="",
                snuba_params=self.snuba_params,
                orderby=[orderby],
                referrer="test_discover_query",
            )

            data = result["data"]
            assert len(data) == 2
            assert [item["message"] for item in data] == expected

    def test_message_filter(self):
        self.event = self.store_event(
            data={
                "message": "oh yeah",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": self.event_time.isoformat(),
            },
            project_id=self.project.id,
        )

        tests: list[tuple[str, list[str]]] = [
            ('message:"oh no"', ["oh no"]),
            ('message:"oh yeah"', ["oh yeah"]),
            ('message:""', []),
            ("has:message", ["oh no", "oh yeah"]),
            ("!has:message", []),
            ("message:oh*", ["oh no", "oh yeah"]),
            ('message:"oh *"', ["oh no", "oh yeah"]),
            ('message:["oh meh"]', []),
            ('message:["oh yeah"]', ["oh yeah"]),
            ('message:["oh yeah", "oh no"]', ["oh no", "oh yeah"]),
        ]

        for query, expected in tests:
            result = errors.query(
                selected_columns=["message"],
                query=query,
                snuba_params=self.snuba_params,
                orderby=["message"],
                referrer="test_discover_query",
            )
            data = result["data"]
            assert len(data) == len(expected)
            assert [item["message"] for item in data] == expected

    def test_to_other_function(self):
        project = self.create_project()

        for i in range(3):
            data = load_data("javascript", timestamp=before_now(minutes=5))
            data["transaction"] = f"/to_other/{i}"
            data["release"] = "aaaa"
            self.store_event(data, project_id=project.id)

        data = load_data("javascript", timestamp=before_now(minutes=5))
        data["transaction"] = "/to_other/y"
        data["release"] = "yyyy"
        self.store_event(data, project_id=project.id)

        data = load_data("javascript", timestamp=before_now(minutes=5))
        data["transaction"] = "/to_other/z"
        data["release"] = "zzzz"
        self.store_event(data, project_id=project.id)

        columns1 = ["transaction", 'to_other(release,"aaaa")']
        columns2 = ["transaction", 'to_other(release,"aaaa",old,new)']

        test_cases = [
            (columns1, "", ["this", "this", "this", "that", "that"], "to_other_release__aaaa"),
            (columns2, "", ["new", "new", "new", "old", "old"], "to_other_release__aaaa__old_new"),
        ]

        for cols, query, expected, alias in test_cases:
            result = errors.query(
                selected_columns=cols,
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                referrer="test_discover_query",
            )

            data = result["data"]
            assert len(data) == len(expected)
            assert [x[alias] for x in data] == expected

    def test_count_if_function(self):
        for i in range(3):
            data = load_data("javascript", timestamp=before_now(minutes=5))
            data["release"] = "aaaa"
            self.store_event(data, project_id=self.project.id)

        data = load_data("javascript", timestamp=before_now(minutes=5))
        data["release"] = "bbbb"
        self.store_event(data, project_id=self.project.id)

        data = load_data("javascript", timestamp=before_now(minutes=5))
        data["release"] = "cccc"
        self.store_event(data, project_id=self.project.id)

        columns1 = ["count()", "count_if(release,equals,aaaa)", "count_if(release,notEquals,aaaa)"]
        columns2 = ["count()", "count_if(release,less,bbbb)", "count_if(release,lessOrEquals,bbbb)"]

        test_cases = [
            (
                columns1,
                "",
                {
                    "count": 5,
                    "count_if_release_equals_aaaa": 3,
                    "count_if_release_notEquals_aaaa": 2,
                },
            ),
            (
                columns2,
                "",
                {
                    "count": 5,
                    "count_if_release_less_bbbb": 3,
                    "count_if_release_lessOrEquals_bbbb": 4,
                },
            ),
        ]

        for cols, query, expected in test_cases:
            result = errors.query(
                selected_columns=cols,
                query=query,
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[self.project],
                ),
                referrer="test_discover_query",
            )

            data = result["data"]
            assert len(data) == 1
            assert data[0] == expected

    def test_count_if_function_with_unicode(self):
        unicode_phrase1 = "\u716e\u6211\u66f4\u591a\u7684\u98df\u7269\uff0c\u6211\u9913\u4e86"
        unicode_phrase2 = "\u53cd\u6b63\u611b\u60c5\u4e0d\u5c31\u90a3\u6837"
        for i in range(3):
            data = load_data("javascript", timestamp=before_now(minutes=5))
            data["release"] = unicode_phrase1
            self.store_event(data, project_id=self.project.id)

        data = load_data("javascript", timestamp=before_now(minutes=5))
        data["release"] = unicode_phrase2
        self.store_event(data, project_id=self.project.id)

        columns1 = [
            "count()",
            f"count_if(release,equals,{unicode_phrase1})",
            f"count_if(release,notEquals,{unicode_phrase1})",
        ]

        test_cases = [
            (
                columns1,
                "",
                {
                    "count": 4,
                    "count_if_release_equals__u716e_u6211_u66f4_u591a_u7684_u98df_u7269_uff0c_u6211_u9913_u4e86": 3,
                    "count_if_release_notEquals__u716e_u6211_u66f4_u591a_u7684_u98df_u7269_uff0c_u6211_u9913_u4e86": 1,
                },
            ),
        ]

        for cols, query, expected in test_cases:
            result = errors.query(
                selected_columns=cols,
                query=query,
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[self.project],
                ),
                referrer="test_discover_query",
            )

            data = result["data"]
            assert len(data) == 1
            assert data[0] == expected

    def test_last_seen(self):
        project = self.create_project()

        expected_timestamp = before_now(minutes=3)
        string_condition_timestamp = before_now(minutes=4).strftime("%Y-%m-%dT%H:%M:%S+00:00")

        data = load_data("javascript", timestamp=expected_timestamp)
        data["transaction"] = "/last_seen"
        self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("javascript", timestamp=before_now(minutes=i + 4))
            data["transaction"] = "/last_seen"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            (f"last_seen():>{string_condition_timestamp}", 1, True),
            ("last_seen():>0", 1, False),
        ]

        for query, expected_length, use_aggregate_conditions in queries:
            result = errors.query(
                selected_columns=["transaction", "last_seen()"],
                query=query,
                referrer="errors",
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
            )
            data = result["data"]

            assert len(data) == expected_length
            assert data[0]["last_seen"] == expected_timestamp.strftime("%Y-%m-%dT%H:%M:%S+00:00")

    def test_latest_event(self):
        project = self.create_project()

        expected_timestamp = before_now(minutes=3)
        data = load_data("javascript", timestamp=expected_timestamp)
        data["transaction"] = "/latest_event"
        stored_event = self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("javascript", timestamp=before_now(minutes=i + 4))
            data["transaction"] = "/latest_event"
            self.store_event(data, project_id=project.id)

        result = errors.query(
            selected_columns=["transaction", "latest_event()"],
            query="",
            orderby=["transaction"],
            referrer="errors",
            snuba_params=SnubaParams(
                start=before_now(minutes=10),
                end=before_now(minutes=2),
                projects=[project],
            ),
            use_aggregate_conditions=False,
        )
        data = result["data"]

        assert len(data) == 1
        assert data[0]["latest_event"] == stored_event.event_id

    def test_eps(self):
        project = self.create_project()

        for _ in range(6):
            data = load_data(
                "javascript",
                timestamp=before_now(minutes=3),
            )
            data["transaction"] = "/eps"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            ("eps():>1", 0, True),
            ("eps():>1", 1, False),
            ("eps(10):>0.5", 1, True),
            ("tps():>1", 0, True),
            ("tps():>1", 1, False),
            ("tps(10):>0.5", 1, True),
        ]

        for query, expected_length, use_aggregate_conditions in queries:
            result = errors.query(
                selected_columns=[
                    "transaction",
                    "eps()",
                    "eps(10)",
                    "eps(60)",
                    "tps()",
                    "tps(10)",
                    "tps(60)",
                ],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=4),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
                referrer="errors",
            )
            data = result["data"]

            assert len(data) == expected_length
            if expected_length > 0:
                assert data[0]["eps"] == 0.05
                assert data[0]["eps_10"] == 0.6
                assert data[0]["eps_60"] == 0.1
                assert data[0]["tps"] == 0.05
                assert data[0]["tps_10"] == 0.6
                assert data[0]["tps_60"] == 0.1

    def test_epm(self):
        project = self.create_project()

        for _ in range(6):
            data = load_data(
                "javascript",
                timestamp=before_now(minutes=3),
            )
            data["transaction"] = "/epm"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            ("epm():>3", 0, True),
            ("epm():>3", 1, False),
            ("epm(10):>3", 1, True),
            ("tpm():>3", 0, True),
            ("tpm():>3", 1, False),
            ("tpm(10):>3", 1, True),
        ]

        for query, expected_length, use_aggregate_conditions in queries:
            result = errors.query(
                selected_columns=[
                    "transaction",
                    "epm()",
                    "epm(10)",
                    "epm(60)",
                    "tpm()",
                    "tpm(10)",
                    "tpm(60)",
                ],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=4),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
                referrer="errors",
            )
            data = result["data"]

            assert len(data) == expected_length
            if expected_length > 0:
                assert data[0]["epm"] == 3
                assert data[0]["epm_10"] == 36.0
                assert data[0]["epm_60"] == 6
                assert data[0]["tpm"] == 3
                assert data[0]["tpm_10"] == 36.0
                assert data[0]["tpm_60"] == 6

    def test_error_handled_alias(self):
        data = load_data("android-ndk", timestamp=before_now(minutes=10))
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "is handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            data["event_id"] = event[0]
            data["logentry"] = {"formatted": event[1]}
            data["exception"]["values"][0]["value"] = event[1]
            data["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            self.store_event(data=data, project_id=self.project.id)

        queries: list[tuple[str, list[int]]] = [
            ("", [0, 1, 1]),
            ("error.handled:true", [1, 1]),
            ("!error.handled:true", [0]),
            ("has:error.handled", [1, 1]),
            ("has:error.handled error.handled:true", [1, 1]),
            ("error.handled:false", [0]),
            ("has:error.handled error.handled:false", []),
        ]

        for query, expected_data in queries:
            result = errors.query(
                selected_columns=["error.handled"],
                query=query,
                snuba_params=SnubaParams(
                    organization=self.organization,
                    projects=[self.project],
                    start=before_now(minutes=12),
                    end=before_now(minutes=8),
                ),
                referrer="errors",
            )

            data = result["data"]
            data = sorted(data, key=lambda k: (k["error.handled"] is None, k["error.handled"]))

            assert len(data) == len(expected_data)
            assert [item["error.handled"] for item in data] == expected_data

    def test_error_unhandled_alias(self):
        data = load_data("android-ndk", timestamp=before_now(minutes=10))
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "is handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            data["event_id"] = event[0]
            data["logentry"] = {"formatted": event[1]}
            data["exception"]["values"][0]["value"] = event[1]
            data["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            self.store_event(data=data, project_id=self.project.id)

        queries: list[tuple[str, list[str], list[int]]] = [
            ("error.unhandled:true", ["a" * 32], [1]),
            ("!error.unhandled:true", ["b" * 32, "c" * 32], [0, 0]),
            ("has:error.unhandled", ["a" * 32], [1]),
            ("!has:error.unhandled", ["b" * 32, "c" * 32], [0, 0]),
            ("has:error.unhandled error.unhandled:true", ["a" * 32], [1]),
            ("error.unhandled:false", ["b" * 32, "c" * 32], [0, 0]),
            ("has:error.unhandled error.unhandled:false", [], []),
        ]

        for query, expected_events, error_handled in queries:
            result = errors.query(
                selected_columns=["error.unhandled"],
                query=query,
                snuba_params=SnubaParams(
                    organization=self.organization,
                    projects=[self.project],
                    start=before_now(minutes=12),
                    end=before_now(minutes=8),
                ),
                referrer="errors",
            )
            data = result["data"]

            assert len(data) == len(expected_events)
            assert [item["error.unhandled"] for item in data] == error_handled

    def test_array_fields(self):
        data = load_data("javascript")
        data["timestamp"] = before_now(minutes=10).isoformat()
        self.store_event(data=data, project_id=self.project.id)

        expected_filenames = [
            "../../sentry/scripts/views.js",
            "../../sentry/scripts/views.js",
            "../../sentry/scripts/views.js",
            "raven.js",
        ]

        queries = [
            ("", 1),
            ("stack.filename:*.js", 1),
            ("stack.filename:*.py", 0),
            ("has:stack.filename", 1),
            ("!has:stack.filename", 0),
        ]

        for query, expected_len in queries:
            result = errors.query(
                selected_columns=["stack.filename"],
                query=query,
                snuba_params=SnubaParams(
                    organization=self.organization,
                    projects=[self.project],
                    start=before_now(minutes=12),
                    end=before_now(minutes=8),
                ),
                referrer="errors",
            )

            data = result["data"]
            assert len(data) == expected_len
            if len(data) == 0:
                continue
            assert len(data[0]["stack.filename"]) == len(expected_filenames)
            assert sorted(data[0]["stack.filename"]) == expected_filenames

        result = errors.query(
            selected_columns=["stack.filename"],
            query="stack.filename:[raven.js]",
            referrer="errors",
            snuba_params=SnubaParams(
                organization=self.organization,
                projects=[self.project],
                start=before_now(minutes=12),
                end=before_now(minutes=8),
            ),
        )

        data = result["data"]
        assert len(data) == 1
        assert len(data[0]["stack.filename"]) == len(expected_filenames)
        assert sorted(data[0]["stack.filename"]) == expected_filenames

    def test_orderby_field_alias(self):
        data = load_data("android-ndk", timestamp=before_now(minutes=10))
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "is handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            data["event_id"] = event[0]
            data["transaction"] = event[0]
            data["logentry"] = {"formatted": event[1]}
            data["exception"]["values"][0]["value"] = event[1]
            data["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            self.store_event(data=data, project_id=self.project.id)

        queries = [
            (["error.unhandled"], [0, 0, 1]),
            (["error.unhandled"], [0, 0, 1]),
            (["-error.unhandled"], [1, 0, 0]),
            (["-error.unhandled"], [1, 0, 0]),
        ]

        for orderby, expected in queries:
            result = errors.query(
                selected_columns=["transaction", "error.unhandled"],
                query="",
                orderby=orderby,
                snuba_params=SnubaParams(
                    organization=self.organization,
                    projects=[self.project],
                    start=before_now(minutes=12),
                    end=before_now(minutes=8),
                ),
                referrer="errors",
            )

            data = result["data"]
            assert [x["error.unhandled"] for x in data] == expected

    def test_orderby_aggregate_function(self):
        project = self.create_project()

        data = load_data("javascript", timestamp=before_now(minutes=5))
        data["transaction"] = "/count/1"
        self.store_event(data, project_id=project.id)

        data = load_data("javascript", timestamp=before_now(minutes=5))
        data["transaction"] = "/count/2"
        self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("javascript", timestamp=before_now(minutes=5))
            data["transaction"] = f"/count/{i}"
            self.store_event(data, project_id=project.id)

        data = load_data("javascript", timestamp=before_now(minutes=5))
        data["transaction"] = "/count/1"
        self.store_event(data, project_id=project.id)

        orderbys = [
            (["count"], [1, 1, 1, 1, 2, 3]),
            (["-count"], [3, 2, 1, 1, 1, 1]),
            (["count()"], [1, 1, 1, 1, 2, 3]),
            (["-count()"], [3, 2, 1, 1, 1, 1]),
        ]

        for orderby, expected in orderbys:
            result = errors.query(
                selected_columns=["transaction", "count()"],
                query="",
                orderby=orderby,
                snuba_params=SnubaParams(
                    projects=[project],
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                ),
                referrer="errors",
            )
            data = result["data"]
            assert [x["count"] for x in data] == expected

    def test_field_aliasing_in_selected_columns(self):
        result = errors.query(
            selected_columns=["project.id", "user", "release", "timestamp.to_hour"],
            query="",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user"] == "id:99"
        assert data[0]["release"] == "first-release"

        event_hour = self.event_time.replace(minute=0, second=0, microsecond=0)
        assert data[0]["timestamp.to_hour"] == event_hour.isoformat()

        assert len(result["meta"]["fields"]) == 4
        assert result["meta"]["fields"] == {
            "project.id": "integer",
            "user": "string",
            "release": "string",
            "timestamp.to_hour": "date",
        }

    def test_field_alias_with_component(self):
        result = errors.query(
            selected_columns=["project.id", "user", "user.email"],
            query="",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user"] == "id:99"
        assert data[0]["user.email"] == "bruce@example.com"

        assert len(result["meta"]["fields"]) == 3
        assert result["meta"]["fields"] == {
            "project.id": "integer",
            "user": "string",
            "user.email": "string",
        }

    def test_field_aliasing_in_aggregate_functions_and_groupby(self):
        result = errors.query(
            selected_columns=["project.id", "count_unique(user.email)"],
            query="",
            snuba_params=self.snuba_params,
            auto_fields=True,
            referrer="errors",
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["count_unique_user_email"] == 1

    def test_field_aliasing_in_conditions(self):
        result = errors.query(
            selected_columns=["project.id", "user.email"],
            query="user.email:bruce@example.com",
            snuba_params=self.snuba_params,
            referrer="errors",
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "bruce@example.com"

    def test_auto_fields_simple_fields(self):
        result = errors.query(
            selected_columns=["user.email", "release"],
            referrer="errors",
            query="",
            snuba_params=self.snuba_params,
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["id"] == self.event.event_id
        assert data[0]["user.email"] == "bruce@example.com"
        assert data[0]["release"] == "first-release"
        assert data[0]["project.name"] == self.project.slug

        assert len(result["meta"]["fields"]) == 4
        assert result["meta"]["fields"] == {
            "user.email": "string",
            "release": "string",
            "id": "string",
            "project.name": "string",
        }

    def test_auto_fields_aggregates(self):
        result = errors.query(
            selected_columns=["count_unique(user.email)"],
            referrer="errors",
            query="",
            snuba_params=self.snuba_params,
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["count_unique_user_email"] == 1

    def test_release_condition(self):
        result = errors.query(
            selected_columns=["id", "message"],
            query=f"release:{self.create_release(self.project).version}",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert len(result["data"]) == 0

        result = errors.query(
            selected_columns=["id", "message"],
            query=f"release:{self.release.version}",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == self.event.message
        assert "event_id" not in data[0]

    def test_semver_condition(self):
        release_1 = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        release_3 = self.create_release(version="test@1.2.5")

        release_1_e_1 = self.store_event(
            data={"release": release_1.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id
        release_2_e_2 = self.store_event(
            data={"release": release_2.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id
        release_3_e_1 = self.store_event(
            data={"release": release_3.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id
        release_3_e_2 = self.store_event(
            data={"release": release_3.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id

        result = errors.query(
            selected_columns=["id"],
            query=f"{SEMVER_ALIAS}:>1.2.3",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }
        result = errors.query(
            selected_columns=["id"],
            query=f"{SEMVER_ALIAS}:>=1.2.3",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {
            release_1_e_1,
            release_1_e_2,
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }
        result = errors.query(
            selected_columns=["id"],
            query=f"{SEMVER_ALIAS}:<1.2.4",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {release_1_e_1, release_1_e_2}
        result = errors.query(
            selected_columns=["id"],
            query=f"!{SEMVER_ALIAS}:1.2.3",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {
            self.event.event_id,
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }

    def test_release_stage_condition(self):
        replaced_release = self.create_release(
            version="replaced_release",
            environments=[self.environment],
            adopted=timezone.now(),
            unadopted=timezone.now(),
        )
        adopted_release = self.create_release(
            version="adopted_release",
            environments=[self.environment],
            adopted=timezone.now(),
        )
        self.create_release(version="not_adopted_release", environments=[self.environment])

        adopted_release_e_1 = self.store_event(
            data={
                "release": adopted_release.version,
                "environment": self.environment.name,
                "timestamp": self.one_min_ago.isoformat(),
            },
            project_id=self.project.id,
        ).event_id
        adopted_release_e_2 = self.store_event(
            data={
                "release": adopted_release.version,
                "environment": self.environment.name,
                "timestamp": self.one_min_ago.isoformat(),
            },
            project_id=self.project.id,
        ).event_id
        replaced_release_e_1 = self.store_event(
            data={
                "release": replaced_release.version,
                "environment": self.environment.name,
                "timestamp": self.one_min_ago.isoformat(),
            },
            project_id=self.project.id,
        ).event_id
        replaced_release_e_2 = self.store_event(
            data={
                "release": replaced_release.version,
                "environment": self.environment.name,
                "timestamp": self.one_min_ago.isoformat(),
            },
            project_id=self.project.id,
        ).event_id

        self.snuba_params.environments = [self.environment]

        result = errors.query(
            selected_columns=["id"],
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED.value}",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
        }

        result = errors.query(
            selected_columns=["id"],
            query=f"!{RELEASE_STAGE_ALIAS}:{ReleaseStages.LOW_ADOPTION.value}",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
            replaced_release_e_1,
            replaced_release_e_2,
        }
        result = errors.query(
            selected_columns=["id"],
            query=f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED.value}, {ReleaseStages.REPLACED.value}]",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
            replaced_release_e_1,
            replaced_release_e_2,
        }

    def test_semver_package_condition(self):
        release_1 = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test2@1.2.4")

        release_1_e_1 = self.store_event(
            data={"release": release_1.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id

        result = errors.query(
            selected_columns=["id"],
            referrer="errors",
            query=f"{SEMVER_PACKAGE_ALIAS}:test",
            snuba_params=self.snuba_params,
        )
        assert {r["id"] for r in result["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }
        result = errors.query(
            selected_columns=["id"],
            query=f"{SEMVER_PACKAGE_ALIAS}:test2",
            referrer="errors",
            snuba_params=self.snuba_params,
        )
        assert {r["id"] for r in result["data"]} == {
            release_2_e_1,
        }

    def test_semver_build_condition(self):
        release_1 = self.create_release(version="test@1.2.3+123")
        release_2 = self.create_release(version="test2@1.2.4+124")

        release_1_e_1 = self.store_event(
            data={"release": release_1.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        ).event_id

        result = errors.query(
            selected_columns=["id"],
            query=f"{SEMVER_BUILD_ALIAS}:123",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }
        result = errors.query(
            selected_columns=["id"],
            query=f"{SEMVER_BUILD_ALIAS}:124",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {
            release_2_e_1,
        }
        result = errors.query(
            selected_columns=["id"],
            query=f"{SEMVER_BUILD_ALIAS}:>=123",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert {r["id"] for r in result["data"]} == {release_1_e_1, release_1_e_2, release_2_e_1}

    def test_latest_release_condition(self):
        result = errors.query(
            selected_columns=["id", "message"],
            query="release:latest",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == self.event.message
        assert "event_id" not in data[0]

    def test_environment_condition(self):
        result = errors.query(
            selected_columns=["id", "message"],
            query=f"environment:{self.create_environment(self.project).name}",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert len(result["data"]) == 0

        result = errors.query(
            selected_columns=["id", "message"],
            query=f"environment:{self.environment.name}",
            snuba_params=self.snuba_params,
            referrer="errors",
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == self.event.message

    def test_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        self.store_event(
            data={"message": "aaaaa", "timestamp": self.one_min_ago.isoformat()},
            project_id=project2.id,
        )
        self.store_event(
            data={"message": "bbbbb", "timestamp": self.one_min_ago.isoformat()},
            project_id=project3.id,
        )

        result = errors.query(
            selected_columns=["project", "message"],
            query=f"project:{self.project.slug} OR project:{project2.slug}",
            snuba_params=SnubaParams(
                projects=[self.project, project2],
                start=self.two_min_ago,
                end=self.now,
            ),
            orderby=["message"],
            referrer="errors",
        )

        data = result["data"]
        assert len(data) == 2
        assert data[0]["project"] == project2.slug
        assert data[1]["project"] == self.project.slug

    def test_nested_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        self.store_event(
            data={"release": "a" * 32, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "b" * 32, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "c" * 32, "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "a" * 32, "timestamp": self.one_min_ago.isoformat()},
            project_id=project2.id,
        )

        result = errors.query(
            selected_columns=["release"],
            query="(release:{} OR release:{}) AND project:{}".format(
                "a" * 32, "b" * 32, self.project.slug
            ),
            snuba_params=SnubaParams(
                projects=[self.project, project2],
                start=self.two_min_ago,
                end=self.now,
            ),
            orderby=["release"],
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 2
        assert data[0]["release"] == "a" * 32
        assert data[1]["release"] == "b" * 32

    def test_conditions_with_special_columns(self):
        for val in ["a", "b", "c"]:
            data = load_data("javascript")
            data["timestamp"] = self.one_min_ago.isoformat()
            data["transaction"] = val * 32
            data["logentry"] = {"formatted": val * 32}
            data["tags"] = {"sub_customer.is-Enterprise-42": val * 32}
            self.store_event(data=data, project_id=self.project.id)

        result = errors.query(
            selected_columns=["transaction", "message"],
            query="event.type:error (transaction:{}* OR message:{}*)".format("a" * 32, "b" * 32),
            snuba_params=SnubaParams(
                projects=[self.project],
                start=self.two_min_ago,
                end=self.now,
            ),
            orderby=["transaction"],
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 2
        assert data[0]["transaction"] == "a" * 32
        assert data[1]["transaction"] == "b" * 32

        result = errors.query(
            selected_columns=["transaction", "sub_customer.is-Enterprise-42"],
            query="event.type:error (transaction:{} AND sub_customer.is-Enterprise-42:{})".format(
                "a" * 32, "a" * 32
            ),
            snuba_params=SnubaParams(
                projects=[self.project],
                start=self.two_min_ago,
                end=self.now,
            ),
            orderby=["transaction"],
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["transaction"] == "a" * 32
        assert data[0]["sub_customer.is-Enterprise-42"] == "a" * 32

    def test_conditions_with_nested_aggregates(self):
        events = [("a", 2), ("b", 3), ("c", 4)]
        for ev in events:
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("javascript")
                data["timestamp"] = self.one_min_ago.isoformat()
                data["transaction"] = f"{val}-{i}"
                data["logentry"] = {"formatted": val}
                data["tags"] = {"trek": val}
                self.store_event(data=data, project_id=self.project.id)

        result = errors.query(
            selected_columns=["trek", "count()"],
            query="(event.type:error AND (trek:{} AND (transaction:*{}* AND count():>2)))".format(
                "b" * 32, "b" * 32
            ),
            snuba_params=SnubaParams(
                projects=[self.project],
                start=self.two_min_ago,
                end=self.now,
            ),
            orderby=["trek"],
            use_aggregate_conditions=True,
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["trek"] == "b" * 32
        assert data[0]["count"] == 3

        with pytest.raises(InvalidSearchQuery) as err:
            errors.query(
                selected_columns=["trek", "transaction"],
                query="(event.type:error AND (trek:{} AND (transaction:*{}* AND count():>2)))".format(
                    "b" * 32, "b" * 32
                ),
                referrer="discover",
                snuba_params=SnubaParams(
                    projects=[self.project],
                    start=self.two_min_ago,
                    end=self.now,
                ),
                orderby=["trek"],
                use_aggregate_conditions=True,
            )
        assert "used in a condition but is not a selected column" in str(err)

    def test_conditions_with_timestamps(self):
        events = [("a", 1), ("b", 2), ("c", 3)]
        for t, ev in enumerate(events):
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("javascript", timestamp=self.now - timedelta(seconds=3 * t + 1))
                data["transaction"] = f"{val}"
                self.store_event(data=data, project_id=self.project.id)

        results = errors.query(
            selected_columns=["transaction", "count()"],
            query="event.type:error AND (timestamp:<{} OR timestamp:>{})".format(
                (self.now - timedelta(seconds=5)).isoformat(),
                (self.now - timedelta(seconds=3)).isoformat(),
            ),
            snuba_params=SnubaParams(
                projects=[self.project],
                start=self.two_min_ago,
                end=self.now,
            ),
            orderby=["transaction"],
            use_aggregate_conditions=True,
            referrer="discover",
        )

        data = results["data"]
        assert len(data) == 2
        assert data[0]["transaction"] == "a" * 32
        assert data[0]["count"] == 1
        assert data[1]["transaction"] == "c" * 32
        assert data[1]["count"] == 3

    def test_timestamp_rollup_filter(self):
        event_hour = self.event_time.replace(minute=0, second=0)
        result = errors.query(
            selected_columns=["project.id", "user", "release"],
            query="timestamp.to_hour:" + event_hour.isoformat(),
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user"] == "id:99"
        assert data[0]["release"] == "first-release"

        assert len(result["meta"]["fields"]) == 3
        assert result["meta"]["fields"] == {
            "project.id": "integer",
            "user": "string",
            "release": "string",
        }

    def test_count_with_or(self):
        data = load_data("javascript", timestamp=before_now(seconds=3))
        data["transaction"] = "a" * 32
        self.store_event(data=data, project_id=self.project.id)

        results = errors.query(
            selected_columns=["transaction", "count()"],
            query="event.type:error AND (count():<1 OR count():>0)",
            snuba_params=self.snuba_params,
            orderby=["transaction"],
            use_aggregate_conditions=True,
            referrer="discover",
        )

        data = results["data"]
        assert len(data) == 1
        assert data[0]["transaction"] == "a" * 32
        assert data[0]["count"] == 1

    def test_access_to_private_functions(self):
        # using private functions directly without access should error
        with pytest.raises(InvalidSearchQuery, match="array_join: no access to private function"):
            errors.query(
                selected_columns=["array_join(tags.key)"],
                query="",
                snuba_params=SnubaParams(
                    projects=[self.project],
                    start=self.two_min_ago,
                    end=self.now,
                ),
                referrer="discover",
            )

        # using private functions in an aggregation without access should error
        with pytest.raises(InvalidSearchQuery, match="histogram: no access to private function"):
            for array_column in ARRAY_COLUMNS:
                errors.query(
                    selected_columns=[f"histogram({array_column}_value, 1,0,1)"],
                    query=f"histogram({array_column}_value, 1,0,1):>0",
                    snuba_params=SnubaParams(
                        projects=[self.project],
                        start=self.two_min_ago,
                        end=self.now,
                    ),
                    use_aggregate_conditions=True,
                    referrer="discover",
                )

        # using private functions in an aggregation without access should error
        # with auto aggregation on
        with pytest.raises(InvalidSearchQuery, match="histogram: no access to private function"):
            for array_column in ARRAY_COLUMNS:
                errors.query(
                    selected_columns=["count()"],
                    query=f"histogram({array_column}_value, 1,0,1):>0",
                    snuba_params=SnubaParams(
                        projects=[self.project],
                        start=self.two_min_ago,
                        end=self.now,
                    ),
                    referrer="discover",
                    auto_aggregations=True,
                    use_aggregate_conditions=True,
                )

    def test_any_function(self):
        data = load_data("javascript", timestamp=before_now(seconds=3))
        data["transaction"] = "a" * 32
        self.store_event(data=data, project_id=self.project.id)

        results = errors.query(
            selected_columns=["count()", "any(transaction)", "any(user.id)"],
            query="transaction:{}".format("a" * 32),
            snuba_params=SnubaParams(
                projects=[self.project],
                start=before_now(minutes=5),
                end=before_now(seconds=1),
            ),
            referrer="discover",
            use_aggregate_conditions=True,
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0]["any_transaction"] == "a" * 32
        assert data[0]["any_user_id"] == "1"
        assert data[0]["count"] == 1

    def test_offsets(self):
        self.store_event(
            data={"message": "hello1", "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        )
        self.store_event(
            data={"message": "hello2", "timestamp": self.one_min_ago.isoformat()},
            project_id=self.project.id,
        )

        result = errors.query(
            selected_columns=["message"],
            query="",
            snuba_params=self.snuba_params,
            orderby=["message"],
            limit=1,
            offset=1,
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 1
        # because we're ording by `message`, and offset by 1, the message should be `hello2`
        assert data[0]["message"] == "hello2"


class ErrorsArithmeticTest(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.now = before_now()
        event_data = load_data("javascript")
        event_data["timestamp"] = (self.day_ago + timedelta(minutes=30, seconds=3)).isoformat()
        self.store_event(data=event_data, project_id=self.project.id)
        self.snuba_params = SnubaParams(
            projects=[self.project],
            start=self.day_ago,
            end=self.now,
        )
        self.query = ""

    def test_simple(self):
        results = errors.query(
            selected_columns=[
                "count()",
            ],
            equations=["count() + 100"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert result["equation[0]"] == 101
