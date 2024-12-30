from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.discover.arithmetic import ArithmeticValidationError
from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import InvalidSearchQuery
from sentry.models.projectteam import ProjectTeam
from sentry.models.releaseprojectenvironment import ReleaseStages
from sentry.models.transaction_threshold import (
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.search.events.constants import (
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.search.events.types import SnubaParams
from sentry.snuba import discover, transactions
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data

ARRAY_COLUMNS = ["measurements", "span_op_breakdowns"]


class TransactionQueryIntegrationTest(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.environment = self.create_environment(self.project, name="prod")
        self.release = self.create_release(self.project, version="first-release")
        self.now = before_now()
        self.one_min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)

        self.event_time = self.one_min_ago
        # error event
        data = load_data("javascript")
        data["timestamp"] = before_now(minutes=10).isoformat()
        self.store_event(data=data, project_id=self.project.id)

        # transaction event
        data = load_data("transaction", timestamp=self.event_time)
        data["transaction"] = "a" * 32
        data["user"] = {"id": "99", "email": "bruce@example.com", "username": "brucew"}
        data["release"] = "first-release"
        data["environment"] = self.environment.name
        data["tags"] = [["key1", "value1"]]
        self.event = self.store_event(data=data, project_id=self.project.id)

        self.snuba_params = SnubaParams(
            organization=self.organization,
            projects=[self.project],
            start=before_now(days=1),
            end=self.now,
        )

    def test_transaction_query(self):
        result = transactions.query(
            selected_columns=["transaction"],
            query="",
            snuba_params=self.snuba_params,
            referrer="test_transactions_query",
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0] == {"transaction": "a" * 32}

    def test_error_event_type_query(self):
        results = transactions.query(
            selected_columns=["count()", "any(transaction)", "any(user.id)"],
            query="event.type:error",
            snuba_params=SnubaParams(
                start=before_now(minutes=5),
                end=before_now(seconds=1),
                projects=[self.project],
            ),
            referrer="discover",
            use_aggregate_conditions=True,
        )

        data = results["data"]
        assert data[0]["count"] == 0

    def test_any_function(self):
        results = transactions.query(
            selected_columns=["count()", "any(transaction)", "any(user.id)"],
            query="event.type:transaction",
            snuba_params=SnubaParams(
                start=before_now(minutes=5),
                end=before_now(seconds=1),
                projects=[self.project],
            ),
            referrer="discover",
            use_aggregate_conditions=True,
        )

        data = results["data"]
        assert len(data) == 1
        assert data[0]["any_transaction"] == "a" * 32
        assert data[0]["any_user_id"] == "99"
        assert data[0]["count"] == 1

    def test_auto_fields_aggregates(self):
        result = transactions.query(
            selected_columns=["count_unique(user.email)"],
            referrer="discover",
            query="",
            snuba_params=self.snuba_params,
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["count_unique_user_email"] == 1

    def test_auto_fields_simple_fields(self):
        result = transactions.query(
            selected_columns=["user.email", "release"],
            referrer="discover",
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

    def test_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "b" * 32
        self.event = self.store_event(data=data, project_id=project2.id)

        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "c" * 32
        self.event = self.store_event(data=data, project_id=project3.id)

        result = transactions.query(
            selected_columns=["project", "transaction"],
            query=f"project:{self.project.slug} OR project:{project2.slug}",
            snuba_params=SnubaParams(
                start=self.two_min_ago,
                end=self.now,
                projects=[self.project, project2],
            ),
            orderby=["transaction"],
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 2
        assert data[0]["project"] == self.project.slug
        assert data[1]["project"] == project2.slug

    def test_nested_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)

        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["release"] = "a" * 32
        self.event = self.store_event(data=data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["release"] = "b" * 32
        self.event = self.store_event(data=data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["release"] = "c" * 32
        self.event = self.store_event(data=data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["release"] = "a" * 32
        self.event = self.store_event(data=data, project_id=project2.id)

        result = transactions.query(
            selected_columns=["release"],
            query="(release:{} OR release:{}) AND project:{}".format(
                "a" * 32, "b" * 32, self.project.slug
            ),
            snuba_params=SnubaParams(
                start=self.two_min_ago,
                end=self.now,
                projects=[self.project, project2],
            ),
            orderby=["release"],
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 2
        assert data[0]["release"] == "a" * 32
        assert data[1]["release"] == "b" * 32

    def test_environment_condition(self):
        result = transactions.query(
            selected_columns=["id", "message"],
            query=f"environment:{self.create_environment(self.project).name}",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(result["data"]) == 0

        result = transactions.query(
            selected_columns=["id", "message"],
            query=f"environment:{self.environment.name}",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == "a" * 32

    def test_field_alias_with_component(self):
        result = transactions.query(
            selected_columns=["project.id", "user", "user.email"],
            query="",
            snuba_params=self.snuba_params,
            referrer="discover",
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
        result = transactions.query(
            selected_columns=["project.id", "count_unique(user.email)"],
            query="",
            snuba_params=self.snuba_params,
            auto_fields=True,
            referrer="discover",
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["count_unique_user_email"] == 1

    def test_field_aliasing_in_conditions(self):
        result = transactions.query(
            selected_columns=["project.id", "user.email"],
            query="user.email:bruce@example.com",
            snuba_params=self.snuba_params,
            referrer="discover",
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "bruce@example.com"

    def test_field_aliasing_in_selected_columns(self):
        result = transactions.query(
            selected_columns=["project.id", "user", "release", "timestamp.to_hour"],
            query="",
            snuba_params=self.snuba_params,
            referrer="discover",
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

    def test_latest_release_condition(self):
        result = transactions.query(
            selected_columns=["id", "message"],
            query="release:latest",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == self.event.transaction
        assert "event_id" not in data[0]

    def test_message_filter(self):
        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "oh yeah"
        self.event = self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "oh no"
        self.event = self.store_event(data, project_id=self.project.id)

        tests: list[tuple[str, list[str]]] = [
            ('message:"oh no"', ["oh no"]),
            ('message:"oh yeah"', ["oh yeah"]),
            ('message:""', []),
            ("has:message", ["a" * 32, "oh no", "oh yeah"]),
            ("!has:message", []),
            ("message:oh*", ["oh no", "oh yeah"]),
            ('message:"oh *"', ["oh no", "oh yeah"]),
            ('message:["oh meh"]', []),
            ('message:["oh yeah"]', ["oh yeah"]),
            ('message:["oh yeah", "oh no"]', ["oh no", "oh yeah"]),
        ]

        for query, expected in tests:
            result = transactions.query(
                selected_columns=["message"],
                query=query,
                snuba_params=self.snuba_params,
                orderby=["message"],
                referrer="test_discover_query",
            )

            data = result["data"]
            assert len(data) == len(expected)
            assert [item["message"] for item in data] == expected

    def test_release_condition(self):
        result = transactions.query(
            selected_columns=["id", "message"],
            query=f"release:{self.create_release(self.project).version}",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(result["data"]) == 0

        result = transactions.query(
            selected_columns=["id", "message"],
            query=f"release:{self.release.version}",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == self.event.transaction
        assert "event_id" not in data[0]

    def test_semver_condition(self):
        release_1 = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        release_3 = self.create_release(version="test@1.2.5")

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_1.version
        release_1_e_1 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_1.version
        release_1_e_2 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_2.version
        release_2_e_1 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_2.version
        release_2_e_2 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_3.version
        release_3_e_1 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_3.version
        release_3_e_2 = self.store_event(data, project_id=self.project.id).event_id

        result = transactions.query(
            selected_columns=["id"],
            query=f"{SEMVER_ALIAS}:>1.2.3",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert {r["id"] for r in result["data"]} == {
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }
        result = transactions.query(
            selected_columns=["id"],
            query=f"{SEMVER_ALIAS}:>=1.2.3",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert {r["id"] for r in result["data"]} == {
            release_1_e_1,
            release_1_e_2,
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }
        result = transactions.query(
            selected_columns=["id"],
            query=f"{SEMVER_ALIAS}:<1.2.4",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert {r["id"] for r in result["data"]} == {release_1_e_1, release_1_e_2}
        result = transactions.query(
            selected_columns=["id"],
            query=f"!{SEMVER_ALIAS}:1.2.3",
            snuba_params=self.snuba_params,
            referrer="discover",
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

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = adopted_release.version
        data["environment"] = self.environment.name
        adopted_release_e_1 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = adopted_release.version
        data["environment"] = self.environment.name
        adopted_release_e_2 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = replaced_release.version
        data["environment"] = self.environment.name
        replaced_release_e_1 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = replaced_release.version
        data["environment"] = self.environment.name
        replaced_release_e_2 = self.store_event(data, project_id=self.project.id).event_id

        self.snuba_params.environments = [self.environment]

        result = transactions.query(
            selected_columns=["id"],
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED.value}",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert {r["id"] for r in result["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
        }

        result = transactions.query(
            selected_columns=["id"],
            query=f"!{RELEASE_STAGE_ALIAS}:{ReleaseStages.LOW_ADOPTION.value}",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert {r["id"] for r in result["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
            replaced_release_e_1,
            replaced_release_e_2,
        }
        result = transactions.query(
            selected_columns=["id"],
            query=f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED.value}, {ReleaseStages.REPLACED.value}]",
            snuba_params=self.snuba_params,
            referrer="discover",
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

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_1.version
        data["environment"] = self.environment.name
        release_1_e_1 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_1.version
        data["environment"] = self.environment.name
        release_1_e_2 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_2.version
        data["environment"] = self.environment.name
        release_2_e_1 = self.store_event(data, project_id=self.project.id).event_id

        result = transactions.query(
            selected_columns=["id"],
            referrer="discover",
            query=f"{SEMVER_PACKAGE_ALIAS}:test",
            snuba_params=self.snuba_params,
        )
        assert {r["id"] for r in result["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }
        result = transactions.query(
            selected_columns=["id"],
            query=f"{SEMVER_PACKAGE_ALIAS}:test2",
            referrer="discover",
            snuba_params=self.snuba_params,
        )
        assert {r["id"] for r in result["data"]} == {
            release_2_e_1,
        }

    def test_semver_build_condition(self):
        release_1 = self.create_release(version="test@1.2.3+123")
        release_2 = self.create_release(version="test2@1.2.4+124")

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_1.version
        data["environment"] = self.environment.name
        release_1_e_1 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_1.version
        data["environment"] = self.environment.name
        release_1_e_2 = self.store_event(data, project_id=self.project.id).event_id

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["release"] = release_2.version
        data["environment"] = self.environment.name
        release_2_e_1 = self.store_event(data, project_id=self.project.id).event_id

        result = transactions.query(
            selected_columns=["id"],
            query=f"{SEMVER_BUILD_ALIAS}:123",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert {r["id"] for r in result["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }
        result = transactions.query(
            selected_columns=["id"],
            query=f"{SEMVER_BUILD_ALIAS}:124",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert {r["id"] for r in result["data"]} == {
            release_2_e_1,
        }
        result = transactions.query(
            selected_columns=["id"],
            query=f"{SEMVER_BUILD_ALIAS}:>=123",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert {r["id"] for r in result["data"]} == {release_1_e_1, release_1_e_2, release_2_e_1}

    def test_message_orderby(self):
        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "oh yeah"
        self.event = self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "oh no"
        self.event = self.store_event(data, project_id=self.project.id)

        tests = [
            ("message", ["a" * 32, "oh no", "oh yeah"]),
            (
                "-message",
                [
                    "oh yeah",
                    "oh no",
                    "a" * 32,
                ],
            ),
        ]

        for orderby, expected in tests:
            result = transactions.query(
                selected_columns=["message"],
                query="",
                snuba_params=self.snuba_params,
                orderby=[orderby],
                referrer="test_discover_query",
            )

            data = result["data"]
            assert len(data) == 3
            assert [item["message"] for item in data] == expected

    def test_missing_project(self):
        projects = []
        other_project = None
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            projects.append(other_project)
            data = load_data("transaction", timestamp=before_now(seconds=3))
            data["transaction"] = "ohh no"
            self.event = self.store_event(data, project_id=other_project.id)

        self.snuba_params.projects = projects

        # delete the last project so its missing
        if other_project is not None:
            other_project.delete()

        result = transactions.query(
            selected_columns=["message", "project"],
            query="",
            snuba_params=self.snuba_params,
            orderby=["project"],
            referrer="test_discover_query",
        )
        data = result["data"]
        assert len(data) == 2
        assert [item["project"] for item in data] == ["a" * 32, "z" * 32]

    def test_offsets(self):
        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "hello1"
        self.event = self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "hello2"
        self.event = self.store_event(data, project_id=self.project.id)

        result = transactions.query(
            selected_columns=["message"],
            query="",
            snuba_params=self.snuba_params,
            orderby=["message"],
            limit=1,
            offset=2,
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 1
        # because we're ording by `message`, and offset by 2, the message should be `hello2`
        # order would be a * 32, hello1, hello2
        assert data[0]["message"] == "hello2"

    def test_orderby_field_alias(self):
        events = (
            ("a" * 32, "ok", False),
            ("b" * 32, "already_exists", True),
            ("c" * 32, "aborted", None),
        )
        for event in events:
            data = load_data("transaction", timestamp=before_now(minutes=10))
            data["event_id"] = event[0]
            data["transaction"] = event[0]
            data["contexts"]["trace"]["status"] = event[1]
            self.store_event(data=data, project_id=self.project.id)

        queries = [
            ("transaction.status", [0, 6, 10]),
            ("transaction.status", [0, 6, 10]),
            ("-transaction.status", [10, 6, 0]),
            ("-transaction.status", [10, 6, 0]),
        ]

        for orderby, expected in queries:
            result = transactions.query(
                selected_columns=["transaction", "transaction.status"],
                query="",
                orderby=[orderby],
                snuba_params=SnubaParams(
                    start=before_now(minutes=12),
                    end=before_now(minutes=8),
                    projects=[self.project],
                    organization=self.organization,
                ),
                referrer="discover",
            )

            data = result["data"]
            assert [x["transaction.status"] for x in data] == expected

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

        result = transactions.query(
            selected_columns=["transaction.status"],
            query="",
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        data = result["data"]
        assert len(data) == 4
        assert {
            data[0]["transaction.status"],
            data[1]["transaction.status"],
            data[2]["transaction.status"],
            data[3]["transaction.status"],
        } == {0, 10, 6}

    def test_project_in_condition_with_or(self):
        project2 = self.create_project(organization=self.organization)
        event_data = load_data("transaction", timestamp=before_now(seconds=3))
        self.store_event(data=event_data, project_id=project2.id)
        expected = sorted([self.project.slug])

        result = transactions.query(
            selected_columns=["project"],
            query=f"project:{self.project.slug} or event.type:transaction",
            snuba_params=SnubaParams(
                start=self.two_min_ago,
                end=self.now,
                projects=[self.project, project2],
                organization=self.organization,
            ),
            orderby=["project"],
            referrer="discover",
        )
        data = result["data"]
        assert len(data) == len(expected)
        assert [item["project"] for item in data] == expected

    def test_project_mapping(self):
        other_project = self.create_project(organization=self.organization)
        self.snuba_params.projects = [other_project]

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "hello"
        self.store_event(data, project_id=other_project.id)

        result = transactions.query(
            selected_columns=["project", "message"],
            query="",
            snuba_params=self.snuba_params,
            orderby=["project"],
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["project"] == other_project.slug

    def test_sorting_and_reverse_sorting_project_name(self):
        projects = []
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            projects.append(other_project)
            data = load_data("transaction", timestamp=before_now(minutes=1))
            self.store_event(data, project_id=other_project.id)

        self.snuba_params.projects = projects

        result = transactions.query(
            selected_columns=["project", "message"],
            query="",
            snuba_params=self.snuba_params,
            orderby=["-project"],
            referrer="test_discover_query",
        )
        data = result["data"]
        assert len(data) == 3
        assert [item["project"] for item in data] == ["z" * 32, "m" * 32, "a" * 32]

        result = transactions.query(
            selected_columns=["project", "message"],
            query="",
            snuba_params=self.snuba_params,
            orderby=["project"],
            referrer="test_discover_query",
        )
        data = result["data"]
        assert len(data) == 3
        assert [item["project"] for item in data] == ["a" * 32, "m" * 32, "z" * 32]

    def test_tags_colliding_with_fields(self):
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["tags"] = [["id", "new"]]
        event = self.store_event(data, project_id=self.project.id)

        tests = [
            ("id", "", sorted([self.event.event_id, event.event_id])),
            ("id", f"id:{event.event_id}", [event.event_id]),
            ("tags[id]", "", ["", "new"]),
            ("tags[id]", "tags[id]:new", ["new"]),
        ]

        for column, query, expected in tests:
            result = transactions.query(
                selected_columns=[column],
                query=query,
                snuba_params=self.snuba_params,
                orderby=[column],
                referrer="test_discover_query",
            )
            data = result["data"]
            assert len(data) == len(expected), (query, expected)
            assert [item[column] for item in data] == expected

    def test_tags_orderby(self):
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["tags"] = [["key1", "value2"]]
        self.store_event(data, project_id=self.project.id)

        tests = [
            ("key1", "key1", ["value1", "value2"]),
            ("key1", "-key1", ["value2", "value1"]),
            ("tags[key1]", "tags[key1]", ["value1", "value2"]),
            ("tags[key1]", "-tags[key1]", ["value2", "value1"]),
        ]

        for column, orderby, expected in tests:
            result = transactions.query(
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
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["tags"] = [["key1", "value2"]]
        self.store_event(data, project_id=self.project.id)

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
            result = transactions.query(
                selected_columns=[column],
                query=query,
                snuba_params=self.snuba_params,
                orderby=[column],
                referrer="test_discover_query",
            )
            data = result["data"]
            assert len(data) == len(expected), (column, query, expected)
            assert [item[column] for item in data] == expected

    def test_team_key_transactions(self):
        team1 = self.create_team(organization=self.organization, name="Team A")
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.organization, name="Team B")
        self.project.add_team(team2)

        txns = ["/blah_transaction/"]
        key_txns = [
            (team1, "/foo_transaction/"),
            (team2, "/zoo_transaction/"),
        ]

        for transaction in txns:
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(5)),
            )
            data["transaction"] = transaction
            self.store_event(data, project_id=self.project.id)

        for team, transaction in key_txns:
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

        for query, expected_results in queries:
            result = transactions.query(
                selected_columns=["transaction", "team_key_transaction"],
                query=query,
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[self.project],
                    organization=self.organization,
                    teams=[team1, team2],
                ),
                referrer="test_discover_query",
            )

            data = result["data"]
            assert len(data) == len(expected_results)
            assert [
                (x["transaction"], x["team_key_transaction"])
                for x in sorted(data, key=lambda k: k["transaction"])
            ] == expected_results

    def test_timestamp_rounding_fields(self):
        result = transactions.query(
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

        data = load_data("transaction", timestamp=two_day_ago)
        self.store_event(data, project_id=self.project.id)

        result = transactions.query(
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
        data = load_data("transaction", timestamp=self.event_time)
        data["transaction"] = "a" * 32
        data["user"] = {"username": "brucew", "id": "1234", "ip": "127.0.0.1"}
        self.event = self.store_event(data=data, project_id=self.project.id)

        # `user.display` should give `id`
        data = load_data("transaction", timestamp=self.event_time)
        data["transaction"] = "a" * 32
        data["user"] = {"id": "1234", "ip": "127.0.0.1"}
        self.event = self.store_event(data=data, project_id=self.project.id)

        # `user.display` should give `ip`
        data = load_data("transaction", timestamp=self.event_time)
        data["transaction"] = "a" * 32
        data["user"] = {"ip_address": "127.0.0.1"}
        self.event = self.store_event(data=data, project_id=self.project.id)

        result = transactions.query(
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
        data = load_data("transaction", timestamp=self.event_time)
        data["transaction"] = "a" * 32
        data["user"] = {"username": "brucew", "ip": "127.0.0.1"}
        self.event = self.store_event(data=data, project_id=self.project.id)

        result = transactions.query(
            selected_columns=["user.display"],
            query="has:user.display user.display:bruce@example.com",
            snuba_params=self.snuba_params,
            referrer="test_discover_query",
        )
        data = result["data"]
        assert len(data) == 1
        assert [item["user.display"] for item in data] == ["bruce@example.com"]

    def test_using_project_and_project_name(self):
        projects = []
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            projects.append(other_project)
            data = load_data("transaction", timestamp=self.event_time)
            self.store_event(data=data, project_id=other_project.id)

        self.snuba_params.projects = projects

        result = transactions.query(
            selected_columns=["project.name", "message", "project"],
            query="",
            snuba_params=self.snuba_params,
            orderby=["project.name"],
            referrer="test_discover_query",
        )
        data = result["data"]
        assert len(data) == 3
        assert [item["project.name"] for item in data] == [
            "a" * 32,
            "m" * 32,
            "z" * 32,
        ]

    @pytest.mark.xfail(reason="Started failing on ClickHouse 21.8")
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

        result = transactions.query(
            selected_columns=["project", "transaction", "project_threshold_config"],
            query="",
            snuba_params=SnubaParams(
                start=before_now(minutes=10),
                end=before_now(minutes=2),
                projects=[self.project, project2],
                organization=self.organization,
            ),
            referrer="test_discover_query",
        )

        assert len(result["data"]) == 5
        sorted_data = sorted(result["data"], key=lambda k: k["transaction"])

        assert [row["transaction"] for row in sorted_data] == expected_transaction
        assert [row["project_threshold_config"][0] for row in sorted_data] == [
            r[0] for r in expected_project_threshold_config
        ]
        assert [row["project_threshold_config"][1] for row in sorted_data] == [
            r[1] for r in expected_project_threshold_config
        ]

        ProjectTransactionThreshold.objects.filter(
            project=project2,
            organization=project2.organization,
        ).delete()

        expected_transaction = ["e" * 10]
        expected_project_threshold_config = [["duration", 300]]

        result = transactions.query(
            selected_columns=["project", "transaction", "project_threshold_config"],
            query="",
            snuba_params=SnubaParams(
                start=before_now(minutes=10),
                end=before_now(minutes=2),
                projects=[project2],
                organization=self.organization,
            ),
            referrer="test_discover_query",
        )

        assert len(result["data"]) == 1
        sorted_data = sorted(result["data"], key=lambda k: k["transaction"])

        assert [row["transaction"] for row in sorted_data] == expected_transaction
        assert [row["project_threshold_config"][0] for row in sorted_data] == [
            r[0] for r in expected_project_threshold_config
        ]
        assert [row["project_threshold_config"][1] for row in sorted_data] == [
            r[1] for r in expected_project_threshold_config
        ]

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

        for cols, query, expected, alias in test_cases:
            result = transactions.query(
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

        for cols, query, expected in test_cases:
            result = transactions.query(
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
            data = load_data("transaction", timestamp=before_now(minutes=5))
            data["release"] = unicode_phrase1
            self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=before_now(minutes=5))
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
            result = transactions.query(
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

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                selected_columns=["transaction", "failure_count()"],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
                referrer="discover",
            )
            data = result["data"]

            assert len(data) == expected_length
            assert data[0]["failure_count"] == 2
            assert data[1]["failure_count"] == 1

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

        for query, expected_apdex, col, alias in queries:
            result = transactions.query(
                selected_columns=["transaction"] + col,
                query=query,
                orderby=["transaction"],
                referrer="discover",
                snuba_params=SnubaParams(
                    start=before_now(minutes=30),
                    end=before_now(minutes=2),
                    projects=[project, project2],
                    organization=self.organization,
                ),
                use_aggregate_conditions=True,
            )
            data = result["data"]
            assert len(data) == len(expected_apdex)
            assert [
                x[alias] for x in sorted(data, key=lambda k: k["transaction"])
            ] == expected_apdex

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

        for query, expected_count_miserable, col, alias in queries:
            result = transactions.query(
                selected_columns=["transaction"] + col,
                query=query,
                orderby=["transaction"],
                referrer="discover",
                snuba_params=SnubaParams(
                    start=before_now(minutes=30),
                    end=before_now(minutes=2),
                    projects=[project, project2],
                    organization=self.organization,
                ),
                use_aggregate_conditions=True,
            )

            data = result["data"]
            assert len(data) == len(expected_count_miserable)
            assert [
                x[alias] for x in sorted(data, key=lambda k: k["transaction"])
            ] == expected_count_miserable

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

        for query, expected_user_misery, col, alias in queries:
            result = transactions.query(
                selected_columns=["transaction"] + col,
                referrer="discover",
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=30),
                    end=before_now(minutes=2),
                    projects=[project, project2],
                    organization=self.organization,
                ),
                use_aggregate_conditions=True,
            )

            data = result["data"]
            assert len(data) == len(expected_user_misery)
            for i, misery in enumerate(sorted(data, key=lambda k: k["transaction"])):
                assert similar(misery[alias], expected_user_misery[i])

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

        for query, expected_length, expected_counts, use_aggregate_conditions in queries:
            result = transactions.query(
                selected_columns=["transaction", "count()"],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                referrer="discover",
                use_aggregate_conditions=use_aggregate_conditions,
            )
            data = result["data"]

            assert len(data) == expected_length
            for index, count in enumerate(data):
                assert count["count"] == expected_counts[index]

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
            selected, query = test_case
            result = transactions.query(
                referrer="discover",
                selected_columns=selected,
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=True,
            )
            alias, expected_value = expected_results[i]
            data = result["data"]

            assert data[0][alias] == expected_value

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

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                selected_columns=["transaction", "last_seen()"],
                query=query,
                referrer="discover",
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
        data = load_data("transaction", timestamp=expected_timestamp)
        data["transaction"] = "/latest_event"
        stored_event = self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("transaction", timestamp=before_now(minutes=i + 4))
            data["transaction"] = "/latest_event"
            self.store_event(data, project_id=project.id)

        result = transactions.query(
            selected_columns=["transaction", "latest_event()"],
            query="",
            orderby=["transaction"],
            referrer="discover",
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

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                selected_columns=["transaction", "failure_rate()"],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
                referrer="discover",
            )
            data = result["data"]

            assert len(data) == expected_length
            assert data[0]["failure_rate"] == 0.6
            if expected_length > 1:
                assert data[1]["failure_rate"] == 0.3

    def _create_percentile_events(self, project):
        for i in range(6):
            start = before_now(minutes=3)
            end = start - timedelta(minutes=1 + i)
            data = load_data(
                "transaction",
                timestamp=start,
                start_timestamp=end,
            )
            data["transaction"] = "/p50"
            self.store_event(data, project_id=project.id)

    def test_percentile(self):
        project = self.create_project()

        self._create_percentile_events(project)

        queries = [
            ("", 1, True),
            ("percentile(transaction.duration, 0.7):>0", 1, False),
            ("percentile(transaction.duration, 0.7):>500000", 0, True),
            ("percentile(transaction.duration, 0.7):>100000", 1, True),
        ]

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                referrer="discover",
                selected_columns=[
                    "transaction",
                    "percentile(transaction.duration, 0.7)",
                    "percentile(transaction.duration, 0.5)",
                ],
                query=query,
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
            if expected_length > 0:
                assert data[0]["percentile_transaction_duration_0_7"] == 270000
                assert data[0]["percentile_transaction_duration_0_5"] == 210000

    def test_p50(self):
        project = self.create_project()

        self._create_percentile_events(project)

        queries = [
            ("", 1, True),
            ("p50(transaction.duration):>0", 1, False),
            ("p50(transaction.duration):>500000", 0, True),
            ("p50(transaction.duration):>100000", 1, True),
        ]

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                referrer="discover",
                selected_columns=[
                    "transaction",
                    "p50(transaction.duration)",
                ],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=20),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
            )
            data = result["data"]

            assert len(data) == expected_length
            if expected_length > 0:
                assert data[0]["p50_transaction_duration"] == 210000

    def test_p75(self):
        project = self.create_project()

        self._create_percentile_events(project)

        queries = [
            ("", 1, True),
            ("p75(transaction.duration):>0", 1, False),
            ("p75(transaction.duration):>500000", 0, True),
            ("p75(transaction.duration):>100000", 1, True),
        ]

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                selected_columns=[
                    "transaction",
                    "p75(transaction.duration)",
                ],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=20),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
                referrer="discover",
            )
            data = result["data"]

            assert len(data) == expected_length
            if expected_length > 0:
                assert data[0]["p75_transaction_duration"] == 285000

    def test_p95(self):
        project = self.create_project()

        self._create_percentile_events(project)

        queries = [
            ("", 1, True),
            ("p95(transaction.duration):>0", 1, False),
            ("p95(transaction.duration):>500000", 0, True),
            ("p95(transaction.duration):>100000", 1, True),
        ]

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                selected_columns=[
                    "transaction",
                    "p95(transaction.duration)",
                ],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=20),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
                referrer="discover",
            )
            data = result["data"]

            assert len(data) == expected_length
            if expected_length > 0:
                assert data[0]["p95_transaction_duration"] == 345000

    def test_p99(self):
        project = self.create_project()

        self._create_percentile_events(project)

        queries = [
            ("", 1, True),
            ("p99(transaction.duration):>0", 1, False),
            ("p99(transaction.duration):>500000", 0, True),
            ("p99(transaction.duration):>100000", 1, True),
        ]

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                selected_columns=[
                    "transaction",
                    "p99(transaction.duration)",
                ],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=20),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
                referrer="discover",
            )
            data = result["data"]

            assert len(data) == expected_length
            if expected_length > 0:
                assert data[0]["p99_transaction_duration"] == 357000

    def test_p100(self):
        project = self.create_project()

        self._create_percentile_events(project)

        queries = [
            ("", 1, True),
            ("p100(transaction.duration):>0", 1, False),
            ("p100(transaction.duration):>500000", 0, True),
            ("p100(transaction.duration):>100000", 1, True),
        ]

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                selected_columns=[
                    "transaction",
                    "p100(transaction.duration)",
                ],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=20),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
                referrer="discover",
            )
            data = result["data"]

            assert len(data) == expected_length
            if expected_length > 0:
                assert data[0]["p100_transaction_duration"] == 360000

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

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
                selected_columns=[
                    "transaction",
                    "p100(measurements.frames_slow_rate)",
                ],
                query=query,
                orderby=["transaction"],
                snuba_params=SnubaParams(
                    start=before_now(minutes=20),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                use_aggregate_conditions=use_aggregate_conditions,
                referrer="discover",
            )
            data = result["data"]

            assert len(data) == expected_length
            if expected_length > 0:
                assert data[0]["p100_measurements_frames_slow_rate"] == 0.5

    def test_count_unique(self):
        for idx in range(3):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=3),
            )
            data["user"] = {"email": f"{idx}@example.com"}
            data["tags"] = {"foo": "bar" if idx < 1 else "baz"}
            self.store_event(data, project_id=self.project.id)

        result = transactions.query(
            selected_columns=["count_unique(user.display)", "count_unique(foo)"],
            query="",
            snuba_params=SnubaParams(
                start=before_now(minutes=4),
                end=before_now(minutes=2),
                projects=[self.project],
            ),
            use_aggregate_conditions=True,
            referrer="discover",
        )
        data = result["data"]

        assert len(data) == 1
        assert data[0]["count_unique_user_display"] == 3
        assert data[0]["count_unique_foo"] == 2

    def test_min_max(self):
        """Testing both min and max since they're so similar"""
        for idx in range(3):
            start = before_now(minutes=3)
            end = start - timedelta(minutes=1 + idx)
            data = load_data(
                "transaction",
                timestamp=start,
                start_timestamp=end,
            )
            self.store_event(data, project_id=self.project.id)

        result = transactions.query(
            selected_columns=[
                "min(transaction.duration)",
                "max(transaction.duration)",
            ],
            query="",
            snuba_params=SnubaParams(
                start=before_now(minutes=4),
                end=before_now(minutes=2),
                projects=[self.project],
            ),
            use_aggregate_conditions=True,
            referrer="discover",
        )
        data = result["data"]

        assert len(data) == 1
        assert data[0]["min_transaction_duration"] == 60000
        assert data[0]["max_transaction_duration"] == 180000

    def test_stats_functions(self):
        for idx in range(3):
            start = before_now(minutes=3)
            end = start - timedelta(minutes=1 + idx)
            data = load_data(
                "transaction",
                timestamp=start,
                start_timestamp=end,
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

        for column, alias, expected in queries:
            result = transactions.query(
                selected_columns=[column],
                query="",
                snuba_params=SnubaParams(
                    start=before_now(minutes=4),
                    end=before_now(minutes=2),
                    projects=[self.project],
                ),
                use_aggregate_conditions=True,
                referrer="discover",
            )
            data = result["data"]

            assert len(data) == 1, column
            assert data[0][alias] == expected, column

    def test_count_at_least(self):
        end = before_now(minutes=3)
        start_one_minute = end - timedelta(minutes=1)
        start_two_minute = end - timedelta(minutes=2)
        for idx in range(3):
            data = load_data(
                "transaction",
                timestamp=end,
                start_timestamp=start_one_minute if idx < 1 else start_two_minute,
            )
            self.store_event(data, project_id=self.project.id)

        result = transactions.query(
            selected_columns=[
                "count_at_least(transaction.duration,60000)",
                "count_at_least(transaction.duration,120000)",
            ],
            query="",
            snuba_params=SnubaParams(
                start=before_now(minutes=4),
                end=before_now(minutes=2),
                projects=[self.project],
            ),
            use_aggregate_conditions=True,
            referrer="discover",
        )
        data = result["data"]

        assert len(data) == 1
        assert data[0]["count_at_least_transaction_duration_60000"] == 3
        assert data[0]["count_at_least_transaction_duration_120000"] == 2

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

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
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
                referrer="discover",
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

        for query, expected_length, use_aggregate_conditions in queries:
            result = transactions.query(
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
                referrer="discover",
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
            result = transactions.query(
                selected_columns=["transaction.status"],
                query=query,
                snuba_params=self.snuba_params,
                referrer="discover",
            )
            data = result["data"]
            assert len(data) == len(expected_statuses), message
            assert sorted(item["transaction.status"] for item in data) == sorted(
                expected_statuses
            ), message

        run_query("has:transaction.status transaction.status:ok", [0, 0, 0], "status 'ok'")
        run_query(
            "has:transaction.status transaction.status:[ok,already_exists]",
            [0, 0, 0, 6],
            "status 'ok' or 'already_exists'",
        )
        run_query("has:transaction.status !transaction.status:ok", [6], "status not 'ok'")
        run_query(
            "has:transaction.status !transaction.status:already_exists",
            [0, 0, 0],
            "status not 'already_exists'",
        )
        run_query(
            "has:transaction.status !transaction.status:[ok,already_exists]",
            [],
            "status not 'ok' and not 'already_exists'",
        )
        run_query("!has:transaction.status", [], "status nonexistant")

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
            ("failure_count()", [0, 0, 1, 1, 1, 1, 1, 2]),
            ("failure_count()", [0, 0, 1, 1, 1, 1, 1, 2]),
            ("-failure_count()", [2, 1, 1, 1, 1, 1, 0, 0]),
            ("-failure_count()", [2, 1, 1, 1, 1, 1, 0, 0]),
            ("failure_count", [0, 0, 1, 1, 1, 1, 1, 2]),
            ("-failure_count", [2, 1, 1, 1, 1, 1, 0, 0]),
        ]

        for orderby, expected in orderbys:
            result = transactions.query(
                selected_columns=["transaction", "failure_count()"],
                query="",
                orderby=[orderby],
                snuba_params=SnubaParams(
                    start=before_now(minutes=10),
                    end=before_now(minutes=2),
                    projects=[project],
                ),
                referrer="discover",
            )
            data = result["data"]

            assert [x["failure_count"] for x in data] == expected

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

        for query, expected_len in queries:
            result = discover.query(
                selected_columns=["spans_op"],
                query=query,
                snuba_params=SnubaParams(
                    start=before_now(minutes=12),
                    end=before_now(minutes=8),
                    projects=[self.project],
                    organization=self.organization,
                ),
                referrer="discover",
            )
            data = result["data"]
            assert len(data) == expected_len

    def test_reflective_types(self):
        results = transactions.query(
            selected_columns=[
                "p50(measurements.lcp)",
                "p50(measurements.foo)",
                "p50(spans.foo)",
            ],
            query="event.type:transaction",
            snuba_params=self.snuba_params,
            use_aggregate_conditions=True,
            referrer="discover",
        )

        assert results["meta"]["fields"] == {
            "p50_measurements_lcp": "duration",
            "p50_measurements_foo": "number",
            "p50_spans_foo": "duration",
        }

    def test_measurements(self):
        event_data = load_data("transaction", timestamp=before_now(seconds=3))
        self.store_event(data=event_data, project_id=self.project.id)

        results = transactions.query(
            selected_columns=[
                "measurements.fp",
                "measurements.fcp",
                "measurements.lcp",
                "measurements.fid",
                "measurements.cls",
                "measurements.does_not_exist",
            ],
            query="event.type:transaction !transaction:{}".format("a" * 32),
            snuba_params=self.snuba_params,
            referrer="discover",
        )

        data = results["data"]
        assert len(data) == 1
        assert data[0]["measurements.fp"] == event_data["measurements"]["fp"]["value"]
        assert data[0]["measurements.fcp"] == event_data["measurements"]["fcp"]["value"]
        assert data[0]["measurements.lcp"] == event_data["measurements"]["lcp"]["value"]
        assert data[0]["measurements.fid"] == event_data["measurements"]["fid"]["value"]
        assert data[0]["measurements.cls"] == event_data["measurements"]["cls"]["value"]
        assert data[0]["measurements.does_not_exist"] is None

    def test_conditions_with_special_columns(self):
        for val in ["b", "c", "d"]:
            data = load_data("transaction")
            data["timestamp"] = self.one_min_ago.isoformat()
            data["transaction"] = val * 32
            data["logentry"] = {"formatted": val * 32}
            data["tags"] = {"sub_customer.is-Enterprise-42": val * 32}
            self.store_event(data=data, project_id=self.project.id)

        result = transactions.query(
            selected_columns=["title", "message"],
            query="event.type:transaction (title:{} OR message:{})".format("b" * 32, "c" * 32),
            snuba_params=SnubaParams(
                start=self.two_min_ago,
                end=self.now,
                projects=[self.project],
            ),
            orderby=["title"],
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 2
        assert data[0]["title"] == "b" * 32
        assert data[1]["title"] == "c" * 32

        result = transactions.query(
            selected_columns=["title", "sub_customer.is-Enterprise-42"],
            query="event.type:transaction (title:{} AND sub_customer.is-Enterprise-42:{})".format(
                "b" * 32, "b" * 32
            ),
            snuba_params=SnubaParams(
                start=self.two_min_ago,
                end=self.now,
                projects=[self.project],
            ),
            orderby=["title"],
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["title"] == "b" * 32
        assert data[0]["sub_customer.is-Enterprise-42"] == "b" * 32

    def test_conditions_with_aggregates(self):
        events = [("a", 2), ("b", 3), ("c", 4)]
        for ev in events:
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("transaction")
                data["timestamp"] = self.one_min_ago.isoformat()
                data["transaction"] = f"{val}-{i}"
                data["logentry"] = {"formatted": val}
                data["tags"] = {"trek": val}
                self.store_event(data=data, project_id=self.project.id)

        result = transactions.query(
            selected_columns=["trek", "count()"],
            query="event.type:transaction (trek:{} OR trek:{}) AND count():>2".format(
                "a" * 32, "b" * 32
            ),
            snuba_params=SnubaParams(
                start=self.two_min_ago,
                end=self.now,
                projects=[self.project],
            ),
            orderby=["trek"],
            use_aggregate_conditions=True,
            referrer="discover",
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["trek"] == "b" * 32
        assert data[0]["count"] == 3

    def test_conditions_with_nested_aggregates(self):
        events = [("a", 2), ("b", 3), ("c", 4)]
        for ev in events:
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("transaction")
                data["timestamp"] = self.one_min_ago.isoformat()
                data["transaction"] = f"{val}-{i}"
                data["logentry"] = {"formatted": val}
                data["tags"] = {"trek": val}
                self.store_event(data=data, project_id=self.project.id)

        result = transactions.query(
            selected_columns=["trek", "count()"],
            query="(event.type:transaction AND (trek:{} AND (transaction:*{}* AND count():>2)))".format(
                "b" * 32, "b" * 32
            ),
            snuba_params=SnubaParams(
                start=self.two_min_ago,
                end=self.now,
                projects=[self.project],
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
            transactions.query(
                selected_columns=["trek", "transaction"],
                query="(event.type:transaction AND (trek:{} AND (transaction:*{}* AND count():>2)))".format(
                    "b" * 32, "b" * 32
                ),
                referrer="discover",
                snuba_params=SnubaParams(
                    start=self.two_min_ago,
                    end=self.now,
                    projects=[self.project],
                ),
                orderby=["trek"],
                use_aggregate_conditions=True,
            )
        assert "used in a condition but is not a selected column" in str(err)

    def test_conditions_with_timestamps(self):
        events = [("b", 1), ("c", 2), ("d", 3)]
        for t, ev in enumerate(events):
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("transaction", timestamp=self.now - timedelta(seconds=3 * t + 1))
                data["transaction"] = f"{val}"
                self.store_event(data=data, project_id=self.project.id)

        results = transactions.query(
            selected_columns=["transaction", "count()"],
            query="event.type:transaction AND (timestamp:<{} OR timestamp:>{})".format(
                (self.now - timedelta(seconds=5)).isoformat(),
                (self.now - timedelta(seconds=3)).isoformat(),
            ),
            snuba_params=SnubaParams(
                start=self.two_min_ago,
                end=self.now,
                projects=[self.project],
            ),
            orderby=["transaction"],
            use_aggregate_conditions=True,
            referrer="discover",
        )

        data = results["data"]
        assert len(data) == 3
        assert data[0]["transaction"] == "a" * 32
        assert data[0]["count"] == 1
        assert data[1]["transaction"] == "b" * 32
        assert data[1]["count"] == 1
        assert data[2]["transaction"] == "d" * 32
        assert data[2]["count"] == 3

    def test_timestamp_rollup_filter(self):
        event_hour = self.event_time.replace(minute=0, second=0)
        result = transactions.query(
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
        data = load_data("transaction", timestamp=before_now(seconds=3))
        data["transaction"] = "a" * 32
        self.store_event(data=data, project_id=self.project.id)

        results = transactions.query(
            selected_columns=["transaction", "count()"],
            query="event.type:transaction AND (count():<1 OR count():>0)",
            snuba_params=self.snuba_params,
            orderby=["transaction"],
            use_aggregate_conditions=True,
            referrer="discover",
        )

        data = results["data"]
        assert len(data) == 1
        assert data[0]["transaction"] == "a" * 32
        assert data[0]["count"] == 2

    def test_array_join(self):
        data = load_data("transaction", timestamp=before_now(seconds=90))
        data["transaction"] = "foo"
        data["measurements"] = {
            "fp": {"value": 1000},
            "fcp": {"value": 1000},
            "lcp": {"value": 1000},
        }
        self.store_event(data=data, project_id=self.project.id)

        results = transactions.query(
            selected_columns=["array_join(measurements_key)"],
            query="transaction:foo",
            snuba_params=self.snuba_params,
            functions_acl=["array_join"],
            referrer="discover",
        )
        assert {"fcp", "fp", "lcp"} == {
            row["array_join_measurements_key"] for row in results["data"]
        }

    def test_access_to_private_functions(self):
        # using private functions directly without access should error
        with pytest.raises(InvalidSearchQuery, match="array_join: no access to private function"):
            transactions.query(
                selected_columns=["array_join(tags.key)"],
                query="",
                snuba_params=SnubaParams(
                    start=self.two_min_ago,
                    end=self.now,
                    projects=[self.project],
                ),
                referrer="discover",
            )

        # using private functions in an aggregation without access should error
        with pytest.raises(InvalidSearchQuery, match="histogram: no access to private function"):
            for array_column in ARRAY_COLUMNS:
                transactions.query(
                    selected_columns=[f"histogram({array_column}_value, 1,0,1)"],
                    query=f"histogram({array_column}_value, 1,0,1):>0",
                    snuba_params=SnubaParams(
                        start=self.two_min_ago,
                        end=self.now,
                        projects=[self.project],
                    ),
                    use_aggregate_conditions=True,
                    referrer="discover",
                )

        # using private functions in an aggregation without access should error
        # with auto aggregation on
        with pytest.raises(InvalidSearchQuery, match="histogram: no access to private function"):
            for array_column in ARRAY_COLUMNS:
                transactions.query(
                    selected_columns=["count()"],
                    query=f"histogram({array_column}_value, 1,0,1):>0",
                    snuba_params=SnubaParams(
                        start=self.two_min_ago,
                        end=self.now,
                        projects=[self.project],
                    ),
                    referrer="discover",
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

        results = transactions.query(
            selected_columns=["sumArray(measurements_value)"],
            query="!transaction:{}".format("a" * 32),
            snuba_params=self.snuba_params,
            # make sure to opt in to gain access to the function
            functions_acl=["sumArray"],
            referrer="discover",
            # -Array combinator is only supported in SnQL
        )
        assert results["data"][0]["sumArray_measurements_value"] == 3000.0

    def test_span_op_breakdowns(self):
        event_data = load_data("transaction", timestamp=before_now(seconds=3))
        self.store_event(data=event_data, project_id=self.project.id)

        results = transactions.query(
            selected_columns=[
                "spans.http",
                "spans.db",
                "spans.resource",
                "spans.browser",
                "spans.total.time",
                "spans.does_not_exist",
            ],
            query="event.type:transaction !transaction:{}".format("a" * 32),
            snuba_params=self.snuba_params,
            referrer="discover",
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


class TransactionsArithmeticTest(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.now = before_now()
        event_data = load_data("transaction")
        # Half of duration so we don't get weird rounding differences when comparing the results
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 1500
        event_data["start_timestamp"] = (self.day_ago + timedelta(minutes=30)).isoformat()
        event_data["timestamp"] = (self.day_ago + timedelta(minutes=30, seconds=3)).isoformat()
        self.store_event(data=event_data, project_id=self.project.id)
        self.snuba_params = SnubaParams(
            projects=[self.project],
            start=self.day_ago,
            end=self.now,
        )
        self.query = "event.type:transaction"

    def test_simple(self):
        results = transactions.query(
            selected_columns=[
                "spans.http",
                "transaction.duration",
            ],
            equations=["spans.http / transaction.duration"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert result["equation[0]"] == result["spans.http"] / result["transaction.duration"]

    def test_multiple_equations(self):
        results = transactions.query(
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
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert result["equation[0]"] == result["spans.http"] / result["transaction.duration"]
        assert result["equation[1]"] == result["transaction.duration"] / result["spans.http"]
        assert result["equation[2]"] == 1500 + result["transaction.duration"]

    def test_invalid_field(self):
        with pytest.raises(ArithmeticValidationError):
            transactions.query(
                selected_columns=[
                    "spans.http",
                    "transaction.status",
                ],
                # while transaction_status is a uint8, there's no reason we should allow arith on it
                equations=["spans.http / transaction.status"],
                query=self.query,
                snuba_params=self.snuba_params,
                referrer="discover",
            )

    def test_invalid_function(self):
        with pytest.raises(ArithmeticValidationError):
            transactions.query(
                selected_columns=[
                    "p50(transaction.duration)",
                    "last_seen()",
                ],
                equations=["p50(transaction.duration) / last_seen()"],
                query=self.query,
                snuba_params=self.snuba_params,
                referrer="discover",
            )

    def test_unselected_field(self):
        with pytest.raises(InvalidSearchQuery):
            transactions.query(
                selected_columns=[
                    "spans.http",
                ],
                equations=["spans.http / transaction.duration"],
                query=self.query,
                snuba_params=self.snuba_params,
                referrer="discover",
            )

    def test_unselected_function(self):
        with pytest.raises(InvalidSearchQuery):
            transactions.query(
                selected_columns=[
                    "p50(transaction.duration)",
                ],
                equations=["p50(transaction.duration) / p100(transaction.duration)"],
                query=self.query,
                snuba_params=self.snuba_params,
                referrer="discover",
            )

    def test_orderby_equation(self):
        for i in range(1, 3):
            event_data = load_data("transaction")
            # Half of duration so we don't get weird rounding differences when comparing the results
            event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 300 * i
            event_data["start_timestamp"] = (self.day_ago + timedelta(minutes=30)).isoformat()
            event_data["timestamp"] = (self.day_ago + timedelta(minutes=30, seconds=3)).isoformat()
            self.store_event(data=event_data, project_id=self.project.id)
        results = transactions.query(
            selected_columns=[
                "spans.http",
                "transaction.duration",
            ],
            equations=[
                "spans.http / transaction.duration",
                "transaction.duration / spans.http",
                "1500 + transaction.duration",
            ],
            orderby=["equation[0]"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 3
        assert [result["equation[0]"] for result in results["data"]] == [0.1, 0.2, 0.5]

        results = transactions.query(
            selected_columns=[
                "spans.http",
                "transaction.duration",
            ],
            equations=[
                "spans.http / transaction.duration",
                "transaction.duration / spans.http",
                "1500 + transaction.duration",
            ],
            orderby=["equation[1]"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 3
        assert [result["equation[1]"] for result in results["data"]] == [2, 5, 10]

        results = transactions.query(
            selected_columns=[
                "spans.http",
                "transaction.duration",
            ],
            equations=[
                "spans.http / transaction.duration",
                "transaction.duration / spans.http",
                "1500 + transaction.duration",
            ],
            orderby=["-equation[0]"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 3
        assert [result["equation[0]"] for result in results["data"]] == [0.5, 0.2, 0.1]

    def test_orderby_nonexistent_equation(self):
        with pytest.raises(InvalidSearchQuery):
            transactions.query(
                selected_columns=[
                    "spans.http",
                    "transaction.duration",
                ],
                orderby=["equation[1]"],
                query=self.query,
                snuba_params=self.snuba_params,
                referrer="discover",
            )

    def test_equation_without_field_or_function(self):
        with pytest.raises(InvalidSearchQuery):
            transactions.query(
                selected_columns=[
                    "spans.http",
                    "transaction.duration",
                ],
                equations=[
                    "5 + 5",
                ],
                query=self.query,
                snuba_params=self.snuba_params,
                referrer="discover",
            )

    def test_aggregate_equation(self):
        results = transactions.query(
            selected_columns=[
                "p50(transaction.duration)",
            ],
            equations=["p50(transaction.duration) / 2"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert result["equation[0]"] == result["p50_transaction_duration"] / 2

    def test_multiple_aggregate_equation(self):
        results = transactions.query(
            selected_columns=[
                "p50(transaction.duration)",
                "count()",
            ],
            equations=["p50(transaction.duration) + 2", "p50(transaction.duration) / count()"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 1
        result = results["data"][0]
        assert result["equation[0]"] == result["p50_transaction_duration"] + 2
        assert result["equation[1]"] == result["p50_transaction_duration"] / result["count"]

    def test_multiple_operators(self):
        results = transactions.query(
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
            snuba_params=self.snuba_params,
            referrer="discover",
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
            event_data["start_timestamp"] = (self.day_ago + timedelta(minutes=30)).isoformat()
            event_data["timestamp"] = (self.day_ago + timedelta(minutes=30, seconds=3)).isoformat()
            self.store_event(data=event_data, project_id=self.project.id)
        results = transactions.query(
            selected_columns=[
                "spans.http",
                "transaction.duration",
            ],
            equations=[
                "transaction.duration / spans.http",  # inf
                "spans.http / spans.http",  # nan
            ],
            orderby=["equation[0]"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 3
        assert [result["equation[0]"] for result in results["data"]] == [2, None, None]

        results = transactions.query(
            selected_columns=[
                "spans.http",
                "transaction.duration",
            ],
            equations=[
                "transaction.duration / spans.http",  # inf
                "spans.http / spans.http",  # nan
            ],
            orderby=["equation[1]"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 3
        assert [result["equation[1]"] for result in results["data"]] == [1, None, None]

        results = transactions.query(
            selected_columns=[
                "spans.http",
                "transaction.duration",
            ],
            equations=[
                "transaction.duration / spans.http",  # inf
                "spans.http / spans.http",  # nan
            ],
            orderby=["-equation[0]"],
            query=self.query,
            snuba_params=self.snuba_params,
            referrer="discover",
        )
        assert len(results["data"]) == 3
        assert [result["equation[0]"] for result in results["data"]] == [2, None, None]
