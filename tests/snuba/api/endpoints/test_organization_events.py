import math
import uuid
from datetime import timedelta
from typing import Any
from unittest import mock

import pytest
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from snuba_sdk.column import Column
from snuba_sdk.function import Function

from sentry.discover.models import (
    DatasetSourcesTypes,
    DiscoverSavedQuery,
    DiscoverSavedQueryTypes,
    TeamKeyTransaction,
)
from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.models.projectteam import ProjectTeam
from sentry.models.releaseprojectenvironment import ReleaseStages
from sentry.models.transaction_threshold import (
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.search.events import constants
from sentry.testutils.cases import (
    APITransactionTestCase,
    PerformanceIssueTestCase,
    ProfilesSnubaTestCase,
    SnubaTestCase,
    SpanTestCase,
)
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.discover import user_misery_formula
from sentry.types.group import GroupSubStatus
from sentry.utils import json
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import SearchIssueTestMixin

MAX_QUERYABLE_TRANSACTION_THRESHOLDS = 1

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsEndpointTestBase(APITransactionTestCase, SnubaTestCase, SpanTestCase):
    viewname = "sentry-api-0-organization-events"
    referrer = "api.organization-events"

    def setUp(self):
        super().setUp()
        self.nine_mins_ago = before_now(minutes=9)
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = self.ten_mins_ago.replace(microsecond=0).isoformat()
        self.eleven_mins_ago = before_now(minutes=11)
        self.eleven_mins_ago_iso = self.eleven_mins_ago.isoformat()
        self.transaction_data = load_data("transaction", timestamp=self.ten_mins_ago)
        self.features = {}

    def client_get(self, *args, **kwargs):
        return self.client.get(*args, **kwargs)

    def reverse_url(self):
        return reverse(
            self.viewname,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def do_request(self, query, features=None, **kwargs):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        self.login_as(user=self.user)
        with self.feature(features):
            return self.client_get(self.reverse_url(), query, format="json", **kwargs)

    def _setup_user_misery(
        self, per_transaction_threshold: bool = False, project: Project | None = None
    ) -> None:
        _project = project or self.project
        # If duration is > 300 * 4 then the user is frustrated
        # There's a total of 4 users and three of them reach the frustration threshold
        events = [
            ("one", 300),
            ("two", 300),
            ("one", 3000),  # Frustrated
            ("two", 3000),  # Frustrated
            ("three", 400),
            ("four", 4000),  # Frustrated
        ]
        for idx, event in enumerate(events):
            data = self.load_data(
                timestamp=before_now(minutes=(10 + idx)),
                duration=timedelta(milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/count_miserable/horribilis/{idx}"
            data["user"] = {"email": f"{event[0]}@example.com"}
            self.store_event(data, project_id=_project.id)

            if per_transaction_threshold and idx % 2:
                ProjectTransactionThresholdOverride.objects.create(
                    transaction=f"/count_miserable/horribilis/{idx}",
                    project=_project,
                    organization=_project.organization,
                    threshold=100 * idx,
                    metric=TransactionMetric.DURATION.value,
                )


class OrganizationEventsEndpointTest(OrganizationEventsEndpointTestBase, PerformanceIssueTestCase):
    def test_no_projects(self):
        response = self.do_request({})

        assert response.status_code == 200, response.content
        assert response.data["data"] == []
        assert response.data["meta"] == {
            "tips": {"query": "Need at least one valid project to query."}
        }

    def test_environment_filter(self):
        self.create_environment(self.project, name="production")
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["id", "project.id"],
            "project": [self.project.id],
            "environment": ["staging", "production"],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 2

    def test_performance_view_feature(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )

        query = {"field": ["id", "project.id"], "project": [self.project.id]}
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1

    def test_multi_project_feature_gate_rejection(self):
        team = self.create_team(organization=self.organization, members=[self.user])

        project = self.create_project(organization=self.organization, teams=[team])
        project2 = self.create_project(organization=self.organization, teams=[team])

        query = {"field": ["id", "project.id"], "project": [project.id, project2.id]}
        response = self.do_request(query)
        assert response.status_code == 400
        assert "events from multiple projects" in response.data["detail"]

    def test_multi_project_feature_gate_replays(self):
        team = self.create_team(organization=self.organization, members=[self.user])

        project = self.create_project(organization=self.organization, teams=[team])
        project2 = self.create_project(organization=self.organization, teams=[team])

        query = {"field": ["id", "project.id"], "project": [project.id, project2.id]}
        response = self.do_request(query, **{"HTTP_X-Sentry-Replay-Request": "1"})
        assert response.status_code == 200

    def test_invalid_search_terms(self):
        self.create_project()

        query = {"field": ["id"], "query": "hi \n there"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Parse error at 'hi \n ther' (column 4). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )

    def test_invalid_trace_span(self):
        self.create_project()

        query = {"field": ["id"], "query": "trace.span:invalid"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "`trace.span` must be a valid 16 character hex (containing only digits, or a-f characters)"
        )

        query = {"field": ["id"], "query": "trace.parent_span:invalid"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "`trace.parent_span` must be a valid 16 character hex (containing only digits, or a-f characters)"
        )

        query = {"field": ["id"], "query": "trace.span:*"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"] == "Wildcard conditions are not permitted on `trace.span` field"
        )

        query = {"field": ["id"], "query": "trace.parent_span:*"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Wildcard conditions are not permitted on `trace.parent_span` field"
        )

    def test_has_trace_context(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "contexts": {
                    "trace": {
                        "span_id": "a" * 16,
                        "trace_id": "b" * 32,
                    },
                },
            },
            project_id=self.project.id,
        )

        query = {"field": ["id", "trace.parent_span"], "query": "has:trace.span"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["id"] == "a" * 32

        query = {"field": ["id"], "query": "has:trace.parent_span"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_treat_status_as_tag_discover_transaction(self):
        event_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
                "tags": {"status": "good"},
            },
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
                "tags": {"status": "bad"},
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["event_id"],
            "query": "!status:good",
            "dataset": "discover",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {"event_id": "", "id": event_2.event_id, "project.name": self.project.slug}
        ]

        query = {"field": ["event_id"], "query": ["status:good"], "dataset": "discover"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {"event_id": "", "id": event_1.event_id, "project.name": self.project.slug}
        ]

    def test_not_has_trace_context(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "contexts": {
                    "trace": {
                        "span_id": "a" * 16,
                        "trace_id": "b" * 32,
                    },
                },
            },
            project_id=self.project.id,
        )

        query = {"field": ["id", "trace.parent_span"], "query": "!has:trace.span"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

        query = {"field": ["id"], "query": "!has:trace.parent_span"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["id"] == "a" * 32

    @pytest.mark.skip(reason="flakey")
    def test_parent_span_id_in_context(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "contexts": {
                    "trace": {
                        "span_id": "a" * 16,
                        "trace_id": "b" * 32,
                        "parent_span_id": "c" * 16,
                    },
                },
            },
            project_id=self.project.id,
        )

        query = {"field": ["id"], "query": f"trace.parent_span:{'c' * 16}"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["id"] == "a" * 32

    def test_out_of_retention(self):
        self.create_project()
        with self.options({"system.event-retention-days": 10}):
            query = {
                "field": ["id", "timestamp"],
                "orderby": ["-timestamp", "-id"],
                "start": before_now(days=20),
                "end": before_now(days=15),
            }
            response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Invalid date range. Please try a more recent date range."

    def test_raw_data(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.eleven_mins_ago_iso,
                "user": {"ip_address": "127.0.0.1", "email": "foo@example.com"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"ip_address": "127.0.0.1", "email": "foo@example.com"},
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["id", "project.id", "user.email", "user.ip", "timestamp"],
            "orderby": "-timestamp",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["id"] == "b" * 32
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "foo@example.com"
        assert "project.name" not in data[0], "project.id does not auto select name"
        assert "project" not in data[0]

        meta = response.data["meta"]
        field_meta = meta["fields"]
        assert field_meta["id"] == "string"
        assert field_meta["user.email"] == "string"
        assert field_meta["user.ip"] == "string"
        assert field_meta["timestamp"] == "date"

    def test_project_name(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )

        query = {"field": ["project.name", "environment"]}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project.name"] == self.project.slug
        assert "project.id" not in response.data["data"][0]
        assert response.data["data"][0]["environment"] == "staging"

    def test_project_without_name(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )

        query = {"field": ["project", "environment"]}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == self.project.slug
        assert response.data["meta"]["fields"]["project"] == "string"
        assert "project.id" not in response.data["data"][0]
        assert response.data["data"][0]["environment"] == "staging"

    def test_project_in_query(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["project", "count()"],
            "query": f'project:"{self.project.slug}"',
            "statsPeriod": "14d",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == self.project.slug
        assert "project.id" not in response.data["data"][0]

    def test_project_in_query_not_in_header(self):
        project = self.create_project()
        other_project = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=project.id,
        )

        query = {
            "field": ["project", "count()"],
            "query": 'project:"%s"' % project.slug,
            "statsPeriod": "14d",
            "project": other_project.id,
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == f"Invalid query. Project(s) {project.slug} do not exist or are not actively selected."
        )

    def test_project_in_query_does_not_exist(self):
        self.create_project()

        query = {"field": ["project", "count()"], "query": "project:morty", "statsPeriod": "14d"}
        response = self.do_request(query)

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Invalid query. Project(s) morty do not exist or are not actively selected."
        )

    def test_not_project_in_query_but_in_header(self):
        team = self.create_team(organization=self.organization, members=[self.user])

        project = self.create_project(organization=self.organization, teams=[team])
        project2 = self.create_project(organization=self.organization, teams=[team])

        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group2"],
            },
            project_id=project2.id,
        )

        query = {
            "field": ["id", "project.id"],
            "project": [project.id],
            "query": f"!project:{project2.slug}",
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == [{"id": "a" * 32, "project.id": project.id}]

    def test_not_project_in_query_with_all_projects(self):
        team = self.create_team(organization=self.organization, members=[self.user])

        project = self.create_project(organization=self.organization, teams=[team])
        project2 = self.create_project(organization=self.organization, teams=[team])

        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group2"],
            },
            project_id=project2.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["id", "project.id"],
            "project": [-1],
            "query": f"!project:{project2.slug}",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200
        assert response.data["data"] == [{"id": "a" * 32, "project.id": project.id}]

    def test_project_condition_used_for_automatic_filters(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["project", "count()"],
            "query": f'project:"{self.project.slug}"',
            "statsPeriod": "14d",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == self.project.slug
        assert "project.id" not in response.data["data"][0]

    def test_auto_insert_project_name_when_event_id_present(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )
        query = {"field": ["id"], "statsPeriod": "1h"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"project.name": self.project.slug, "id": "a" * 32}]

    def test_auto_insert_project_name_when_event_id_present_with_aggregate(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )
        query = {"field": ["id", "count()"], "statsPeriod": "1h"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {"project.name": self.project.slug, "id": "a" * 32, "count()": 1}
        ]

    def test_performance_short_group_id(self):
        event = self.create_performance_issue()
        query = {
            "field": ["count()"],
            "statsPeriod": "1h",
            "query": f"project:{event.group.project.slug} issue:{event.group.qualified_short_id}",
            "dataset": "issuePlatform",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 1

    def test_multiple_performance_short_group_ids_filter(self):
        event1 = self.create_performance_issue()
        event2 = self.create_performance_issue()

        query = {
            "field": ["count()"],
            "statsPeriod": "1h",
            "query": f"project:{event1.group.project.slug} issue:[{event1.group.qualified_short_id},{event2.group.qualified_short_id}]",
            "dataset": "issuePlatform",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 2

    def test_event_id_with_in_search(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging1",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "staging2",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )
        # Should not show up
        self.store_event(
            data={
                "event_id": "c" * 32,
                "environment": "staging3",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )
        query = {
            "field": ["id", "environment"],
            "statsPeriod": "1h",
            "query": f"id:[{'a' * 32}, {'b' * 32}]",
            "orderby": "environment",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        assert response.data["data"][0]["id"] == "a" * 32
        assert response.data["data"][1]["id"] == "b" * 32

    def test_user_search(self):
        self.transaction_data["user"] = {
            "email": "foo@example.com",
            "id": "123",
            "ip_address": "127.0.0.1",
            "username": "foo",
        }
        self.store_event(self.transaction_data, project_id=self.project.id)
        fields = {
            "email": "user.email",
            "id": "user.id",
            "ip_address": "user.ip",
            "username": "user.username",
        }
        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        for dataset in ["discover", "transactions"]:
            for key, value in self.transaction_data["user"].items():
                field = fields[key]
                query = {
                    "field": ["project", "user"],
                    "query": f"{field}:{value}",
                    "statsPeriod": "14d",
                    "dataset": dataset,
                }
                response = self.do_request(query, features=features)
                assert response.status_code == 200, response.content
                assert len(response.data["data"]) == 1
                assert response.data["data"][0]["project"] == self.project.slug
                assert response.data["data"][0]["user"] == "id:123"

    def test_has_user(self):
        self.store_event(self.transaction_data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        for dataset in ["discover", "transactions"]:
            for value in self.transaction_data["user"].values():
                query = {
                    "field": ["project", "user"],
                    "query": "has:user",
                    "statsPeriod": "14d",
                    "dataset": dataset,
                }
                response = self.do_request(query, features=features)

                assert response.status_code == 200, response.content
                assert len(response.data["data"]) == 1
                assert response.data["data"][0]["user"] == "ip:{}".format(
                    self.transaction_data["user"]["ip_address"]
                )

    def test_team_param_no_access(self):
        org = self.create_organization(
            owner=self.user,  # use other user as owner
            name="foo",
            flags=0,  # disable default allow_joinleave
        )
        project = self.create_project(name="baz", organization=org)

        user = self.create_user()
        self.login_as(user=user, superuser=False)

        team = self.create_team(organization=org, name="Team Bar")
        project.add_team(team)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )

        query = {"field": ["id", "project.id"], "project": [project.id], "team": [team.id]}
        response = self.do_request(query)
        assert response.status_code == 403, response.content

        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_team_is_nan(self):
        query = {"field": ["id"], "project": [self.project.id], "team": [math.nan]}
        response = self.do_request(query)
        assert response.status_code == 400, response.content

        assert response.data["detail"] == "Invalid Team ID: nan"

    def test_comparison_operators_on_numeric_field(self):
        event = self.store_event(
            {"timestamp": before_now(minutes=1).isoformat()}, project_id=self.project.id
        )

        query = {"field": ["issue"], "query": f"issue.id:>{event.group.id - 1}"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == event.group.qualified_short_id

        query = {"field": ["issue"], "query": f"issue.id:>{event.group.id}"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_negation_on_numeric_field_excludes_issue(self):
        event = self.store_event({"timestamp": self.ten_mins_ago_iso}, project_id=self.project.id)

        query = {"field": ["issue"], "query": f"issue.id:{event.group.id}"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == event.group.qualified_short_id

        query = {"field": ["issue"], "query": f"!issue.id:{event.group.id}"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_negation_on_numeric_in_filter_excludes_issue(self):
        event = self.store_event({"timestamp": self.ten_mins_ago_iso}, project_id=self.project.id)

        query = {"field": ["issue"], "query": f"issue.id:[{event.group.id}]"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == event.group.qualified_short_id

        query = {"field": ["issue"], "query": f"!issue.id:[{event.group.id}]"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_negation_on_duration_filter_excludes_transaction(self):
        event = self.store_event(self.transaction_data, project_id=self.project.id)
        duration = int(event.data.get("timestamp") - event.data.get("start_timestamp")) * 1000

        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["transaction"],
                "query": f"transaction.duration:{duration}",
                "dataset": dataset,
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert response.data["data"][0]["id"] == event.event_id

            query = {"field": ["transaction"], "query": f"!transaction.duration:{duration}"}
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 0

    def test_has_issue(self):
        event = self.store_event({"timestamp": self.ten_mins_ago_iso}, project_id=self.project.id)

        self.store_event(self.transaction_data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}

        # should only show 1 event of type default
        query = {"field": ["project", "issue"], "query": "has:issue", "statsPeriod": "14d"}
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == event.group.qualified_short_id

        # should only show 1 event of type default
        query = {
            "field": ["project", "issue"],
            "query": "event.type:default has:issue",
            "statsPeriod": "14d",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == event.group.qualified_short_id

        # should show no results because no the default event has an issue
        query = {
            "field": ["project", "issue"],
            "query": "event.type:default !has:issue",
            "statsPeriod": "14d",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

        # should show no results because no transactions have issues
        query = {
            "field": ["project", "issue"],
            "query": "event.type:transaction has:issue",
            "statsPeriod": "14d",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

        # should only show 1 event of type transaction since they don't have issues
        query = {
            "field": ["project", "issue"],
            "query": "event.type:transaction !has:issue",
            "statsPeriod": "14d",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == "unknown"

    @pytest.mark.skip("Cannot look up group_id of transaction events")
    def test_unknown_issue(self):
        event = self.store_event({"timestamp": self.ten_mins_ago_iso}, project_id=self.project.id)

        self.store_event(self.transaction_data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {"field": ["project", "issue"], "query": "issue:unknown", "statsPeriod": "14d"}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == "unknown"

        query = {"field": ["project", "issue"], "query": "!issue:unknown", "statsPeriod": "14d"}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == event.group.qualified_short_id

    def test_negative_user_search(self):
        user_data = {"email": "foo@example.com", "id": "123", "username": "foo"}

        # Load an event with data that shouldn't match
        data = self.transaction_data.copy()
        data["transaction"] = "/transactions/nomatch"
        event_user = user_data.copy()
        event_user["id"] = "undefined"
        data["user"] = event_user
        self.store_event(data, project_id=self.project.id)

        # Load a matching event
        data = self.transaction_data.copy()
        data["transaction"] = "/transactions/matching"
        data["user"] = user_data
        self.store_event(data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["project", "user"],
                "query": '!user:"id:undefined"',
                "statsPeriod": "14d",
                "dataset": dataset,
            }
            response = self.do_request(query, features=features)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert response.data["data"][0]["user"] == "id:{}".format(user_data["id"])
            assert "user.email" not in response.data["data"][0]
            assert "user.id" not in response.data["data"][0]

    def test_not_project_in_query(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=project2.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["project", "count()"],
            "query": '!project:"%s"' % project1.slug,
            "statsPeriod": "14d",
        }
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == project2.slug
        assert "project.id" not in response.data["data"][0]

    def test_error_handled_condition(self):
        prototype = self.load_data(platform="android-ndk")
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "was handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            prototype["event_id"] = event[0]
            prototype["logentry"] = {"formatted": event[1]}
            prototype["exception"]["values"][0]["value"] = event[1]
            prototype["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            prototype["timestamp"] = self.ten_mins_ago_iso
            self.store_event(data=prototype, project_id=self.project.id)

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["message", "error.handled"],
                "query": "error.handled:0",
                "orderby": "message",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 1 == len(response.data["data"])
            assert 0 == response.data["data"][0]["error.handled"]

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["message", "error.handled"],
                "query": "error.handled:1",
                "orderby": "message",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 2 == len(response.data["data"])
            assert 1 == response.data["data"][0]["error.handled"]
            assert 1 == response.data["data"][1]["error.handled"]

    def test_error_unhandled_condition(self):
        prototype = self.load_data(platform="android-ndk")
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "was handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            prototype["event_id"] = event[0]
            prototype["logentry"] = {"formatted": event[1]}
            prototype["exception"]["values"][0]["value"] = event[1]
            prototype["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            prototype["timestamp"] = self.ten_mins_ago_iso
            self.store_event(data=prototype, project_id=self.project.id)

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["message", "error.unhandled", "error.handled"],
                "query": "error.unhandled:true",
                "orderby": "message",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 1 == len(response.data["data"])
            assert 0 == response.data["data"][0]["error.handled"]
            assert 1 == response.data["data"][0]["error.unhandled"]

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["message", "error.handled", "error.unhandled"],
                "query": "error.unhandled:false",
                "orderby": "message",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 2 == len(response.data["data"])
            assert 1 == response.data["data"][0]["error.handled"]
            assert 0 == response.data["data"][0]["error.unhandled"]
            assert 1 == response.data["data"][1]["error.handled"]
            assert 0 == response.data["data"][1]["error.unhandled"]

    def test_groupby_error_handled_and_unhandled(self):
        prototype = self.load_data(platform="android-ndk")
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "was handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            prototype["event_id"] = event[0]
            prototype["logentry"] = {"formatted": event[1]}
            prototype["exception"]["values"][0]["value"] = event[1]
            prototype["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            prototype["timestamp"] = self.ten_mins_ago_iso
            self.store_event(data=prototype, project_id=self.project.id)

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["error.handled", "count()"],
                "query": "event.type:error",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 2 == len(response.data["data"])
            assert 0 == response.data["data"][0]["error.handled"]
            assert 1 == response.data["data"][0]["count()"]
            assert 1 == response.data["data"][1]["error.handled"]
            assert 2 == response.data["data"][1]["count()"]

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["error.unhandled", "count()"],
                "query": "event.type:error",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 2 == len(response.data["data"])
            assert 0 == response.data["data"][0]["error.unhandled"]
            assert 2 == response.data["data"][0]["count()"]
            assert 1 == response.data["data"][1]["error.unhandled"]
            assert 1 == response.data["data"][1]["count()"]

    def test_error_main_thread_condition(self):
        prototype = self.load_data(platform="android-ndk")

        prototype["timestamp"] = self.ten_mins_ago_iso
        self.store_event(data=prototype, project_id=self.project.id)

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["id", "project.id"],
                "query": "error.main_thread:true",
                "project": [self.project.id],
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 1 == len(response.data["data"])

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["id", "project.id"],
                "query": "error.main_thread:false",
                "project": [self.project.id],
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 0 == len(response.data["data"])

    def test_implicit_groupby(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.eleven_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=self.project.id,
        )
        event1 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
            },
            project_id=self.project.id,
        )

        query = {"field": ["count(id)", "project.id", "issue.id"], "orderby": "issue.id"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0] == {
            "project.id": self.project.id,
            "issue.id": event1.group_id,
            "count(id)": 2,
        }
        assert data[1] == {
            "project.id": self.project.id,
            "issue.id": event2.group_id,
            "count(id)": 1,
        }
        meta = response.data["meta"]["fields"]
        assert meta["count(id)"] == "integer"

    def test_orderby(self):
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.eleven_mins_ago_iso},
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "c" * 32, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        )
        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0]["id"] == "c" * 32
        assert data[1]["id"] == "b" * 32
        assert data[2]["id"] == "a" * 32

    def test_sort_title(self):
        self.store_event(
            data={"event_id": "a" * 32, "message": "zlast", "timestamp": self.eleven_mins_ago_iso},
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "message": "second", "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "c" * 32, "message": "first", "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        )
        query = {"field": ["id", "title"], "sort": "title"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0]["id"] == "c" * 32
        assert data[1]["id"] == "b" * 32
        assert data[2]["id"] == "a" * 32

    def test_sort_invalid(self):
        self.create_project()

        query = {"field": ["id"], "sort": "garbage"}
        response = self.do_request(query)
        assert response.status_code == 400
        assert "sort by" in response.data["detail"]

    def test_latest_release_alias(self):
        event1 = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.eleven_mins_ago_iso, "release": "0.8"},
            project_id=self.project.id,
        )
        query = {"field": ["issue.id", "release"], "query": "release:latest"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0]["issue.id"] == event1.group_id
        assert data[0]["release"] == "0.8"

        event2 = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.ten_mins_ago_iso, "release": "0.9"},
            project_id=self.project.id,
        )

        query = {"field": ["issue.id", "release"], "query": "release:latest"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0]["issue.id"] == event2.group_id
        assert data[0]["release"] == "0.9"

    def test_semver(self):
        release_1 = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        release_3 = self.create_release(version="test@1.2.5")

        release_1_e_1 = self.store_event(
            data={"release": release_1.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id
        release_2_e_2 = self.store_event(
            data={"release": release_2.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id
        release_3_e_1 = self.store_event(
            data={"release": release_3.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id
        release_3_e_2 = self.store_event(
            data={"release": release_3.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id

        query = {"field": ["id"], "query": f"{constants.SEMVER_ALIAS}:>1.2.3"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }

        query = {"field": ["id"], "query": f"{constants.SEMVER_ALIAS}:>=1.2.3"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }

        query = {"field": ["id"], "query": f"{constants.SEMVER_ALIAS}:<1.2.4"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

        query = {"field": ["id"], "query": f"{constants.SEMVER_ALIAS}:1.2.3"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

        query = {"field": ["id"], "query": f"!{constants.SEMVER_ALIAS}:1.2.3"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }

    def test_release_stage(self):
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
                "timestamp": self.ten_mins_ago_iso,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).event_id
        adopted_release_e_2 = self.store_event(
            data={
                "release": adopted_release.version,
                "timestamp": self.ten_mins_ago_iso,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).event_id
        replaced_release_e_1 = self.store_event(
            data={
                "release": replaced_release.version,
                "timestamp": self.ten_mins_ago_iso,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).event_id
        replaced_release_e_2 = self.store_event(
            data={
                "release": replaced_release.version,
                "timestamp": self.ten_mins_ago_iso,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).event_id

        query = {
            "field": ["id"],
            "query": f"{constants.RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED.value}",
            "environment": [self.environment.name],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
        }

        query = {
            "field": ["id"],
            "query": f"!{constants.RELEASE_STAGE_ALIAS}:{ReleaseStages.LOW_ADOPTION.value}",
            "environment": [self.environment.name],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
            replaced_release_e_1,
            replaced_release_e_2,
        }

        query = {
            "field": ["id"],
            "query": f"{constants.RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED.value}, {ReleaseStages.REPLACED.value}]",
            "environment": [self.environment.name],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            adopted_release_e_1,
            adopted_release_e_2,
            replaced_release_e_1,
            replaced_release_e_2,
        }

    def test_semver_package(self):
        release_1 = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test2@1.2.4")

        release_1_e_1 = self.store_event(
            data={"release": release_1.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id

        query = {"field": ["id"], "query": f"{constants.SEMVER_PACKAGE_ALIAS}:test"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

        query = {"field": ["id"], "query": f"{constants.SEMVER_PACKAGE_ALIAS}:test2"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_2_e_1,
        }

    def test_semver_build(self):
        release_1 = self.create_release(version="test@1.2.3+123")
        release_2 = self.create_release(version="test2@1.2.4+124")

        release_1_e_1 = self.store_event(
            data={"release": release_1.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        ).event_id

        query = {"field": ["id"], "query": f"{constants.SEMVER_BUILD_ALIAS}:123"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

        query = {"field": ["id"], "query": f"{constants.SEMVER_BUILD_ALIAS}:124"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_2_e_1,
        }
        query = {"field": ["id"], "query": f"!{constants.SEMVER_BUILD_ALIAS}:124"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

    def test_aliased_fields(self):
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "bar@example.com"},
            },
            project_id=self.project.id,
        )

        query = {"field": ["issue.id", "count(id)", "count_unique(user)"], "orderby": "issue.id"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["issue.id"] == event1.group_id
        assert data[0]["count(id)"] == 1
        assert data[0]["count_unique(user)"] == 1
        assert "projectid" not in data[0]
        assert "project.id" not in data[0]
        assert data[1]["issue.id"] == event2.group_id
        assert data[1]["count(id)"] == 2
        assert data[1]["count_unique(user)"] == 2

    def test_aggregate_field_with_dotted_param(self):
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
                "user": {"id": "123", "email": "foo@example.com"},
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"id": "123", "email": "foo@example.com"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"id": "456", "email": "bar@example.com"},
            },
            project_id=self.project.id,
        )
        query = {
            "field": ["issue.id", "issue_title", "count(id)", "count_unique(user.email)"],
            "orderby": "issue.id",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["issue.id"] == event1.group_id
        assert data[0]["count(id)"] == 1
        assert data[0]["count_unique(user.email)"] == 1
        assert "projectid" not in data[0]
        assert "project.id" not in data[0]
        assert data[1]["issue.id"] == event2.group_id
        assert data[1]["count(id)"] == 2
        assert data[1]["count_unique(user.email)"] == 2

    def test_failure_rate_alias_field(self):
        data = self.transaction_data.copy()
        data["transaction"] = "/failure_rate/success"
        self.store_event(data, project_id=self.project.id)

        data = self.transaction_data.copy()
        data["transaction"] = "/failure_rate/unknown"
        data["contexts"]["trace"]["status"] = "unknown_error"
        self.store_event(data, project_id=self.project.id)

        for i in range(6):
            data = self.transaction_data.copy()
            data["transaction"] = f"/failure_rate/{i}"
            data["contexts"]["trace"]["status"] = "unauthenticated"
            self.store_event(data, project_id=self.project.id)

        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["failure_rate()"],
                "query": "event.type:transaction",
                "dataset": dataset,
            }
            response = self.do_request(query)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            data = response.data["data"]
            assert data[0]["failure_rate()"] == 0.75

    def test_count_miserable_alias_field(self):
        self._setup_user_misery()
        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["count_miserable(user, 300)"],
                "query": "event.type:transaction",
                "dataset": dataset,
            }
            response = self.do_request(query)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            data = response.data["data"]
            assert data[0]["count_miserable(user, 300)"] == 3

    @mock.patch(
        "sentry.search.events.fields.MAX_QUERYABLE_TRANSACTION_THRESHOLDS",
        MAX_QUERYABLE_TRANSACTION_THRESHOLDS,
    )
    @mock.patch(
        "sentry.search.events.datasets.discover.MAX_QUERYABLE_TRANSACTION_THRESHOLDS",
        MAX_QUERYABLE_TRANSACTION_THRESHOLDS,
    )
    def test_too_many_transaction_thresholds(self):
        project_transaction_thresholds = []
        project_ids = []
        for i in range(MAX_QUERYABLE_TRANSACTION_THRESHOLDS + 1):
            project = self.create_project(name=f"bulk_txn_{i}")
            project_ids.append(project.id)
            project_transaction_thresholds.append(
                ProjectTransactionThreshold(
                    organization=self.organization,
                    project=project,
                    threshold=400,
                    metric=TransactionMetric.LCP.value,
                )
            )

        ProjectTransactionThreshold.objects.bulk_create(project_transaction_thresholds)

        query = {
            "field": [
                "transaction",
                "count_miserable(user)",
            ],
            "query": "event.type:transaction",
            "project": project_ids,
        }

        response = self.do_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:global-views": True,
            },
        )

        assert response.status_code == 400
        assert (
            response.data["detail"]
            == "Exceeded 1 configured transaction thresholds limit, try with fewer Projects."
        )

    def test_count_miserable_new_alias_field(self):
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=400,  # This is higher than the default threshold
            metric=TransactionMetric.DURATION.value,
        )
        self._setup_user_misery()

        query = {
            "field": [
                "transaction",
                "count_miserable(user)",
            ],
            "query": "event.type:transaction",
            "project": [self.project.id],
            "sort": "count_miserable_user",
        }

        def _expected(index: int, count: int) -> dict[str, Any]:
            return {
                "transaction": f"/count_miserable/horribilis/{index}",
                "project_threshold_config": ["duration", 400],
                "count_miserable(user)": count,
            }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        # Sorted by count_miserable_user, however, withing the same count_miserable_user,
        # the order is not guaranteed
        for expected in [
            _expected(0, 0),
            _expected(1, 0),
            _expected(2, 1),
            _expected(3, 1),
            _expected(4, 0),
            _expected(5, 1),
        ]:
            assert expected in response.data["data"]

        # The condition will exclude transactions with count_miserable(user) == 0
        query["query"] = "event.type:transaction count_miserable(user):>0"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        for expected in [_expected(2, 1), _expected(3, 1), _expected(5, 1)]:
            assert expected in response.data["data"]

    def test_user_misery_denominator(self):
        """This is to test against a bug where the denominator of misery(total unique users) was wrong
        This is because the total unique users for a LCP misery should only count users that have had a txn with lcp,
        and not count all transactions (ie. uniq_if(transaction has lcp) not just uniq())
        """
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )
        lcps = [
            400,
            400,
            300,
            3000,
            3000,
            3000,
        ]
        for idx, lcp in enumerate(lcps):
            data = self.load_data(
                timestamp=before_now(minutes=(10 + idx)),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = "/misery/new/"
            data["user"] = {"email": f"{idx}@example.com"}
            data["measurements"] = {
                "lcp": {"value": lcp},
            }
            self.store_event(data, project_id=self.project.id)

        # Shouldn't count towards misery
        data = self.load_data(timestamp=self.ten_mins_ago, duration=timedelta(milliseconds=0))
        data["transaction"] = "/misery/new/"
        data["user"] = {"email": "7@example.com"}
        data["measurements"] = {}
        self.store_event(data, project_id=self.project.id)

        query = {
            "field": [
                "transaction",
                "user_misery()",
            ],
            "query": "event.type:transaction",
            "project": [self.project.id],
            "sort": "-user_misery",
        }

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        # (3 frustrated + 5.8875) / (6 + 117.75)
        assert abs(data[0]["user_misery()"] - user_misery_formula(3, 6)) < 0.0001

    def test_user_misery_alias_field(self):
        events = [
            ("one", 300),
            ("one", 300),
            ("two", 3000),
            ("two", 3000),
            ("three", 300),
            ("three", 3000),
        ]
        for idx, event in enumerate(events):
            data = self.load_data(
                timestamp=before_now(minutes=(10 + idx)),
                duration=timedelta(milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/user_misery/{idx}"
            data["user"] = {"email": f"{event[0]}@example.com"}
            self.store_event(data, project_id=self.project.id)
        query = {"field": ["user_misery(300)"], "query": "event.type:transaction"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert abs(data[0]["user_misery(300)"] - user_misery_formula(2, 3)) < 0.0001

    def test_apdex_denominator_correct(self):
        """This is to test against a bug where the denominator of apdex(total count) was wrong

        This is because the total_count for a LCP apdex should only count transactions that have lcp, and not count
        all transactions (ie. count_if(transaction has lcp) not just count())
        """
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )
        lcps = [
            400,
            400,
            300,
            800,
            3000,
            3000,
            3000,
        ]
        for idx, lcp in enumerate(lcps):
            data = self.load_data(
                timestamp=before_now(minutes=(10 + idx)),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = "/apdex/new/"
            data["user"] = {"email": f"{idx}@example.com"}
            data["measurements"] = {
                "lcp": {"value": lcp},
            }
            self.store_event(data, project_id=self.project.id)

        # Shouldn't count towards apdex
        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(milliseconds=0),
        )
        data["transaction"] = "/apdex/new/"
        data["user"] = {"email": "7@example.com"}
        data["measurements"] = {}
        self.store_event(data, project_id=self.project.id)

        query = {
            "field": [
                "transaction",
                "apdex()",
            ],
            "query": "event.type:transaction",
            "project": [self.project.id],
            "sort": "-apdex",
        }

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        # 3 satisfied + 1 tolerated => 3.5/7
        assert data[0]["apdex()"] == 0.5

    def test_apdex_new_alias_field(self):
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=400,
            metric=TransactionMetric.DURATION.value,
        )

        events = [
            ("one", 400),
            ("one", 400),
            ("two", 3000),
            ("two", 3000),
            ("three", 300),
            ("three", 3000),
        ]
        for idx, event in enumerate(events):
            data = self.load_data(
                timestamp=before_now(minutes=(10 + idx)),
                duration=timedelta(milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/apdex/new/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}
            self.store_event(data, project_id=self.project.id)

        query = {
            "field": [
                "transaction",
                "apdex()",
            ],
            "query": "event.type:transaction",
            "project": [self.project.id],
            "sort": "-apdex",
        }

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        assert data[0]["apdex()"] == 1.0
        assert data[1]["apdex()"] == 0.5
        assert data[2]["apdex()"] == 0.0

        query["query"] = "event.type:transaction apdex():>0.50"

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["apdex()"] == 1.0

    def test_user_misery_alias_field_with_project_threshold(self):
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=400,
            metric=TransactionMetric.DURATION.value,
        )

        events = [
            ("one", 400),
            ("one", 400),
            ("two", 3000),
            ("two", 3000),
            ("three", 300),
            ("three", 3000),
        ]
        for idx, event in enumerate(events):
            data = self.load_data(
                timestamp=before_now(minutes=(10 + idx)),
                duration=timedelta(milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/count_miserable/horribilis/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}
            self.store_event(data, project_id=self.project.id)

        query = {
            "field": [
                "transaction",
                "user_misery()",
            ],
            "orderby": "user_misery()",
            "query": "event.type:transaction",
            "project": [self.project.id],
        }

        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        assert data[0]["user_misery()"] == user_misery_formula(0, 2)
        assert data[1]["user_misery()"] == user_misery_formula(1, 2)
        assert data[2]["user_misery()"] == user_misery_formula(2, 2)

        query["query"] = "event.type:transaction user_misery():>0.050"

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["user_misery()"] == user_misery_formula(1, 2)
        assert data[1]["user_misery()"] == user_misery_formula(2, 2)

    def test_user_misery_alias_field_with_transaction_threshold(self):
        self._setup_user_misery(per_transaction_threshold=True)

        query = {
            "field": [
                "transaction",
                "user_misery()",
            ],
            "query": "event.type:transaction",
            "orderby": "transaction",
            "project": [self.project.id],
        }

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content

        expected = [
            ("/count_miserable/horribilis/0", ["duration", 300], user_misery_formula(0, 1)),
            ("/count_miserable/horribilis/1", ["duration", 100], user_misery_formula(0, 1)),
            ("/count_miserable/horribilis/2", ["duration", 300], user_misery_formula(1, 1)),
            ("/count_miserable/horribilis/3", ["duration", 300], user_misery_formula(1, 1)),
            ("/count_miserable/horribilis/4", ["duration", 300], user_misery_formula(0, 1)),
            ("/count_miserable/horribilis/5", ["duration", 500], user_misery_formula(1, 1)),
        ]

        assert len(response.data["data"]) == 6
        data = response.data["data"]
        for i, record in enumerate(expected):
            name, threshold_config, misery = record
            assert data[i]["transaction"] == name
            assert data[i]["project_threshold_config"] == threshold_config
            assert data[i]["user_misery()"] == pytest.approx(misery, rel=1e-3)

        query["query"] = "event.type:transaction user_misery():>0.050"

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        assert data[0]["user_misery()"] == user_misery_formula(1, 1)
        assert data[1]["user_misery()"] == user_misery_formula(1, 1)
        assert data[2]["user_misery()"] == user_misery_formula(1, 1)

    def test_user_misery_alias_field_with_transaction_threshold_and_project_threshold(self):
        project = self.create_project()

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=project.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        self._setup_user_misery(per_transaction_threshold=True, project=project)

        project2 = self.create_project()

        data = self.load_data()
        data["transaction"] = "/count_miserable/horribilis/project2"
        data["user"] = {"email": "project2@example.com"}
        self.store_event(data, project_id=project2.id)

        query = {
            "field": [
                "transaction",
                "user_misery()",
            ],
            "query": "event.type:transaction",
            "orderby": "transaction",
            "project": [project.id, project2.id],
        }

        response = self.do_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:global-views": True,
            },
        )

        assert response.status_code == 200, response.content

        zero_one = user_misery_formula(0, 1)
        one_one = user_misery_formula(1, 1)
        expected = [
            # Uses project threshold
            ("/count_miserable/horribilis/0", ["duration", 100], zero_one),
            ("/count_miserable/horribilis/1", ["duration", 100], zero_one),  # Uses txn threshold
            ("/count_miserable/horribilis/2", ["duration", 100], one_one),  # Uses project threshold
            ("/count_miserable/horribilis/3", ["duration", 300], one_one),  # Uses txn threshold
            # Uses project threshold
            ("/count_miserable/horribilis/4", ["duration", 100], zero_one),
            ("/count_miserable/horribilis/5", ["duration", 500], one_one),  # Uses txn threshold
            ("/count_miserable/horribilis/project2", ["duration", 300], one_one),  # Uses fallback
        ]

        data = response.data["data"]
        for i, record in enumerate(expected):
            name, threshold_config, misery = record
            assert data[i]["transaction"] == name
            assert data[i]["project_threshold_config"] == threshold_config
            assert data[i]["user_misery()"] == misery

        query["query"] = "event.type:transaction user_misery():>0.050"

        response = self.do_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:global-views": True,
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 4

    def test_aggregation(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
                "tags": {"sub_customer.is-Enterprise-42": "1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "staging",
                "tags": {"sub_customer.is-Enterprise-42": "1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
                "tags": {"sub_customer.is-Enterprise-42": "0"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
                "tags": {"sub_customer.is-Enterprise-42": "1"},
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["sub_customer.is-Enterprise-42", "count(sub_customer.is-Enterprise-42)"],
            "orderby": "sub_customer.is-Enterprise-42",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["count(sub_customer.is-Enterprise-42)"] == 1
        assert data[1]["count(sub_customer.is-Enterprise-42)"] == 3

    def test_aggregation_comparison(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
            },
            project_id=self.project.id,
        )
        event = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "bar@example.com"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_3"],
                "user": {"email": "bar@example.com"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "e" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_3"],
                "user": {"email": "bar@example.com"},
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["issue.id", "count(id)", "count_unique(user)"],
            "query": "count(id):>1 count_unique(user):>1",
            "orderby": "issue.id",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["issue.id"] == event.group_id
        assert data[0]["count(id)"] == 2
        assert data[0]["count_unique(user)"] == 2

    def test_aggregation_alias_comparison(self):
        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        self.store_event(data, project_id=self.project.id)

        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        event = self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["transaction", "p95()"],
            "query": "event.type:transaction p95():<4000",
            "orderby": ["transaction"],
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == event.transaction
        assert data[0]["p95()"] == 3000

    def test_auto_aggregations(self):
        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        self.store_event(data, project_id=self.project.id)

        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        event = self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["transaction", "p75()"],
            "query": "event.type:transaction p95():<4000",
            "orderby": ["transaction"],
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == event.transaction

        query = {
            "field": ["transaction"],
            "query": "event.type:transaction p95():<4000",
            "orderby": ["transaction"],
        }
        response = self.do_request(query)

        assert response.status_code == 400, response.content

    def test_aggregation_comparison_with_conditions(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "staging",
            },
            project_id=self.project.id,
        )
        event = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["issue.id", "count(id)"],
            "query": "count(id):>1 user.email:foo@example.com environment:prod",
            "orderby": "issue.id",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content

        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["issue.id"] == event.group_id
        assert data[0]["count(id)"] == 2

    def test_aggregation_date_comparison_with_conditions(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "staging",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        query = {
            "field": ["issue.id", "max(timestamp)"],
            "query": "max(timestamp):>1 user.email:foo@example.com environment:prod",
            "orderby": "issue.id",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        assert response.data["meta"]["fields"]["max(timestamp)"] == "date"
        data = response.data["data"]
        assert data[0]["issue.id"] == event.group_id

    def test_percentile_function(self):
        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        event1 = self.store_event(data, project_id=self.project.id)

        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        event2 = self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["transaction", "percentile(transaction.duration, 0.95)"],
            "query": "event.type:transaction",
            "orderby": ["transaction"],
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["transaction"] == event1.transaction
        assert data[0]["percentile(transaction.duration, 0.95)"] == 5000
        assert data[1]["transaction"] == event2.transaction
        assert data[1]["percentile(transaction.duration, 0.95)"] == 3000

    def test_percentile_function_as_condition(self):
        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        event1 = self.store_event(data, project_id=self.project.id)

        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["transaction", "percentile(transaction.duration, 0.95)"],
            "query": "event.type:transaction percentile(transaction.duration, 0.95):>4000",
            "orderby": ["transaction"],
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == event1.transaction
        assert data[0]["percentile(transaction.duration, 0.95)"] == 5000

    def test_epm_function(self):
        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        event1 = self.store_event(data, project_id=self.project.id)

        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        event2 = self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["transaction", "epm()"],
            "query": "event.type:transaction",
            "orderby": ["transaction"],
            "start": self.eleven_mins_ago_iso,
            "end": self.nine_mins_ago,
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["transaction"] == event1.transaction
        assert data[0]["epm()"] == 0.5
        assert data[1]["transaction"] == event2.transaction
        assert data[1]["epm()"] == 0.5
        meta = response.data["meta"]
        assert meta["fields"]["epm()"] == "rate"
        assert meta["units"]["epm()"] == "1/minute"

    def test_nonexistent_fields(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )

        query = {"field": ["issue_world.id"]}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["issue_world.id"] == ""

    def test_no_requested_fields_or_grouping(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )

        query = {"query": "test"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "No columns selected"

    def test_condition_on_aggregate_misses(self):
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "bar@example.com"},
            },
            project_id=self.project.id,
        )

        query = {"field": ["issue.id"], "query": "event_count:>0", "orderby": "issue.id"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_next_prev_link_headers(self):
        events = [("a", "group_1"), ("b", "group_2"), ("c", "group_2"), ("d", "group_2")]
        for e in events:
            self.store_event(
                data={
                    "event_id": e[0] * 32,
                    "timestamp": self.ten_mins_ago_iso,
                    "fingerprint": [e[1]],
                    "user": {"email": "foo@example.com"},
                    "tags": {"language": "C++"},
                },
                project_id=self.project.id,
            )

        query = {
            "field": ["count(id)", "issue.id", "context.key"],
            "sort": "-count_id",
            "query": "language:C++",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        links = parse_link_header(response["Link"])
        for link in links:
            assert "field=issue.id" in link
            assert "field=count%28id%29" in link
            assert "field=context.key" in link
            assert "sort=-count_id" in link
            assert "query=language%3AC%2B%2B" in link

        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["count(id)"] == 3
        assert data[1]["count(id)"] == 1

    def test_empty_count_query(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["1123581321"],
                "user": {"email": "foo@example.com"},
                "tags": {"language": "C++"},
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["count()"],
            "query": f"issue.id:{event.group_id} timestamp:>{self.ten_mins_ago_iso}",
            "statsPeriod": "14d",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 0

    def test_stack_wildcard_condition(self):
        data = self.load_data(platform="javascript")
        data["timestamp"] = self.ten_mins_ago_iso
        self.store_event(data=data, project_id=self.project.id)

        query = {"field": ["stack.filename", "message"], "query": "stack.filename:*.js"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["fields"]["message"] == "string"

    def test_email_wildcard_condition(self):
        data = self.load_data(platform="javascript")
        data["timestamp"] = self.ten_mins_ago_iso
        self.store_event(data=data, project_id=self.project.id)

        query = {"field": ["stack.filename", "message"], "query": "user.email:*@example.org"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["fields"]["message"] == "string"

    def test_release_wildcard_condition(self):
        release = self.create_release(version="test@1.2.3+123")

        self.store_event(
            data={"release": release.version, "timestamp": self.ten_mins_ago_iso},
            project_id=self.project.id,
        )

        query = {"field": ["stack.filename", "release"], "query": "release:test*"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["release"] == release.version

    def test_transaction_event_type(self):
        self.store_event(data=self.transaction_data, project_id=self.project.id)

        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["transaction", "transaction.duration", "transaction.status"],
                "query": "event.type:transaction",
                "dataset": dataset,
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert response.data["meta"]["fields"]["transaction.duration"] == "duration"
            assert response.data["meta"]["fields"]["transaction.status"] == "string"
            assert response.data["meta"]["units"]["transaction.duration"] == "millisecond"
            assert response.data["data"][0]["transaction.status"] == "ok"

    def test_trace_columns(self):
        self.store_event(data=self.transaction_data, project_id=self.project.id)

        for dataset in ["discover", "transactions"]:
            query = {"field": ["trace"], "query": "event.type:transaction", "dataset": dataset}
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert response.data["meta"]["fields"]["trace"] == "string"
            assert (
                response.data["data"][0]["trace"]
                == self.transaction_data["contexts"]["trace"]["trace_id"]
            )

    def test_issue_in_columns(self):
        project1 = self.create_project()
        project2 = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=project2.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {"field": ["id", "issue"], "orderby": ["id"]}
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["id"] == event1.event_id
        assert data[0]["issue.id"] == event1.group_id
        assert data[0]["issue"] == event1.group.qualified_short_id
        assert data[1]["id"] == event2.event_id
        assert data[1]["issue.id"] == event2.group_id
        assert data[1]["issue"] == event2.group.qualified_short_id

    def test_issue_in_search_and_columns(self):
        project1 = self.create_project()
        project2 = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=project2.id,
        )

        tests = [
            ("issue", "issue:%s" % event1.group.qualified_short_id),
            ("issue.id", "issue:%s" % event1.group.qualified_short_id),
            ("issue", "issue.id:%s" % event1.group_id),
            ("issue.id", "issue.id:%s" % event1.group_id),
        ]

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        for testdata in tests:
            query = {"field": [testdata[0]], "query": testdata[1]}
            response = self.do_request(query, features=features)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["id"] == event1.event_id
            assert data[0]["issue.id"] == event1.group_id
            if testdata[0] == "issue":
                assert data[0]["issue"] == event1.group.qualified_short_id
            else:
                assert data[0].get("issue", None) is None

    def test_issue_negation(self):
        project1 = self.create_project()
        project2 = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "go really fast plz",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
            },
            project_id=project2.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["title", "issue.id"],
            "query": f"!issue:{event1.group.qualified_short_id}",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["title"] == event2.title
        assert data[0]["issue.id"] == event2.group_id

    def test_search_for_nonexistent_issue(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=self.project.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {"field": ["count()"], "query": "issue.id:112358"}
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 0

    def test_issue_alias_inside_aggregate(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
            },
            project_id=self.project.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["project", "count(id)", "count_unique(issue.id)", "count_unique(issue)"],
            "sort": "-count(id)",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count(id)"] == 2
        assert data[0]["count_unique(issue.id)"] == 2
        assert data[0]["count_unique(issue)"] == 2

    def test_project_alias_inside_aggregate(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
            },
            project_id=project2.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": [
                "event.type",
                "count(id)",
                "count_unique(project.id)",
                "count_unique(project)",
            ],
            "sort": "-count(id)",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count(id)"] == 2
        assert data[0]["count_unique(project.id)"] == 2
        assert data[0]["count_unique(project)"] == 2

    def test_user_display(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"email": "cathy@example.com"},
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"username": "catherine"},
            },
            project_id=project2.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "user.display"],
            "query": "user.display:cath*",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        result = {r["user.display"] for r in data}
        assert result == {"catherine", "cathy@example.com"}

    def test_user_display_with_aggregates(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"email": "cathy@example.com"},
            },
            project_id=self.project.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "user.display", "count_unique(title)"],
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        result = {r["user.display"] for r in data}
        assert result == {"cathy@example.com"}

        query = {"field": ["event.type", "count_unique(user.display)"], "statsPeriod": "24h"}
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count_unique(user.display)"] == 1

    def test_orderby_user_display(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"email": "cathy@example.com"},
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"username": "catherine"},
            },
            project_id=project2.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "user.display"],
            "query": "user.display:cath*",
            "statsPeriod": "24h",
            "orderby": "-user.display",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        result = [r["user.display"] for r in data]
        # because we're ordering by `-user.display`, we expect the results in reverse sorted order
        assert result == ["cathy@example.com", "catherine"]

    def test_orderby_user_display_with_aggregates(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"email": "cathy@example.com"},
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"username": "catherine"},
            },
            project_id=project2.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "user.display", "count_unique(title)"],
            "query": "user.display:cath*",
            "statsPeriod": "24h",
            "orderby": "user.display",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        result = [r["user.display"] for r in data]
        # because we're ordering by `user.display`, we expect the results in sorted order
        assert result == ["catherine", "cathy@example.com"]

    def test_any_field_alias(self):
        day_ago = before_now(days=1).replace(hour=10, minute=11, second=12, microsecond=13)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": day_ago.isoformat(),
                "user": {"email": "cathy@example.com"},
            },
            project_id=self.project.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": [
                "event.type",
                "any(user.display)",
                "any(timestamp.to_day)",
                "any(timestamp.to_hour)",
            ],
            "statsPeriod": "7d",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        result = {r["any(user.display)"] for r in data}
        assert result == {"cathy@example.com"}
        result = {r["any(timestamp.to_day)"][:19] for r in data}
        assert result == {
            day_ago.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None).isoformat()
        }
        result = {r["any(timestamp.to_hour)"][:19] for r in data}
        assert result == {
            day_ago.replace(minute=0, second=0, microsecond=0, tzinfo=None).isoformat()
        }

    def test_field_aliases_in_conflicting_functions(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": (
                    before_now(days=1).replace(hour=10, minute=11, second=12, microsecond=13)
                ).isoformat(),
                "user": {"email": "cathy@example.com"},
            },
            project_id=self.project.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}

        field_aliases = ["user.display", "timestamp.to_day", "timestamp.to_hour"]
        for alias in field_aliases:
            query = {
                "field": [alias, f"any({alias})"],
                "statsPeriod": "7d",
            }
            response = self.do_request(query, features=features)
            assert response.status_code == 400, response.content
            assert (
                response.data["detail"]
                == f"A single field cannot be used both inside and outside a function in the same query. To use {alias} you must first remove the function(s): any({alias})"
            )

    @pytest.mark.skip(
        """
         For some reason ClickHouse errors when there are two of the same string literals
         (in this case the empty string "") in a query and one is in the prewhere clause.
         Does not affect production or ClickHouse versions > 20.4.
         """
    )
    def test_has_message(self):
        event = self.store_event(
            {"timestamp": self.ten_mins_ago_iso, "message": "a"}, project_id=self.project.id
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {"field": ["project", "message"], "query": "has:message", "statsPeriod": "14d"}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["message"] == event.message

        query = {"field": ["project", "message"], "query": "!has:message", "statsPeriod": "14d"}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_has_transaction_status(self):
        self.store_event(self.transaction_data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["event.type", "count(id)"],
                "query": "event.type:transaction has:transaction.status",
                "sort": "-count(id)",
                "statsPeriod": "24h",
                "dataset": dataset,
            }
            response = self.do_request(query, features=features)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["count(id)"] == 1

    @pytest.mark.xfail(reason="Started failing on ClickHouse 21.8")
    def test_not_has_transaction_status(self):
        self.store_event(self.transaction_data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["event.type", "count(id)"],
                "query": "event.type:transaction !has:transaction.status",
                "sort": "-count(id)",
                "statsPeriod": "24h",
                "dataset": dataset,
            }
            response = self.do_request(query, features=features)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["count(id)"] == 0

    def test_tag_that_looks_like_aggregation(self):
        data = {
            "message": "Failure state",
            "timestamp": self.ten_mins_ago_iso,
            "tags": {"count_diff": 99},
        }
        self.store_event(data, project_id=self.project.id)
        query = {
            "field": ["message", "count_diff", "count()"],
            "query": "",
            "project": [self.project.id],
            "statsPeriod": "24h",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        meta = response.data["meta"]["fields"]
        assert "string" == meta["count_diff"], "tags should not be counted as integers"
        assert "string" == meta["message"]
        assert "integer" == meta["count()"]
        assert 1 == len(response.data["data"])
        data = response.data["data"][0]
        assert "99" == data["count_diff"]
        assert "Failure state" == data["message"]
        assert 1 == data["count()"]

    def test_aggregate_negation(self):
        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        self.store_event(data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "count()"],
            "query": "event.type:transaction count():1",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1

        query = {
            "field": ["event.type", "count()"],
            "query": "event.type:transaction !count():1",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 0

    def test_all_aggregates_in_columns(self):
        data = self.load_data(
            timestamp=self.eleven_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/failure_rate/1"
        self.store_event(data, project_id=self.project.id)

        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/failure_rate/1"
        data["contexts"]["trace"]["status"] = "unauthenticated"
        event = self.store_event(data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": [
                "event.type",
                "p50()",
                "p75()",
                "p95()",
                "p99()",
                "p100()",
                "percentile(transaction.duration, 0.99)",
                "apdex(300)",
                "count_miserable(user, 300)",
                "user_misery(300)",
                "failure_rate()",
            ],
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        meta = response.data["meta"]["fields"]
        units = response.data["meta"]["units"]
        assert meta["p50()"] == "duration"
        assert meta["p75()"] == "duration"
        assert meta["p95()"] == "duration"
        assert meta["p99()"] == "duration"
        assert meta["p100()"] == "duration"
        assert meta["percentile(transaction.duration, 0.99)"] == "duration"
        assert meta["apdex(300)"] == "number"
        assert meta["failure_rate()"] == "percentage"
        assert meta["user_misery(300)"] == "number"
        assert meta["count_miserable(user, 300)"] == "integer"

        assert units["p50()"] == "millisecond"
        assert units["p75()"] == "millisecond"
        assert units["p95()"] == "millisecond"
        assert units["p99()"] == "millisecond"
        assert units["p100()"] == "millisecond"
        assert units["percentile(transaction.duration, 0.99)"] == "millisecond"

        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p50()"] == 5000
        assert data[0]["p75()"] == 5000
        assert data[0]["p95()"] == 5000
        assert data[0]["p99()"] == 5000
        assert data[0]["p100()"] == 5000
        assert data[0]["percentile(transaction.duration, 0.99)"] == 5000
        assert data[0]["apdex(300)"] == 0.0
        assert data[0]["count_miserable(user, 300)"] == 1
        assert data[0]["user_misery(300)"] == user_misery_formula(1, 1)
        assert data[0]["failure_rate()"] == 0.5

        features = {
            "organizations:discover-basic": True,
            "organizations:global-views": True,
        }

        query = {
            "field": [
                "event.type",
                "p50()",
                "p75()",
                "p95()",
                "p99()",
                "p100()",
                "percentile(transaction.duration, 0.99)",
                "apdex(300)",
                "apdex()",
                "count_miserable(user, 300)",
                "user_misery(300)",
                "failure_rate()",
                "count_miserable(user)",
                "user_misery()",
            ],
            "query": "event.type:transaction",
            "project": [self.project.id],
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        meta = response.data["meta"]["fields"]
        units = response.data["meta"]["units"]
        assert meta["p50()"] == "duration"
        assert meta["p75()"] == "duration"
        assert meta["p95()"] == "duration"
        assert meta["p99()"] == "duration"
        assert meta["p100()"] == "duration"
        assert meta["percentile(transaction.duration, 0.99)"] == "duration"
        assert meta["apdex(300)"] == "number"
        assert meta["apdex()"] == "number"
        assert meta["failure_rate()"] == "percentage"
        assert meta["user_misery(300)"] == "number"
        assert meta["count_miserable(user, 300)"] == "integer"
        assert meta["project_threshold_config"] == "string"
        assert meta["user_misery()"] == "number"
        assert meta["count_miserable(user)"] == "integer"

        assert units["p50()"] == "millisecond"
        assert units["p75()"] == "millisecond"
        assert units["p95()"] == "millisecond"
        assert units["p99()"] == "millisecond"
        assert units["p100()"] == "millisecond"
        assert units["percentile(transaction.duration, 0.99)"] == "millisecond"

        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p50()"] == 5000
        assert data[0]["p75()"] == 5000
        assert data[0]["p95()"] == 5000
        assert data[0]["p99()"] == 5000
        assert data[0]["p100()"] == 5000
        assert data[0]["percentile(transaction.duration, 0.99)"] == 5000
        assert data[0]["apdex(300)"] == 0.0
        assert data[0]["apdex()"] == 0.0
        assert data[0]["count_miserable(user, 300)"] == 1
        assert data[0]["user_misery(300)"] == user_misery_formula(1, 1)
        assert data[0]["failure_rate()"] == 0.5
        assert data[0]["project_threshold_config"] == ["duration", 300]
        assert data[0]["user_misery()"] == user_misery_formula(1, 1)
        assert data[0]["count_miserable(user)"] == 1

        query = {
            "field": ["event.type", "last_seen()", "latest_event()"],
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert self.ten_mins_ago_iso == data[0]["last_seen()"]
        assert data[0]["latest_event()"] == event.event_id

        query = {
            "field": [
                "event.type",
                "count()",
                "count(id)",
                "count_unique(project)",
                "min(transaction.duration)",
                "max(transaction.duration)",
                "avg(transaction.duration)",
                "stddev(transaction.duration)",
                "var(transaction.duration)",
                "cov(transaction.duration, transaction.duration)",
                "corr(transaction.duration, transaction.duration)",
                "linear_regression(transaction.duration, transaction.duration)",
                "sum(transaction.duration)",
            ],
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 2
        assert data[0]["count(id)"] == 2
        assert data[0]["count_unique(project)"] == 1
        assert data[0]["min(transaction.duration)"] == 5000
        assert data[0]["max(transaction.duration)"] == 5000
        assert data[0]["avg(transaction.duration)"] == 5000
        assert data[0]["stddev(transaction.duration)"] == 0.0
        assert data[0]["var(transaction.duration)"] == 0.0
        assert data[0]["cov(transaction.duration, transaction.duration)"] == 0.0
        assert data[0]["corr(transaction.duration, transaction.duration)"] == 0.0
        assert data[0]["linear_regression(transaction.duration, transaction.duration)"] == [0, 0]
        assert data[0]["sum(transaction.duration)"] == 10000

    def test_null_user_misery_returns_zero(self):
        self.transaction_data["user"] = None
        self.transaction_data["transaction"] = "/no_users/1"
        self.store_event(self.transaction_data, project_id=self.project.id)
        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["user_misery(300)"],
                "query": "event.type:transaction",
                "dataset": dataset,
            }

            response = self.do_request(query, features=features)
            assert response.status_code == 200, response.content
            meta = response.data["meta"]["fields"]
            assert meta["user_misery(300)"] == "number"
            data = response.data["data"]
            assert data[0]["user_misery(300)"] == 0

    def test_null_user_misery_new_returns_zero(self):
        self.transaction_data["user"] = None
        self.transaction_data["transaction"] = "/no_users/1"
        self.store_event(self.transaction_data, project_id=self.project.id)
        features = {
            "organizations:discover-basic": True,
        }

        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["user_misery()"],
                "query": "event.type:transaction",
                "dataset": dataset,
            }

            response = self.do_request(query, features=features)
            assert response.status_code == 200, response.content
            meta = response.data["meta"]["fields"]
            assert meta["user_misery()"] == "number"
            data = response.data["data"]
            assert data[0]["user_misery()"] == 0

    def test_all_aggregates_in_query(self):
        data = self.load_data(
            timestamp=self.eleven_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/failure_rate/1"
        self.store_event(data, project_id=self.project.id)

        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/failure_rate/2"
        data["contexts"]["trace"]["status"] = "unauthenticated"
        self.store_event(data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": [
                "event.type",
                "p50()",
                "p75()",
                "p95()",
                "percentile(transaction.duration, 0.99)",
                "p100()",
            ],
            "query": "event.type:transaction p50():>100 p75():>1000 p95():>1000 p100():>1000 percentile(transaction.duration, 0.99):>1000",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p50()"] == 5000
        assert data[0]["p75()"] == 5000
        assert data[0]["p95()"] == 5000
        assert data[0]["p100()"] == 5000
        assert data[0]["percentile(transaction.duration, 0.99)"] == 5000

        query = {
            "field": [
                "event.type",
                "apdex(300)",
                "count_miserable(user, 300)",
                "user_misery(300)",
                "failure_rate()",
            ],
            "query": "event.type:transaction apdex(300):>-1.0 failure_rate():>0.25",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["apdex(300)"] == 0.0
        assert data[0]["count_miserable(user, 300)"] == 1
        assert data[0]["user_misery(300)"] == user_misery_formula(1, 1)
        assert data[0]["failure_rate()"] == 0.5

        query = {
            "field": ["event.type", "last_seen()", "latest_event()"],
            "query": "event.type:transaction last_seen():>1990-12-01T00:00:00",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1

        query = {
            "field": ["event.type", "count()", "count(id)", "count_unique(transaction)"],
            "query": "event.type:transaction count():>1 count(id):>1 count_unique(transaction):>1",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 2
        assert data[0]["count(id)"] == 2
        assert data[0]["count_unique(transaction)"] == 2

        query = {
            "field": [
                "event.type",
                "min(transaction.duration)",
                "max(transaction.duration)",
                "avg(transaction.duration)",
                "sum(transaction.duration)",
                "stddev(transaction.duration)",
                "var(transaction.duration)",
                "cov(transaction.duration, transaction.duration)",
                "corr(transaction.duration, transaction.duration)",
            ],
            "query": " ".join(
                [
                    "event.type:transaction",
                    "min(transaction.duration):>1000",
                    "max(transaction.duration):>1000",
                    "avg(transaction.duration):>1000",
                    "sum(transaction.duration):>1000",
                    "stddev(transaction.duration):>=0.0",
                    "var(transaction.duration):>=0.0",
                    "cov(transaction.duration, transaction.duration):>=0.0",
                    # correlation is nan because variance is 0
                    # "corr(transaction.duration, transaction.duration):>=0.0",
                ]
            ),
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["min(transaction.duration)"] == 5000
        assert data[0]["max(transaction.duration)"] == 5000
        assert data[0]["avg(transaction.duration)"] == 5000
        assert data[0]["sum(transaction.duration)"] == 10000
        assert data[0]["stddev(transaction.duration)"] == 0.0
        assert data[0]["var(transaction.duration)"] == 0.0
        assert data[0]["cov(transaction.duration, transaction.duration)"] == 0.0
        assert data[0]["corr(transaction.duration, transaction.duration)"] == 0.0

        query = {
            "field": ["event.type", "apdex(400)"],
            "query": "event.type:transaction apdex(400):0",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["apdex(400)"] == 0

    def test_functions_in_orderby(self):
        data = self.load_data(
            timestamp=self.eleven_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/failure_rate/1"
        self.store_event(data, project_id=self.project.id)

        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/failure_rate/2"
        data["contexts"]["trace"]["status"] = "unauthenticated"
        event = self.store_event(data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "p75()"],
            "sort": "-p75",
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p75()"] == 5000

        query = {
            "field": ["event.type", "percentile(transaction.duration, 0.99)"],
            "sort": "-percentile_transaction_duration_0_99",
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["percentile(transaction.duration, 0.99)"] == 5000

        query = {
            "field": ["event.type", "apdex(300)"],
            "sort": "-apdex(300)",
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["apdex(300)"] == 0.0

        query = {
            "field": ["event.type", "latest_event()"],
            "query": "event.type:transaction",
            "sort": "latest_event",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["latest_event()"] == event.event_id

        query = {
            "field": ["event.type", "count_unique(transaction)"],
            "query": "event.type:transaction",
            "sort": "-count_unique_transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count_unique(transaction)"] == 2

        query = {
            "field": ["event.type", "min(transaction.duration)"],
            "query": "event.type:transaction",
            "sort": "-min_transaction_duration",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["min(transaction.duration)"] == 5000

    def test_issue_alias_in_aggregate(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.eleven_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
            },
            project_id=self.project.id,
        )

        query = {"field": ["event.type", "count_unique(issue)"], "query": "count_unique(issue):>1"}
        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count_unique(issue)"] == 2

    def test_deleted_issue_in_results(self):
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.eleven_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
            },
            project_id=self.project.id,
        )
        event2.group.delete()

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {"field": ["issue", "count()"], "sort": "issue.id"}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["issue"] == event1.group.qualified_short_id
        assert data[1]["issue"] == "unknown"

    def test_last_seen_negative_duration(self):
        self.store_event(
            data={
                "event_id": "f" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=self.project.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {"field": ["id", "last_seen()"], "query": "last_seen():-30d"}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["id"] == "f" * 32

    def test_last_seen_aggregate_condition(self):
        self.store_event(
            data={
                "event_id": "f" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["id", "last_seen()"],
            "query": f"last_seen():>{before_now(days=30).isoformat()}",
        }
        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["id"] == "f" * 32

    def test_conditional_filter(self):
        for v in ["a", "b"]:
            self.store_event(
                data={
                    "event_id": v * 32,
                    "timestamp": self.ten_mins_ago_iso,
                    "fingerprint": ["group_1"],
                },
                project_id=self.project.id,
            )

        query = {
            "field": ["id"],
            "query": "id:{} OR id:{}".format("a" * 32, "b" * 32),
            "orderby": "id",
        }
        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["id"] == "a" * 32
        assert data[1]["id"] == "b" * 32

    def test_aggregation_comparison_with_conditional_filter(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "staging",
            },
            project_id=self.project.id,
        )
        event = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "canary",
            },
            project_id=self.project.id,
        )

        query = {
            "field": ["issue.id", "count(id)"],
            "query": "count(id):>1 user.email:foo@example.com AND (environment:prod OR environment:staging)",
            "orderby": "issue.id",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content

        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["issue.id"] == event.group_id
        assert data[0]["count(id)"] == 2

    def run_test_in_query(
        self, query, expected_events, expected_negative_events=None, dataset="discover"
    ):
        params = {"field": ["id"], "query": query, "orderby": "id", "dataset": dataset}
        response = self.do_request(
            params, {"organizations:discover-basic": True, "organizations:global-views": True}
        )
        assert response.status_code == 200, response.content
        assert [row["id"] for row in response.data["data"]] == [e.event_id for e in expected_events]

        if expected_negative_events is not None:
            params["query"] = f"!{query}"
            response = self.do_request(
                params,
                {"organizations:discover-basic": True, "organizations:global-views": True},
            )
            assert response.status_code == 200, response.content
            assert [row["id"] for row in response.data["data"]] == [
                e.event_id for e in expected_negative_events
            ]

    def test_in_query_events(self):
        project_1 = self.create_project()
        event_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_1"],
                "message": "group1",
                "user": {"email": "hello@example.com"},
                "environment": "prod",
                "tags": {"random": "123"},
                "release": "1.0",
            },
            project_id=project_1.id,
        )
        project_2 = self.create_project()
        event_2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_2"],
                "message": "group2",
                "user": {"email": "bar@example.com"},
                "environment": "staging",
                "tags": {"random": "456"},
                "stacktrace": {"frames": [{"filename": "src/app/group2.py"}]},
                "release": "1.2",
            },
            project_id=project_2.id,
        )
        project_3 = self.create_project()
        event_3 = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group_3"],
                "message": "group3",
                "user": {"email": "foo@example.com"},
                "environment": "canary",
                "tags": {"random": "789"},
            },
            project_id=project_3.id,
        )

        self.run_test_in_query("environment:[prod, staging]", [event_1, event_2], [event_3])
        self.run_test_in_query("environment:[staging]", [event_2], [event_1, event_3])
        self.run_test_in_query(
            "user.email:[foo@example.com, hello@example.com]", [event_1, event_3], [event_2]
        )
        self.run_test_in_query("user.email:[foo@example.com]", [event_3], [event_1, event_2])
        self.run_test_in_query(
            "user.display:[foo@example.com, hello@example.com]", [event_1, event_3], [event_2]
        )
        self.run_test_in_query(
            'message:["group2 src/app/group2.py in ?", group1]', [event_1, event_2], [event_3]
        )

        self.run_test_in_query(
            f"issue.id:[{event_1.group_id},{event_2.group_id}]", [event_1, event_2]
        )
        self.run_test_in_query(
            f"issue:[{event_1.group.qualified_short_id},{event_2.group.qualified_short_id}]",
            [event_1, event_2],
        )
        self.run_test_in_query(
            f"issue:[{event_1.group.qualified_short_id},{event_2.group.qualified_short_id}, unknown]",
            [event_1, event_2],
        )
        self.run_test_in_query(f"project_id:[{project_3.id},{project_2.id}]", [event_2, event_3])
        self.run_test_in_query(
            f"project.name:[{project_3.slug},{project_2.slug}]", [event_2, event_3]
        )
        self.run_test_in_query("random:[789,456]", [event_2, event_3], [event_1])
        self.run_test_in_query("tags[random]:[789,456]", [event_2, event_3], [event_1])
        self.run_test_in_query("release:[1.0,1.2]", [event_1, event_2], [event_3])

    def test_in_query_events_stack(self):
        test_js = self.store_event(
            self.load_data(
                platform="javascript",
                timestamp=self.ten_mins_ago,
                duration=timedelta(seconds=5),
            ),
            project_id=self.project.id,
        )
        test_java = self.store_event(
            self.load_data(
                platform="java",
                timestamp=self.ten_mins_ago,
                duration=timedelta(seconds=5),
            ),
            project_id=self.project.id,
        )
        self.run_test_in_query(
            "stack.filename:[../../sentry/scripts/views.js]", [test_js], [test_java]
        )

    def test_in_query_transactions(self):
        data = self.transaction_data.copy()
        data["event_id"] = "a" * 32
        data["contexts"]["trace"]["status"] = "ok"
        transaction_1 = self.store_event(data, project_id=self.project.id)

        data = self.transaction_data.copy()
        data["event_id"] = "b" * 32
        data["contexts"]["trace"]["status"] = "aborted"
        transaction_2 = self.store_event(data, project_id=self.project.id)

        data = self.transaction_data.copy()
        data["event_id"] = "c" * 32
        data["contexts"]["trace"]["status"] = "already_exists"
        transaction_3 = self.store_event(data, project_id=self.project.id)

        for dataset in ["discover", "transactions"]:
            self.run_test_in_query(
                "transaction.status:[aborted, already_exists]",
                [transaction_2, transaction_3],
                [transaction_1],
                dataset=dataset,
            )

    def test_messed_up_function_values(self):
        # TODO (evanh): It would be nice if this surfaced an error to the user.
        # The problem: The && causes the parser to treat that term not as a bad
        # function call but a valid raw search with parens in it. It's not trivial
        # to change the parser to recognize "bad function values" and surface them.
        for v in ["a", "b"]:
            self.store_event(
                data={
                    "event_id": v * 32,
                    "timestamp": self.ten_mins_ago_iso,
                    "fingerprint": ["group_1"],
                },
                project_id=self.project.id,
            )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": [
                "transaction",
                "project",
                "epm()",
                "p50()",
                "p95()",
                "failure_rate()",
                "apdex(300)",
                "count_unique(user)",
                "user_misery(300)",
                "count_miserable(user, 300)",
            ],
            "query": "failure_rate():>0.003&& users:>10 event.type:transaction",
            "sort": "-failure_rate",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 0

    def test_context_fields_between_datasets(self):
        event_data = self.load_data(platform="android")
        transaction_data = self.load_data()
        event_data["spans"] = transaction_data["spans"]
        event_data["contexts"]["trace"] = transaction_data["contexts"]["trace"]
        event_data["type"] = "transaction"
        event_data["transaction"] = "/failure_rate/1"
        event_data["timestamp"] = self.ten_mins_ago.isoformat()
        event_data["start_timestamp"] = before_now(minutes=10, seconds=5).isoformat()
        event_data["user"]["geo"] = {"country_code": "US", "region": "CA", "city": "San Francisco"}
        self.store_event(event_data, project_id=self.project.id)
        event_data["type"] = "error"
        self.store_event(event_data, project_id=self.project.id)

        fields = [
            "os.build",
            "os.kernel_version",
            "device.arch",
            # TODO: battery level is not consistent across both datasets
            # "device.battery_level",
            "device.brand",
            "device.charging",
            "device.locale",
            "device.model_id",
            "device.name",
            "device.online",
            "device.orientation",
            "device.simulator",
            "device.uuid",
        ]

        data = [
            {"field": fields + ["location", "count()"], "query": "event.type:error"},
            {"field": fields + ["duration", "count()"], "query": "event.type:transaction"},
        ]

        for datum in data:
            response = self.do_request(datum)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1, datum
            results = response.data["data"]
            assert results[0]["count()"] == 1, datum

            for field in fields:
                key, value = field.split(".", 1)
                expected = str(event_data["contexts"][key][value])
                assert results[0][field] == expected, field + str(datum)

    def test_http_fields_between_datasets(self):
        event_data = self.load_data(platform="android")
        transaction_data = self.load_data()
        event_data["spans"] = transaction_data["spans"]
        event_data["contexts"]["trace"] = transaction_data["contexts"]["trace"]
        event_data["type"] = "transaction"
        event_data["transaction"] = "/failure_rate/1"
        event_data["timestamp"] = self.ten_mins_ago.isoformat()
        event_data["start_timestamp"] = before_now(minutes=10, seconds=5).isoformat()
        event_data["user"]["geo"] = {"country_code": "US", "region": "CA", "city": "San Francisco"}
        event_data["request"] = transaction_data["request"]
        self.store_event(event_data, project_id=self.project.id)
        event_data["type"] = "error"
        self.store_event(event_data, project_id=self.project.id)

        fields = ["http.method", "http.referer", "http.url"]
        expected = ["GET", "fixtures.transaction", "http://countries:8010/country_by_code/"]

        data = [
            {"field": fields + ["location", "count()"], "query": "event.type:error"},
            {"field": fields + ["duration", "count()"], "query": "event.type:transaction"},
        ]

        for datum in data:
            response = self.do_request(datum)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1, datum
            results = response.data["data"]
            assert results[0]["count()"] == 1, datum

            for field, exp in zip(fields, expected):
                assert results[0][field] == exp, field + str(datum)

    def test_failure_count_alias_field(self):
        data = self.transaction_data.copy()
        data["transaction"] = "/failure_count/success"
        self.store_event(data, project_id=self.project.id)

        data = self.transaction_data.copy()
        data["transaction"] = "/failure_count/unknown"
        data["contexts"]["trace"]["status"] = "unknown_error"
        self.store_event(data, project_id=self.project.id)

        for i in range(6):
            data = self.transaction_data.copy()
            data["transaction"] = f"/failure_count/{i}"
            data["contexts"]["trace"]["status"] = "unauthenticated"
            self.store_event(data, project_id=self.project.id)

        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["count()", "failure_count()"],
                "query": "event.type:transaction",
                "dataset": dataset,
            }
            response = self.do_request(query)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            data = response.data["data"]
            assert data[0]["count()"] == 8
            assert data[0]["failure_count()"] == 6

    @mock.patch("sentry.utils.snuba.quantize_time")
    def test_quantize_dates(self, mock_quantize):
        self.create_project()
        mock_quantize.return_value = before_now(days=1)

        # Don't quantize short time periods
        query = {"statsPeriod": "1h", "query": "", "field": ["id", "timestamp"]}
        self.do_request(query)

        # Don't quantize absolute date periods
        self.do_request(query)
        query = {
            "start": before_now(days=20).isoformat(),
            "end": before_now(days=15).isoformat(),
            "query": "",
            "field": ["id", "timestamp"],
        }
        self.do_request(query)
        assert len(mock_quantize.mock_calls) == 0

        # Quantize long date periods
        query = {"field": ["id", "timestamp"], "statsPeriod": "90d", "query": ""}
        self.do_request(query)
        assert len(mock_quantize.mock_calls) == 2

    def test_limit_number_of_fields(self):
        self.create_project()
        for i in range(1, 25):
            response = self.do_request({"field": ["id"] * i})
            if i <= 20:
                assert response.status_code == 200
            else:
                assert response.status_code == 400
                assert (
                    response.data["detail"]
                    == "You can view up to 20 fields at a time. Please delete some and try again."
                )

    def test_percentile_function_meta_types(self):
        self.store_event(self.transaction_data, project_id=self.project.id)

        for dataset in ["discover", "transactions"]:
            query = {
                "field": [
                    "transaction",
                    "percentile(transaction.duration, 0.95)",
                    "percentile(measurements.fp, 0.95)",
                    "percentile(measurements.fcp, 0.95)",
                    "percentile(measurements.lcp, 0.95)",
                    "percentile(measurements.fid, 0.95)",
                    "percentile(measurements.ttfb, 0.95)",
                    "percentile(measurements.ttfb.requesttime, 0.95)",
                    "percentile(measurements.cls, 0.95)",
                    "percentile(measurements.foo, 0.95)",
                    "percentile(measurements.bar, 0.95)",
                ],
                "query": "",
                "orderby": ["transaction"],
                "dataset": dataset,
            }
            response = self.do_request(query)

            assert response.status_code == 200, response.content
            meta = response.data["meta"]["fields"]
            assert meta["percentile(transaction.duration, 0.95)"] == "duration"
            assert meta["percentile(measurements.fp, 0.95)"] == "duration"
            assert meta["percentile(measurements.fcp, 0.95)"] == "duration"
            assert meta["percentile(measurements.lcp, 0.95)"] == "duration"
            assert meta["percentile(measurements.fid, 0.95)"] == "duration"
            assert meta["percentile(measurements.ttfb, 0.95)"] == "duration"
            assert meta["percentile(measurements.ttfb.requesttime, 0.95)"] == "duration"
            assert meta["percentile(measurements.cls, 0.95)"] == "number"
            assert meta["percentile(measurements.foo, 0.95)"] == "number"
            assert meta["percentile(measurements.bar, 0.95)"] == "number"

            units = response.data["meta"]["units"]
            assert units["percentile(transaction.duration, 0.95)"] == "millisecond"
            assert units["percentile(measurements.fp, 0.95)"] == "millisecond"
            assert units["percentile(measurements.fcp, 0.95)"] == "millisecond"
            assert units["percentile(measurements.lcp, 0.95)"] == "millisecond"
            assert units["percentile(measurements.fid, 0.95)"] == "millisecond"
            assert units["percentile(measurements.ttfb, 0.95)"] == "millisecond"
            assert units["percentile(measurements.ttfb.requesttime, 0.95)"] == "millisecond"

    def test_count_at_least_query(self):
        self.store_event(self.transaction_data, self.project.id)

        for dataset in ["discover", "transactions"]:
            response = self.do_request(
                {"field": "count_at_least(measurements.fcp, 0)", "dataset": dataset}
            )
            assert response.status_code == 200
            assert len(response.data["data"]) == 1
            assert response.data["data"][0]["count_at_least(measurements.fcp, 0)"] == 1

            # a value that's a little bigger than the stored fcp
            fcp = int(self.transaction_data["measurements"]["fcp"]["value"] + 1)
            response = self.do_request(
                {"field": f"count_at_least(measurements.fcp, {fcp})", "dataset": dataset}
            )
            assert response.status_code == 200
            assert len(response.data["data"]) == 1
            assert response.data["data"][0][f"count_at_least(measurements.fcp, {fcp})"] == 0

    def test_measurements_query(self):
        self.store_event(self.transaction_data, self.project.id)
        for dataset in ["discover", "transactions"]:
            query = {
                "field": [
                    "measurements.fp",
                    "measurements.fcp",
                    "measurements.lcp",
                    "measurements.fid",
                ],
                "dataset": dataset,
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            for field in query["field"]:
                measure = field.split(".", 1)[1]
                assert (
                    response.data["data"][0][field]
                    == self.transaction_data["measurements"][measure]["value"]
                )

            query = {
                "field": [
                    "measurements.fP",
                    "measurements.Fcp",
                    "measurements.LcP",
                    "measurements.FID",
                ],
                "dataset": dataset,
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            for field in query["field"]:
                measure = field.split(".", 1)[1].lower()
                assert (
                    response.data["data"][0][field]
                    == self.transaction_data["measurements"][measure]["value"]
                )

    def test_measurements_aggregations(self):
        self.store_event(self.transaction_data, self.project.id)

        # should try all the potential aggregates
        # Skipped tests for stddev and var since sampling one data point
        # results in nan.
        for dataset in ["discover", "transactions"]:
            query = {
                "field": [
                    "percentile(measurements.fcp, 0.5)",
                    "count_unique(measurements.fcp)",
                    "min(measurements.fcp)",
                    "max(measurements.fcp)",
                    "avg(measurements.fcp)",
                    "sum(measurements.fcp)",
                ],
                "dataset": dataset,
            }
            response = self.do_request(query)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert (
                response.data["data"][0]["percentile(measurements.fcp, 0.5)"]
                == self.transaction_data["measurements"]["fcp"]["value"]
            )
            assert response.data["data"][0]["count_unique(measurements.fcp)"] == 1
            assert (
                response.data["data"][0]["min(measurements.fcp)"]
                == self.transaction_data["measurements"]["fcp"]["value"]
            )
            assert (
                response.data["data"][0]["max(measurements.fcp)"]
                == self.transaction_data["measurements"]["fcp"]["value"]
            )
            assert (
                response.data["data"][0]["avg(measurements.fcp)"]
                == self.transaction_data["measurements"]["fcp"]["value"]
            )
            assert (
                response.data["data"][0]["sum(measurements.fcp)"]
                == self.transaction_data["measurements"]["fcp"]["value"]
            )

    def get_measurement_condition_response(self, query_str, field, dataset="discover"):
        query = {
            "field": ["transaction", "count()"] + (field if field else []),
            "query": query_str,
            "dataset": dataset,
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        return response

    def assert_measurement_condition_without_results(
        self, query_str, field=None, dataset="discover"
    ):
        response = self.get_measurement_condition_response(query_str, field, dataset=dataset)
        assert len(response.data["data"]) == 0

    def assert_measurement_condition_with_results(self, query_str, field=None, dataset="discover"):
        response = self.get_measurement_condition_response(query_str, field, dataset=dataset)
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["transaction"] == self.transaction_data["metadata"]["title"]
        assert response.data["data"][0]["count()"] == 1

    def test_measurements_conditions(self):
        self.store_event(self.transaction_data, self.project.id)

        fcp = self.transaction_data["measurements"]["fcp"]["value"]

        for dataset in ["discover", "transactions"]:
            # equality condition
            # We use json dumps here to ensure precision when converting from float to str
            # This is necessary because equality on floating point values need to be precise
            self.assert_measurement_condition_with_results(
                f"measurements.fcp:{json.dumps(fcp)}", dataset=dataset
            )

            # greater than condition
            self.assert_measurement_condition_with_results(
                f"measurements.fcp:>{fcp - 1}", dataset=dataset
            )
            self.assert_measurement_condition_without_results(
                f"measurements.fcp:>{fcp + 1}", dataset=dataset
            )

            # less than condition
            self.assert_measurement_condition_with_results(
                f"measurements.fcp:<{fcp + 1}", dataset=dataset
            )
            self.assert_measurement_condition_without_results(
                f"measurements.fcp:<{fcp - 1}", dataset=dataset
            )

            # has condition
            self.assert_measurement_condition_with_results("has:measurements.fcp", dataset=dataset)
            self.assert_measurement_condition_without_results(
                "!has:measurements.fcp", dataset=dataset
            )

    def test_measurements_aggregation_conditions(self):
        self.store_event(self.transaction_data, self.project.id)

        fcp = self.transaction_data["measurements"]["fcp"]["value"]
        functions = [
            "percentile(measurements.fcp, 0.5)",
            "min(measurements.fcp)",
            "max(measurements.fcp)",
            "avg(measurements.fcp)",
            "sum(measurements.fcp)",
        ]

        for dataset in ["discover", "transactions"]:
            for function in functions:
                self.assert_measurement_condition_with_results(
                    f"{function}:>{fcp - 1}", field=[function], dataset=dataset
                )
                self.assert_measurement_condition_without_results(
                    f"{function}:>{fcp + 1}", field=[function], dataset=dataset
                )
                self.assert_measurement_condition_with_results(
                    f"{function}:<{fcp + 1}", field=[function], dataset=dataset
                )
                self.assert_measurement_condition_without_results(
                    f"{function}:<{fcp - 1}", field=[function], dataset=dataset
                )

            count_unique = "count_unique(measurements.fcp)"
            self.assert_measurement_condition_with_results(
                f"{count_unique}:1", field=[count_unique], dataset=dataset
            )
            self.assert_measurement_condition_without_results(
                f"{count_unique}:0", field=[count_unique], dataset=dataset
            )

    def test_compare_numeric_aggregate(self):
        self.store_event(self.transaction_data, self.project.id)

        for dataset in ["discover", "transactions"]:
            query = {
                "field": [
                    "p75(measurements.fcp)",
                    "compare_numeric_aggregate(p75_measurements_fcp,greater,0)",
                ],
                "dataset": dataset,
            }
            response = self.do_request(query)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert (
                response.data["data"][0][
                    "compare_numeric_aggregate(p75_measurements_fcp,greater,0)"
                ]
                == 1
            )

            query = {
                "field": ["p75()", "compare_numeric_aggregate(p75,equals,0)"],
            }
            response = self.do_request(query)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert response.data["data"][0]["compare_numeric_aggregate(p75,equals,0)"] == 0

    def test_no_team_key_transactions(self):
        transactions = [
            "/blah_transaction/",
            "/foo_transaction/",
            "/zoo_transaction/",
        ]

        for transaction in transactions:
            self.transaction_data["transaction"] = transaction
            self.store_event(self.transaction_data, self.project.id)

        for dataset in ["discover", "transactions"]:
            query = {
                "team": "myteams",
                "project": [self.project.id],
                # use the order by to ensure the result order
                "orderby": "transaction",
                "field": [
                    "team_key_transaction",
                    "transaction",
                    "transaction.status",
                    "project",
                    "epm()",
                    "failure_rate()",
                    "percentile(transaction.duration, 0.95)",
                ],
                "dataset": dataset,
            }
            response = self.do_request(query)

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 3
            assert data[0]["team_key_transaction"] == 0
            assert data[0]["transaction"] == "/blah_transaction/"
            assert data[1]["team_key_transaction"] == 0
            assert data[1]["transaction"] == "/foo_transaction/"
            assert data[2]["team_key_transaction"] == 0
            assert data[2]["transaction"] == "/zoo_transaction/"

    def test_team_key_transactions_my_teams(self):
        team1 = self.create_team(organization=self.organization, name="Team A")
        self.create_team_membership(team1, user=self.user)
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.organization, name="Team B")
        self.project.add_team(team2)

        transactions = ["/blah_transaction/"]
        key_transactions = [
            (team1, "/foo_transaction/"),
            (team2, "/zoo_transaction/"),
        ]

        for transaction in transactions:
            self.transaction_data["transaction"] = transaction
            self.store_event(self.transaction_data, self.project.id)

        for team, transaction in key_transactions:
            self.transaction_data["transaction"] = transaction
            self.store_event(self.transaction_data, self.project.id)
            TeamKeyTransaction.objects.create(
                organization=self.organization,
                transaction=transaction,
                project_team=ProjectTeam.objects.get(project=self.project, team=team),
            )

        for dataset in ["discover", "transactions"]:
            query = {
                "team": "myteams",
                "project": [self.project.id],
                "field": [
                    "team_key_transaction",
                    "transaction",
                    "transaction.status",
                    "project",
                    "epm()",
                    "failure_rate()",
                    "percentile(transaction.duration, 0.95)",
                ],
                "dataset": dataset,
            }

            query["orderby"] = ["team_key_transaction", "transaction"]
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 3
            assert data[0]["team_key_transaction"] == 0
            assert data[0]["transaction"] == "/blah_transaction/"
            assert data[1]["team_key_transaction"] == 0
            assert data[1]["transaction"] == "/zoo_transaction/"
            assert data[2]["team_key_transaction"] == 1
            assert data[2]["transaction"] == "/foo_transaction/"

            # not specifying any teams should use my teams
            query = {
                "project": [self.project.id],
                "field": [
                    "team_key_transaction",
                    "transaction",
                    "transaction.status",
                    "project",
                    "epm()",
                    "failure_rate()",
                    "percentile(transaction.duration, 0.95)",
                ],
                "dataset": dataset,
            }

            query["orderby"] = ["team_key_transaction", "transaction"]
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 3
            assert data[0]["team_key_transaction"] == 0
            assert data[0]["transaction"] == "/blah_transaction/"
            assert data[1]["team_key_transaction"] == 0
            assert data[1]["transaction"] == "/zoo_transaction/"
            assert data[2]["team_key_transaction"] == 1
            assert data[2]["transaction"] == "/foo_transaction/"

    def test_team_key_transactions_orderby(self):
        team1 = self.create_team(organization=self.organization, name="Team A")
        team2 = self.create_team(organization=self.organization, name="Team B")

        transactions = ["/blah_transaction/"]
        key_transactions = [
            (team1, "/foo_transaction/"),
            (team2, "/zoo_transaction/"),
        ]

        for transaction in transactions:
            self.transaction_data["transaction"] = transaction
            self.store_event(self.transaction_data, self.project.id)

        for team, transaction in key_transactions:
            self.create_team_membership(team, user=self.user)
            self.project.add_team(team)
            self.transaction_data["transaction"] = transaction
            self.store_event(self.transaction_data, self.project.id)
            TeamKeyTransaction.objects.create(
                organization=self.organization,
                transaction=transaction,
                project_team=ProjectTeam.objects.get(project=self.project, team=team),
            )

        for dataset in ["discover", "transactions"]:
            query = {
                "team": "myteams",
                "project": [self.project.id],
                "field": [
                    "team_key_transaction",
                    "transaction",
                    "transaction.status",
                    "project",
                    "epm()",
                    "failure_rate()",
                    "percentile(transaction.duration, 0.95)",
                ],
                "dataset": dataset,
            }

            # test ascending order
            query["orderby"] = ["team_key_transaction", "transaction"]
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 3
            assert data[0]["team_key_transaction"] == 0
            assert data[0]["transaction"] == "/blah_transaction/"
            assert data[1]["team_key_transaction"] == 1
            assert data[1]["transaction"] == "/foo_transaction/"
            assert data[2]["team_key_transaction"] == 1
            assert data[2]["transaction"] == "/zoo_transaction/"

            # test descending order
            query["orderby"] = ["-team_key_transaction", "-transaction"]
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 3
            assert data[0]["team_key_transaction"] == 1
            assert data[0]["transaction"] == "/zoo_transaction/"
            assert data[1]["team_key_transaction"] == 1
            assert data[1]["transaction"] == "/foo_transaction/"
            assert data[2]["team_key_transaction"] == 0
            assert data[2]["transaction"] == "/blah_transaction/"

    def test_team_key_transactions_query(self):
        team1 = self.create_team(organization=self.organization, name="Team A")
        team2 = self.create_team(organization=self.organization, name="Team B")

        transactions = ["/blah_transaction/"]
        key_transactions = [
            (team1, "/foo_transaction/"),
            (team2, "/zoo_transaction/"),
        ]

        for transaction in transactions:
            self.transaction_data["transaction"] = transaction
            self.store_event(self.transaction_data, self.project.id)

        for team, transaction in key_transactions:
            self.create_team_membership(team, user=self.user)
            self.project.add_team(team)
            self.transaction_data["transaction"] = transaction
            self.store_event(self.transaction_data, self.project.id)
            TeamKeyTransaction.objects.create(
                organization=self.organization,
                project_team=ProjectTeam.objects.get(
                    project=self.project,
                    team=team,
                ),
                transaction=transaction,
            )
        for dataset in ["discover", "transactions"]:
            query = {
                "team": "myteams",
                "project": [self.project.id],
                # use the order by to ensure the result order
                "orderby": "transaction",
                "field": [
                    "team_key_transaction",
                    "transaction",
                    "transaction.status",
                    "project",
                    "epm()",
                    "failure_rate()",
                    "percentile(transaction.duration, 0.95)",
                ],
                "dataset": dataset,
            }

            # key transactions
            query["query"] = "has:team_key_transaction"
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 2
            assert data[0]["team_key_transaction"] == 1
            assert data[0]["transaction"] == "/foo_transaction/"
            assert data[1]["team_key_transaction"] == 1
            assert data[1]["transaction"] == "/zoo_transaction/"

            # key transactions
            query["query"] = "team_key_transaction:true"
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 2
            assert data[0]["team_key_transaction"] == 1
            assert data[0]["transaction"] == "/foo_transaction/"
            assert data[1]["team_key_transaction"] == 1
            assert data[1]["transaction"] == "/zoo_transaction/"

            # not key transactions
            query["query"] = "!has:team_key_transaction"
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["team_key_transaction"] == 0
            assert data[0]["transaction"] == "/blah_transaction/"

            # not key transactions
            query["query"] = "team_key_transaction:false"
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["team_key_transaction"] == 0
            assert data[0]["transaction"] == "/blah_transaction/"

    def test_too_many_team_key_transactions(self):
        MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS = 1
        with mock.patch(
            "sentry.search.events.fields.MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS",
            MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS,
        ):
            team = self.create_team(organization=self.organization, name="Team A")
            self.create_team_membership(team, user=self.user)
            self.project.add_team(team)
            project_team = ProjectTeam.objects.get(project=self.project, team=team)

            for i in range(MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS + 1):
                transaction = f"transaction-{team.id}-{i}"
                self.transaction_data["transaction"] = transaction
                self.store_event(self.transaction_data, self.project.id)

            TeamKeyTransaction.objects.bulk_create(
                [
                    TeamKeyTransaction(
                        organization=self.organization,
                        project_team=project_team,
                        transaction=f"transaction-{team.id}-{i}",
                    )
                    for i in range(MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS + 1)
                ]
            )
            for dataset in ["discover", "transactions"]:
                query = {
                    "team": "myteams",
                    "project": [self.project.id],
                    "orderby": "transaction",
                    "field": [
                        "team_key_transaction",
                        "transaction",
                        "transaction.status",
                        "project",
                        "epm()",
                        "failure_rate()",
                        "percentile(transaction.duration, 0.95)",
                    ],
                    "dataset": dataset,
                }

                response = self.do_request(query)
                assert response.status_code == 200, response.content
                data = response.data["data"]
                assert len(data) == 2
                assert (
                    sum(row["team_key_transaction"] for row in data)
                    == MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS
                )

    def test_no_pagination_param(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )

        query = {"field": ["id", "project.id"], "project": [self.project.id], "noPagination": True}
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1
        assert "Link" not in response

    def test_nan_result(self):
        query = {"field": ["apdex(300)"], "project": [self.project.id], "query": f"id:{'0' * 32}"}
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["apdex(300)"] == 0

    def test_equation_simple(self):
        event_data = self.load_data(
            timestamp=self.ten_mins_ago,
        )
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 1500
        self.store_event(data=event_data, project_id=self.project.id)

        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["spans.http", "equation|spans.http / 3"],
                "project": [self.project.id],
                "query": "event.type:transaction",
                "dataset": dataset,
            }
            response = self.do_request(
                query,
                {
                    "organizations:discover-basic": True,
                },
            )
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert (
                response.data["data"][0]["equation|spans.http / 3"]
                == event_data["breakdowns"]["span_ops"]["ops.http"]["value"] / 3
            )
            assert response.data["meta"]["fields"]["equation|spans.http / 3"] == "number"

    def test_equation_sort(self):
        event_data = self.transaction_data.copy()
        event_data["breakdowns"] = {"span_ops": {"ops.http": {"value": 1500}}}
        self.store_event(data=event_data, project_id=self.project.id)

        event_data2 = self.transaction_data.copy()
        event_data2["breakdowns"] = {"span_ops": {"ops.http": {"value": 2000}}}
        self.store_event(data=event_data2, project_id=self.project.id)

        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["spans.http", "equation|spans.http / 3"],
                "project": [self.project.id],
                "orderby": "equation|spans.http / 3",
                "query": "event.type:transaction",
                "dataset": dataset,
            }
            response = self.do_request(
                query,
                {
                    "organizations:discover-basic": True,
                },
            )
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 2
            assert (
                response.data["data"][0]["equation|spans.http / 3"]
                == event_data["breakdowns"]["span_ops"]["ops.http"]["value"] / 3
            )
            assert (
                response.data["data"][1]["equation|spans.http / 3"]
                == event_data2["breakdowns"]["span_ops"]["ops.http"]["value"] / 3
            )

    def test_equation_operation_limit(self):
        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["spans.http", f"equation|spans.http{' * 2' * 11}"],
                "project": [self.project.id],
                "query": "event.type:transaction",
                "dataset": dataset,
            }
            response = self.do_request(
                query,
                {
                    "organizations:discover-basic": True,
                },
            )

            assert response.status_code == 400

    @mock.patch("sentry.api.bases.organization_events.MAX_FIELDS", 2)
    def test_equation_field_limit(self):
        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["spans.http", "transaction.duration", "equation|5 * 2"],
                "project": [self.project.id],
                "query": "event.type:transaction",
                "dataset": dataset,
            }
            response = self.do_request(
                query,
                {
                    "organizations:discover-basic": True,
                },
            )

            assert response.status_code == 400

    def test_count_if(self):
        unicode_phrase1 = "\u716e\u6211\u66f4\u591a\u7684\u98df\u7269\uff0c\u6211\u9913\u4e86"
        for i in range(5):
            data = self.load_data(
                timestamp=before_now(minutes=(10 + i)),
                duration=timedelta(milliseconds=100 if i < 3 else 200),
            )
            data["tags"] = {
                "sub_customer.is-Enterprise-42": "yes" if i == 0 else "no",
                "unicode-phrase": unicode_phrase1 if i == 0 else "no",
            }
            self.store_event(data, project_id=self.project.id)

        query = {
            "field": [
                "count_if(transaction.duration, less, 150)",
                "count_if(transaction.duration, greater, 150)",
                "count_if(sub_customer.is-Enterprise-42, equals, yes)",
                "count_if(sub_customer.is-Enterprise-42, notEquals, yes)",
                f"count_if(unicode-phrase, equals, {unicode_phrase1})",
            ],
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1

        assert response.data["data"][0]["count_if(transaction.duration, less, 150)"] == 3
        assert response.data["data"][0]["count_if(transaction.duration, greater, 150)"] == 2

        assert response.data["data"][0]["count_if(sub_customer.is-Enterprise-42, equals, yes)"] == 1
        assert (
            response.data["data"][0]["count_if(sub_customer.is-Enterprise-42, notEquals, yes)"] == 4
        )
        assert response.data["data"][0][f"count_if(unicode-phrase, equals, {unicode_phrase1})"] == 1

    def test_count_if_array_field(self):
        data = self.load_data(platform="javascript")
        data["timestamp"] = self.ten_mins_ago_iso
        self.store_event(data=data, project_id=self.project.id)
        query = {
            "field": [
                "count_if(stack.filename, equals, raven.js)",
            ],
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["count_if(stack.filename, equals, raven.js)"] == 1

    def test_count_if_measurements_cls(self):
        data = self.transaction_data.copy()
        data["measurements"] = {"cls": {"value": 0.5}}
        self.store_event(data, project_id=self.project.id)
        data["measurements"] = {"cls": {"value": 0.1}}
        self.store_event(data, project_id=self.project.id)

        query = {
            "field": [
                "count_if(measurements.cls, greater, 0.05)",
                "count_if(measurements.cls, less, 0.3)",
            ],
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1

        assert response.data["data"][0]["count_if(measurements.cls, greater, 0.05)"] == 2
        assert response.data["data"][0]["count_if(measurements.cls, less, 0.3)"] == 1

    def test_count_if_filter(self):
        for i in range(5):
            data = self.load_data(
                timestamp=before_now(minutes=(10 + i)),
                duration=timedelta(milliseconds=100 if i < 3 else 200),
            )
            data["tags"] = {"sub_customer.is-Enterprise-42": "yes" if i == 0 else "no"}
            self.store_event(data, project_id=self.project.id)

        query = {
            "field": [
                "count_if(transaction.duration, less, 150)",
            ],
            "query": "count_if(transaction.duration, less, 150):>2",
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1

        assert response.data["data"][0]["count_if(transaction.duration, less, 150)"] == 3

        query = {
            "field": [
                "count_if(transaction.duration, less, 150)",
            ],
            "query": "count_if(transaction.duration, less, 150):<2",
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 0

    def test_filters_with_escaped_asterisk(self):
        self.transaction_data["transaction"] = r"/:a*/:b-:c(\d\.\e+)"
        self.store_event(self.transaction_data, project_id=self.project.id)

        query = {
            "field": ["transaction", "transaction.duration"],
            # make sure to escape the asterisk so it's not treated as a wildcard
            "query": r'transaction:"/:a\*/:b-:c(\d\.\e+)"',
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1

    def test_filters_with_back_slashes(self):
        self.transaction_data["transaction"] = r"a\b\c@d"
        self.store_event(self.transaction_data, project_id=self.project.id)

        query = {
            "field": ["transaction", "transaction.duration"],
            "query": r'transaction:"a\b\c@d"',
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1

    def test_mobile_measurements(self):
        self.transaction_data["measurements"]["frames_total"] = {"value": 100}
        self.transaction_data["measurements"]["frames_slow"] = {"value": 10}
        self.transaction_data["measurements"]["frames_frozen"] = {"value": 5}
        self.transaction_data["measurements"]["stall_count"] = {"value": 2}
        self.transaction_data["measurements"]["stall_total_time"] = {"value": 12}
        self.transaction_data["measurements"]["stall_longest_time"] = {"value": 7}
        self.store_event(self.transaction_data, project_id=self.project.id)

        query = {
            "field": [
                "measurements.frames_total",
                "measurements.frames_slow",
                "measurements.frames_frozen",
                "measurements.frames_slow_rate",
                "measurements.frames_frozen_rate",
                "measurements.stall_count",
                "measurements.stall_total_time",
                "measurements.stall_longest_time",
                "measurements.stall_percentage",
            ],
            "query": "",
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["measurements.frames_total"] == 100
        assert data[0]["measurements.frames_slow"] == 10
        assert data[0]["measurements.frames_frozen"] == 5
        assert data[0]["measurements.frames_slow_rate"] == 0.1
        assert data[0]["measurements.frames_frozen_rate"] == 0.05
        assert data[0]["measurements.stall_count"] == 2
        assert data[0]["measurements.stall_total_time"] == 12
        assert data[0]["measurements.stall_longest_time"] == 7
        assert data[0]["measurements.stall_percentage"] == 0.004
        meta = response.data["meta"]["fields"]
        assert meta["measurements.frames_total"] == "number"
        assert meta["measurements.frames_slow"] == "number"
        assert meta["measurements.frames_frozen"] == "number"
        assert meta["measurements.frames_slow_rate"] == "percentage"
        assert meta["measurements.frames_frozen_rate"] == "percentage"
        assert meta["measurements.stall_count"] == "number"
        assert meta["measurements.stall_total_time"] == "number"
        assert meta["measurements.stall_longest_time"] == "number"
        assert meta["measurements.stall_percentage"] == "percentage"

        query = {
            "field": [
                "p75(measurements.frames_slow_rate)",
                "p75(measurements.frames_frozen_rate)",
                "percentile(measurements.frames_slow_rate,0.5)",
                "percentile(measurements.frames_frozen_rate,0.5)",
                "p75(measurements.stall_percentage)",
                "percentile(measurements.stall_percentage,0.5)",
            ],
            "query": "",
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p75(measurements.frames_slow_rate)"] == 0.1
        assert data[0]["p75(measurements.frames_frozen_rate)"] == 0.05
        assert data[0]["p75(measurements.stall_percentage)"] == 0.004
        assert data[0]["percentile(measurements.frames_slow_rate,0.5)"] == 0.1
        assert data[0]["percentile(measurements.frames_frozen_rate,0.5)"] == 0.05
        assert data[0]["percentile(measurements.stall_percentage,0.5)"] == 0.004
        meta = response.data["meta"]["fields"]
        assert meta["p75(measurements.frames_slow_rate)"] == "percentage"
        assert meta["p75(measurements.frames_frozen_rate)"] == "percentage"
        assert meta["p75(measurements.stall_percentage)"] == "percentage"
        assert meta["percentile(measurements.frames_slow_rate,0.5)"] == "percentage"
        assert meta["percentile(measurements.stall_percentage,0.5)"] == "percentage"

    def test_project_auto_fields(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )

        query = {"field": ["environment"]}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["environment"] == "staging"
        assert response.data["data"][0]["project.name"] == self.project.slug

    def test_timestamp_different_from_params(self):
        fifteen_days_ago = before_now(days=15)
        fifteen_days_later = before_now(days=-15)

        for query_text in [
            f"timestamp:<{fifteen_days_ago}",
            f"timestamp:<={fifteen_days_ago}",
            f"timestamp:>{fifteen_days_later}",
            f"timestamp:>={fifteen_days_later}",
        ]:
            query = {
                "field": ["count()"],
                "query": query_text,
                "statsPeriod": "14d",
                "project": self.project.id,
            }
            response = self.do_request(query)

            assert response.status_code == 400, query_text

    @mock.patch("sentry.search.events.builder.base.raw_snql_query")
    def test_removes_unnecessary_default_project_and_transaction_thresholds(self, mock_snql_query):
        mock_snql_query.side_effect = [{"meta": {}, "data": []}]

        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.organization,
            # these are the default values that we use
            threshold=constants.DEFAULT_PROJECT_THRESHOLD,
            metric=TransactionMetric.DURATION.value,
        )
        ProjectTransactionThresholdOverride.objects.create(
            transaction="transaction",
            project=self.project,
            organization=self.organization,
            # these are the default values that we use
            threshold=constants.DEFAULT_PROJECT_THRESHOLD,
            metric=TransactionMetric.DURATION.value,
        )

        query = {
            "field": ["apdex()", "user_misery()"],
            "query": "event.type:transaction",
            "project": [self.project.id],
        }

        response = self.do_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:global-views": True,
            },
        )

        assert response.status_code == 200, response.content

        assert mock_snql_query.call_count == 1

        assert (
            Function("tuple", ["duration", 300], "project_threshold_config")
            in mock_snql_query.call_args_list[0][0][0].query.select
        )

    @mock.patch("sentry.search.events.builder.base.raw_snql_query")
    def test_removes_unnecessary_default_project_and_transaction_thresholds_keeps_others(
        self, mock_snql_query
    ):
        mock_snql_query.side_effect = [{"meta": {}, "data": []}]

        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.organization,
            # these are the default values that we use
            threshold=constants.DEFAULT_PROJECT_THRESHOLD,
            metric=TransactionMetric.DURATION.value,
        )
        ProjectTransactionThresholdOverride.objects.create(
            transaction="transaction",
            project=self.project,
            organization=self.organization,
            # these are the default values that we use
            threshold=constants.DEFAULT_PROJECT_THRESHOLD,
            metric=TransactionMetric.DURATION.value,
        )

        project = self.create_project()

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=self.organization,
            threshold=100,
            metric=TransactionMetric.LCP.value,
        )
        ProjectTransactionThresholdOverride.objects.create(
            transaction="transaction",
            project=project,
            organization=self.organization,
            threshold=200,
            metric=TransactionMetric.LCP.value,
        )

        query = {
            "field": ["apdex()", "user_misery()"],
            "query": "event.type:transaction",
            "project": [self.project.id, project.id],
        }

        response = self.do_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:global-views": True,
            },
        )

        assert response.status_code == 200, response.content

        assert mock_snql_query.call_count == 1

        project_threshold_override_config_index = Function(
            "indexOf",
            [
                # only 1 transaction override is present here
                # because the other use to the default values
                [(Function("toUInt64", [project.id]), "transaction")],
                (Column("project_id"), Column("transaction")),
            ],
            "project_threshold_override_config_index",
        )

        project_threshold_config_index = Function(
            "indexOf",
            [
                # only 1 project override is present here
                # because the other use to the default values
                [Function("toUInt64", [project.id])],
                Column("project_id"),
            ],
            "project_threshold_config_index",
        )

        assert (
            Function(
                "if",
                [
                    Function("equals", [project_threshold_override_config_index, 0]),
                    Function(
                        "if",
                        [
                            Function("equals", [project_threshold_config_index, 0]),
                            ("duration", 300),
                            Function(
                                "arrayElement", [[("lcp", 100)], project_threshold_config_index]
                            ),
                        ],
                    ),
                    Function(
                        "arrayElement",
                        [[("lcp", 200)], project_threshold_override_config_index],
                    ),
                ],
                "project_threshold_config",
            )
            in mock_snql_query.call_args_list[0][0][0].query.select
        )

    def test_count_web_vitals(self):
        # Good
        self.transaction_data["measurements"] = {
            "lcp": {"value": constants.VITAL_THRESHOLDS["lcp"]["meh"] - 100},
        }
        self.store_event(self.transaction_data, self.project.id)
        # Meh
        self.transaction_data["measurements"] = {
            "lcp": {"value": constants.VITAL_THRESHOLDS["lcp"]["meh"] + 100},
        }
        self.store_event(self.transaction_data, self.project.id)
        self.store_event(self.transaction_data, self.project.id)
        query = {
            "field": [
                "count_web_vitals(measurements.lcp, poor)",
                "count_web_vitals(measurements.lcp, meh)",
                "count_web_vitals(measurements.lcp, good)",
            ]
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0] == {
            "count_web_vitals(measurements.lcp, poor)": 0,
            "count_web_vitals(measurements.lcp, meh)": 2,
            "count_web_vitals(measurements.lcp, good)": 1,
        }

    def test_count_web_vitals_invalid_vital(self):
        query = {
            "field": [
                "count_web_vitals(measurements.foo, poor)",
            ],
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content

        query = {
            "field": [
                "count_web_vitals(tags[lcp], poor)",
            ],
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content

        query = {
            "field": [
                "count_web_vitals(transaction.duration, poor)",
            ],
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content

        query = {
            "field": [
                "count_web_vitals(measurements.lcp, bad)",
            ],
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content

    def test_tag_that_looks_like_aggregate(self):
        data = self.load_data()
        data["tags"] = {"p95": "<5k"}
        self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["p95"],
            "query": "p95:<5k",
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p95"] == "<5k"

    def test_chained_or_query_meta_tip(self):
        query = {
            "field": ["transaction"],
            "query": "transaction:a OR transaction:b",
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        meta = response.data["meta"]
        assert meta["tips"] == {
            "query": "Did you know you can replace chained or conditions like `field:a OR field:b OR field:c` with `field:[a,b,c]`",
            "columns": None,
        }

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_no_ratelimit(self):
        query = {
            "field": ["transaction"],
            "project": [self.project.id],
        }
        with freeze_time("2000-01-01"):
            for _ in range(15):
                self.do_request(query)
            response = self.do_request(query)
            assert response.status_code == 200, response.content

    def test_transaction_source(self):
        query = {
            "field": ["transaction"],
            "query": "transaction.source:task",
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content

    def test_readable_device_name(self):
        data = self.load_data()
        data["tags"] = {"device": "iPhone14,3"}
        self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["device"],
            "query": "",
            "project": [self.project.id],
            "readable": True,
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["device"] == "iPhone14,3"
        assert data[0]["readable"] == "iPhone 13 Pro Max"

    def test_http_status_code(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "tags": {"http.status_code": "200"},
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "contexts": {"response": {"status_code": 400}},
            },
            project_id=project2.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "http.status_code"],
            "query": "",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        result = {r["http.status_code"] for r in data}
        assert result == {"200", "400"}

    def test_http_status_code_context_priority(self):
        project1 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "tags": {"http.status_code": "200"},
                "contexts": {"response": {"status_code": 400}},
            },
            project_id=project1.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "http.status_code"],
            "query": "",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["http.status_code"] == "400"

    def test_total_count(self):
        project1 = self.create_project()
        for i in range(3):
            self.store_event(data=self.load_data(platform="javascript"), project_id=project1.id)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=project1.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["transaction", "total.count", "count()"],
            "query": "!transaction:/example",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["total.count"] == 3

    def test_total_count_by_itself(self):
        project1 = self.create_project()
        for i in range(3):
            self.store_event(data=self.load_data(platform="javascript"), project_id=project1.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["total.count"],
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 400, response.content

    def test_total_count_equation(self):
        project1 = self.create_project()
        for i in range(3):
            self.store_event(data=self.load_data(platform="javascript"), project_id=project1.id)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=project1.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["transaction", "count()", "total.count", "equation|count()/total.count"],
            "query": "",
            "orderby": "equation|count()/total.count",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["equation|count()/total.count"] == 0.25
        assert data[1]["equation|count()/total.count"] == 0.75

    def test_total_count_filter(self):
        project1 = self.create_project()
        for i in range(3):
            self.store_event(data=self.load_data(platform="javascript"), project_id=project1.id)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "tags": {"total.count": ">45"},
            },
            project_id=project1.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["transaction", "count()", "total.count"],
            "query": "total.count:>45",
            "orderby": "count()",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["total.count"] == 1

    def test_total_sum_transaction_duration_equation(self):
        for i in range(3):
            data = self.load_data(
                timestamp=self.eleven_mins_ago,
                duration=timedelta(seconds=5),
            )
            data["transaction"] = "/endpoint/1"
            self.store_event(data, project_id=self.project.id)

        data = self.load_data(
            timestamp=self.ten_mins_ago,
            duration=timedelta(seconds=5),
        )
        data["transaction"] = "/endpoint/2"
        self.store_event(data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}

        query = {
            "field": [
                "transaction",
                "sum(transaction.duration)",
                "total.transaction_duration",
                "equation|sum(transaction.duration)/total.transaction_duration",
            ],
            "query": "",
            "orderby": "-equation|sum(transaction.duration)/total.transaction_duration",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["equation|sum(transaction.duration)/total.transaction_duration"] == 0.75
        assert data[1]["equation|sum(transaction.duration)/total.transaction_duration"] == 0.25

    def test_device_class(self):
        project1 = self.create_project()
        for i in range(3):
            self.store_event(
                data={
                    "event_id": "a" * 32,
                    "transaction": "/example",
                    "message": "how to make fast",
                    "timestamp": self.ten_mins_ago_iso,
                    "tags": {"device.class": f"{i + 1}"},
                },
                project_id=project1.id,
            )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["device.class"],
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3
        result = (*map(lambda columns: columns["device.class"], data),)
        assert "low" in result
        assert "medium" in result
        assert "high" in result

    def test_device_class_filter_low(self):
        project1 = self.create_project()
        for i in range(3):
            self.store_event(data=self.load_data(platform="javascript"), project_id=project1.id)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.ten_mins_ago_iso,
                "tags": {"device.class": "1"},
            },
            project_id=project1.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["device.class", "count()"],
            "query": "device.class:low",
            "orderby": "count()",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 1

    def test_group_id_as_custom_tag(self):
        project1 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "poof",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"email": self.user.email},
                "tags": {"group_id": "this should just get returned"},
            },
            project_id=project1.id,
        )
        query = {
            "field": ["group_id"],
            "query": "",
            "orderby": "group_id",
            "statsPeriod": "24h",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["group_id"] == "this should just get returned"

    def test_floored_epm(self):
        for _ in range(5):
            data = self.load_data(
                timestamp=self.ten_mins_ago,
                duration=timedelta(seconds=5),
            )
            data["transaction"] = "/aggregates/1"
            event1 = self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["transaction", "floored_epm()", "epm()"],
            "query": "event.type:transaction",
            "orderby": ["transaction"],
            "start": self.eleven_mins_ago_iso,
            "end": self.nine_mins_ago,
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == event1.transaction
        assert data[0]["floored_epm()"] == 1
        assert data[0]["epm()"] == 2.5

    def test_floored_epm_more_events(self):
        for _ in range(25):
            data = self.load_data(
                timestamp=self.ten_mins_ago,
                duration=timedelta(seconds=5),
            )
            data["transaction"] = "/aggregates/1"
            event1 = self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["transaction", "floored_epm()", "epm()"],
            "query": "event.type:transaction",
            "orderby": ["transaction"],
            "start": self.eleven_mins_ago_iso,
            "end": self.nine_mins_ago,
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == event1.transaction
        assert data[0]["epm()"] == 12.5
        assert data[0]["floored_epm()"] == 10

    def test_saves_discover_saved_query_split_flag(self):
        self.store_event(self.transaction_data, project_id=self.project.id)
        query = {"fields": ["message"], "query": "", "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="query name",
            query=query,
            version=2,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )

        assert model.dataset == DiscoverSavedQueryTypes.DISCOVER
        assert model.dataset_source == DatasetSourcesTypes.UNKNOWN.value

        features = {
            "organizations:discover-basic": True,
            "organizations:global-views": True,
            "organizations:performance-discover-dataset-selector": False,
        }
        query = {
            "field": ["project", "user"],
            "query": "has:user event.type:transaction",
            "statsPeriod": "14d",
            "discoverSavedQueryId": model.id,
        }
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert "discoverSplitDecision" not in response.data["meta"]

        model = DiscoverSavedQuery.objects.get(id=model.id)
        assert model.dataset == DiscoverSavedQueryTypes.DISCOVER
        assert model.dataset_source == DatasetSourcesTypes.UNKNOWN.value

    def test_saves_discover_saved_query_split_transaction(self):
        self.store_event(self.transaction_data, project_id=self.project.id)
        query = {"fields": ["message"], "query": "", "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="query name",
            query=query,
            version=2,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )

        assert model.dataset == DiscoverSavedQueryTypes.DISCOVER

        features = {
            "organizations:discover-basic": True,
            "organizations:global-views": True,
            "organizations:performance-discover-dataset-selector": True,
        }
        query = {
            "field": ["project", "user"],
            "query": "has:user event.type:transaction",
            "statsPeriod": "14d",
            "discoverSavedQueryId": model.id,
        }
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["discoverSplitDecision"] == "transaction-like"

        model = DiscoverSavedQuery.objects.get(id=model.id)
        assert model.dataset == DiscoverSavedQueryTypes.TRANSACTION_LIKE
        assert model.dataset_source == DatasetSourcesTypes.INFERRED.value

    def test_saves_discover_saved_query_split_error(self):
        self.store_event(self.transaction_data, project_id=self.project.id)

        data = self.load_data(platform="javascript")
        data["timestamp"] = self.ten_mins_ago_iso
        self.store_event(data=data, project_id=self.project.id)

        query = {"fields": ["message"], "query": "", "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="query name",
            query=query,
            version=2,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )

        assert model.dataset == DiscoverSavedQueryTypes.DISCOVER

        features = {
            "organizations:discover-basic": True,
            "organizations:global-views": True,
            "organizations:performance-discover-dataset-selector": True,
        }
        query = {
            "field": ["project", "user"],
            "query": "has:user event.type:error",
            "statsPeriod": "14d",
            "discoverSavedQueryId": model.id,
        }
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["discoverSplitDecision"] == "error-events"

        model = DiscoverSavedQuery.objects.get(id=model.id)
        assert model.dataset == DiscoverSavedQueryTypes.ERROR_EVENTS

    def test_saves_discover_saved_query_ambiguous_as_error(self):
        self.store_event(self.transaction_data, project_id=self.project.id)

        data = self.load_data(platform="javascript")
        data["timestamp"] = self.ten_mins_ago_iso
        self.store_event(data=data, project_id=self.project.id)

        query = {"fields": ["message"], "query": "", "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="query name",
            query=query,
            version=2,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )

        assert model.dataset == DiscoverSavedQueryTypes.DISCOVER

        features = {
            "organizations:discover-basic": True,
            "organizations:global-views": True,
            "organizations:performance-discover-dataset-selector": True,
        }
        query = {
            "field": ["transaction"],
            "query": "",
            "statsPeriod": "14d",
            "discoverSavedQueryId": model.id,
        }
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["discoverSplitDecision"] == "error-events"

        model = DiscoverSavedQuery.objects.get(id=model.id)
        assert model.dataset == DiscoverSavedQueryTypes.ERROR_EVENTS

    def test_applies_inferred_dataset_by_columns(self):
        self.store_event(self.transaction_data, project_id=self.project.id)

        data = self.load_data(platform="javascript")
        data["timestamp"] = self.ten_mins_ago_iso
        self.store_event(data=data, project_id=self.project.id)

        query = {"fields": ["message"], "query": "", "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="query name",
            query=query,
            version=2,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )

        assert model.dataset == DiscoverSavedQueryTypes.DISCOVER

        features = {
            "organizations:discover-basic": True,
            "organizations:global-views": True,
            "organizations:performance-discover-dataset-selector": True,
        }
        query = {
            "field": ["transaction.status"],
            "query": "",
            "statsPeriod": "14d",
            "discoverSavedQueryId": model.id,
        }
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["discoverSplitDecision"] == "transaction-like"

        model = DiscoverSavedQuery.objects.get(id=model.id)
        assert model.dataset == DiscoverSavedQueryTypes.TRANSACTION_LIKE

    def test_issues_with_transaction_dataset(self):
        self.store_event(self.transaction_data, project_id=self.project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["issue", "count()"],
            "query": "",
            "statsPeriod": "14d",
            "dataset": "transactions",
        }
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == "unknown"
        assert response.data["data"][0]["count()"] == 1

    def test_metrics_enhanced_defaults_to_transactions_with_feature_flag(self):
        # Store an error
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "poof",
                "timestamp": self.ten_mins_ago_iso,
                "user": {"email": self.user.email},
                "tags": {"notMetrics": "this makes it not metrics"},
            },
            project_id=self.project.id,
        )

        # Store a transaction
        self.store_event(
            {**self.transaction_data, "tags": {"notMetrics": "this makes it not metrics"}},
            project_id=self.project.id,
        )
        features = {
            "organizations:performance-discover-dataset-selector": True,
            "organizations:discover-basic": True,
            "organizations:global-views": True,
        }
        query = {
            "field": ["count()"],
            "query": 'notMetrics:"this makes it not metrics"',
            "statsPeriod": "14d",
            "dataset": "metricsEnhanced",
        }
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1

        # count() is 1 because it falls back to transactions
        assert response.data["data"][0]["count()"] == 1


class OrganizationEventsProfilesDatasetEndpointTest(OrganizationEventsEndpointTestBase):
    @mock.patch("sentry.search.events.builder.base.raw_snql_query")
    def test_profiles_dataset_simple(self, mock_snql_query):
        mock_snql_query.side_effect = [
            {
                "data": [
                    {
                        "project": self.project.id,
                        "transaction": "foo",
                        "last_seen": "2022-10-20T16:41:22+00:00",
                        "latest_event": "a" * 32,
                        "count": 1,
                        "count_unique_transaction": 1,
                        "percentile_profile_duration_0_25": 1,
                        "p50_profile_duration": 1,
                        "p75_profile_duration": 1,
                        "p95_profile_duration": 1,
                        "p99_profile_duration": 1,
                        "p100_profile_duration": 1,
                        "min_profile_duration": 1,
                        "max_profile_duration": 1,
                        "avg_profile_duration": 1,
                        "sum_profile_duration": 1,
                    },
                ],
                "meta": [
                    {
                        "name": "project",
                        "type": "UInt64",
                    },
                    {
                        "name": "transaction",
                        "type": "LowCardinality(String)",
                    },
                    {
                        "name": "last_seen",
                        "type": "DateTime",
                    },
                    {
                        "name": "latest_event",
                        "type": "String",
                    },
                    {
                        "name": "count",
                        "type": "UInt64",
                    },
                    {
                        "name": "count_unique_transaction",
                        "type": "UInt64",
                    },
                    {
                        "name": "percentile_profile_duration_0_25",
                        "type": "Float64",
                    },
                    *[
                        {
                            "name": f"{fn}_profile_duration",
                            "type": "Float64",
                        }
                        for fn in ["p50", "p75", "p95", "p99", "p100", "min", "max", "avg", "sum"]
                    ],
                ],
            },
        ]

        fields = [
            "project",
            "transaction",
            "last_seen()",
            "latest_event()",
            "count()",
            "count_unique(transaction)",
            "percentile(profile.duration, 0.25)",
            "p50(profile.duration)",
            "p75(profile.duration)",
            "p95(profile.duration)",
            "p99(profile.duration)",
            "p100(profile.duration)",
            "min(profile.duration)",
            "max(profile.duration)",
            "avg(profile.duration)",
            "sum(profile.duration)",
        ]

        query = {
            "field": fields,
            "project": [self.project.id],
            "dataset": "profiles",
        }
        response = self.do_request(query, features={"organizations:profiling": True})
        assert response.status_code == 200, response.content

        # making sure the response keys are in the form we expect and not aliased
        data_keys = {key for row in response.data["data"] for key in row}
        field_keys = {key for key in response.data["meta"]["fields"]}
        unit_keys = {key for key in response.data["meta"]["units"]}
        assert set(fields) == data_keys
        assert set(fields) == field_keys
        assert set(fields) == unit_keys


class OrganizationEventsProfileFunctionsDatasetEndpointTest(
    OrganizationEventsEndpointTestBase, ProfilesSnubaTestCase
):
    def test_functions_dataset_simple(self):
        one_hour_ago = before_now(hours=1)
        three_hours_ago = before_now(hours=3)

        stored_1 = self.store_functions(
            [
                {
                    "self_times_ns": [100_000_000 for _ in range(100)],
                    "package": "foo",
                    "function": "foo",
                    "in_app": True,
                },
            ],
            project=self.project,
            timestamp=three_hours_ago,
        )
        stored_2 = self.store_functions(
            [
                {
                    "self_times_ns": [150_000_000 for _ in range(100)],
                    "package": "foo",
                    "function": "foo",
                    "in_app": True,
                },
            ],
            project=self.project,
            timestamp=one_hour_ago,
        )
        stored_3 = self.store_functions_chunk(
            [
                {
                    "self_times_ns": [200_000_000 for _ in range(100)],
                    "package": "bar",
                    "function": "bar",
                    "thread_id": "1",
                    "in_app": True,
                },
            ],
            project=self.project,
            timestamp=three_hours_ago,
        )
        stored_4 = self.store_functions_chunk(
            [
                {
                    "self_times_ns": [250_000_000 for _ in range(100)],
                    "package": "bar",
                    "function": "bar",
                    "thread_id": "1",
                    "in_app": True,
                },
            ],
            project=self.project,
            timestamp=one_hour_ago,
        )

        mid = before_now(hours=2)

        fields = [
            "transaction",
            "project",
            "function",
            "package",
            "is_application",
            "platform.name",
            "environment",
            "release",
            "count()",
            "examples()",
            "all_examples()",
            "p50()",
            "p75()",
            "p95()",
            "p99()",
            "avg()",
            "sum()",
            f"regression_score(function.duration, 0.95, {int(mid.timestamp())})",
        ]

        response = self.do_request(
            {
                "field": fields,
                "statsPeriod": "4h",
                "project": [self.project.id],
                "dataset": "profileFunctions",
                "orderby": "transaction",
            },
            features={"organizations:profiling": True},
        )
        assert response.status_code == 200, response.content

        # making sure the response keys are in the form we expect and not aliased
        data_keys = {key for row in response.data["data"] for key in row}
        field_keys = {key for key in response.data["meta"]["fields"]}
        unit_keys = {key for key in response.data["meta"]["units"]}
        assert set(fields) == data_keys
        assert set(fields) == field_keys
        assert set(fields) == unit_keys
        assert response.data["meta"]["units"] == {
            "transaction": None,
            "project": None,
            "function": None,
            "package": None,
            "is_application": None,
            "platform.name": None,
            "environment": None,
            "release": None,
            "count()": None,
            "examples()": None,
            "all_examples()": None,
            "p50()": "nanosecond",
            "p75()": "nanosecond",
            "p95()": "nanosecond",
            "p99()": "nanosecond",
            "avg()": "nanosecond",
            "sum()": "nanosecond",
            f"regression_score(function.duration, 0.95, {int(mid.timestamp())})": None,
        }

        def all_examples_sort_key(example):
            return example.get("profile_id") or example.get("profiler_id")

        for row in response.data["data"]:
            row["examples()"].sort()
            row["all_examples()"].sort(key=all_examples_sort_key)

        transaction_examples = [
            stored_1["transaction"]["contexts"]["profile"]["profile_id"],
            stored_2["transaction"]["contexts"]["profile"]["profile_id"],
        ]
        transaction_examples.sort()

        transaction_all_examples = [
            {"profile_id": stored_1["transaction"]["contexts"]["profile"]["profile_id"]},
            {"profile_id": stored_2["transaction"]["contexts"]["profile"]["profile_id"]},
        ]
        transaction_all_examples.sort(key=all_examples_sort_key)

        continuous_examples = [stored_3["profiler_id"], stored_4["profiler_id"]]
        continuous_examples.sort()

        continuous_all_examples = [
            {
                "profiler_id": stored_3["profiler_id"],
                "thread_id": "1",
                "start": three_hours_ago.timestamp(),
                "end": (three_hours_ago + timedelta(microseconds=200_000)).timestamp(),
            },
            {
                "profiler_id": stored_4["profiler_id"],
                "thread_id": "1",
                "start": one_hour_ago.timestamp(),
                "end": (one_hour_ago + timedelta(microseconds=250_000)).timestamp(),
            },
        ]
        continuous_all_examples.sort(key=all_examples_sort_key)

        assert response.data["data"] == [
            {
                "transaction": "",
                "project": self.project.slug,
                "function": "bar",
                "package": "bar",
                "is_application": 1,
                "platform.name": "",
                "environment": None,
                "release": None,
                "count()": 200,
                "examples()": continuous_examples,
                "all_examples()": continuous_all_examples,
                "p50()": 225_000_000.0,
                "p75()": 250_000_000.0,
                "p95()": 250_000_000.0,
                "p99()": 250_000_000.0,
                "avg()": 225_000_000.0,
                "sum()": 45_000_000_000.0,
                f"regression_score(function.duration, 0.95, {int(mid.timestamp())})": mock.ANY,
            },
            {
                "transaction": "/country_by_code/",
                "project": self.project.slug,
                "function": "foo",
                "package": "foo",
                "is_application": 1,
                "platform.name": "transaction",
                "environment": None,
                "release": None,
                "count()": 200,
                "examples()": transaction_examples,
                "all_examples()": transaction_all_examples,
                "p50()": 125_000_000.0,
                "p75()": 150_000_000.0,
                "p95()": 150_000_000.0,
                "p99()": 150_000_000.0,
                "avg()": 125_000_000.0,
                "sum()": 25_000_000_000.0,
                f"regression_score(function.duration, 0.95, {int(mid.timestamp())})": mock.ANY,
            },
        ]


class OrganizationEventsIssuePlatformDatasetEndpointTest(
    OrganizationEventsEndpointTestBase, SearchIssueTestMixin, PerformanceIssueTestCase
):
    def test_performance_issue_id_filter(self):
        event = self.create_performance_issue()

        query = {
            "field": ["count()"],
            "statsPeriod": "2h",
            "query": f"issue.id:{event.group.id}",
            "dataset": "issuePlatform",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 1

    def test_generic_issue_ids_filter(self):
        user_data = {
            "id": self.user.id,
            "username": "user",
            "email": "hellboy@bar.com",
            "ip_address": "127.0.0.1",
        }
        event, _, group_info = self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            before_now(hours=1),
            user=user_data,
        )
        event, _, group_info = self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group2"],
            "prod",
            before_now(hours=1),
            user=user_data,
        )
        assert group_info is not None

        query = {
            "field": ["title", "release", "environment", "user.display", "timestamp"],
            "statsPeriod": "90d",
            "query": f"issue.id:{group_info.group.id}",
            "dataset": "issuePlatform",
        }
        with self.feature(["organizations:profiling"]):
            response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["title"] == group_info.group.title
        assert response.data["data"][0]["environment"] == "prod"
        assert response.data["data"][0]["user.display"] == user_data["email"]
        assert response.data["data"][0]["timestamp"] == event.timestamp

        query = {
            "field": ["title", "release", "environment", "user.display", "timestamp"],
            "statsPeriod": "90d",
            "query": f"issue:{group_info.group.qualified_short_id}",
            "dataset": "issuePlatform",
        }
        with self.feature(["organizations:profiling"]):
            response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["title"] == group_info.group.title
        assert response.data["data"][0]["environment"] == "prod"
        assert response.data["data"][0]["user.display"] == user_data["email"]
        assert response.data["data"][0]["timestamp"] == event.timestamp

    def test_performance_short_group_id(self):
        event = self.create_performance_issue()
        query = {
            "field": ["count()"],
            "statsPeriod": "1h",
            "query": f"project:{event.group.project.slug} issue:{event.group.qualified_short_id}",
            "dataset": "issuePlatform",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 1

    def test_multiple_performance_short_group_ids_filter(self):
        event1 = self.create_performance_issue()
        event2 = self.create_performance_issue()

        query = {
            "field": ["count()"],
            "statsPeriod": "1h",
            "query": f"project:{event1.group.project.slug} issue:[{event1.group.qualified_short_id},{event2.group.qualified_short_id}]",
            "dataset": "issuePlatform",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 2

    def test_user_display_issue_platform(self):
        project1 = self.create_project()
        user_data = {
            "id": self.user.id,
            "username": "user",
            "email": "hellboy@bar.com",
            "ip_address": "127.0.0.1",
        }
        _, _, group_info = self.store_search_issue(
            project1.id,
            1,
            ["group1-fingerprint"],
            None,
            before_now(hours=1),
            user=user_data,
        )
        assert group_info is not None

        features = {
            "organizations:discover-basic": True,
            "organizations:global-views": True,
            "organizations:profiling": True,
        }
        query = {
            "field": ["user.display"],
            "query": f"user.display:hell* issue.id:{group_info.group.id}",
            "statsPeriod": "24h",
            "dataset": "issuePlatform",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        result = {r["user.display"] for r in data}
        assert result == {user_data["email"]}

    def test_all_events_fields(self):
        user_data = {
            "id": self.user.id,
            "username": "user",
            "email": "hellboy@bar.com",
            "ip_address": "127.0.0.1",
        }
        replay_id = str(uuid.uuid4())
        profile_id = str(uuid.uuid4())
        event = self.create_performance_issue(
            contexts={
                "trace": {
                    "trace_id": str(uuid.uuid4().hex),
                    "span_id": "933e5c9a8e464da9",
                    "type": "trace",
                },
                "replay": {"replay_id": replay_id},
                "profile": {"profile_id": profile_id},
            },
            user_data=user_data,
        )

        query = {
            "field": [
                "id",
                "transaction",
                "title",
                "release",
                "environment",
                "user.display",
                "device",
                "os",
                "url",
                "runtime",
                "replayId",
                "profile.id",
                "transaction.duration",
                "timestamp",
            ],
            "statsPeriod": "1h",
            "query": f"project:{event.group.project.slug} issue:{event.group.qualified_short_id}",
            "dataset": "issuePlatform",
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content

        data = response.data["data"][0]

        assert data == {
            "id": event.event_id,
            "transaction": event.transaction,
            "project.name": event.project.name.lower(),
            "title": event.group.title,
            "release": event.release,
            "environment": event.get_environment().name,
            "user.display": user_data["email"],
            "device": "Mac",
            "os": "",
            "url": event.interfaces["request"].full_url,
            "runtime": dict(event.get_raw_data()["tags"])["runtime"],
            "replayId": replay_id.replace("-", ""),
            "profile.id": profile_id.replace("-", ""),
            "transaction.duration": 3000,
            "timestamp": event.datetime.replace(microsecond=0).isoformat(),
        }


class OrganizationEventsErrorsDatasetEndpointTest(OrganizationEventsEndpointTestBase):
    def test_status(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        ).group
        group_2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group2"],
            },
            project_id=self.project.id,
        ).group
        group_3 = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        ).group

        query = {
            "field": ["count()"],
            "statsPeriod": "2h",
            "query": "status:unresolved",
            "dataset": "errors",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 3
        group_2.status = GroupStatus.IGNORED
        group_2.substatus = GroupSubStatus.FOREVER
        group_2.save(update_fields=["status", "substatus"])
        group_3.status = GroupStatus.IGNORED
        group_3.substatus = GroupSubStatus.FOREVER
        group_3.save(update_fields=["status", "substatus"])
        # XXX: Snuba caches query results, so change the time period so that the query
        # changes enough to bust the cache.
        query["statsPeriod"] = "3h"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 1

    def test_is_status(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        ).group
        group_2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group2"],
            },
            project_id=self.project.id,
        ).group
        group_3 = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        ).group

        query = {
            "field": ["count()"],
            "statsPeriod": "2h",
            "query": "is:unresolved",
            "dataset": "errors",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 3
        group_2.status = GroupStatus.IGNORED
        group_2.substatus = GroupSubStatus.FOREVER
        group_2.save(update_fields=["status", "substatus"])
        group_3.status = GroupStatus.IGNORED
        group_3.substatus = GroupSubStatus.FOREVER
        group_3.save(update_fields=["status", "substatus"])
        # XXX: Snuba caches query results, so change the time period so that the query
        # changes enough to bust the cache.
        query["statsPeriod"] = "3h"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 1

    def test_short_group_id(self):
        group_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        ).group
        query = {
            "field": ["count()"],
            "statsPeriod": "1h",
            "query": f"project:{group_1.project.slug} issue:{group_1.qualified_short_id}",
            "dataset": "errors",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 1

    def test_user_display(self):
        group_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
                "user": {
                    "email": "hellboy@bar.com",
                },
            },
            project_id=self.project.id,
        ).group

        features = {
            "organizations:discover-basic": True,
            "organizations:global-views": True,
        }
        query = {
            "field": ["user.display"],
            "query": f"user.display:hell* issue.id:{group_1.id}",
            "statsPeriod": "24h",
            "dataset": "errors",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        result = {r["user.display"] for r in data}
        assert result == {"hellboy@bar.com"}

    def test_performance_score(self):
        self.transaction_data["measurements"] = {
            "score.lcp": {"value": 0.03},
            "score.weight.lcp": {"value": 0.3},
        }
        self.store_event(self.transaction_data, self.project.id)
        self.transaction_data["measurements"] = {
            "score.lcp": {"value": 1.0},
            "score.weight.lcp": {"value": 1.0},
        }
        self.store_event(self.transaction_data, self.project.id)
        query = {
            "field": [
                "performance_score(measurements.score.lcp)",
            ]
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0] == {
            "performance_score(measurements.score.lcp)": 0.7923076923076923,
        }

    def test_invalid_performance_score_column(self):
        self.transaction_data["measurements"] = {
            "score.total": {"value": 0.0},
        }
        self.store_event(self.transaction_data, self.project.id)
        query = {
            "field": [
                "performance_score(measurements.score.fp)",
            ]
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content

    def test_all_events_fields(self):
        user_data = {
            "id": self.user.id,
            "username": "user",
            "email": "hellboy@bar.com",
            "ip_address": "127.0.0.1",
        }
        replay_id = uuid.uuid4().hex
        event = self.store_event(
            data={
                "timestamp": self.ten_mins_ago_iso,
                "fingerprint": ["group1"],
                "contexts": {
                    "trace": {
                        "trace_id": str(uuid.uuid4().hex),
                        "span_id": "933e5c9a8e464da9",
                        "type": "trace",
                    },
                    "replay": {"replay_id": replay_id},
                },
                "tags": {"device": "Mac"},
                "user": user_data,
            },
            project_id=self.project.id,
        )

        query = {
            "field": [
                "id",
                "transaction",
                "title",
                "release",
                "environment",
                "user.display",
                "device",
                "os",
                "replayId",
                "timestamp",
            ],
            "statsPeriod": "2d",
            "query": "is:unresolved",
            "dataset": "errors",
            "sort": "-title",
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content

        data = response.data["data"][0]
        assert data == {
            "id": event.event_id,
            "transaction": "",
            "project.name": event.project.name.lower(),
            "title": event.group.title,
            "release": event.release,
            "environment": None,
            "user.display": user_data["email"],
            "device": "Mac",
            "replayId": replay_id,
            "os": "",
            "timestamp": event.datetime.replace(microsecond=0).isoformat(),
        }

    def test_opportunity_score(self):
        self.transaction_data["measurements"] = {
            "score.lcp": {"value": 0.03},
            "score.weight.lcp": {"value": 0.3},
            "score.fcp": {"value": 0.4},
            "score.weight.fcp": {"value": 0.7},
            "score.total": {"value": 0.43},
        }
        self.store_event(self.transaction_data, self.project.id)
        self.transaction_data["measurements"] = {
            "score.lcp": {"value": 1.0},
            "score.weight.lcp": {"value": 1.0},
            "score.total": {"value": 1.0},
        }
        self.store_event(self.transaction_data, self.project.id)
        self.transaction_data["measurements"] = {
            "score.total": {"value": 0.0},
        }
        self.store_event(self.transaction_data, self.project.id)
        query = {
            "field": [
                "opportunity_score(measurements.score.lcp)",
                "opportunity_score(measurements.score.total)",
            ]
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0] == {
            "opportunity_score(measurements.score.lcp)": 0.27,
            "opportunity_score(measurements.score.total)": 1.57,
        }

    def test_count_scores(self):
        self.transaction_data["measurements"] = {
            "score.lcp": {"value": 0.03},
            "score.total": {"value": 0.43},
        }
        self.store_event(self.transaction_data, self.project.id)
        self.transaction_data["measurements"] = {
            "score.total": {"value": 1.0},
        }
        self.store_event(self.transaction_data, self.project.id)
        self.transaction_data["measurements"] = {
            "score.total": {"value": 0.0},
        }
        self.store_event(self.transaction_data, self.project.id)
        query = {
            "field": [
                "count_scores(measurements.score.lcp)",
                "count_scores(measurements.score.total)",
            ]
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0] == {
            "count_scores(measurements.score.lcp)": 1,
            "count_scores(measurements.score.total)": 3,
        }
