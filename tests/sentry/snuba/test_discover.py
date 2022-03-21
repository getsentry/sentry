from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.discover.arithmetic import ArithmeticValidationError
from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import InvalidSearchQuery
from sentry.models import ProjectTeam, ProjectTransactionThreshold, ReleaseStages
from sentry.models.transaction_threshold import (
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.search.events.constants import (
    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.snuba import discover
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data
from sentry.utils.snuba import Dataset, get_array_column_alias

ARRAY_COLUMNS = ["measurements", "span_op_breakdowns"]


class QueryIntegrationTest(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.environment = self.create_environment(self.project, name="prod")
        self.release = self.create_release(self.project, version="first-release")
        self.now = before_now().replace(tzinfo=timezone.utc)
        self.one_min_ago = before_now(minutes=1).replace(tzinfo=timezone.utc)
        self.two_min_ago = before_now(minutes=2).replace(tzinfo=timezone.utc)

        self.event_time = self.one_min_ago
        self.event = self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(self.event_time),
                "tags": [["key1", "value1"]],
            },
            project_id=self.project.id,
        )

    def test_project_mapping(self):
        other_project = self.create_project(organization=self.organization)
        self.store_event(
            data={"message": "hello", "timestamp": iso_format(self.one_min_ago)},
            project_id=other_project.id,
        )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["project", "message"],
                query="",
                params={
                    "project_id": [other_project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="project",
                use_snql=use_snql,
            )

            data = result["data"]
            assert len(data) == 1, use_snql
            assert data[0]["project"] == other_project.slug, use_snql

    def test_sorting_project_name(self):
        project_ids = []
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            project_ids.append(other_project.id)
            self.store_event(
                data={"message": "ohh no", "timestamp": iso_format(self.one_min_ago)},
                project_id=other_project.id,
            )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["project", "message"],
                query="",
                params={
                    "project_id": project_ids,
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="project",
                use_snql=use_snql,
            )
            data = result["data"]
            assert len(data) == 3, use_snql
            assert [item["project"] for item in data] == ["a" * 32, "m" * 32, "z" * 32], use_snql

    def test_reverse_sorting_project_name(self):
        project_ids = []
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            project_ids.append(other_project.id)
            self.store_event(
                data={"message": "ohh no", "timestamp": iso_format(self.one_min_ago)},
                project_id=other_project.id,
            )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["project", "message"],
                query="",
                params={
                    "project_id": project_ids,
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="-project",
                use_snql=use_snql,
            )
            data = result["data"]
            assert len(data) == 3, use_snql
            assert [item["project"] for item in data] == ["z" * 32, "m" * 32, "a" * 32], use_snql

    def test_using_project_and_project_name(self):
        project_ids = []
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            project_ids.append(other_project.id)
            self.store_event(
                data={"message": "ohh no", "timestamp": iso_format(self.one_min_ago)},
                project_id=other_project.id,
            )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["project.name", "message", "project"],
                query="",
                params={
                    "project_id": project_ids,
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="project.name",
                use_snql=use_snql,
            )
            data = result["data"]
            assert len(data) == 3, use_snql
            assert [item["project.name"] for item in data] == [
                "a" * 32,
                "m" * 32,
                "z" * 32,
            ], use_snql

    def test_missing_project(self):
        project_ids = []
        other_project = None
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            project_ids.append(other_project.id)
            self.store_event(
                data={"message": "ohh no", "timestamp": iso_format(self.one_min_ago)},
                project_id=other_project.id,
            )

        # delete the last project so its missing
        if other_project is not None:
            other_project.delete()

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["message", "project"],
                query="",
                params={
                    "project_id": project_ids,
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="project",
            )
            data = result["data"]
            assert len(data) == 3, use_snql
            assert [item["project"] for item in data] == ["", "a" * 32, "z" * 32], use_snql

    def test_issue_short_id_mapping(self):
        tests = [
            ("issue", f"issue:{self.event.group.qualified_short_id}"),
            ("issue", f"issue.id:{self.event.group_id}"),
            ("issue.id", f"issue:{self.event.group.qualified_short_id}"),
            ("issue.id", f"issue.id:{self.event.group_id}"),
        ]

        for use_snql in [False, True]:
            for column, query in tests:
                result = discover.query(
                    selected_columns=[column],
                    query=query,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                )
                data = result["data"]
                assert len(data) == 1, use_snql
                # The query will translate `issue` into `issue.id`. Additional post processing
                # is required to insert the `issue` column.
                assert [item["issue.id"] for item in data] == [self.event.group_id], use_snql

    def test_issue_filters(self):
        tests = [
            "has:issue",
            "has:issue.id",
            f"issue:[{self.event.group.qualified_short_id}]",
            f"issue.id:[{self.event.group_id}]",
        ]

        for use_snql in [False, True]:
            for query in tests:
                result = discover.query(
                    selected_columns=["issue", "issue.id"],
                    query=query,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                    use_snql=use_snql,
                )
                data = result["data"]
                assert len(data) == 1, use_snql
                # The query will translate `issue` into `issue.id`. Additional post processing
                # is required to insert the `issue` column.
                assert [item["issue.id"] for item in data] == [self.event.group_id], use_snql

    def test_tags_orderby(self):
        self.event = self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(self.event_time),
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

        for use_snql in [False, True]:
            for column, orderby, expected in tests:
                result = discover.query(
                    selected_columns=[column],
                    query="",
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                    orderby=orderby,
                    use_snql=use_snql,
                )
                data = result["data"]
                assert len(data) == len(expected), use_snql
                assert [item[column] for item in data] == expected, use_snql

    def test_tags_filter(self):
        self.event = self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(self.event_time),
                "tags": [["key1", "value2"]],
            },
            project_id=self.project.id,
        )

        tests = [
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

        for use_snql in [False, True]:
            for column, query, expected in tests:
                result = discover.query(
                    selected_columns=[column],
                    query=query,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                    orderby=column,
                    use_snql=use_snql,
                )
                data = result["data"]
                assert len(data) == len(expected), (use_snql, column, query, expected)
                assert [item[column] for item in data] == expected, use_snql

    def test_tags_colliding_with_fields(self):
        event = self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(self.event_time),
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

        for use_snql in [False, True]:
            for column, query, expected in tests:
                result = discover.query(
                    selected_columns=[column],
                    query=query,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                    orderby=column,
                    use_snql=use_snql,
                )
                data = result["data"]
                assert len(data) == len(expected), (use_snql, query, expected)
                assert [item[column] for item in data] == expected, use_snql

    def test_reverse_sorting_issue(self):
        other_event = self.store_event(
            data={
                "message": "whoopsies",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(self.event_time),
            },
            project_id=self.project.id,
        )

        tests = [
            # issue is not sortable
            # "issue",
            "issue.id",
        ]

        for use_snql in [False, True]:
            for column in tests:
                for direction in ["", "-"]:
                    result = discover.query(
                        selected_columns=[column],
                        query="",
                        params={
                            "organization_id": self.organization.id,
                            "project_id": [self.project.id],
                            "start": self.two_min_ago,
                            "end": self.now,
                        },
                        orderby=f"{direction}{column}",
                        use_snql=use_snql,
                    )
                    data = result["data"]
                    assert len(data) == 2, use_snql
                    expected = [self.event.group_id, other_event.group_id]
                    if direction == "-":
                        expected.reverse()
                    assert [item["issue.id"] for item in data] == expected, use_snql

    def test_timestamp_rounding_fields(self):
        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["timestamp.to_hour", "timestamp.to_day"],
                query="",
                params={
                    "organization_id": self.organization.id,
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                use_snql=use_snql,
            )
            data = result["data"]
            assert len(data) == 1, use_snql

            hour = self.event_time.replace(minute=0, second=0, microsecond=0)
            day = hour.replace(hour=0)
            assert [item["timestamp.to_hour"] for item in data] == [
                f"{iso_format(hour)}+00:00"
            ], use_snql
            assert [item["timestamp.to_day"] for item in data] == [
                f"{iso_format(day)}+00:00"
            ], use_snql

    def test_timestamp_rounding_filters(self):
        one_day_ago = before_now(days=1).replace(tzinfo=timezone.utc)
        two_day_ago = before_now(days=2).replace(tzinfo=timezone.utc)
        three_day_ago = before_now(days=3).replace(tzinfo=timezone.utc)

        self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(two_day_ago),
            },
            project_id=self.project.id,
        )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["timestamp.to_hour", "timestamp.to_day"],
                query=f"timestamp.to_hour:<{iso_format(one_day_ago)} timestamp.to_day:<{iso_format(one_day_ago)}",
                params={
                    "organization_id": self.organization.id,
                    "project_id": [self.project.id],
                    "start": three_day_ago,
                    "end": self.now,
                },
                use_snql=use_snql,
            )
            data = result["data"]
            assert len(data) == 1, use_snql

            hour = two_day_ago.replace(minute=0, second=0, microsecond=0)
            day = hour.replace(hour=0)
            assert [item["timestamp.to_hour"] for item in data] == [
                f"{iso_format(hour)}+00:00"
            ], use_snql
            assert [item["timestamp.to_day"] for item in data] == [
                f"{iso_format(day)}+00:00"
            ], use_snql

    def test_user_display(self):
        # `user.display` should give `username`
        self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"username": "brucew", "id": "1234", "ip": "127.0.0.1"},
                "timestamp": iso_format(self.event_time),
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
                "timestamp": iso_format(self.event_time),
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
                "timestamp": iso_format(self.event_time),
            },
            project_id=self.project.id,
        )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["user.display"],
                query="",
                params={
                    "organization_id": self.organization.id,
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                use_snql=use_snql,
            )
            data = result["data"]
            assert len(data) == 4, use_snql
            assert {item["user.display"] for item in data} == {
                "bruce@example.com",
                "brucew",
                "1234",
                "127.0.0.1",
            }, use_snql

    def test_user_display_filter(self):
        # `user.display` should give `username`
        self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"username": "brucew", "ip": "127.0.0.1"},
                "timestamp": iso_format(self.event_time),
            },
            project_id=self.project.id,
        )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["user.display"],
                query="has:user.display user.display:bruce@example.com",
                params={
                    "organization_id": self.organization.id,
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                use_snql=use_snql,
            )
            data = result["data"]
            assert len(data) == 1, use_snql
            assert [item["user.display"] for item in data] == ["bruce@example.com"], use_snql

    def test_message_orderby(self):
        self.event = self.store_event(
            data={
                "message": "oh yeah",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(self.event_time),
            },
            project_id=self.project.id,
        )

        tests = [
            ("message", ["oh no", "oh yeah"]),
            ("-message", ["oh yeah", "oh no"]),
        ]

        for use_snql in [False, True]:
            for orderby, expected in tests:
                result = discover.query(
                    selected_columns=["message"],
                    query="",
                    params={
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                    orderby=orderby,
                    use_snql=use_snql,
                )

                data = result["data"]
                assert len(data) == 2, use_snql
                assert [item["message"] for item in data] == expected, use_snql

    def test_message_filter(self):
        self.event = self.store_event(
            data={
                "message": "oh yeah",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(self.event_time),
            },
            project_id=self.project.id,
        )

        tests = [
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

        for use_snql in [False, True]:
            for query, expected in tests:
                result = discover.query(
                    selected_columns=["message"],
                    query=query,
                    params={
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                    orderby="message",
                    use_snql=use_snql,
                )

                data = result["data"]
                assert len(data) == len(expected), use_snql
                assert [item["message"] for item in data] == expected, use_snql

    def test_team_key_transactions(self):
        team1 = self.create_team(organization=self.organization, name="Team A")
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.organization, name="Team B")
        self.project.add_team(team2)

        transactions = ["/blah_transaction/"]
        key_transactions = [
            (team1, "/foo_transaction/"),
            (team2, "/zoo_transaction/"),
        ]

        for transaction in transactions:
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(5)),
            )
            data["transaction"] = transaction
            self.store_event(data, project_id=self.project.id)

        for team, transaction in key_transactions:
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(5)),
            )
            data["transaction"] = transaction
            self.store_event(data, project_id=self.project.id)
            TeamKeyTransaction.objects.create(
                organization=self.organization,
                transaction=transaction,
                project_team=ProjectTeam.objects.get(project=self.project, team=team),
            )

        queries = [
            ("", [("/blah_transaction/", 0), ("/foo_transaction/", 1), ("/zoo_transaction/", 1)]),
            ("has:team_key_transaction", [("/foo_transaction/", 1), ("/zoo_transaction/", 1)]),
            ("!has:team_key_transaction", [("/blah_transaction/", 0)]),
            ("team_key_transaction:true", [("/foo_transaction/", 1), ("/zoo_transaction/", 1)]),
            ("team_key_transaction:false", [("/blah_transaction/", 0)]),
        ]

        for use_snql in [False, True]:
            for query, expected_results in queries:
                result = discover.query(
                    selected_columns=["transaction", "team_key_transaction"],
                    query=query,
                    params={
                        "start": before_now(minutes=10),
                        "end": before_now(minutes=2),
                        "project_id": [self.project.id],
                        "organization_id": self.organization.id,
                        "team_id": [team1.id, team2.id],
                    },
                    use_snql=use_snql,
                )

                data = result["data"]
                assert len(data) == len(expected_results), use_snql
                assert [
                    (x["transaction"], x["team_key_transaction"])
                    for x in sorted(data, key=lambda k: k["transaction"])
                ] == expected_results, use_snql

    def test_snql_wip_project_threshold_config(self):
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        project2 = self.create_project()
        ProjectTransactionThreshold.objects.create(
            project=project2,
            organization=project2.organization,
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )

        events = [
            ("a" * 10, 300),
            ("b" * 10, 300),
            ("c" * 10, 3000),
            ("d" * 10, 3000),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(3 + idx)),
                start_timestamp=before_now(minutes=(3 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = event[0]
            self.store_event(data, project_id=self.project.id)

            if idx % 2:
                ProjectTransactionThresholdOverride.objects.create(
                    transaction=event[0],
                    project=self.project,
                    organization=self.organization,
                    threshold=1000,
                    metric=TransactionMetric.DURATION.value,
                )

        data = load_data(
            "transaction", timestamp=before_now(minutes=3), start_timestamp=before_now(minutes=4)
        )
        data["transaction"] = "e" * 10
        self.store_event(data, project_id=project2.id)

        expected_transaction = ["a" * 10, "b" * 10, "c" * 10, "d" * 10, "e" * 10]
        expected_project_threshold_config = [
            ["duration", 100],
            ["duration", 1000],
            ["duration", 100],
            ["duration", 1000],
            ["lcp", 600],
        ]

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["project", "transaction", "project_threshold_config"],
                query="",
                params={
                    "start": before_now(minutes=10),
                    "end": before_now(minutes=2),
                    "project_id": [self.project.id, project2.id],
                    "organization_id": self.organization.id,
                },
                use_snql=use_snql,
            )

            assert len(result["data"]) == 5, use_snql
            sorted_data = sorted(result["data"], key=lambda k: k["transaction"])

            assert [row["transaction"] for row in sorted_data] == expected_transaction, use_snql
            assert [row["project_threshold_config"][0] for row in sorted_data] == [
                r[0] for r in expected_project_threshold_config
            ], use_snql
            assert [row["project_threshold_config"][1] for row in sorted_data] == [
                r[1] for r in expected_project_threshold_config
            ], use_snql

        ProjectTransactionThreshold.objects.filter(
            project=project2,
            organization=project2.organization,
        ).delete()

        expected_transaction = ["e" * 10]
        expected_project_threshold_config = [["duration", 300]]

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["project", "transaction", "project_threshold_config"],
                query="",
                params={
                    "start": before_now(minutes=10),
                    "end": before_now(minutes=2),
                    "project_id": [project2.id],
                    "organization_id": self.organization.id,
                },
                use_snql=use_snql,
            )

            assert len(result["data"]) == 1, use_snql
            sorted_data = sorted(result["data"], key=lambda k: k["transaction"])

            assert [row["transaction"] for row in sorted_data] == expected_transaction, use_snql
            assert [row["project_threshold_config"][0] for row in sorted_data] == [
                r[0] for r in expected_project_threshold_config
            ], use_snql
            assert [row["project_threshold_config"][1] for row in sorted_data] == [
                r[1] for r in expected_project_threshold_config
            ], use_snql

    def test_to_other_function(self):
        project = self.create_project()

        for i in range(3):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["transaction"] = f"/to_other/{i}"
            data["release"] = "aaaa"
            self.store_event(data, project_id=project.id)

        data = load_data("transaction", timestamp=before_now(minutes=5))
        data["transaction"] = "/to_other/y"
        data["release"] = "yyyy"
        self.store_event(data, project_id=project.id)

        data = load_data("transaction", timestamp=before_now(minutes=5))
        data["transaction"] = "/to_other/z"
        data["release"] = "zzzz"
        self.store_event(data, project_id=project.id)

        columns1 = ["transaction", 'to_other(release,"aaaa")']
        columns2 = ["transaction", 'to_other(release,"aaaa",old,new)']

        test_cases = [
            (columns1, "", ["this", "this", "this", "that", "that"], "to_other_release__aaaa"),
            (columns2, "", ["new", "new", "new", "old", "old"], "to_other_release__aaaa__old_new"),
        ]

        for use_snql in [False, True]:
            for cols, query, expected, alias in test_cases:
                result = discover.query(
                    selected_columns=cols,
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=10),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_snql=use_snql,
                )

                data = result["data"]
                assert len(data) == len(expected), use_snql
                assert [x[alias] for x in data] == expected, use_snql

    def test_count_if_function(self):
        for i in range(3):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["release"] = "aaaa"
            self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(minutes=5))
        data["release"] = "bbbb"
        self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(minutes=5))
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

        for use_snql in [False, True]:
            for cols, query, expected in test_cases:
                result = discover.query(
                    selected_columns=cols,
                    query=query,
                    params={
                        "start": before_now(minutes=10),
                        "end": before_now(minutes=2),
                        "project_id": [self.project.id],
                    },
                    use_snql=use_snql,
                )

                data = result["data"]
                assert len(data) == 1, use_snql
                assert data[0] == expected, use_snql

    def test_failure_count_function(self):
        project = self.create_project()

        data = load_data("transaction", timestamp=before_now(minutes=5))
        data["transaction"] = "/failure_count/success"
        self.store_event(data, project_id=project.id)

        data = load_data("transaction", timestamp=before_now(minutes=5))
        data["transaction"] = "/failure_count/unknown"
        data["contexts"]["trace"]["status"] = "unknown_error"
        self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["transaction"] = f"/failure_count/{i}"
            data["contexts"]["trace"]["status"] = "unauthenticated"
            self.store_event(data, project_id=project.id)

        data = load_data("transaction", timestamp=before_now(minutes=5))
        data["transaction"] = "/failure_count/0"
        data["contexts"]["trace"]["status"] = "unauthenticated"
        self.store_event(data, project_id=project.id)

        queries = [
            ("", 8, True),
            ("failure_count():>0", 6, True),
            ("failure_count():>0", 8, False),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=["transaction", "failure_count()"],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=10),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                assert data[0]["failure_count"] == 2, use_snql
                assert data[1]["failure_count"] == 1, use_snql

    def test_apdex_function(self):
        project = self.create_project()

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=project.organization,
            threshold=400,
            metric=TransactionMetric.DURATION.value,
        )

        ProjectTransactionThresholdOverride.objects.create(
            project=project,
            transaction="/apdex/ace",
            organization=project.organization,
            threshold=400,
            metric=TransactionMetric.LCP.value,
        )

        project2 = self.create_project()

        events = [
            ("ace", 400),
            ("ace", 400),
            ("one", 400),
            ("one", 400),
            ("two", 3000),
            ("two", 3000),
            ("three", 300),
            ("three", 3000),
            ("zorp", 300),
            ("zorp", 3000),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(5 + idx)),
                start_timestamp=before_now(minutes=(5 + idx), milliseconds=event[1]),
            )
            data["measurements"]["lcp"]["value"] = 3000
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/apdex/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}

            if event[0] == "zorp":
                self.store_event(data, project_id=project2.id)  # No custom thresholds for project2
            else:
                self.store_event(data, project_id=project.id)

        queries = [
            ("", [0.5, 0.5, 0.25, 0.0, 0.25], ["apdex(100)"], "apdex_100"),
            ("", [0.0, 1.0, 0.5, 0.0, 0.5], ["apdex()"], "apdex"),
            ("apdex(100):<0.5", [0.25, 0.0, 0.25], ["apdex(100)"], "apdex_100"),
            ("apdex():>0", [1.0, 0.5, 0.5], ["apdex()"], "apdex"),
        ]

        for use_snql in [False, True]:
            for query, expected_apdex, col, alias in queries:
                if not use_snql == discover.query:
                    base_cols = ["transaction", "project_threshold_config"]
                else:
                    base_cols = ["transaction"]

                result = discover.query(
                    selected_columns=base_cols + col,
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=30),
                        "end": before_now(minutes=2),
                        "project_id": [project.id, project2.id],
                        "organization_id": self.organization.id,
                    },
                    use_aggregate_conditions=True,
                    use_snql=use_snql,
                )
                data = result["data"]
                assert len(data) == len(expected_apdex), use_snql
                assert [
                    x[alias] for x in sorted(data, key=lambda k: k["transaction"])
                ] == expected_apdex, use_snql

    def test_count_miserable_function(self):
        project = self.create_project()

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=project.organization,
            threshold=400,
            metric=TransactionMetric.DURATION.value,
        )

        ProjectTransactionThresholdOverride.objects.create(
            project=project,
            transaction="/count_miserable/ace",
            organization=project.organization,
            threshold=400,
            metric=TransactionMetric.LCP.value,
        )

        project2 = self.create_project()

        events = [
            ("ace", 400),
            ("ace", 400),
            ("one", 400),
            ("one", 400),
            ("two", 3000),
            ("two", 3000),
            ("three", 300),
            ("three", 3000),
            ("zorp", 300),
            ("zorp", 3000),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(5 + idx)),
                start_timestamp=before_now(minutes=(5 + idx), milliseconds=event[1]),
            )
            data["measurements"]["lcp"]["value"] = 3000
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/count_miserable/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}

            if event[0] == "zorp":
                self.store_event(data, project_id=project2.id)  # No custom thresholds for project2
            else:
                self.store_event(data, project_id=project.id)

        queries = [
            (
                "",
                [0, 0, 1, 2, 1],
                ["count_miserable(user,100)"],
                "count_miserable_user_100",
            ),
            ("", [2, 0, 1, 2, 1], ["count_miserable(user)"], "count_miserable_user"),
            (
                "count_miserable(user,100):<2",
                [0, 0, 1, 1],
                ["count_miserable(user,100)"],
                "count_miserable_user_100",
            ),
            (
                "count_miserable(user):>0",
                [2, 1, 2, 1],
                ["count_miserable(user)"],
                "count_miserable_user",
            ),
        ]

        for use_snql in [False, True]:
            for query, expected_count_miserable, col, alias in queries:
                if not use_snql:
                    base_cols = ["transaction", "project_threshold_config"]
                else:
                    base_cols = ["transaction"]

                result = discover.query(
                    selected_columns=base_cols + col,
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=30),
                        "end": before_now(minutes=2),
                        "project_id": [project.id, project2.id],
                        "organization_id": self.organization.id,
                    },
                    use_aggregate_conditions=True,
                    use_snql=use_snql,
                )

                data = result["data"]
                assert len(data) == len(expected_count_miserable), use_snql
                assert [
                    x[alias] for x in sorted(data, key=lambda k: k["transaction"])
                ] == expected_count_miserable, use_snql

    def test_user_misery_function(self):
        project = self.create_project()

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=project.organization,
            threshold=400,
            metric=TransactionMetric.DURATION.value,
        )

        ProjectTransactionThresholdOverride.objects.create(
            project=project,
            transaction="/user_misery/ace",
            organization=project.organization,
            threshold=400,
            metric=TransactionMetric.LCP.value,
        )

        project2 = self.create_project()

        events = [
            ("ace", 400),
            ("ace", 400),
            ("one", 400),
            ("one", 400),
            ("two", 3000),
            ("two", 3000),
            ("three", 300),
            ("three", 3000),
            ("zorp", 300),
            ("zorp", 3000),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(5 + idx)),
                start_timestamp=before_now(minutes=(5 + idx), milliseconds=event[1]),
            )
            data["measurements"]["lcp"]["value"] = 3000
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/user_misery/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}

            if event[0] == "zorp":
                self.store_event(data, project_id=project2.id)  # No custom thresholds for project2
            else:
                self.store_event(data, project_id=project.id)

        queries = [
            (
                "",
                [0.0492, 0.0492, 0.0575, 0.0659, 0.0575],
                ["user_misery(100)"],
                "user_misery_100",
            ),
            ("", [0.0659, 0.0492, 0.0575, 0.0659, 0.0575], ["user_misery()"], "user_misery"),
            (
                "user_misery(100):<0.06",
                [0.0492, 0.0492, 0.0575, 0.0575],
                ["user_misery(100)"],
                "user_misery_100",
            ),
            (
                "user_misery():>0.05",
                [0.0659, 0.0575, 0.0659, 0.0575],
                ["user_misery()"],
                "user_misery",
            ),
        ]

        similar = lambda a, b: abs(a - b) < 0.001

        for use_snql in [False, True]:
            for query, expected_user_misery, col, alias in queries:
                if not use_snql:
                    base_cols = ["transaction", "project_threshold_config"]
                else:
                    base_cols = ["transaction"]

                result = discover.query(
                    selected_columns=base_cols + col,
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=30),
                        "end": before_now(minutes=2),
                        "project_id": [project.id, project2.id],
                        "organization_id": self.organization.id,
                    },
                    use_aggregate_conditions=True,
                    use_snql=use_snql,
                )

                data = result["data"]
                assert len(data) == len(expected_user_misery), use_snql
                for i, misery in enumerate(sorted(data, key=lambda k: k["transaction"])):
                    assert similar(misery[alias], expected_user_misery[i]), use_snql

    def test_count(self):
        project = self.create_project()

        for i in range(6):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["transaction"] = "/count/6"
            self.store_event(data, project_id=project.id)
        for i in range(8):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["transaction"] = "/count/8"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 2, (6, 8), True),
            ("count():>6", 2, (6, 8), False),
            ("count():>6", 1, (8,), True),
        ]

        for use_snql in [False, True]:
            for query, expected_length, expected_counts, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=["transaction", "count()"],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=10),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                for index, count in enumerate(data):
                    assert count["count"] == expected_counts[index], use_snql

    def test_compare_numeric_aggregate_function(self):
        project = self.create_project()

        for i in range(6):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + i),
            )
            data["transaction"] = "/percentile"
            self.store_event(data, project_id=project.id)

        fields = [
            (
                [
                    "transaction",
                    "p50(measurements.lcp)",
                    "compare_numeric_aggregate(p50_measurements_lcp,greater,2000)",
                ],
                "",
            ),
            (
                [
                    "transaction",
                    "p50(measurements.lcp)",
                    "compare_numeric_aggregate(p50_measurements_lcp,less,2000)",
                ],
                "",
            ),
        ]

        expected_results = [
            ("compare_numeric_aggregate_p50_measurements_lcp_greater_2000", 1),
            ("compare_numeric_aggregate_p50_measurements_lcp_less_2000", 0),
        ]

        for i, test_case in enumerate(fields):
            for use_snql in [False, True]:
                selected, query = test_case
                result = discover.query(
                    selected_columns=selected,
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=10),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=True,
                    use_snql=use_snql,
                )
                alias, expected_value = expected_results[i]
                data = result["data"]

                assert data[0][alias] == expected_value, use_snql

    def test_last_seen(self):
        project = self.create_project()

        expected_timestamp = before_now(minutes=3)
        string_condition_timestamp = before_now(minutes=4).strftime("%Y-%m-%dT%H:%M:%S+00:00")

        data = load_data("transaction", timestamp=expected_timestamp)
        data["transaction"] = "/last_seen"
        self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("transaction", timestamp=before_now(minutes=i + 4))
            data["transaction"] = "/last_seen"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            (f"last_seen():>{string_condition_timestamp}", 1, True),
            ("last_seen():>0", 1, False),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=["transaction", "last_seen()"],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=10),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                assert data[0]["last_seen"] == expected_timestamp.strftime(
                    "%Y-%m-%dT%H:%M:%S+00:00"
                ), use_snql

    def test_latest_event(self):
        project = self.create_project()

        expected_timestamp = before_now(minutes=3)
        data = load_data("transaction", timestamp=expected_timestamp)
        data["transaction"] = "/latest_event"
        stored_event = self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("transaction", timestamp=before_now(minutes=i + 4))
            data["transaction"] = "/latest_event"
            self.store_event(data, project_id=project.id)

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["transaction", "latest_event()"],
                query="",
                orderby="transaction",
                params={
                    "start": before_now(minutes=10),
                    "end": before_now(minutes=2),
                    "project_id": [project.id],
                },
                use_aggregate_conditions=False,
                use_snql=use_snql,
            )
            data = result["data"]

            assert len(data) == 1, use_snql
            assert data[0]["latest_event"] == stored_event.event_id, use_snql

    def test_failure_rate(self):
        project = self.create_project()

        for i in range(6):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["transaction"] = "/failure_rate/over"
            data["contexts"]["trace"]["status"] = "unauthenticated"
            self.store_event(data, project_id=project.id)
        for i in range(4):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["transaction"] = "/failure_rate/over"
            self.store_event(data, project_id=project.id)
        for i in range(7):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["transaction"] = "/failure_rate/under"
            self.store_event(data, project_id=project.id)
        for i in range(3):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["transaction"] = "/failure_rate/under"
            data["contexts"]["trace"]["status"] = "unauthenticated"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 2, True),
            ("failure_rate():>0.5", 1, True),
            ("failure_rate():>0.5", 2, False),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=["transaction", "failure_rate()"],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=10),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                assert data[0]["failure_rate"] == 0.6, use_snql
                if expected_length > 1:
                    assert data[1]["failure_rate"] == 0.3, use_snql

    def test_percentile(self):
        project = self.create_project()

        for i in range(6):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + i),
            )
            data["transaction"] = "/percentile"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            ("percentile(transaction.duration, 0.7):>0", 1, False),
            ("percentile(transaction.duration, 0.7):>500000", 0, True),
            ("percentile(transaction.duration, 0.7):>100000", 1, True),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=[
                        "transaction",
                        "percentile(transaction.duration, 0.7)",
                        "percentile(transaction.duration, 0.5)",
                    ],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=20),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                if expected_length > 0:
                    assert round(data[0]["percentile_transaction_duration_0_7"]) == 270000, use_snql
                    assert round(data[0]["percentile_transaction_duration_0_5"]) == 210000, use_snql

    def test_p50(self):
        project = self.create_project()

        for i in range(6):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + i),
            )
            data["transaction"] = "/p50"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            ("p50(transaction.duration):>0", 1, False),
            ("p50(transaction.duration):>500000", 0, True),
            ("p50(transaction.duration):>100000", 1, True),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=[
                        "transaction",
                        "p50(transaction.duration)",
                    ],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=20),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                if expected_length > 0:
                    assert round(data[0]["p50_transaction_duration"]) == 210000, use_snql

    def test_p75(self):
        project = self.create_project()

        for i in range(6):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + i),
            )
            data["transaction"] = "/p75"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            ("p75(transaction.duration):>0", 1, False),
            ("p75(transaction.duration):>500000", 0, True),
            ("p75(transaction.duration):>100000", 1, True),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=[
                        "transaction",
                        "p75(transaction.duration)",
                    ],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=20),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                if expected_length > 0:
                    assert round(data[0]["p75_transaction_duration"]) == 285000, use_snql

    def test_p95(self):
        project = self.create_project()

        for i in range(6):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + i),
            )
            data["transaction"] = "/p95"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            ("p95(transaction.duration):>0", 1, False),
            ("p95(transaction.duration):>500000", 0, True),
            ("p95(transaction.duration):>100000", 1, True),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=[
                        "transaction",
                        "p95(transaction.duration)",
                    ],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=20),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                if expected_length > 0:
                    assert round(data[0]["p95_transaction_duration"]) == 345000, use_snql

    def test_p99(self):
        project = self.create_project()

        for i in range(6):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + i),
            )
            data["transaction"] = "/p99"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            ("p99(transaction.duration):>0", 1, False),
            ("p99(transaction.duration):>500000", 0, True),
            ("p99(transaction.duration):>100000", 1, True),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=[
                        "transaction",
                        "p99(transaction.duration)",
                    ],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=20),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                if expected_length > 0:
                    assert round(data[0]["p99_transaction_duration"]) == 357000, use_snql

    def test_p100(self):
        project = self.create_project()

        for i in range(6):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + i),
            )
            data["transaction"] = "/p100"
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            ("p100(transaction.duration):>0", 1, False),
            ("p100(transaction.duration):>500000", 0, True),
            ("p100(transaction.duration):>100000", 1, True),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=[
                        "transaction",
                        "p100(transaction.duration)",
                    ],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=20),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                if expected_length > 0:
                    assert round(data[0]["p100_transaction_duration"]) == 360000, use_snql

    def test_p100_with_measurement(self):
        project = self.create_project()

        for i in range(6):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + i),
            )
            data["transaction"] = "/p100"
            data["measurements"]["frames_total"] = {"value": 100 * i}
            data["measurements"]["frames_slow"] = {"value": 50 * i}
            self.store_event(data, project_id=project.id)

        queries = [
            ("", 1, True),
            ("p100(measurements.frames_slow_rate):>0", 1, False),
            ("p100(measurements.frames_slow_rate):>0.6", 0, True),
            ("p100(measurements.frames_slow_rate):>0.4", 1, True),
        ]

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
                    selected_columns=[
                        "transaction",
                        "p100(measurements.frames_slow_rate)",
                    ],
                    query=query,
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=20),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                if expected_length > 0:
                    assert data[0]["p100_measurements_frames_slow_rate"] == 0.5, use_snql

    def test_count_unique(self):
        for idx in range(3):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
            )
            data["user"] = {"email": f"{idx}@example.com"}
            data["tags"] = {"foo": "bar" if idx < 1 else "baz"}
            self.store_event(data, project_id=self.project.id)
        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["count_unique(user.display)", "count_unique(foo)"],
                query="",
                params={
                    "start": before_now(minutes=4),
                    "end": before_now(minutes=2),
                    "project_id": [self.project.id],
                },
                use_aggregate_conditions=True,
                use_snql=use_snql,
            )
            data = result["data"]

            assert len(data) == 1, use_snql
            assert data[0]["count_unique_user_display"] == 3, use_snql
            assert data[0]["count_unique_foo"] == 2, use_snql

    def test_min_max(self):
        """Testing both min and max since they're so similar"""
        for idx in range(3):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + idx),
            )
            self.store_event(data, project_id=self.project.id)

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=[
                    "min(transaction.duration)",
                    "max(transaction.duration)",
                ],
                query="",
                params={
                    "start": before_now(minutes=4),
                    "end": before_now(minutes=2),
                    "project_id": [self.project.id],
                },
                use_aggregate_conditions=True,
                use_snql=use_snql,
            )
            data = result["data"]

            assert len(data) == 1, use_snql
            assert data[0]["min_transaction_duration"] == 60000, use_snql
            assert data[0]["max_transaction_duration"] == 180000, use_snql

    def test_stats_functions(self):
        for idx in range(3):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 + idx),
            )
            self.store_event(data, project_id=self.project.id)

        queries = [
            ("var(transaction.duration)", "var_transaction_duration", 3600000000),
            ("stddev(transaction.duration)", "stddev_transaction_duration", 60000),
            # This is a nonsense cov&corr column, but gives us a consistent result for tests
            (
                "cov(transaction.duration,transaction.duration)",
                "cov_transaction_duration_transaction_duration",
                3600000000,
            ),
            (
                "corr(transaction.duration,transaction.duration)",
                "corr_transaction_duration_transaction_duration",
                1,
            ),
        ]

        for use_snql in [False, True]:
            for column, alias, expected in queries:
                result = discover.query(
                    selected_columns=[column],
                    query="",
                    params={
                        "start": before_now(minutes=4),
                        "end": before_now(minutes=2),
                        "project_id": [self.project.id],
                    },
                    use_aggregate_conditions=True,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == 1, column
                assert data[0][alias] == expected, column

    def test_count_at_least(self):
        for idx in range(3):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
                start_timestamp=before_now(minutes=4 if idx < 1 else 5),
            )
            self.store_event(data, project_id=self.project.id)
        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=[
                    "count_at_least(transaction.duration,60000)",
                    "count_at_least(transaction.duration,120000)",
                ],
                query="",
                params={
                    "start": before_now(minutes=4),
                    "end": before_now(minutes=2),
                    "project_id": [self.project.id],
                },
                use_aggregate_conditions=True,
                use_snql=use_snql,
            )
            data = result["data"]

            assert len(data) == 1, use_snql
            assert data[0]["count_at_least_transaction_duration_60000"] == 3, use_snql
            assert data[0]["count_at_least_transaction_duration_120000"] == 2, use_snql

    def test_eps(self):
        project = self.create_project()

        for _ in range(6):
            data = load_data(
                "transaction",
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

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
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
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=4),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                if expected_length > 0:
                    assert data[0]["eps"] == 0.05, use_snql
                    assert data[0]["eps_10"] == 0.6, use_snql
                    assert data[0]["eps_60"] == 0.1, use_snql
                    assert data[0]["tps"] == 0.05, use_snql
                    assert data[0]["tps_10"] == 0.6, use_snql
                    assert data[0]["tps_60"] == 0.1, use_snql

    def test_epm(self):
        project = self.create_project()

        for _ in range(6):
            data = load_data(
                "transaction",
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

        for use_snql in [False, True]:
            for query, expected_length, use_aggregate_conditions in queries:
                result = discover.query(
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
                    orderby="transaction",
                    params={
                        "start": before_now(minutes=4),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_aggregate_conditions=use_aggregate_conditions,
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == expected_length, use_snql
                if expected_length > 0:
                    assert data[0]["epm"] == 3, use_snql
                    assert data[0]["epm_10"] == 36.0, use_snql
                    assert data[0]["epm_60"] == 6, use_snql
                    assert data[0]["tpm"] == 3, use_snql
                    assert data[0]["tpm_10"] == 36.0, use_snql
                    assert data[0]["tpm_60"] == 6, use_snql

    def test_transaction_status(self):
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/test_transaction/success"
        data["contexts"]["trace"]["status"] = "ok"
        self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/test_transaction/aborted"
        data["contexts"]["trace"]["status"] = "aborted"
        self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/test_transaction/already_exists"
        data["contexts"]["trace"]["status"] = "already_exists"
        self.store_event(data, project_id=self.project.id)

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["transaction.status"],
                query="",
                params={
                    "organization_id": self.organization.id,
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                use_snql=use_snql,
            )
            data = result["data"]
            assert len(data) == 3, use_snql
            assert {
                data[0]["transaction.status"],
                data[1]["transaction.status"],
                data[2]["transaction.status"],
            } == {0, 10, 6}, use_snql

    def test_transaction_status_filter(self):
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/test_transaction/success"
        data["contexts"]["trace"]["status"] = "ok"
        self.store_event(data, project_id=self.project.id)
        self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/test_transaction/already_exists"
        data["contexts"]["trace"]["status"] = "already_exists"
        self.store_event(data, project_id=self.project.id)

        def run_query(query, expected_statuses, message):
            for use_snql in [False, True]:
                result = discover.query(
                    selected_columns=["transaction.status"],
                    query=query,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                    use_snql=use_snql,
                )
                data = result["data"]
                assert len(data) == len(
                    expected_statuses
                ), f"failed with use_snql:'{use_snql}' due to {message}"
                assert sorted(item["transaction.status"] for item in data) == sorted(
                    expected_statuses
                ), f"failed with use_snql:'{use_snql}' due to {message} condition"

        run_query("has:transaction.status transaction.status:ok", [0, 0], "status 'ok'")
        run_query(
            "has:transaction.status transaction.status:[ok,already_exists]",
            [0, 0, 6],
            "status 'ok' or 'already_exists'",
        )
        run_query("has:transaction.status !transaction.status:ok", [6], "status not 'ok'")
        run_query(
            "has:transaction.status !transaction.status:already_exists",
            [0, 0],
            "status not 'already_exists'",
        )
        run_query(
            "has:transaction.status !transaction.status:[ok,already_exists]",
            [],
            "status not 'ok' and not 'already_exists'",
        )
        run_query("!has:transaction.status", [], "status nonexistant")

    def test_error_handled_alias(self):
        data = load_data("android-ndk", timestamp=before_now(minutes=10))
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "is handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            data["event_id"] = event[0]
            data["message"] = event[1]
            data["exception"]["values"][0]["value"] = event[1]
            data["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            self.store_event(data=data, project_id=self.project.id)

        queries = [
            ("", [[0], [1], [None]]),
            ("error.handled:true", [[1], [None]]),
            ("!error.handled:true", [[0]]),
            ("has:error.handled", [[1], [None]]),
            ("has:error.handled error.handled:true", [[1], [None]]),
            ("error.handled:false", [[0]]),
            ("has:error.handled error.handled:false", []),
        ]

        for use_snql in [False, True]:
            for query, expected_data in queries:
                result = discover.query(
                    selected_columns=["error.handled"],
                    query=query,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": before_now(minutes=12),
                        "end": before_now(minutes=8),
                    },
                    use_snql=use_snql,
                )

                data = result["data"]
                data = sorted(
                    data, key=lambda k: (k["error.handled"][0] is None, k["error.handled"][0])
                )

                assert len(data) == len(expected_data), use_snql
                assert [item["error.handled"] for item in data] == expected_data, use_snql

    def test_error_unhandled_alias(self):
        data = load_data("android-ndk", timestamp=before_now(minutes=10))
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "is handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            data["event_id"] = event[0]
            data["message"] = event[1]
            data["exception"]["values"][0]["value"] = event[1]
            data["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            self.store_event(data=data, project_id=self.project.id)

        queries = [
            ("error.unhandled:true", ["a" * 32], [1]),
            ("!error.unhandled:true", ["b" * 32, "c" * 32], [0, 0]),
            ("has:error.unhandled", ["a" * 32], [1]),
            ("!has:error.unhandled", ["b" * 32, "c" * 32], [0, 0]),
            ("has:error.unhandled error.unhandled:true", ["a" * 32], [1]),
            ("error.unhandled:false", ["b" * 32, "c" * 32], [0, 0]),
            ("has:error.unhandled error.unhandled:false", [], []),
        ]

        for use_snql in [False, True]:
            for query, expected_events, error_handled in queries:
                result = discover.query(
                    selected_columns=["error.unhandled"],
                    query=query,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": before_now(minutes=12),
                        "end": before_now(minutes=8),
                    },
                    use_snql=use_snql,
                )
                data = result["data"]

                assert len(data) == len(expected_events), use_snql
                assert [item["error.unhandled"] for item in data] == error_handled, use_snql

    def test_array_fields(self):
        data = load_data("javascript")
        data["timestamp"] = iso_format(before_now(minutes=10))
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

        for use_snql in [False, True]:
            for query, expected_len in queries:
                result = discover.query(
                    selected_columns=["stack.filename"],
                    query=query,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": before_now(minutes=12),
                        "end": before_now(minutes=8),
                    },
                    use_snql=use_snql,
                )

                data = result["data"]
                assert len(data) == expected_len, use_snql
                if len(data) == 0:
                    continue
                assert len(data[0]["stack.filename"]) == len(expected_filenames), use_snql
                assert sorted(data[0]["stack.filename"]) == expected_filenames, use_snql

            result = discover.query(
                selected_columns=["stack.filename"],
                query="stack.filename:[raven.js]",
                params={
                    "organization_id": self.organization.id,
                    "project_id": [self.project.id],
                    "start": before_now(minutes=12),
                    "end": before_now(minutes=8),
                },
                use_snql=use_snql,
            )

            data = result["data"]
            assert len(data) == 1
            assert len(data[0]["stack.filename"]) == len(expected_filenames)
            assert sorted(data[0]["stack.filename"]) == expected_filenames

    @pytest.mark.skip("setting snuba config is too slow")
    def test_spans_op_array_field(self):
        trace_context = {
            "parent_span_id": "8988cec7cc0779c1",
            "type": "trace",
            "op": "http.server",
            "trace_id": "a7d67cf796774551a95be6543cacd459",
            "span_id": "babaae0d4b7512d9",
            "status": "ok",
            "hash": "a" * 16,
            "exclusive_time": 1.2345,
        }
        data = load_data(
            "transaction", timestamp=before_now(minutes=10), trace_context=trace_context, spans=[]
        )
        self.store_event(data=data, project_id=self.project.id)

        queries = [
            ("has:spans_op", 1),
            ("!has:spans_op", 0),
        ]

        for use_snql in [False, True]:
            for query, expected_len in queries:
                result = discover.query(
                    selected_columns=["spans_op"],
                    query=query,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": before_now(minutes=12),
                        "end": before_now(minutes=8),
                    },
                    use_snql=use_snql,
                )
                data = result["data"]
                assert len(data) == expected_len, use_snql

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
            data["message"] = event[1]
            data["exception"]["values"][0]["value"] = event[1]
            data["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            self.store_event(data=data, project_id=self.project.id)

        queries = [
            (["error.unhandled"], [0, 0, 1]),
            ("error.unhandled", [0, 0, 1]),
            (["-error.unhandled"], [1, 0, 0]),
            ("-error.unhandled", [1, 0, 0]),
        ]

        for use_snql in [False, True]:
            for orderby, expected in queries:
                result = discover.query(
                    selected_columns=["transaction", "error.unhandled"],
                    query="",
                    orderby=orderby,
                    params={
                        "organization_id": self.organization.id,
                        "project_id": [self.project.id],
                        "start": before_now(minutes=12),
                        "end": before_now(minutes=8),
                    },
                    use_snql=use_snql,
                )

                data = result["data"]
                assert [x["error.unhandled"] for x in data] == expected, use_snql

    def test_orderby_aggregate_function(self):
        project = self.create_project()

        data = load_data("transaction", timestamp=before_now(minutes=5))
        data["transaction"] = "/failure_count/success"
        self.store_event(data, project_id=project.id)

        data = load_data("transaction", timestamp=before_now(minutes=5))
        data["transaction"] = "/failure_count/unknown"
        data["contexts"]["trace"]["status"] = "unknown_error"
        self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["transaction"] = f"/failure_count/{i}"
            data["contexts"]["trace"]["status"] = "unauthenticated"
            self.store_event(data, project_id=project.id)

        data = load_data("transaction", timestamp=before_now(minutes=5))
        data["transaction"] = "/failure_count/0"
        data["contexts"]["trace"]["status"] = "unauthenticated"
        self.store_event(data, project_id=project.id)

        orderbys = [
            (["failure_count()"], [0, 0, 1, 1, 1, 1, 1, 2]),
            ("failure_count()", [0, 0, 1, 1, 1, 1, 1, 2]),
            (["-failure_count()"], [2, 1, 1, 1, 1, 1, 0, 0]),
            ("-failure_count()", [2, 1, 1, 1, 1, 1, 0, 0]),
            ("failure_count", [0, 0, 1, 1, 1, 1, 1, 2]),
            ("-failure_count", [2, 1, 1, 1, 1, 1, 0, 0]),
        ]

        for use_snql in [False, True]:
            for orderby, expected in orderbys:
                result = discover.query(
                    selected_columns=["transaction", "failure_count()"],
                    query="",
                    orderby=orderby,
                    params={
                        "start": before_now(minutes=10),
                        "end": before_now(minutes=2),
                        "project_id": [project.id],
                    },
                    use_snql=use_snql,
                )
                data = result["data"]

                assert [x["failure_count"] for x in data] == expected, use_snql

    def test_field_aliasing_in_selected_columns(self):
        result = discover.query(
            selected_columns=["project.id", "user", "release", "timestamp.to_hour"],
            query="",
            params={"project_id": [self.project.id]},
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user"] == "id:99"
        assert data[0]["release"] == "first-release"

        event_hour = self.event_time.replace(minute=0, second=0)
        assert data[0]["timestamp.to_hour"] == iso_format(event_hour) + "+00:00"

        assert len(result["meta"]) == 4
        assert result["meta"] == {
            "project.id": "integer",
            "user": "string",
            "release": "string",
            "timestamp.to_hour": "date",
        }

    def test_field_alias_with_component(self):
        result = discover.query(
            selected_columns=["project.id", "user", "user.email"],
            query="",
            params={"project_id": [self.project.id]},
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user"] == "id:99"
        assert data[0]["user.email"] == "bruce@example.com"

        assert len(result["meta"]) == 3
        assert result["meta"] == {
            "project.id": "integer",
            "user": "string",
            "user.email": "string",
        }

    def test_field_aliasing_in_aggregate_functions_and_groupby(self):
        result = discover.query(
            selected_columns=["project.id", "count_unique(user.email)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["count_unique_user_email"] == 1

    def test_field_aliasing_in_conditions(self):
        result = discover.query(
            selected_columns=["project.id", "user.email"],
            query="user.email:bruce@example.com",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "bruce@example.com"

    def test_auto_fields_simple_fields(self):
        result = discover.query(
            selected_columns=["user.email", "release"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["id"] == self.event.event_id
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "bruce@example.com"
        assert data[0]["release"] == "first-release"
        assert data[0]["project.name"] == self.project.slug

        assert len(result["meta"]) == 5
        assert result["meta"] == {
            "user.email": "string",
            "release": "string",
            "id": "string",
            "project.id": "integer",
            "project.name": "string",
        }

    def test_auto_fields_aggregates(self):
        result = discover.query(
            selected_columns=["count_unique(user.email)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["count_unique_user_email"] == 1

    def test_release_condition(self):
        result = discover.query(
            selected_columns=["id", "message"],
            query=f"release:{self.create_release(self.project).version}",
            params={"project_id": [self.project.id]},
        )
        assert len(result["data"]) == 0

        result = discover.query(
            selected_columns=["id", "message"],
            query=f"release:{self.release.version}",
            params={"project_id": [self.project.id]},
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
            data={"release": release_1.version},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version},
            project_id=self.project.id,
        ).event_id
        release_2_e_2 = self.store_event(
            data={"release": release_2.version},
            project_id=self.project.id,
        ).event_id
        release_3_e_1 = self.store_event(
            data={"release": release_3.version},
            project_id=self.project.id,
        ).event_id
        release_3_e_2 = self.store_event(
            data={"release": release_3.version},
            project_id=self.project.id,
        ).event_id

        result = discover.query(
            selected_columns=["id"],
            query=f"{SEMVER_ALIAS}:>1.2.3",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
        )
        assert {r["id"] for r in result["data"]} == {
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }
        result = discover.query(
            selected_columns=["id"],
            query=f"{SEMVER_ALIAS}:>=1.2.3",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
        )
        assert {r["id"] for r in result["data"]} == {
            release_1_e_1,
            release_1_e_2,
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }
        result = discover.query(
            selected_columns=["id"],
            query=f"{SEMVER_ALIAS}:<1.2.4",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
        )
        assert {r["id"] for r in result["data"]} == {release_1_e_1, release_1_e_2}
        result = discover.query(
            selected_columns=["id"],
            query=f"!{SEMVER_ALIAS}:1.2.3",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
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
            data={"release": adopted_release.version, "environment": self.environment.name},
            project_id=self.project.id,
        ).event_id
        adopted_release_e_2 = self.store_event(
            data={"release": adopted_release.version, "environment": self.environment.name},
            project_id=self.project.id,
        ).event_id
        replaced_release_e_1 = self.store_event(
            data={"release": replaced_release.version, "environment": self.environment.name},
            project_id=self.project.id,
        ).event_id
        replaced_release_e_2 = self.store_event(
            data={"release": replaced_release.version, "environment": self.environment.name},
            project_id=self.project.id,
        ).event_id

        result = discover.query(
            selected_columns=["id"],
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED}",
            params={
                "project_id": [self.project.id],
                "organization_id": self.organization.id,
                "environment": [self.environment.name],
            },
        )
        assert {r["id"] for r in result["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
        }

        result = discover.query(
            selected_columns=["id"],
            query=f"!{RELEASE_STAGE_ALIAS}:{ReleaseStages.LOW_ADOPTION}",
            params={
                "project_id": [self.project.id],
                "organization_id": self.organization.id,
                "environment": [self.environment.name],
            },
        )
        assert {r["id"] for r in result["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
            replaced_release_e_1,
            replaced_release_e_2,
        }
        result = discover.query(
            selected_columns=["id"],
            query=f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED}, {ReleaseStages.REPLACED}]",
            params={
                "project_id": [self.project.id],
                "organization_id": self.organization.id,
                "environment": [self.environment.name],
            },
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
            data={"release": release_1.version},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version},
            project_id=self.project.id,
        ).event_id

        result = discover.query(
            selected_columns=["id"],
            query=f"{SEMVER_PACKAGE_ALIAS}:test",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
        )
        assert {r["id"] for r in result["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }
        result = discover.query(
            selected_columns=["id"],
            query=f"{SEMVER_PACKAGE_ALIAS}:test2",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
        )
        assert {r["id"] for r in result["data"]} == {
            release_2_e_1,
        }

    def test_semver_build_condition(self):
        release_1 = self.create_release(version="test@1.2.3+123")
        release_2 = self.create_release(version="test2@1.2.4+124")

        release_1_e_1 = self.store_event(
            data={"release": release_1.version},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version},
            project_id=self.project.id,
        ).event_id

        result = discover.query(
            selected_columns=["id"],
            query=f"{SEMVER_BUILD_ALIAS}:123",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
        )
        assert {r["id"] for r in result["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }
        result = discover.query(
            selected_columns=["id"],
            query=f"{SEMVER_BUILD_ALIAS}:124",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
        )
        assert {r["id"] for r in result["data"]} == {
            release_2_e_1,
        }
        result = discover.query(
            selected_columns=["id"],
            query=f"{SEMVER_BUILD_ALIAS}:>=123",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
        )
        assert {r["id"] for r in result["data"]} == {release_1_e_1, release_1_e_2, release_2_e_1}

    def test_latest_release_condition(self):
        result = discover.query(
            selected_columns=["id", "message"],
            query="release:latest",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == self.event.message
        assert "event_id" not in data[0]

    def test_environment_condition(self):
        result = discover.query(
            selected_columns=["id", "message"],
            query=f"environment:{self.create_environment(self.project).name}",
            params={"project_id": [self.project.id]},
        )
        assert len(result["data"]) == 0

        result = discover.query(
            selected_columns=["id", "message"],
            query=f"environment:{self.environment.name}",
            params={"project_id": [self.project.id]},
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == self.event.message

    def test_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        self.store_event(
            data={"message": "aaaaa", "timestamp": iso_format(self.one_min_ago)},
            project_id=project2.id,
        )
        self.store_event(
            data={"message": "bbbbb", "timestamp": iso_format(self.one_min_ago)},
            project_id=project3.id,
        )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["project", "message"],
                query=f"project:{self.project.slug} OR project:{project2.slug}",
                params={
                    "project_id": [self.project.id, project2.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="message",
                use_snql=use_snql,
            )

            data = result["data"]
            assert len(data) == 2, use_snql
            assert data[0]["project"] == project2.slug, use_snql
            assert data[1]["project"] == self.project.slug, use_snql

    def test_nested_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "b" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "c" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=project2.id,
        )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["release"],
                query="(release:{} OR release:{}) AND project:{}".format(
                    "a" * 32, "b" * 32, self.project.slug
                ),
                params={
                    "project_id": [self.project.id, project2.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="release",
                use_snql=use_snql,
            )

            data = result["data"]
            assert len(data) == 2, use_snql
            assert data[0]["release"] == "a" * 32, use_snql
            assert data[1]["release"] == "b" * 32, use_snql

    def test_conditions_with_special_columns(self):
        for val in ["a", "b", "c"]:
            data = load_data("transaction")
            data["timestamp"] = iso_format(self.one_min_ago)
            data["transaction"] = val * 32
            data["message"] = val * 32
            data["tags"] = {"sub_customer.is-Enterprise-42": val * 32}
            self.store_event(data=data, project_id=self.project.id)

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["title", "message"],
                query="event.type:transaction (title:{} OR message:{})".format("a" * 32, "b" * 32),
                params={
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="title",
                use_snql=use_snql,
            )

            data = result["data"]
            assert len(data) == 2, use_snql
            assert data[0]["title"] == "a" * 32, use_snql
            assert data[1]["title"] == "b" * 32, use_snql

            result = discover.query(
                selected_columns=["title", "sub_customer.is-Enterprise-42"],
                query="event.type:transaction (title:{} AND sub_customer.is-Enterprise-42:{})".format(
                    "a" * 32, "a" * 32
                ),
                params={
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="title",
                use_snql=use_snql,
            )

            data = result["data"]
            assert len(data) == 1, use_snql
            assert data[0]["title"] == "a" * 32, use_snql
            assert data[0]["sub_customer.is-Enterprise-42"] == "a" * 32, use_snql

    def test_conditions_with_aggregates(self):
        events = [("a", 2), ("b", 3), ("c", 4)]
        for ev in events:
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("transaction")
                data["timestamp"] = iso_format(self.one_min_ago)
                data["transaction"] = f"{val}-{i}"
                data["message"] = val
                data["tags"] = {"trek": val}
                self.store_event(data=data, project_id=self.project.id)

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["trek", "count()"],
                query="event.type:transaction (trek:{} OR trek:{}) AND count():>2".format(
                    "a" * 32, "b" * 32
                ),
                params={
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="trek",
                use_aggregate_conditions=True,
                use_snql=use_snql,
            )

            data = result["data"]
            assert len(data) == 1, use_snql
            assert data[0]["trek"] == "b" * 32, use_snql
            assert data[0]["count"] == 3, use_snql

    def test_conditions_with_nested_aggregates(self):
        events = [("a", 2), ("b", 3), ("c", 4)]
        for ev in events:
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("transaction")
                data["timestamp"] = iso_format(self.one_min_ago)
                data["transaction"] = f"{val}-{i}"
                data["message"] = val
                data["tags"] = {"trek": val}
                self.store_event(data=data, project_id=self.project.id)

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["trek", "count()"],
                query="(event.type:transaction AND (trek:{} AND (transaction:*{}* AND count():>2)))".format(
                    "b" * 32, "b" * 32
                ),
                params={
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="trek",
                use_aggregate_conditions=True,
                use_snql=use_snql,
            )

            data = result["data"]
            assert len(data) == 1, use_snql
            assert data[0]["trek"] == "b" * 32, use_snql
            assert data[0]["count"] == 3, use_snql

            with pytest.raises(InvalidSearchQuery) as err:
                discover.query(
                    selected_columns=["trek", "transaction"],
                    query="(event.type:transaction AND (trek:{} AND (transaction:*{}* AND count():>2)))".format(
                        "b" * 32, "b" * 32
                    ),
                    params={
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                    orderby="trek",
                    use_aggregate_conditions=True,
                    use_snql=use_snql,
                )
            assert "used in a condition but is not a selected column" in str(err)

    def test_conditions_with_timestamps(self):
        events = [("a", 1), ("b", 2), ("c", 3)]
        for t, ev in enumerate(events):
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("transaction", timestamp=self.now - timedelta(seconds=3 * t + 1))
                data["transaction"] = f"{val}"
                self.store_event(data=data, project_id=self.project.id)

        for use_snql in [False, True]:
            results = discover.query(
                selected_columns=["transaction", "count()"],
                query="event.type:transaction AND (timestamp:<{} OR timestamp:>{})".format(
                    iso_format(self.now - timedelta(seconds=5)),
                    iso_format(self.now - timedelta(seconds=3)),
                ),
                params={
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="transaction",
                use_aggregate_conditions=True,
                use_snql=use_snql,
            )

            data = results["data"]
            assert len(data) == 2, use_snql
            assert data[0]["transaction"] == "a" * 32, use_snql
            assert data[0]["count"] == 1, use_snql
            assert data[1]["transaction"] == "c" * 32, use_snql
            assert data[1]["count"] == 3, use_snql

    def test_timestamp_rollup_filter(self):
        event_hour = self.event_time.replace(minute=0, second=0)
        result = discover.query(
            selected_columns=["project.id", "user", "release"],
            query="timestamp.to_hour:" + iso_format(event_hour),
            params={"project_id": [self.project.id]},
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user"] == "id:99"
        assert data[0]["release"] == "first-release"

        assert len(result["meta"]) == 3
        assert result["meta"] == {
            "project.id": "integer",
            "user": "string",
            "release": "string",
        }

    def test_count_with_or(self):
        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "a" * 32
        self.store_event(data=data, project_id=self.project.id)

        results = discover.query(
            selected_columns=["transaction", "count()"],
            query="event.type:transaction AND (count():<1 OR count():>0)",
            params={"project_id": [self.project.id]},
            orderby="transaction",
            use_aggregate_conditions=True,
        )

        data = results["data"]
        assert len(data) == 1
        assert data[0]["transaction"] == "a" * 32
        assert data[0]["count"] == 1

    def test_array_join(self):
        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["measurements"] = {
            "fp": {"value": 1000},
            "fcp": {"value": 1000},
            "lcp": {"value": 1000},
        }
        self.store_event(data=data, project_id=self.project.id)

        for use_snql in [False, True]:
            results = discover.query(
                selected_columns=["array_join(measurements_key)"],
                query="",
                params={
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                functions_acl=["array_join"],
                use_snql=use_snql,
            )
            assert {"fcp", "fp", "lcp"} == {
                row["array_join_measurements_key"] for row in results["data"]
            }

    def test_access_to_private_functions(self):
        for use_snql in [False, True]:
            # using private functions directly without access should error
            with pytest.raises(
                InvalidSearchQuery, match="array_join: no access to private function"
            ):
                discover.query(
                    selected_columns=["array_join(tags.key)"],
                    query="",
                    params={
                        "project_id": [self.project.id],
                        "start": self.two_min_ago,
                        "end": self.now,
                    },
                    use_snql=use_snql,
                )

        # TODO: test the following with `use_snql=True` once histogram is using snql

        # using private functions in an aggregation without access should error
        with pytest.raises(InvalidSearchQuery, match="histogram: no access to private function"):
            for array_column in ARRAY_COLUMNS:
                discover.query(
                    selected_columns=[f"histogram({array_column}_value, 1,0,1)"],
                    query=f"histogram({array_column}_value, 1,0,1):>0",
                    params={"project_id": [self.project.id]},
                    use_aggregate_conditions=True,
                )

        # using private functions in an aggregation without access should error
        # with auto aggregation on
        with pytest.raises(InvalidSearchQuery, match="histogram: no access to private function"):
            for array_column in ARRAY_COLUMNS:
                discover.query(
                    selected_columns=["count()"],
                    query=f"histogram({array_column}_value, 1,0,1):>0",
                    params={"project_id": [self.project.id]},
                    auto_aggregations=True,
                    use_aggregate_conditions=True,
                )

    def test_sum_array_combinator(self):
        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["measurements"] = {
            "fp": {"value": 1000},
            "fcp": {"value": 1000},
            "lcp": {"value": 1000},
        }
        self.store_event(data=data, project_id=self.project.id)

        results = discover.query(
            selected_columns=["sumArray(measurements_value)"],
            query="",
            params={
                "project_id": [self.project.id],
                "start": self.two_min_ago,
                "end": self.now,
            },
            # make sure to opt in to gain access to the function
            functions_acl=["sumArray"],
            # -Array combinator is only supported in SnQL
            use_snql=True,
        )
        assert results["data"][0]["sumArray_measurements_value"] == 3000.0

    def test_any_function(self):
        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "a" * 32
        self.store_event(data=data, project_id=self.project.id)

        for use_snql in [False, True]:
            results = discover.query(
                selected_columns=["count()", "any(transaction)", "any(user.id)"],
                query="event.type:transaction",
                params={
                    "start": before_now(minutes=5),
                    "end": before_now(seconds=1),
                    "project_id": [self.project.id],
                },
                use_aggregate_conditions=True,
                use_snql=use_snql,
            )

            data = results["data"]
            assert len(data) == 1
            assert data[0]["any_transaction"] == "a" * 32
            assert data[0]["any_user_id"] is None
            assert data[0]["count"] == 1

    def test_offsets(self):
        self.store_event(
            data={"message": "hello1", "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.store_event(
            data={"message": "hello2", "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )

        for use_snql in [False, True]:
            result = discover.query(
                selected_columns=["message"],
                query="",
                params={
                    "project_id": [self.project.id],
                    "start": self.two_min_ago,
                    "end": self.now,
                },
                orderby="message",
                use_snql=use_snql,
                limit=1,
                offset=1,
            )

            data = result["data"]
            assert len(data) == 1, use_snql
            # because we're ording by `message`, and offset by 1, the message should be `hello2`
            assert data[0]["message"] == "hello2"

    def test_reflective_types(self):
        results = discover.query(
            selected_columns=[
                "p50(measurements.lcp)",
                "p50(measurements.foo)",
                "p50(spans.foo)",
            ],
            query="event.type:transaction",
            params={"project_id": [self.project.id]},
            use_aggregate_conditions=True,
        )

        assert results["meta"] == {
            "p50_measurements_lcp": "duration",
            "p50_measurements_foo": "number",
            "p50_spans_foo": "duration",
        }

    def test_measurements(self):
        event_data = load_data("transaction", timestamp=before_now(seconds=3))
        self.store_event(data=event_data, project_id=self.project.id)

        results = discover.query(
            selected_columns=[
                "measurements.fp",
                "measurements.fcp",
                "measurements.lcp",
                "measurements.fid",
                "measurements.cls",
                "measurements.does_not_exist",
            ],
            query="event.type:transaction",
            params={"project_id": [self.project.id]},
        )

        data = results["data"]
        assert len(data) == 1
        assert data[0]["measurements.fp"] == event_data["measurements"]["fp"]["value"]
        assert data[0]["measurements.fcp"] == event_data["measurements"]["fcp"]["value"]
        assert data[0]["measurements.lcp"] == event_data["measurements"]["lcp"]["value"]
        assert data[0]["measurements.fid"] == event_data["measurements"]["fid"]["value"]
        assert data[0]["measurements.cls"] == event_data["measurements"]["cls"]["value"]
        assert data[0]["measurements.does_not_exist"] is None

    def test_span_op_breakdowns(self):
        event_data = load_data("transaction", timestamp=before_now(seconds=3))
        self.store_event(data=event_data, project_id=self.project.id)

        results = discover.query(
            selected_columns=[
                "spans.http",
                "spans.db",
                "spans.resource",
                "spans.browser",
                "spans.total.time",
                "spans.does_not_exist",
            ],
            query="event.type:transaction",
            params={"project_id": [self.project.id]},
        )

        data = results["data"]
        assert len(data) == 1
        span_ops = event_data["breakdowns"]["span_ops"]
        assert data[0]["spans.http"] == span_ops["ops.http"]["value"]
        assert data[0]["spans.db"] == span_ops["ops.db"]["value"]
        assert data[0]["spans.resource"] == span_ops["ops.resource"]["value"]
        assert data[0]["spans.browser"] == span_ops["ops.browser"]["value"]
        assert data[0]["spans.total.time"] == span_ops["total.time"]["value"]
        assert data[0]["spans.does_not_exist"] is None

    def test_project_in_condition_with_or(self):
        project2 = self.create_project(organization=self.organization)
        event_data = load_data("transaction", timestamp=before_now(seconds=3))
        self.store_event(data=event_data, project_id=project2.id)
        expected = sorted([self.project.slug, project2.slug])

        result = discover.query(
            selected_columns=["project"],
            query=f"project:{self.project.slug} or event.type:transaction",
            params={
                "organization_id": self.organization.id,
                "project_id": [self.project.id, project2.id],
                "start": self.two_min_ago,
                "end": self.now,
            },
            orderby="project",
            use_snql=True,
        )
        data = result["data"]
        assert len(data) == len(expected)
        assert [item["project"] for item in data] == expected


class QueryTransformTest(TestCase):
    """
    This test mocks snuba.raw_query to let us isolate column transformations.
    """

    @patch("sentry.snuba.discover.raw_query")
    def test_query_parse_error(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=[],
                query="foo(id):<1dino",
                params={"project_id": [self.project.id]},
            )
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_query_no_fields(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        with pytest.raises(InvalidSearchQuery) as err:
            discover.query(
                selected_columns=[],
                query="event.type:transaction",
                params={"project_id": [self.project.id]},
            )
        assert "No columns selected" in str(err)
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_field_alias_macro(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "user"}, {"name": "project_id"}],
            "data": [{"user": "a@example.org", "project_id": self.project.id}],
        }
        discover.query(
            selected_columns=["user", "project"], query="", params={"project_id": [self.project.id]}
        )
        mock_query.assert_called_with(
            selected_columns=[
                "user",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", [f"'{self.project.slug}'"]],
                        "''",
                    ],
                    "project",
                ],
            ],
            aggregations=[],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_project_filter_limits_automatic_fields(self, mock_query):
        project2 = self.create_project(organization=self.organization)
        mock_query.return_value = {
            "meta": [{"name": "title"}, {"name": "project_id"}],
            "data": [{"title": "stuff", "project_id": project2.id}],
        }
        discover.query(
            selected_columns=["title", "project"],
            query=f"project:{project2.slug}",
            params={"project_id": [self.project.id, project2.id]},
        )
        mock_query.assert_called_with(
            selected_columns=[
                "title",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{project2.id}'"]],
                        ["array", [f"'{project2.slug}'"]],
                        "''",
                    ],
                    "project",
                ],
            ],
            aggregations=[],
            filter_keys={"project_id": [project2.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[["project_id", "=", project2.id]],
            groupby=[],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_project_with_aggregate_grouping(self, mock_query):
        project2 = self.create_project(organization=self.organization)
        mock_query.return_value = {
            "meta": [{"name": "title"}, {"name": "project_id"}],
            "data": [{"title": "stuff", "project_id": project2.id}],
        }
        discover.query(
            selected_columns=["title", "project", "p99()"],
            query=f"project:{project2.slug}",
            params={"project_id": [self.project.id, project2.id]},
        )
        mock_query.assert_called_with(
            selected_columns=[
                "title",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{project2.id}'"]],
                        ["array", [f"'{project2.slug}'"]],
                        "''",
                    ],
                    "project",
                ],
            ],
            aggregations=[["quantile(0.99)", "duration", "p99"]],
            filter_keys={"project_id": [project2.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[["project_id", "=", project2.id]],
            groupby=["title", "project_id"],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_no_auto_fields(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "count"}],
            "data": [{"count": 1}],
        }
        discover.query(
            selected_columns=["count()"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=False,
        )
        mock_query.assert_called_with(
            selected_columns=[],
            aggregations=[["count", None, "count"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_aliasing_in_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "transaction.duration",
                "count_unique(transaction.duration)",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            aggregations=[["uniq", "duration", "count_unique_transaction_duration"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=["transaction", "duration"],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_aggregate_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "p95"}],
            "data": [{"transaction": "api.do_things", "p95": 200}],
        }
        discover.query(
            selected_columns=["transaction", "p95()", "count_unique(transaction)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                ["quantile(0.95)", "duration", "p95"],
                ["uniq", "transaction", "count_unique_transaction"],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_failure_rate_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "failure_rate"}],
            "data": [{"transaction": "api.do_things", "failure_rate": 0.314159}],
        }
        discover.query(
            selected_columns=["transaction", "failure_rate()"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["failure_rate()", None, "failure_rate"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_apdex_new_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
                {"name": "apdex"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 300),
                    "apdex": 0.15,
                }
            ],
        }

        discover.query(
            selected_columns=[
                "transaction",
                "apdex()",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=["transaction", "project_threshold_config"],
            conditions=[],
            aggregations=[
                [
                    "apdex(multiIf(equals(tupleElement(project_threshold_config,1),'lcp'),if(has(measurements.key,'lcp'),arrayElement(measurements.value,indexOf(measurements.key,'lcp')),NULL),duration),tupleElement(project_threshold_config,2))",
                    None,
                    "apdex",
                ]
            ],
            selected_columns=[
                "transaction",
                [
                    "tuple",
                    ["'duration'", 300],
                    "project_threshold_config",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_user_misery_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "user_misery_300"}],
            "data": [{"transaction": "api.do_things", "user_misery_300": 0.15}],
        }
        discover.query(
            selected_columns=["transaction", "user_misery(300)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "ifNull(divide(plus(uniqIf(user, greater(duration, 1200)), 5.8875), plus(uniq(user), 117.75)), 0)",
                    None,
                    "user_misery_300",
                ]
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_user_misery_new_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
                {"name": "user_misery"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 300),
                    "user_misery": 0.15,
                }
            ],
        }

        discover.query(
            selected_columns=[
                "transaction",
                "user_misery()",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=["transaction", "project_threshold_config"],
            conditions=[],
            aggregations=[
                [
                    "ifNull(divide(plus(uniqIf(user,greater(multiIf(equals(tupleElement(project_threshold_config,1),'lcp'),if(has(measurements.key,'lcp'),arrayElement(measurements.value,indexOf(measurements.key,'lcp')),NULL),duration),multiply(tupleElement(project_threshold_config,2),4))),5.8875),plus(uniq(user),117.75)),0)",
                    None,
                    "user_misery",
                ]
            ],
            selected_columns=[
                "transaction",
                [
                    "tuple",
                    ["'duration'", 300],
                    "project_threshold_config",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_count_miserable_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "count_miserable_user_300"}],
            "data": [{"transaction": "api.do_things", "count_miserable_user_300": 15}],
        }
        discover.query(
            selected_columns=["transaction", "count_miserable(user, 300)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "uniqIf(user, greater(duration, 1200))",
                    None,
                    "count_miserable_user_300",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_count_miserable_allows_zero_threshold(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "count_miserable_user_0"}],
            "data": [{"transaction": "api.do_things", "count_miserable_user_0": 15}],
        }
        discover.query(
            selected_columns=["transaction", "count_miserable(user,0)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "uniqIf(user, greater(duration, 0))",
                    None,
                    "count_miserable_user_0",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_apdex_allows_zero_threshold(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "apdex_0"}],
            "data": [{"transaction": "api.do_things", "apdex_0": 15}],
        }
        discover.query(
            selected_columns=["transaction", "apdex(0)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "apdex(duration, 0)",
                    None,
                    "apdex_0",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_project_threshold_config_alias_no_configured_thresholds(
        self, mock_query
    ):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 300),
                }
            ],
        }

        discover.query(
            selected_columns=[
                "transaction",
                "project_threshold_config",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=[],
            conditions=[],
            aggregations=[],
            selected_columns=[
                "transaction",
                [
                    "tuple",
                    ["'duration'", 300],
                    "project_threshold_config",
                ],
                "event_id",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", ["'bar'"]],
                        "''",
                    ],
                    "`project.name`",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_threshold_config_selected_with_project_threshold_configured(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 400),
                }
            ],
        }

        ProjectTransactionThreshold.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            threshold=200,
            metric=TransactionMetric.DURATION.value,
        )

        discover.query(
            selected_columns=[
                "transaction",
                "project_threshold_config",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=[],
            conditions=[],
            aggregations=[],
            selected_columns=[
                "transaction",
                [
                    "if",
                    [
                        [
                            "equals",
                            [
                                [
                                    "indexOf",
                                    [["array", [["toUInt64", [self.project.id]]]], "project_id"],
                                    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
                                ],
                                0,
                            ],
                        ],
                        ["tuple", ["'duration'", 300]],
                        [
                            "arrayElement",
                            [
                                ["array", [["tuple", ["'duration'", 200]]]],
                                [
                                    "indexOf",
                                    [["array", [["toUInt64", [self.project.id]]]], "project_id"],
                                    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
                                ],
                            ],
                        ],
                    ],
                    "project_threshold_config",
                ],
                "event_id",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", ["'bar'"]],
                        "''",
                    ],
                    "`project.name`",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_threshold_config_selected_with_txn_threshold_configured(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 400),
                }
            ],
        }

        ProjectTransactionThresholdOverride.objects.create(
            transaction="transaction/threshold",
            project_id=self.project.id,
            organization_id=self.organization.id,
            threshold=200,
            metric=TransactionMetric.DURATION.value,
        )

        discover.query(
            selected_columns=[
                "transaction",
                "project_threshold_config",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=[],
            conditions=[],
            aggregations=[],
            selected_columns=[
                "transaction",
                [
                    "if",
                    [
                        [
                            "equals",
                            [
                                [
                                    "indexOf",
                                    [
                                        [
                                            "array",
                                            [
                                                [
                                                    "tuple",
                                                    [
                                                        ["toUInt64", [self.project.id]],
                                                        "'transaction/threshold'",
                                                    ],
                                                ],
                                            ],
                                        ],
                                        ["tuple", ["project_id", "transaction"]],
                                    ],
                                    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
                                ],
                                0,
                            ],
                        ],
                        ["tuple", ["'duration'", 300]],
                        [
                            "arrayElement",
                            [
                                ["array", [["tuple", ["'duration'", 200]]]],
                                [
                                    "indexOf",
                                    [
                                        [
                                            "array",
                                            [
                                                [
                                                    "tuple",
                                                    [
                                                        ["toUInt64", [self.project.id]],
                                                        "'transaction/threshold'",
                                                    ],
                                                ],
                                            ],
                                        ],
                                        ["tuple", ["project_id", "transaction"]],
                                    ],
                                    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
                                ],
                            ],
                        ],
                    ],
                    "project_threshold_config",
                ],
                "event_id",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", ["'bar'"]],
                        "''",
                    ],
                    "`project.name`",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_threshold_config_selected_with_project_and_txn_thresholds_configured(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 400),
                }
            ],
        }

        ProjectTransactionThresholdOverride.objects.create(
            transaction="transaction/threshold",
            project_id=self.project.id,
            organization_id=self.organization.id,
            threshold=200,
            metric=TransactionMetric.DURATION.value,
        )

        ProjectTransactionThreshold.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            threshold=200,
            metric=TransactionMetric.DURATION.value,
        )

        discover.query(
            selected_columns=[
                "transaction",
                "project_threshold_config",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=[],
            conditions=[],
            aggregations=[],
            selected_columns=[
                "transaction",
                [
                    "if",
                    [
                        [
                            "equals",
                            [
                                [
                                    "indexOf",
                                    [
                                        [
                                            "array",
                                            [
                                                [
                                                    "tuple",
                                                    [
                                                        ["toUInt64", [self.project.id]],
                                                        "'transaction/threshold'",
                                                    ],
                                                ],
                                            ],
                                        ],
                                        ["tuple", ["project_id", "transaction"]],
                                    ],
                                    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
                                ],
                                0,
                            ],
                        ],
                        [
                            "if",
                            [
                                [
                                    "equals",
                                    [
                                        [
                                            "indexOf",
                                            [
                                                ["array", [["toUInt64", [self.project.id]]]],
                                                "project_id",
                                            ],
                                            PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
                                        ],
                                        0,
                                    ],
                                ],
                                ["tuple", ["'duration'", 300]],
                                [
                                    "arrayElement",
                                    [
                                        ["array", [["tuple", ["'duration'", 200]]]],
                                        [
                                            "indexOf",
                                            [
                                                ["array", [["toUInt64", [self.project.id]]]],
                                                "project_id",
                                            ],
                                            PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        [
                            "arrayElement",
                            [
                                ["array", [["tuple", ["'duration'", 200]]]],
                                [
                                    "indexOf",
                                    [
                                        [
                                            "array",
                                            [
                                                [
                                                    "tuple",
                                                    [
                                                        ["toUInt64", [self.project.id]],
                                                        "'transaction/threshold'",
                                                    ],
                                                ],
                                            ],
                                        ],
                                        ["tuple", ["project_id", "transaction"]],
                                    ],
                                    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
                                ],
                            ],
                        ],
                    ],
                    "project_threshold_config",
                ],
                "event_id",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", ["'bar'"]],
                        "''",
                    ],
                    "`project.name`",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_count_miserable_new_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
                {"name": "count_miserable_user_project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 400),
                    "count_miserable_user": 15,
                }
            ],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "count_miserable(user)",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=["transaction", "project_threshold_config"],
            conditions=[],
            aggregations=[
                [
                    """
                    uniqIf(user, greater(
                        multiIf(
                            equals(tupleElement(project_threshold_config, 1), 'lcp'),
                            if(has(measurements.key, 'lcp'), arrayElement(measurements.value, indexOf(measurements.key, 'lcp')), NULL),
                            duration
                        ),
                        multiply(tupleElement(project_threshold_config, 2), 4)
                    ))
                    """.replace(
                        "\n", ""
                    ).replace(
                        " ", ""
                    ),
                    None,
                    "count_miserable_user",
                ]
            ],
            selected_columns=[
                "transaction",
                [
                    "tuple",
                    ["'duration'", 300],
                    "project_threshold_config",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            limit=50,
            dataset=Dataset.Discover,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_percentile_range_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "firstPercentile"}],
            "data": [{"transaction": "api.do_things", "firstPercentile": 15}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "percentile_range(transaction.duration, 0.5, greater, 2020-05-02T14:45:01) as percentile_range_1",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "quantileIf(0.50)",
                    [
                        "duration",
                        ["greater", [["toDateTime", ["'2020-05-02T14:45:01'"]], "timestamp"]],
                    ],
                    "percentile_range_1",
                ]
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_avg_range_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "firstAverage"}],
            "data": [{"transaction": "api.do_things", "firstAverage": 15}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "avg_range(transaction.duration, greater, 2020-05-02T14:45:01) as avg_range_1",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "avgIf",
                    [
                        "duration",
                        ["greater", [["toDateTime", ["'2020-05-02T14:45:01'"]], "timestamp"]],
                    ],
                    "avg_range_1",
                ]
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_percentile_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "percentile_transaction_duration_0_75"}],
            "data": [
                {"transaction": "api.do_things", "percentile_transaction_duration_0_75": 1123}
            ],
        }
        discover.query(
            selected_columns=["transaction", "percentile(transaction.duration, 0.75)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["quantile(0.75)", "duration", "percentile_transaction_duration_0_75"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_orderby_limit_offset(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "title"}, {"name": "project.id"}],
            "data": [{"project.id": "tester", "title": "test title"}],
        }
        discover.query(
            selected_columns=["project.id", "title"],
            query="",
            params={"project_id": [self.project.id]},
            orderby=["project.id"],
            offset=100,
            limit=200,
        )
        mock_query.assert_called_with(
            selected_columns=["project_id", "title"],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            orderby=["project_id"],
            aggregations=[],
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            having=[],
            limit=200,
            offset=100,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_orderby_must_be_selected_if_aggregate(self, mock_query):
        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["transaction", "transaction.duration"],
                query="",
                params={"project_id": [self.project.id]},
                orderby=["count()"],
            )
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_orderby_aggregate_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "count_id"}, {"name": "project.id"}],
            "data": [{"project.id": "tester", "count_id": 10}],
        }
        discover.query(
            selected_columns=["count(id)", "project.id", "id"],
            query="",
            params={"project_id": [self.project.id]},
            orderby=["count_id"],
        )
        mock_query.assert_called_with(
            selected_columns=["project_id", "event_id"],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            orderby=["count_id"],
            aggregations=[["count", None, "count_id"]],
            end=None,
            start=None,
            conditions=[],
            groupby=["project_id", "event_id"],
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_conditions_order_and_groupby_aliasing(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        discover.query(
            selected_columns=["timestamp", "transaction", "transaction.duration", "count()"],
            query="transaction.op:ok transaction.duration:200 sdk.name:python tags[projectid]:123",
            params={"project_id": [self.project.id]},
            orderby=["-timestamp", "-count"],
        )
        mock_query.assert_called_with(
            selected_columns=["timestamp", "transaction", "duration"],
            aggregations=[["count", None, "count"]],
            conditions=[
                ["transaction_op", "=", "ok"],
                ["duration", "=", 200],
                ["sdk_name", "=", "python"],
                [["ifNull", ["tags[projectid]", "''"]], "=", "123"],
            ],
            filter_keys={"project_id": [self.project.id]},
            groupby=["timestamp", "transaction", "duration"],
            having=[],
            orderby=["-timestamp", "-count"],
            dataset=Dataset.Discover,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_conditions_nested_function_aliasing(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}],
            "data": [{"transaction": "api.do_things"}],
        }
        discover.query(
            selected_columns=["transaction", "count()"],
            query="event.type:transaction user.email:*@sentry.io message:recent-searches",
            params={"project_id": [self.project.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[
                ["type", "=", "transaction"],
                [["match", ["email", r"'(?i)^.*@sentry\.io$'"]], "=", 1],
                [["positionCaseInsensitive", ["message", "'recent-searches'"]], "!=", 0],
            ],
            aggregations=[["count", None, "count"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            having=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_condition_transform(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="http.method:GET",
            params={"project_id": [self.project.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            having=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_condition_projectid_transform(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        # The project_id column is not a public column, but we
        # have to let it through in conditions to ensure project.name works.
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="project_id:1",
            params={"project_id": [self.project.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["project_id", "=", 1]],
            filter_keys={"project_id": [self.project.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            having=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_condition_projectname_transform(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        project2 = self.create_project(organization=self.organization)

        # project.name is in the public schema and should be converted to a
        # project_id condition.
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query=f"project.name:{project2.slug}",
            params={"project_id": [self.project.id, project2.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["project_id", "=", project2.id]],
            filter_keys={"project_id": [project2.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            having=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_params_forward(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="http.method:GET",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            having=[],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        discover.query(
            selected_columns=["transaction", "avg(transaction.duration)"],
            query="http.method:GET avg(transaction.duration):>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[["avg", "duration", "avg_transaction_duration"]],
            having=[["avg_transaction_duration", ">", 5]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_alias_aggregate_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        discover.query(
            selected_columns=["transaction", "p95()"],
            query="http.method:GET p95():>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )

        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[["quantile(0.95)", "duration", "p95"]],
            having=[["p95", ">", 5]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_duration_aliases(self, mock_query):
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        test_cases = [
            ("1ms", 1),
            ("1.5s", 1500),
            ("23.4m", 1000 * 60 * 23.4),
            ("1.00min", 1000 * 60),
            ("3.45hr", 1000 * 60 * 60 * 3.45),
            ("1.23h", 1000 * 60 * 60 * 1.23),
            ("3wk", 1000 * 60 * 60 * 24 * 7 * 3),
            ("2.1w", 1000 * 60 * 60 * 24 * 7 * 2.1),
        ]
        for query_string, value in test_cases:
            mock_query.return_value = {
                "meta": [{"name": "transaction"}, {"name": "duration"}],
                "data": [{"transaction": "api.do_things", "duration": 200}],
            }
            discover.query(
                selected_columns=["transaction", "p95()"],
                query=f"http.method:GET p95():>{query_string}",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
            )

            mock_query.assert_called_with(
                selected_columns=["transaction"],
                conditions=[["http_method", "=", "GET"]],
                filter_keys={"project_id": [self.project.id]},
                groupby=["transaction"],
                dataset=Dataset.Discover,
                aggregations=[["quantile(0.95)", "duration", "p95"]],
                having=[["p95", ">", value]],
                end=end_time,
                start=start_time,
                orderby=None,
                limit=50,
                offset=None,
                referrer=None,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_alias_aggregate_conditions_with_brackets(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        discover.query(
            selected_columns=["transaction", "p95()"],
            query="http.method:GET p95():>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )

        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[["quantile(0.95)", "duration", "p95"]],
            having=[["p95", ">", 5]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_date_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        discover.query(
            selected_columns=[
                "transaction",
                "avg(transaction.duration)",
                "stddev(transaction.duration)",
                "max(timestamp)",
            ],
            query="http.method:GET max(timestamp):>2019-12-01",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[
                ["avg", "duration", "avg_transaction_duration"],
                ["stddevSamp", "duration", "stddev_transaction_duration"],
                ["max", "timestamp", "max_timestamp"],
            ],
            having=[["max_timestamp", ">", 1575158400]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_duration_alias(self, mock_query):
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        test_cases = [
            ("1ms", 1),
            ("1.5s", 1500),
            ("1.00min", 1000 * 60),
            ("3.45hr", 1000 * 60 * 60 * 3.45),
        ]
        for query_string, value in test_cases:
            mock_query.return_value = {
                "meta": [{"name": "transaction"}, {"name": "duration"}],
                "data": [{"transaction": "api.do_things", "duration": 200}],
            }
            discover.query(
                selected_columns=[
                    "transaction",
                    "avg(transaction.duration)",
                    "stddev(transaction.duration)",
                    "max(timestamp)",
                ],
                query=f"http.method:GET avg(transaction.duration):>{query_string}",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
            )
            mock_query.assert_called_with(
                selected_columns=["transaction"],
                conditions=[["http_method", "=", "GET"]],
                filter_keys={"project_id": [self.project.id]},
                groupby=["transaction"],
                dataset=Dataset.Discover,
                aggregations=[
                    ["avg", "duration", "avg_transaction_duration"],
                    ["stddevSamp", "duration", "stddev_transaction_duration"],
                    ["max", "timestamp", "max_timestamp"],
                ],
                having=[["avg_transaction_duration", ">", value]],
                end=end_time,
                start=start_time,
                orderby=None,
                limit=50,
                offset=None,
                referrer=None,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_condition_missing_selected_column(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["transaction"],
                query="http.method:GET max(timestamp):>5",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_condition_missing_with_auto(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["transaction"],
                query="http.method:GET max(timestamp):>5",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
                auto_aggregations=True,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_no_aggregate_conditions_with_auto(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        with pytest.raises(AssertionError):
            discover.query(
                selected_columns=["transaction"],
                query="http.method:GET max(timestamp):>5",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=False,
                auto_aggregations=True,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_auto_aggregation(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        discover.query(
            selected_columns=["transaction", "p95()"],
            query="http.method:GET max(timestamp):>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
            auto_aggregations=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                ["quantile(0.95)", "duration", "p95"],
                ["max", "timestamp", "max_timestamp"],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            start=start_time,
            end=end_time,
            orderby=None,
            having=[["max_timestamp", ">", 5.0]],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_auto_aggregation_with_boolean_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        discover.query(
            selected_columns=["transaction", "min(timestamp)"],
            query="max(timestamp):>5 AND min(timestamp):<10",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
            auto_aggregations=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                ["min", "timestamp", "min_timestamp"],
                ["max", "timestamp", "max_timestamp"],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            start=start_time,
            end=end_time,
            orderby=None,
            having=[["max_timestamp", ">", 5.0], ["min_timestamp", "<", 10.0]],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_function_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "percentile_transaction_duration_0_75"}],
            "data": [
                {"transaction": "api.do_things", "percentile_transaction_duration_0_75": 1123}
            ],
        }
        discover.query(
            selected_columns=["transaction", "percentile(transaction.duration, 0.75)"],
            query="percentile(transaction.duration, 0.75):>100",
            params={"project_id": [self.project.id]},
            auto_fields=True,
            use_aggregate_conditions=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["quantile(0.75)", "duration", "percentile_transaction_duration_0_75"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[["percentile_transaction_duration_0_75", ">", 100]],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_find_histogram_min_max(self, mock_query):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            # no rows returned from snuba
            mock_query.side_effect = [{"meta": [], "data": []}]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, None, "", {"project_id": [self.project.id]}
            )
            assert values == (None, None), f"failing for {array_column}"

            # more than 2 rows returned snuba
            mock_query.side_effect = [{"meta": [], "data": [{}, {}]}]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, None, "", {"project_id": [self.project.id]}
            )
            assert values == (None, None), f"failing for {array_column}"

            # None rows are returned from snuba
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"max_{alias}_foo"},
                    ],
                    "data": [{f"min_{alias}_foo": None, f"max_{alias}_foo": None}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, None, "", {"project_id": [self.project.id]}
            )
            assert values == (None, None), f"failing for {array_column}"

            # use the given min/max
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], 1, 2, "", {"project_id": [self.project.id]}
            )
            assert values == (1, 2), f"failing for {array_column}"

            # use the given min, but query for max
            mock_query.side_effect = [
                {
                    "meta": [{"name": f"max_{alias}_foo"}],
                    "data": [{f"max_{alias}_foo": 3.45}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], 1.23, None, "", {"project_id": [self.project.id]}
            )
            assert values == (
                1.23,
                3.45,
            ), f"failing for {array_column}"

            # use the given min, but query for max. the given min will be above
            # the queried max
            mock_query.side_effect = [
                {
                    "meta": [{"name": f"max_{alias}_foo"}],
                    "data": [{f"max_{alias}_foo": 3.45}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], 3.5, None, "", {"project_id": [self.project.id]}
            )
            assert values == (
                3.5,
                3.5,
            ), f"failing for {array_column}"

            # use the given max, but query for min. the given max will be below
            # the queried min
            mock_query.side_effect = [
                {
                    "meta": [{"name": f"min_{alias}_foo"}],
                    "data": [{f"min_{alias}_foo": 3.45}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, 3.4, "", {"project_id": [self.project.id]}
            )
            assert values == (
                3.4,
                3.4,
            ), f"failing for {array_column}"

            # use the given max, but query for min
            mock_query.side_effect = [
                {
                    "meta": [{"name": f"min_{alias}_foo"}],
                    "data": [{f"min_{alias}_foo": 1.23}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, 3.45, "", {"project_id": [self.project.id]}
            )
            assert values == (
                1.23,
                3.45,
            ), f"failing for {array_column}"

            # single min/max returned from snuba
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"max_{alias}_foo"},
                    ],
                    "data": [{f"min_{alias}_foo": 1.23, f"max_{alias}_foo": 3.45}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, None, "", {"project_id": [self.project.id]}
            )
            assert values == (
                1.23,
                3.45,
            ), f"failing for {array_column}"

            # multiple min/max returned from snuba
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"min_{alias}_bar"},
                        {"name": f"min_{alias}_baz"},
                        {"name": f"max_{alias}_foo"},
                        {"name": f"max_{alias}_bar"},
                        {"name": f"max_{alias}_baz"},
                    ],
                    "data": [
                        {
                            f"min_{alias}_foo": 1.23,
                            f"min_{alias}_bar": 1.34,
                            f"min_{alias}_baz": 1.45,
                            f"max_{alias}_foo": 3.45,
                            f"max_{alias}_bar": 3.56,
                            f"max_{alias}_baz": 3.67,
                        }
                    ],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo", f"{alias}.bar", f"{alias}.baz"],
                None,
                None,
                "",
                {"project_id": [self.project.id]},
            )
            assert values == (
                1.23,
                3.67,
            ), f"failing for {array_column}"

            # multiple min/max with some Nones returned from snuba
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"min_{alias}_bar"},
                        {"name": f"min_{alias}_baz"},
                        {"name": f"max_{alias}_foo"},
                        {"name": f"max_{alias}_bar"},
                        {"name": f"max_{alias}_baz"},
                    ],
                    "data": [
                        {
                            f"min_{alias}_foo": 1.23,
                            f"min_{alias}_bar": None,
                            f"min_{alias}_baz": 1.45,
                            f"max_{alias}_foo": 3.45,
                            f"max_{alias}_bar": None,
                            f"max_{alias}_baz": 3.67,
                        }
                    ],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo", f"{alias}.bar", f"{alias}.baz"],
                None,
                None,
                "",
                {"project_id": [self.project.id]},
            )
            assert values == (
                1.23,
                3.67,
            ), f"failing for {array_column}"

    def test_find_histogram_params(self):
        # min and max is None
        assert discover.find_histogram_params(1, None, None, 1) == (1, 1, 0, 1)
        # min is None
        assert discover.find_histogram_params(1, None, 1, 10) == (1, 1, 0, 10)
        # max is None
        assert discover.find_histogram_params(1, 1, None, 100) == (1, 1, 100, 100)

        assert discover.find_histogram_params(10, 0, 9, 1) == (10, 1, 0, 1)
        assert discover.find_histogram_params(10, 0, 10, 1) == (6, 2, 0, 1)
        assert discover.find_histogram_params(10, 0, 99, 1) == (10, 10, 0, 1)
        assert discover.find_histogram_params(10, 0, 100, 1) == (6, 20, 0, 1)
        assert discover.find_histogram_params(5, 10, 19, 10) == (5, 20, 100, 10)
        assert discover.find_histogram_params(5, 10, 19.9, 10) == (5, 20, 100, 10)
        assert discover.find_histogram_params(10, 10, 20, 1) == (6, 2, 10, 1)
        assert discover.find_histogram_params(10, 10, 20, 10) == (6, 20, 100, 10)
        assert discover.find_histogram_params(10, 10, 20, 100) == (9, 120, 1000, 100)

    def test_normalize_histogram_results_empty(self):
        for array_column in ARRAY_COLUMNS:
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{array_column}.foo"],
                f"array_join({array_column}_key)",
                discover.HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{array_column}.foo": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_empty_multiple(self):
        for array_column in ARRAY_COLUMNS:
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{array_column}.bar", f"{array_column}.foo"],
                f"array_join({array_column}_key)",
                discover.HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{array_column}.bar": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
                f"{array_column}.foo": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_full(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 1,
                        "count": 2,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 1,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.foo"],
                f"array_join({array_column}_key)",
                discover.HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 2},
                    {"bin": 2, "count": 1},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_full_multiple(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 1,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 1,
                        "count": 2,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 1,
                        "count": 2,
                    },
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 1,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.bar", f"{alias}.foo"],
                f"array_join({array_column}_key)",
                discover.HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.bar": [
                    {"bin": 0, "count": 1},
                    {"bin": 1, "count": 2},
                    {"bin": 2, "count": 3},
                ],
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 2},
                    {"bin": 2, "count": 1},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_partial(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.foo"],
                f"array_join({array_column}_key)",
                discover.HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_partial_multiple(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 3,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.bar", f"{alias}.foo"],
                f"array_join({array_column}_key)",
                discover.HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.bar": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 3},
                ],
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_ignore_unexpected_rows(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                    # this row shouldn't be used because "baz" isn't an expected array_column
                    {
                        f"array_join_{array_column}_key": "baz",
                        f"histogram_{array_column}_value_1_0_1": 1,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 3,
                    },
                    # this row shouldn't be used because 3 isn't an expected bin
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 3,
                        "count": 3,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.bar", f"{alias}.foo"],
                f"array_join({array_column}_key)",
                discover.HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.bar": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 3},
                ],
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_adjust_for_precision(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_25_0_100": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_25_0_100": 0,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_25_0_100": 25,
                        "count": 2,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_25_0_100": 50,
                        "count": 1,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_25_0_100": 75,
                        "count": 1,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.foo"],
                f"array_join({array_column}_key)",
                discover.HistogramParams(4, 25, 0, 100),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 0.25, "count": 2},
                    {"bin": 0.50, "count": 1},
                    {"bin": 0.75, "count": 1},
                ],
            }, f"failing for {array_column}"

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_query(self, mock_query):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"max_{alias}_foo"},
                    ],
                    "data": [
                        {
                            f"min_{alias}_bar": 2,
                            f"min_{alias}_foo": 0,
                            f"max_{alias}_bar": 2,
                            f"max_{alias}_foo": 2,
                        }
                    ],
                },
                {
                    "meta": [
                        {"name": f"array_join_{array_column}_key", "type": "String"},
                        {"name": f"histogram_{array_column}_value_1_0_1", "type": "Float64"},
                        {"name": "count", "type": "UInt64"},
                    ],
                    "data": [
                        {
                            f"array_join_{array_column}_key": "bar",
                            f"histogram_{array_column}_value_1_0_1": 0,
                            "count": 3,
                        },
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_1_0_1": 0,
                            "count": 3,
                        },
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_1_0_1": 2,
                            "count": 1,
                        },
                    ],
                },
            ]
            results = discover.histogram_query(
                [f"{alias}.bar", f"{alias}.foo"],
                "",
                {"project_id": [self.project.id]},
                3,
                0,
            )
            assert results == {
                f"{alias}.bar": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 1},
                ],
            }, f"failing for {array_column}"

    def test_histogram_query_with_bad_fields(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            with pytest.raises(InvalidSearchQuery) as err:
                discover.histogram_query(
                    [f"{alias}.bar", "transaction.duration"],
                    "",
                    {"project_id": [self.project.id]},
                    3,
                    0,
                )
            assert "multihistogram expected either all measurements or all breakdowns" in str(
                err
            ), f"failing for {array_column}"

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_query_with_optionals(self, mock_query):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"array_join_{array_column}_key", "type": "String"},
                        {"name": f"histogram_{array_column}_value_5_5_10", "type": "Float64"},
                        {"name": "count", "type": "UInt64"},
                    ],
                    "data": [
                        # this row shouldn't be used because it lies outside the boundary
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_5_5_10": 0,
                            "count": 1,
                        },
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_5_5_10": 5,
                            "count": 3,
                        },
                        {
                            f"array_join_{array_column}_key": "bar",
                            f"histogram_{array_column}_value_5_5_10": 10,
                            "count": 2,
                        },
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_5_5_10": 15,
                            "count": 1,
                        },
                        # this row shouldn't be used because it lies outside the boundary
                        {
                            f"array_join_{array_column}_key": "bar",
                            f"histogram_{array_column}_value_5_5_10": 30,
                            "count": 2,
                        },
                    ],
                },
            ]
            results = discover.histogram_query(
                [f"{alias}.bar", f"{alias}.foo"],
                "",
                {"project_id": [self.project.id]},
                3,
                1,
                0.5,
                2,
            )
            assert results == {
                f"{alias}.bar": [
                    {"bin": 0.5, "count": 0},
                    {"bin": 1.0, "count": 2},
                    {"bin": 1.5, "count": 0},
                ],
                f"{alias}.foo": [
                    {"bin": 0.5, "count": 3},
                    {"bin": 1.0, "count": 0},
                    {"bin": 1.5, "count": 1},
                ],
            }, f"failing for {array_column}"


class TimeseriesBase(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()

        self.one_min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "very bad",
                "timestamp": iso_format(self.day_ago + timedelta(hours=1)),
                "fingerprint": ["group1"],
                "tags": {"important": "yes"},
                "user": {"id": 1},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh my",
                "timestamp": iso_format(self.day_ago + timedelta(hours=1, minutes=1)),
                "fingerprint": ["group2"],
                "tags": {"important": "no"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "very bad",
                "timestamp": iso_format(self.day_ago + timedelta(hours=2, minutes=1)),
                "fingerprint": ["group2"],
                "tags": {"important": "yes"},
            },
            project_id=self.project.id,
        )


class TimeseriesQueryTest(TimeseriesBase):
    def test_invalid_field_in_function(self):
        with pytest.raises(InvalidSearchQuery):
            discover.timeseries_query(
                selected_columns=["min(transaction)"],
                query="transaction:api.issue.delete",
                params={"project_id": [self.project.id]},
                rollup=1800,
            )

    def test_missing_start_and_end(self):
        with pytest.raises(InvalidSearchQuery) as err:
            discover.timeseries_query(
                selected_columns=["count()"],
                query="transaction:api.issue.delete",
                params={"project_id": [self.project.id]},
                rollup=1800,
            )
        assert "without a start and end" in str(err)

    def test_no_aggregations(self):
        with pytest.raises(InvalidSearchQuery) as err:
            discover.timeseries_query(
                selected_columns=["transaction", "title"],
                query="transaction:api.issue.delete",
                params={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=2),
                    "project_id": [self.project.id],
                },
                rollup=1800,
            )
        assert "no aggregation" in str(err)

    def test_field_alias(self):
        result = discover.timeseries_query(
            selected_columns=["p95()"],
            query="event.type:transaction transaction:api.issue.delete",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3

    def test_failure_rate_field_alias(self):
        result = discover.timeseries_query(
            selected_columns=["failure_rate()"],
            query="event.type:transaction transaction:api.issue.delete",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3

    def test_aggregate_function(self):
        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [2] == [val["count"] for val in result.data["data"] if "count" in val]

        result = discover.timeseries_query(
            selected_columns=["count_unique(user)"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        keys = set()
        for row in result.data["data"]:
            keys.update(list(row.keys()))
        assert "count_unique_user" in keys
        assert "time" in keys

    def test_comparison_aggregate_function_invalid(self):
        with pytest.raises(
            InvalidSearchQuery, match="Only one column can be selected for comparison queries"
        ):
            discover.timeseries_query(
                selected_columns=["count()", "count_unique(user)"],
                query="",
                params={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=2),
                    "project_id": [self.project.id],
                },
                rollup=3600,
                comparison_delta=timedelta(days=1),
            )

    def test_comparison_aggregate_function(self):
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(hours=1)),
                "user": {"id": 1},
            },
            project_id=self.project.id,
        )

        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
            comparison_delta=timedelta(days=1),
        )
        assert len(result.data["data"]) == 3
        # Values should all be 0, since there is no comparison period data at all.
        assert [(0, 0), (3, 0), (0, 0)] == [
            (val.get("count", 0), val.get("comparisonCount", 0)) for val in result.data["data"]
        ]

        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(days=-1, hours=1)),
                "user": {"id": 1},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(days=-1, hours=1, minutes=2)),
                "user": {"id": 2},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(days=-1, hours=2, minutes=1)),
            },
            project_id=self.project.id,
        )

        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2, minutes=1),
                "project_id": [self.project.id],
            },
            rollup=3600,
            comparison_delta=timedelta(days=1),
        )
        assert len(result.data["data"]) == 3
        # In the second bucket we have 3 events in the current period and 2 in the comparison, so
        # we get a result of 50% increase
        assert [(0, 0), (3, 2), (0, 0)] == [
            (val.get("count", 0), val.get("comparisonCount", 0)) for val in result.data["data"]
        ]

        result = discover.timeseries_query(
            selected_columns=["count_unique(user)"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2, minutes=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
            comparison_delta=timedelta(days=1),
        )
        assert len(result.data["data"]) == 3
        # In the second bucket we have 1 unique user in the current period and 2 in the comparison, so
        # we get a result of -50%
        assert [(0, 0), (1, 2), (0, 0)] == [
            (val.get("count_unique_user", 0), val.get("comparisonCount", 0))
            for val in result.data["data"]
        ]

    def test_count_miserable(self):
        event_data = load_data("transaction")
        # Half of duration so we don't get weird rounding differences when comparing the results
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 300
        event_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=30))
        event_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=30, seconds=3))
        self.store_event(data=event_data, project_id=self.project.id)
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        project2 = self.create_project()
        ProjectTransactionThreshold.objects.create(
            project=project2,
            organization=project2.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        result = discover.timeseries_query(
            selected_columns=["count_miserable(user)"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id, project2.id],
                "organization_id": self.organization.id,
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [1] == [
            val["count_miserable_user"]
            for val in result.data["data"]
            if "count_miserable_user" in val
        ]

    def test_count_miserable_with_arithmetic(self):
        event_data = load_data("transaction")
        # Half of duration so we don't get weird rounding differences when comparing the results
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 300
        event_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=30))
        event_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=30, seconds=3))
        self.store_event(data=event_data, project_id=self.project.id)
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        project2 = self.create_project()
        ProjectTransactionThreshold.objects.create(
            project=project2,
            organization=project2.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        result = discover.timeseries_query(
            selected_columns=["equation|count_miserable(user) - 100"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id, project2.id],
                "organization_id": self.organization.id,
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [1 - 100] == [
            val["equation[0]"] for val in result.data["data"] if "equation[0]" in val
        ]

    def test_equation_function(self):
        result = discover.timeseries_query(
            selected_columns=["equation|count() / 100"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [0.02] == [val["equation[0]"] for val in result.data["data"] if "equation[0]" in val]

        result = discover.timeseries_query(
            selected_columns=["equation|count_unique(user) / 100"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        keys = set()
        for row in result.data["data"]:
            keys.update(list(row.keys()))
        assert "equation[0]" in keys
        assert "time" in keys

    def test_zerofilling(self):
        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=3),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 4, "Should have empty results"
        assert [2, 1] == [
            val["count"] for val in result.data["data"] if "count" in val
        ], result.data["data"]

    def test_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        self.store_event(
            data={"message": "hello", "timestamp": iso_format(self.one_min_ago)},
            project_id=project2.id,
        )
        self.store_event(
            data={"message": "hello", "timestamp": iso_format(self.one_min_ago)},
            project_id=project3.id,
        )

        result = discover.timeseries_query(
            selected_columns=["count()"],
            query=f"project:{self.project.slug} OR project:{project2.slug}",
            params={
                "start": before_now(minutes=5),
                "end": before_now(seconds=1),
                "project_id": [self.project.id, project2.id, project3.id],
            },
            rollup=3600,
        )

        data = result.data["data"]
        assert len([d for d in data if "count" in d]) == 1
        for d in data:
            if "count" in d:
                assert d["count"] == 1

    def test_nested_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "b" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "c" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=project2.id,
        )

        result = discover.timeseries_query(
            selected_columns=["release", "count()"],
            query="(release:{} OR release:{}) AND project:{}".format(
                "a" * 32, "b" * 32, self.project.slug
            ),
            params={
                "start": before_now(minutes=5),
                "end": before_now(seconds=1),
                "project_id": [self.project.id, project2.id],
            },
            rollup=3600,
        )

        data = result.data["data"]
        data = result.data["data"]
        assert len([d for d in data if "count" in d]) == 1
        for d in data:
            if "count" in d:
                assert d["count"] == 2


class TopEventsTimeseriesQueryTest(TimeseriesBase):
    @patch("sentry.snuba.discover.raw_query")
    def test_project_filter_adjusts_filter(self, mock_query):
        """While the function is called with 2 project_ids, we should limit it down to the 1 in top_events"""
        project2 = self.create_project(organization=self.organization)
        top_events = {
            "data": [
                {
                    "project": self.project.slug,
                    "project.id": self.project.id,
                }
            ]
        }
        start = before_now(minutes=5)
        end = before_now(seconds=1)
        discover.top_events_timeseries(
            selected_columns=["project", "count()"],
            params={
                "start": start,
                "end": end,
                "project_id": [self.project.id, project2.id],
            },
            rollup=3600,
            top_events=top_events,
            timeseries_columns=["count()"],
            user_query="",
            orderby=["count()"],
            limit=10000,
            organization=self.organization,
        )
        mock_query.assert_called_with(
            aggregations=[["count", None, "count"]],
            conditions=[],
            # Should be limited to the project in top_events
            filter_keys={"project_id": [self.project.id]},
            selected_columns=[
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{project.id}'" for project in [self.project, project2]]],
                        ["array", [f"'{project.slug}'" for project in [self.project, project2]]],
                        "''",
                    ],
                    "project",
                ],
            ],
            start=start,
            end=end,
            rollup=3600,
            orderby=["time", "project_id"],
            groupby=["time", "project_id"],
            dataset=Dataset.Discover,
            limit=10000,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_timestamp_fields(self, mock_query):
        timestamp1 = before_now(days=2, minutes=5)
        timestamp2 = before_now(minutes=2)
        top_events = {
            "data": [
                {
                    "timestamp": iso_format(timestamp1),
                    "timestamp.to_hour": iso_format(timestamp1.replace(minute=0, second=0)),
                    "timestamp.to_day": iso_format(timestamp1.replace(hour=0, minute=0, second=0)),
                },
                {
                    "timestamp": iso_format(timestamp2),
                    "timestamp.to_hour": iso_format(timestamp2.replace(minute=0, second=0)),
                    "timestamp.to_day": iso_format(timestamp2.replace(hour=0, minute=0, second=0)),
                },
            ]
        }
        start = before_now(days=3, minutes=10)
        end = before_now(minutes=1)
        discover.top_events_timeseries(
            selected_columns=["timestamp", "timestamp.to_day", "timestamp.to_hour", "count()"],
            params={
                "start": start,
                "end": end,
                "project_id": [self.project.id],
            },
            rollup=3600,
            top_events=top_events,
            timeseries_columns=["count()"],
            user_query="",
            orderby=["count()"],
            limit=10000,
            organization=self.organization,
        )
        to_hour = ["toStartOfHour", ["timestamp"], "timestamp.to_hour"]
        to_day = ["toStartOfDay", ["timestamp"], "timestamp.to_day"]
        mock_query.assert_called_with(
            aggregations=[["count", None, "count"]],
            conditions=[
                # Each timestamp field should generated a nested condition.
                # Within each, the conditions will be ORed together.
                [
                    ["timestamp", "=", iso_format(timestamp1)],
                    ["timestamp", "=", iso_format(timestamp2)],
                ],
                [
                    [
                        to_day,
                        "=",
                        iso_format(timestamp1.replace(hour=0, minute=0, second=0)),
                    ],
                    [
                        to_day,
                        "=",
                        iso_format(timestamp2.replace(hour=0, minute=0, second=0)),
                    ],
                ],
                [
                    [to_hour, "=", iso_format(timestamp1.replace(minute=0, second=0))],
                    [to_hour, "=", iso_format(timestamp2.replace(minute=0, second=0))],
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            selected_columns=[
                "timestamp",
                to_day,
                to_hour,
            ],
            start=start,
            end=end,
            rollup=3600,
            orderby=["time", "timestamp", "timestamp.to_day", "timestamp.to_hour"],
            groupby=["time", "timestamp", "timestamp.to_day", "timestamp.to_hour"],
            dataset=Dataset.Discover,
            limit=10000,
            referrer=None,
        )


def format_project_event(project_slug, event_id):
    return f"{project_slug}:{event_id}"


class GetFacetsTest(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()

        self.project = self.create_project()
        self.min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1)

    def test_invalid_query(self):
        with pytest.raises(InvalidSearchQuery):
            discover.get_facets(
                "\n",
                {"project_id": [self.project.id], "end": self.min_ago, "start": self.day_ago},
                "testing.get-facets-test",
            )

    def test_no_results(self):
        results = discover.get_facets(
            "",
            {"project_id": [self.project.id], "end": self.min_ago, "start": self.day_ago},
            "testing.get-facets-test",
        )
        assert results == []

    def test_single_project(self):
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "red", "paying": "1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "blue", "paying": "0"},
            },
            project_id=self.project.id,
        )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("", params, "testing.get-facets-test")
        assert len(result) == 5
        assert {r.key for r in result} == {"color", "paying", "level"}
        assert {r.value for r in result} == {"red", "blue", "1", "0", "error"}
        assert {r.count for r in result} == {1, 2}

    def test_project_filter(self):
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        other_project = self.create_project()
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"toy": "train"},
            },
            project_id=other_project.id,
        )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("", params, "testing.get-facets-test")
        keys = {r.key for r in result}
        assert keys == {"color", "level"}

        # Query more than one project.
        params = {
            "project_id": [self.project.id, other_project.id],
            "start": self.day_ago,
            "end": self.min_ago,
        }
        result = discover.get_facets("", params, "testing.get-facets-test")
        keys = {r.key for r in result}
        assert keys == {"level", "toy", "color", "project"}

        projects = [f for f in result if f.key == "project"]
        assert [p.count for p in projects] == [1, 1]

    def test_environment_promoted_tag(self):
        for env in ("prod", "staging", None):
            self.store_event(
                data={
                    "message": "very bad",
                    "type": "default",
                    "environment": env,
                    "timestamp": iso_format(before_now(minutes=2)),
                },
                project_id=self.project.id,
            )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("", params, "testing.get-facets-test")
        keys = {r.key for r in result}
        assert keys == {"environment", "level"}
        assert {None, "prod", "staging"} == {f.value for f in result if f.key == "environment"}
        assert {1} == {f.count for f in result if f.key == "environment"}

    def test_query_string(self):
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "message": "oh my",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"toy": "train"},
            },
            project_id=self.project.id,
        )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("bad", params, "testing.get-facets-test")
        keys = {r.key for r in result}
        assert "color" in keys
        assert "toy" not in keys

        result = discover.get_facets("color:red", params, "testing.get-facets-test")
        keys = {r.key for r in result}
        assert "color" in keys
        assert "toy" not in keys

    def test_query_string_with_aggregate_condition(self):
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "message": "oh my",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"toy": "train"},
            },
            project_id=self.project.id,
        )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("bad", params, "testing.get-facets-test")
        keys = {r.key for r in result}
        assert "color" in keys
        assert "toy" not in keys

        result = discover.get_facets("color:red p95():>1", params, "testing.get-facets-test")
        keys = {r.key for r in result}
        assert "color" in keys
        assert "toy" not in keys

    def test_date_params(self):
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "message": "oh my",
                "type": "default",
                "timestamp": iso_format(before_now(days=2)),
                "tags": {"toy": "train"},
            },
            project_id=self.project.id,
        )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("", params, "testing.get-facets-test")
        keys = {r.key for r in result}
        assert "color" in keys
        assert "toy" not in keys


def test_zerofill():
    results = discover.zerofill(
        {}, datetime(2019, 1, 2, 0, 0), datetime(2019, 1, 9, 23, 59, 59), 86400, "time"
    )
    results_desc = discover.zerofill(
        {}, datetime(2019, 1, 2, 0, 0), datetime(2019, 1, 9, 23, 59, 59), 86400, "-time"
    )

    assert results == list(reversed(results_desc))

    # Bucket for the 2, 3, 4, 5, 6, 7, 8, 9
    assert len(results) == 8

    assert results[0]["time"] == 1546387200
    assert results[7]["time"] == 1546992000


class ArithmeticTest(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        event_data = load_data("transaction")
        # Half of duration so we don't get weird rounding differences when comparing the results
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 1500
        event_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=30))
        event_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=30, seconds=3))
        self.store_event(data=event_data, project_id=self.project.id)
        self.params = {"project_id": [self.project.id]}
        self.query = "event.type:transaction"

    def test_simple(self):
        results = discover.query(
            selected_columns=[
                "spans.http",
                "transaction.duration",
            ],
            equations=["spans.http / transaction.duration"],
            query=self.query,
            params=self.params,
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert result["equation[0]"] == result["spans.http"] / result["transaction.duration"]

    def test_multiple_equations(self):
        results = discover.query(
            selected_columns=[
                "spans.http",
                "transaction.duration",
            ],
            equations=[
                "spans.http / transaction.duration",
                "transaction.duration / spans.http",
                "1500 + transaction.duration",
            ],
            query=self.query,
            params=self.params,
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert result["equation[0]"] == result["spans.http"] / result["transaction.duration"]
        assert result["equation[1]"] == result["transaction.duration"] / result["spans.http"]
        assert result["equation[2]"] == 1500 + result["transaction.duration"]

    def test_invalid_field(self):
        with self.assertRaises(ArithmeticValidationError):
            discover.query(
                selected_columns=[
                    "spans.http",
                    "transaction.status",
                ],
                # while transaction_status is a uint8, there's no reason we should allow arith on it
                equations=["spans.http / transaction.status"],
                query=self.query,
                params=self.params,
            )

    def test_invalid_function(self):
        with self.assertRaises(ArithmeticValidationError):
            discover.query(
                selected_columns=[
                    "p50(transaction.duration)",
                    "last_seen()",
                ],
                equations=["p50(transaction.duration) / last_seen()"],
                query=self.query,
                params=self.params,
            )

    def test_unselected_field(self):
        with self.assertRaises(InvalidSearchQuery):
            discover.query(
                selected_columns=[
                    "spans.http",
                ],
                equations=["spans.http / transaction.duration"],
                query=self.query,
                params=self.params,
            )

    def test_unselected_function(self):
        with self.assertRaises(InvalidSearchQuery):
            discover.query(
                selected_columns=[
                    "p50(transaction.duration)",
                ],
                equations=["p50(transaction.duration) / p100(transaction.duration)"],
                query=self.query,
                params=self.params,
            )

    def test_orderby_equation(self):
        for i in range(1, 3):
            event_data = load_data("transaction")
            # Half of duration so we don't get weird rounding differences when comparing the results
            event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 300 * i
            event_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=30))
            event_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=30, seconds=3))
            self.store_event(data=event_data, project_id=self.project.id)
        query_params = {
            "selected_columns": [
                "spans.http",
                "transaction.duration",
            ],
            "equations": [
                "spans.http / transaction.duration",
                "transaction.duration / spans.http",
                "1500 + transaction.duration",
            ],
            "orderby": ["equation[0]"],
            "query": self.query,
            "params": self.params,
        }
        results = discover.query(**query_params)
        assert len(results["data"]) == 3
        assert [result["equation[0]"] for result in results["data"]] == [0.1, 0.2, 0.5]

        query_params["orderby"] = ["equation[1]"]
        results = discover.query(**query_params)
        assert len(results["data"]) == 3
        assert [result["equation[1]"] for result in results["data"]] == [2, 5, 10]

        query_params["orderby"] = ["-equation[0]"]
        results = discover.query(**query_params)
        assert len(results["data"]) == 3
        assert [result["equation[0]"] for result in results["data"]] == [0.5, 0.2, 0.1]

    def test_orderby_nonexistent_equation(self):
        with self.assertRaises(InvalidSearchQuery):
            discover.query(
                selected_columns=[
                    "spans.http",
                    "transaction.duration",
                ],
                orderby=["equation[1]"],
                query=self.query,
                params=self.params,
            )

    def test_equation_without_field_or_function(self):
        with self.assertRaises(InvalidSearchQuery):
            discover.query(
                selected_columns=[
                    "spans.http",
                    "transaction.duration",
                ],
                equations=[
                    "5 + 5",
                ],
                query=self.query,
                params=self.params,
            )

    def test_aggregate_equation(self):
        results = discover.query(
            selected_columns=[
                "p50(transaction.duration)",
            ],
            equations=["p50(transaction.duration) / 2"],
            query=self.query,
            params=self.params,
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert result["equation[0]"] == result["p50_transaction_duration"] / 2

    def test_multiple_aggregate_equation(self):
        results = discover.query(
            selected_columns=[
                "p50(transaction.duration)",
                "count()",
            ],
            equations=["p50(transaction.duration) + 2", "p50(transaction.duration) / count()"],
            query=self.query,
            params=self.params,
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert result["equation[0]"] == result["p50_transaction_duration"] + 2
        assert result["equation[1]"] == result["p50_transaction_duration"] / result["count"]

    def test_multiple_operators(self):
        results = discover.query(
            selected_columns=[
                "p50(transaction.duration)",
                "p100(transaction.duration)",
                "count()",
            ],
            equations=[
                "p50(transaction.duration) / p100(transaction.duration) * 100",
                "100 + count() * 5 - 3 / 5",
                "count() + count() / count() * count() - count()",
            ],
            query=self.query,
            params=self.params,
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert (
            result["equation[0]"]
            == result["p50_transaction_duration"] / result["p100_transaction_duration"] * 100
        )
        assert result["equation[1]"] == 100 + result["count"] * 5 - 3 / 5
        assert (
            result["equation[2]"]
            == result["count"]
            + result["count"] / result["count"] * result["count"]
            - result["count"]
        )

    def test_nan_equation_results(self):
        for i in range(1, 3):
            event_data = load_data("transaction")
            # Half of duration so we don't get weird rounding differences when comparing the results
            event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 0
            event_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=30))
            event_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=30, seconds=3))
            self.store_event(data=event_data, project_id=self.project.id)
        query_params = {
            "selected_columns": [
                "spans.http",
                "transaction.duration",
            ],
            "equations": [
                "transaction.duration / spans.http",  # inf
                "spans.http / spans.http",  # nan
            ],
            "orderby": ["equation[0]"],
            "query": self.query,
            "params": self.params,
        }
        results = discover.query(**query_params)
        assert len(results["data"]) == 3
        assert [result["equation[0]"] for result in results["data"]] == [2, None, None]

        query_params["orderby"] = ["equation[1]"]
        results = discover.query(**query_params)
        assert len(results["data"]) == 3
        assert [result["equation[1]"] for result in results["data"]] == [1, 0, 0]

        query_params["orderby"] = ["-equation[0]"]
        results = discover.query(**query_params)
        assert len(results["data"]) == 3
        assert [result["equation[0]"] for result in results["data"]] == [None, None, 2]
