from base64 import b64encode
from unittest import mock

import pytest
from django.urls import reverse
from django.utils import timezone
from pytz import utc
from snuba_sdk.column import Column
from snuba_sdk.function import Function

from sentry.discover.models import TeamKeyTransaction
from sentry.models import ApiKey, ProjectTeam, ProjectTransactionThreshold, ReleaseStages
from sentry.models.transaction_threshold import (
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.search.events.constants import (
    DEFAULT_PROJECT_THRESHOLD,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
    TIMEOUT_ERROR_MESSAGE,
)
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.skips import requires_not_arm64
from sentry.utils import json
from sentry.utils.samples import load_data
from sentry.utils.snuba import QueryExecutionError, QueryIllegalTypeOfArgument, RateLimitExceeded

MAX_QUERYABLE_TRANSACTION_THRESHOLDS = 1


class OrganizationEventsV2EndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.two_min_ago = iso_format(before_now(minutes=2))
        self.transaction_data = load_data("transaction", timestamp=before_now(minutes=1))
        self.features = {}

    def do_request(self, query, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-eventsv2",
            kwargs={"organization_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request({})

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_api_key_request(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        # Project ID cannot be inffered when using an org API key, so that must
        # be passed in the parameters
        api_key = ApiKey.objects.create(organization=self.organization, scope_list=["org:read"])
        query = {"field": ["project.name", "environment"], "project": [project.id]}

        url = reverse(
            "sentry-api-0-organization-eventsv2",
            kwargs={"organization_slug": self.organization.slug},
        )
        response = self.client.get(
            url,
            query,
            format="json",
            HTTP_AUTHORIZATION=b"Basic " + b64encode(f"{api_key.key}:".encode()),
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project.name"] == project.slug

    def test_performance_view_feature(self):
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago, "fingerprint": ["group1"]},
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

        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago, "fingerprint": ["group1"]},
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago, "fingerprint": ["group2"]},
            project_id=project2.id,
        )

        query = {"field": ["id", "project.id"], "project": [project.id, project2.id]}
        response = self.do_request(query)
        assert response.status_code == 400
        assert "events from multiple projects" in response.data["detail"]

    def test_invalid_search_terms(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast", "timestamp": self.min_ago},
            project_id=project.id,
        )

        query = {"field": ["id"], "query": "hi \n there"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Parse error at 'hi \n ther' (column 4). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )

    def test_invalid_trace_span(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast", "timestamp": self.min_ago},
            project_id=project.id,
        )

        query = {"field": ["id"], "query": "trace.span:invalid"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "trace.span must be a valid 16 character hex (containing only digits, or a-f characters)"
        )

        query = {"field": ["id"], "query": "trace.parent_span:invalid"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "trace.parent_span must be a valid 16 character hex (containing only digits, or a-f characters)"
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

    @mock.patch("sentry.snuba.discover.raw_query")
    @mock.patch("sentry.search.events.builder.raw_snql_query")
    def test_handling_snuba_errors(self, mock_snql_query, mock_query):
        mock_query.side_effect = RateLimitExceeded("test")
        mock_snql_query.side_effect = RateLimitExceeded("test")

        project = self.create_project()

        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast"}, project_id=project.id
        )

        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert response.data["detail"] == TIMEOUT_ERROR_MESSAGE

        mock_query.side_effect = QueryExecutionError("test")
        mock_snql_query.side_effect = QueryExecutionError("test")

        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)
        assert response.status_code == 500, response.content
        assert response.data["detail"] == "Internal error. Your query failed to run."

        mock_query.side_effect = QueryIllegalTypeOfArgument("test")
        mock_snql_query.side_effect = QueryIllegalTypeOfArgument("test")

        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)

        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Invalid query. Argument to function is wrong type."

    def test_out_of_retention(self):
        self.create_project()
        with self.options({"system.event-retention-days": 10}):
            query = {
                "field": ["id", "timestamp"],
                "orderby": ["-timestamp", "-id"],
                "start": iso_format(before_now(days=20)),
                "end": iso_format(before_now(days=15)),
            }
            response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Invalid date range. Please try a more recent date range."

    def test_raw_data(self):
        project = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.two_min_ago,
                "user": {"ip_address": "127.0.0.1", "email": "foo@example.com"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "staging",
                "timestamp": self.min_ago,
                "user": {"ip_address": "127.0.0.1", "email": "foo@example.com"},
            },
            project_id=project.id,
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
        assert data[0]["project.id"] == project.id
        assert data[0]["user.email"] == "foo@example.com"
        assert "project.name" not in data[0], "project.id does not auto select name"
        assert "project" not in data[0]

        meta = response.data["meta"]
        assert meta["id"] == "string"
        assert meta["user.email"] == "string"
        assert meta["user.ip"] == "string"
        assert meta["timestamp"] == "date"

    def test_project_name(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        query = {"field": ["project.name", "environment"]}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project.name"] == project.slug
        assert "project.id" not in response.data["data"][0]
        assert response.data["data"][0]["environment"] == "staging"

    def test_project_without_name(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        query = {"field": ["project", "environment"]}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == project.slug
        assert response.data["meta"]["project"] == "string"
        assert "project.id" not in response.data["data"][0]
        assert response.data["data"][0]["environment"] == "staging"

    def test_project_in_query(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        query = {
            "field": ["project", "count()"],
            "query": 'project:"%s"' % project.slug,
            "statsPeriod": "14d",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == project.slug
        assert "project.id" not in response.data["data"][0]

    def test_project_in_query_not_in_header(self):
        project = self.create_project()
        other_project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
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
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

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
            data={"event_id": "a" * 32, "timestamp": self.min_ago, "fingerprint": ["group1"]},
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago, "fingerprint": ["group2"]},
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
            data={"event_id": "a" * 32, "timestamp": self.min_ago, "fingerprint": ["group1"]},
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago, "fingerprint": ["group2"]},
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
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        query = {
            "field": ["project", "count()"],
            "query": 'project:"%s"' % project.slug,
            "statsPeriod": "14d",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == project.slug
        assert "project.id" not in response.data["data"][0]

    def test_auto_insert_project_name_when_event_id_present(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )
        query = {"field": ["id"], "statsPeriod": "1h"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"project.name": project.slug, "id": "a" * 32}]

    def test_auto_insert_project_name_when_event_id_present_with_aggregate(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )
        query = {"field": ["id", "count()"], "statsPeriod": "1h"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"project.name": project.slug, "id": "a" * 32, "count": 1}]

    def test_user_search(self):
        project = self.create_project()
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["user"] = {
            "email": "foo@example.com",
            "id": "123",
            "ip_address": "127.0.0.1",
            "username": "foo",
        }
        self.store_event(data, project_id=project.id)
        fields = {
            "email": "user.email",
            "id": "user.id",
            "ip_address": "user.ip",
            "username": "user.username",
        }
        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        for key, value in data["user"].items():
            field = fields[key]
            query = {
                "field": ["project", "user"],
                "query": f"{field}:{value}",
                "statsPeriod": "14d",
            }
            response = self.do_request(query, features=features)
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert response.data["data"][0]["project"] == project.slug
            assert response.data["data"][0]["user"] == "id:123"

    def test_has_user(self):
        project = self.create_project()
        data = load_data("transaction", timestamp=before_now(minutes=1))
        self.store_event(data, project_id=project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        for value in data["user"].values():
            query = {"field": ["project", "user"], "query": "has:user", "statsPeriod": "14d"}
            response = self.do_request(query, features=features)

            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            assert response.data["data"][0]["user"] == "ip:{}".format(data["user"]["ip_address"])

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
            data={"event_id": "a" * 32, "timestamp": self.min_ago, "fingerprint": ["group1"]},
            project_id=project.id,
        )

        query = {"field": ["id", "project.id"], "project": [project.id], "team": [team.id]}
        response = self.do_request(query)
        assert response.status_code == 403, response.content

        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_comparison_operators_on_numeric_field(self):
        project = self.create_project()
        event = self.store_event(
            {"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
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
        project = self.create_project()
        event = self.store_event(
            {"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
        )

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
        project = self.create_project()
        event = self.store_event(
            {"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
        )

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
        project = self.create_project()
        data = load_data("transaction", timestamp=before_now(minutes=1))
        event = self.store_event(data, project_id=project.id)
        duration = int(event.data.get("timestamp") - event.data.get("start_timestamp")) * 1000

        query = {"field": ["transaction"], "query": f"transaction.duration:{duration}"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["id"] == event.event_id

        query = {"field": ["transaction"], "query": f"!transaction.duration:{duration}"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_has_issue(self):
        project = self.create_project()
        event = self.store_event(
            {"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
        )

        data = load_data("transaction", timestamp=before_now(minutes=1))
        self.store_event(data, project_id=project.id)

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
        project = self.create_project()
        event = self.store_event(
            {"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
        )

        data = load_data("transaction", timestamp=before_now(minutes=1))
        self.store_event(data, project_id=project.id)

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
        project = self.create_project()
        user_data = {"email": "foo@example.com", "id": "123", "username": "foo"}

        # Load an event with data that shouldn't match
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/transactions/nomatch"
        event_user = user_data.copy()
        event_user["id"] = "undefined"
        data["user"] = event_user
        self.store_event(data, project_id=project.id)

        # Load a matching event
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/transactions/matching"
        data["user"] = user_data
        self.store_event(data, project_id=project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["project", "user"],
            "query": '!user:"id:undefined"',
            "statsPeriod": "14d",
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
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project1.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "environment": "staging", "timestamp": self.min_ago},
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
        self.login_as(user=self.user)
        project = self.create_project()
        prototype = load_data("android-ndk")
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "was handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            prototype["event_id"] = event[0]
            prototype["message"] = event[1]
            prototype["exception"]["values"][0]["value"] = event[1]
            prototype["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            prototype["timestamp"] = self.two_min_ago
            self.store_event(data=prototype, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["message", "error.handled"],
                "query": "error.handled:0",
                "orderby": "message",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 1 == len(response.data["data"])
            assert [0] == response.data["data"][0]["error.handled"]

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["message", "error.handled"],
                "query": "error.handled:1",
                "orderby": "message",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 2 == len(response.data["data"])
            assert [None] == response.data["data"][0]["error.handled"]
            assert [1] == response.data["data"][1]["error.handled"]

    def test_error_unhandled_condition(self):
        self.login_as(user=self.user)
        project = self.create_project()
        prototype = load_data("android-ndk")
        events = (
            ("a" * 32, "not handled", False),
            ("b" * 32, "was handled", True),
            ("c" * 32, "undefined", None),
        )
        for event in events:
            prototype["event_id"] = event[0]
            prototype["message"] = event[1]
            prototype["exception"]["values"][0]["value"] = event[1]
            prototype["exception"]["values"][0]["mechanism"]["handled"] = event[2]
            prototype["timestamp"] = self.two_min_ago
            self.store_event(data=prototype, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            query = {
                "field": ["message", "error.unhandled", "error.handled"],
                "query": "error.unhandled:true",
                "orderby": "message",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            assert 1 == len(response.data["data"])
            assert [0] == response.data["data"][0]["error.handled"]
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
            assert [None] == response.data["data"][0]["error.handled"]
            assert 0 == response.data["data"][0]["error.unhandled"]
            assert [1] == response.data["data"][1]["error.handled"]
            assert 0 == response.data["data"][1]["error.unhandled"]

    def test_implicit_groupby(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.two_min_ago, "fingerprint": ["group_1"]},
            project_id=project.id,
        )
        event1 = self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago, "fingerprint": ["group_1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"event_id": "c" * 32, "timestamp": self.min_ago, "fingerprint": ["group_2"]},
            project_id=project.id,
        )

        query = {"field": ["count(id)", "project.id", "issue.id"], "orderby": "issue.id"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0] == {"project.id": project.id, "issue.id": event1.group_id, "count_id": 2}
        assert data[1] == {"project.id": project.id, "issue.id": event2.group_id, "count_id": 1}
        meta = response.data["meta"]
        assert meta["count_id"] == "integer"

    def test_orderby(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.two_min_ago}, project_id=project.id
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago}, project_id=project.id
        )
        self.store_event(
            data={"event_id": "c" * 32, "timestamp": self.min_ago}, project_id=project.id
        )
        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0]["id"] == "c" * 32
        assert data[1]["id"] == "b" * 32
        assert data[2]["id"] == "a" * 32

    def test_sort_title(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "message": "zlast", "timestamp": self.two_min_ago},
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "message": "second", "timestamp": self.min_ago},
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "c" * 32, "message": "first", "timestamp": self.min_ago},
            project_id=project.id,
        )
        query = {"field": ["id", "title"], "sort": "title"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0]["id"] == "c" * 32
        assert data[1]["id"] == "b" * 32
        assert data[2]["id"] == "a" * 32

    def test_sort_invalid(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.two_min_ago}, project_id=project.id
        )
        query = {"field": ["id"], "sort": "garbage"}
        response = self.do_request(query)
        assert response.status_code == 400
        assert "sort by" in response.data["detail"]

    def test_latest_release_alias(self):
        project = self.create_project()
        event1 = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.two_min_ago, "release": "0.8"},
            project_id=project.id,
        )
        query = {"field": ["issue.id", "release"], "query": "release:latest"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0]["issue.id"] == event1.group_id
        assert data[0]["release"] == "0.8"

        event2 = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago, "release": "0.9"},
            project_id=project.id,
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
            data={"release": release_1.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id
        release_2_e_2 = self.store_event(
            data={"release": release_2.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id
        release_3_e_1 = self.store_event(
            data={"release": release_3.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id
        release_3_e_2 = self.store_event(
            data={"release": release_3.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id

        query = {"field": ["id"], "query": f"{SEMVER_ALIAS}:>1.2.3"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_2_e_1,
            release_2_e_2,
            release_3_e_1,
            release_3_e_2,
        }

        query = {"field": ["id"], "query": f"{SEMVER_ALIAS}:>=1.2.3"}
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

        query = {"field": ["id"], "query": f"{SEMVER_ALIAS}:<1.2.4"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

        query = {"field": ["id"], "query": f"{SEMVER_ALIAS}:1.2.3"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

        query = {"field": ["id"], "query": f"!{SEMVER_ALIAS}:1.2.3"}
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
                "timestamp": self.min_ago,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).event_id
        adopted_release_e_2 = self.store_event(
            data={
                "release": adopted_release.version,
                "timestamp": self.min_ago,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).event_id
        replaced_release_e_1 = self.store_event(
            data={
                "release": replaced_release.version,
                "timestamp": self.min_ago,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).event_id
        replaced_release_e_2 = self.store_event(
            data={
                "release": replaced_release.version,
                "timestamp": self.min_ago,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).event_id

        query = {
            "field": ["id"],
            "query": f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED}",
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
            "query": f"!{RELEASE_STAGE_ALIAS}:{ReleaseStages.LOW_ADOPTION}",
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
            "query": f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED}, {ReleaseStages.REPLACED}]",
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
            data={"release": release_1.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id

        query = {"field": ["id"], "query": f"{SEMVER_PACKAGE_ALIAS}:test"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

        query = {"field": ["id"], "query": f"{SEMVER_PACKAGE_ALIAS}:test2"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_2_e_1,
        }

    def test_semver_build(self):
        release_1 = self.create_release(version="test@1.2.3+123")
        release_2 = self.create_release(version="test2@1.2.4+124")

        release_1_e_1 = self.store_event(
            data={"release": release_1.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id
        release_1_e_2 = self.store_event(
            data={"release": release_1.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id
        release_2_e_1 = self.store_event(
            data={"release": release_2.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        ).event_id

        query = {"field": ["id"], "query": f"{SEMVER_BUILD_ALIAS}:123"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

        query = {"field": ["id"], "query": f"{SEMVER_BUILD_ALIAS}:124"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_2_e_1,
        }
        query = {"field": ["id"], "query": f"!{SEMVER_BUILD_ALIAS}:124"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert {r["id"] for r in response.data["data"]} == {
            release_1_e_1,
            release_1_e_2,
        }

    def test_aliased_fields(self):
        project = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "bar@example.com"},
            },
            project_id=project.id,
        )

        query = {"field": ["issue.id", "count(id)", "count_unique(user)"], "orderby": "issue.id"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["issue.id"] == event1.group_id
        assert data[0]["count_id"] == 1
        assert data[0]["count_unique_user"] == 1
        assert "projectid" not in data[0]
        assert "project.id" not in data[0]
        assert data[1]["issue.id"] == event2.group_id
        assert data[1]["count_id"] == 2
        assert data[1]["count_unique_user"] == 2

    def test_aggregate_field_with_dotted_param(self):
        project = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_1"],
                "user": {"id": "123", "email": "foo@example.com"},
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"id": "123", "email": "foo@example.com"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"id": "456", "email": "bar@example.com"},
            },
            project_id=project.id,
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
        assert data[0]["count_id"] == 1
        assert data[0]["count_unique_user_email"] == 1
        assert "projectid" not in data[0]
        assert "project.id" not in data[0]
        assert data[1]["issue.id"] == event2.group_id
        assert data[1]["count_id"] == 2
        assert data[1]["count_unique_user_email"] == 2

    def test_failure_rate_alias_field(self):
        project = self.create_project()

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/failure_rate/success"
        self.store_event(data, project_id=project.id)

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/failure_rate/unknown"
        data["contexts"]["trace"]["status"] = "unknown_error"
        self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("transaction", timestamp=before_now(minutes=1))
            data["transaction"] = f"/failure_rate/{i}"
            data["contexts"]["trace"]["status"] = "unauthenticated"
            self.store_event(data, project_id=project.id)

        query = {"field": ["failure_rate()"], "query": "event.type:transaction"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["failure_rate"] == 0.75

    def test_count_miserable_alias_field(self):
        project = self.create_project()

        events = [
            ("one", 300),
            ("one", 300),
            ("two", 3000),
            ("two", 3000),
            ("three", 300),
            ("three", 3000),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + idx)),
                start_timestamp=before_now(minutes=(1 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/count_miserable/horribilis/{idx}"
            data["user"] = {"email": f"{event[0]}@example.com"}
            self.store_event(data, project_id=project.id)
        query = {"field": ["count_miserable(user, 300)"], "query": "event.type:transaction"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["count_miserable_user_300"] == 2

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

        events = [
            ("one", 400),
            ("one", 400),
            ("two", 3000),
            ("two", 3000),
            ("three", 300),
            ("three", 3000),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + idx)),
                start_timestamp=before_now(minutes=(1 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/count_miserable/horribilis/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}
            self.store_event(data, project_id=project_ids[0])

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
        project = self.create_project()

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=project.organization,
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
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + idx)),
                start_timestamp=before_now(minutes=(1 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/count_miserable/horribilis/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}
            self.store_event(data, project_id=project.id)

        query = {
            "field": [
                "transaction",
                "count_miserable(user)",
            ],
            "query": "event.type:transaction",
            "project": [project.id],
            "sort": "count_miserable_user",
        }

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        assert data[0]["count_miserable_user"] == 0
        assert data[1]["count_miserable_user"] == 1
        assert data[2]["count_miserable_user"] == 2

        query["query"] = "event.type:transaction count_miserable(user):>0"

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert abs(data[0]["count_miserable_user"]) == 1
        assert abs(data[1]["count_miserable_user"]) == 2

    def test_user_misery_alias_field(self):
        project = self.create_project()

        events = [
            ("one", 300),
            ("one", 300),
            ("two", 3000),
            ("two", 3000),
            ("three", 300),
            ("three", 3000),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + idx)),
                start_timestamp=before_now(minutes=(1 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/user_misery/{idx}"
            data["user"] = {"email": f"{event[0]}@example.com"}
            self.store_event(data, project_id=project.id)
        query = {"field": ["user_misery(300)"], "query": "event.type:transaction"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert abs(data[0]["user_misery_300"] - 0.0653) < 0.0001

    def test_apdex_new_alias_field(self):
        project = self.create_project()

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=project.organization,
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
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + idx)),
                start_timestamp=before_now(minutes=(1 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/apdex/new/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}
            self.store_event(data, project_id=project.id)

        query = {
            "field": [
                "transaction",
                "apdex()",
            ],
            "query": "event.type:transaction",
            "project": [project.id],
            "sort": "-apdex",
        }

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        assert data[0]["apdex"] == 1.0
        assert data[1]["apdex"] == 0.5
        assert data[2]["apdex"] == 0.0

        query["query"] = "event.type:transaction apdex():>0.50"

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["apdex"] == 1.0

    def test_user_misery_alias_field_with_project_threshold(self):
        project = self.create_project()

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=project.organization,
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
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + idx)),
                start_timestamp=before_now(minutes=(1 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/count_miserable/horribilis/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}
            self.store_event(data, project_id=project.id)

        query = {
            "field": [
                "transaction",
                "user_misery()",
            ],
            "orderby": "user_misery()",
            "query": "event.type:transaction",
            "project": [project.id],
        }

        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        assert abs(data[0]["user_misery"] - 0.04916) < 0.0001
        assert abs(data[1]["user_misery"] - 0.05751) < 0.0001
        assert abs(data[2]["user_misery"] - 0.06586) < 0.0001

        query["query"] = "event.type:transaction user_misery():>0.050"

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert abs(data[0]["user_misery"] - 0.05751) < 0.0001
        assert abs(data[1]["user_misery"] - 0.06586) < 0.0001

    def test_user_misery_alias_field_with_transaction_threshold(self):
        project = self.create_project()

        events = [
            ("one", 300),
            ("two", 300),
            ("one", 3000),
            ("two", 3000),
            ("three", 400),
            ("four", 4000),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + idx)),
                start_timestamp=before_now(minutes=(1 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/count_miserable/horribilis/{idx}"
            data["user"] = {"email": f"{event[0]}@example.com"}
            self.store_event(data, project_id=project.id)

            if idx % 2:
                ProjectTransactionThresholdOverride.objects.create(
                    transaction=f"/count_miserable/horribilis/{idx}",
                    project=project,
                    organization=project.organization,
                    threshold=100 * idx,
                    metric=TransactionMetric.DURATION.value,
                )

        query = {
            "field": [
                "transaction",
                "user_misery()",
            ],
            "query": "event.type:transaction",
            "orderby": "transaction",
            "project": [project.id],
        }

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content

        expected = [
            ("/count_miserable/horribilis/0", ["duration", 300], 0.049578),
            ("/count_miserable/horribilis/1", ["duration", 100], 0.049578),
            ("/count_miserable/horribilis/2", ["duration", 300], 0.058),
            ("/count_miserable/horribilis/3", ["duration", 300], 0.058),
            ("/count_miserable/horribilis/4", ["duration", 300], 0.049578),
            ("/count_miserable/horribilis/5", ["duration", 500], 0.058),
        ]

        assert len(response.data["data"]) == 6
        data = response.data["data"]
        for i, record in enumerate(expected):
            name, threshold_config, misery = record
            assert data[i]["transaction"] == name
            assert data[i]["project_threshold_config"] == threshold_config
            assert abs(data[i]["user_misery"] - misery) < 0.0001

        query["query"] = "event.type:transaction user_misery():>0.050"

        response = self.do_request(
            query,
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        assert abs(data[0]["user_misery"] - 0.058) < 0.0001
        assert abs(data[1]["user_misery"] - 0.058) < 0.0001
        assert abs(data[2]["user_misery"] - 0.058) < 0.0001

    def test_user_misery_alias_field_with_transaction_threshold_and_project_threshold(self):
        project = self.create_project()

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=project.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        events = [
            ("one", 300),
            ("two", 300),
            ("one", 3000),
            ("two", 3000),
            ("three", 400),
            ("four", 4000),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + idx)),
                start_timestamp=before_now(minutes=(1 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/count_miserable/horribilis/{idx}"
            data["user"] = {"email": f"{event[0]}@example.com"}
            self.store_event(data, project_id=project.id)

            if idx % 2:
                ProjectTransactionThresholdOverride.objects.create(
                    transaction=f"/count_miserable/horribilis/{idx}",
                    project=project,
                    organization=project.organization,
                    threshold=100 * idx,
                    metric=TransactionMetric.DURATION.value,
                )

        project2 = self.create_project()

        data = load_data("transaction", timestamp=before_now(minutes=1))
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

        expected = [
            (
                "/count_miserable/horribilis/0",
                ["duration", 100],
                0.049578,
            ),  # Uses project threshold
            ("/count_miserable/horribilis/1", ["duration", 100], 0.049578),  # Uses txn threshold
            ("/count_miserable/horribilis/2", ["duration", 100], 0.058),  # Uses project threshold
            ("/count_miserable/horribilis/3", ["duration", 300], 0.058),  # Uses txn threshold
            (
                "/count_miserable/horribilis/4",
                ["duration", 100],
                0.049578,
            ),  # Uses project threshold
            ("/count_miserable/horribilis/5", ["duration", 500], 0.058),  # Uses txn threshold
            ("/count_miserable/horribilis/project2", ["duration", 300], 0.058),  # Uses fallback
        ]

        assert len(response.data["data"]) == 7
        data = response.data["data"]
        for i, record in enumerate(expected):
            name, threshold_config, misery = record
            assert data[i]["transaction"] == name
            assert data[i]["project_threshold_config"] == threshold_config
            assert abs(data[i]["user_misery"] - misery) < 0.0001

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
        project = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
                "tags": {"sub_customer.is-Enterprise-42": "1"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "staging",
                "tags": {"sub_customer.is-Enterprise-42": "1"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
                "tags": {"sub_customer.is-Enterprise-42": "0"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
                "tags": {"sub_customer.is-Enterprise-42": "1"},
            },
            project_id=project.id,
        )

        query = {
            "field": ["sub_customer.is-Enterprise-42", "count(sub_customer.is-Enterprise-42)"],
            "orderby": "sub_customer.is-Enterprise-42",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["count_sub_customer_is_Enterprise_42"] == 1
        assert data[1]["count_sub_customer_is_Enterprise_42"] == 3

    def test_aggregation_comparison(self):
        project = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
            },
            project_id=project.id,
        )
        event = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "bar@example.com"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_3"],
                "user": {"email": "bar@example.com"},
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "e" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_3"],
                "user": {"email": "bar@example.com"},
            },
            project_id=project.id,
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
        assert data[0]["count_id"] == 2
        assert data[0]["count_unique_user"] == 2

    def test_aggregation_alias_comparison(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        event = self.store_event(data, project_id=project.id)

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
        assert data[0]["p95"] == 3000

    def test_auto_aggregations(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        event = self.store_event(data, project_id=project.id)

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
        project = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "staging",
            },
            project_id=project.id,
        )
        event = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=project.id,
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
        assert data[0]["count_id"] == 2

    def test_aggregation_date_comparison_with_conditions(self):
        project = self.create_project()
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "staging",
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=project.id,
        )
        query = {
            "field": ["issue.id", "max(timestamp)"],
            "query": "max(timestamp):>1 user.email:foo@example.com environment:prod",
            "orderby": "issue.id",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        assert response.data["meta"]["max_timestamp"] == "date"
        data = response.data["data"]
        assert data[0]["issue.id"] == event.group_id

    def test_percentile_function(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        event1 = self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        event2 = self.store_event(data, project_id=project.id)

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
        assert data[0]["percentile_transaction_duration_0_95"] == 5000
        assert data[1]["transaction"] == event2.transaction
        assert data[1]["percentile_transaction_duration_0_95"] == 3000

    def test_percentile_function_as_condition(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        event1 = self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        self.store_event(data, project_id=project.id)

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
        assert data[0]["percentile_transaction_duration_0_95"] == 5000

    def test_epm_function(self):
        project = self.create_project()

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["transaction"] = "/aggregates/1"
        event1 = self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=3),
        )
        data["transaction"] = "/aggregates/2"
        event2 = self.store_event(data, project_id=project.id)

        query = {
            "field": ["transaction", "epm()"],
            "query": "event.type:transaction",
            "orderby": ["transaction"],
            "statsPeriod": "2m",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["transaction"] == event1.transaction
        assert data[0]["epm"] == 0.5
        assert data[1]["transaction"] == event2.transaction
        assert data[1]["epm"] == 0.5

    def test_nonexistent_fields(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast", "timestamp": self.min_ago},
            project_id=project.id,
        )

        query = {"field": ["issue_world.id"]}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["issue_world.id"] == ""

    def test_no_requested_fields_or_grouping(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast", "timestamp": self.min_ago},
            project_id=project.id,
        )

        query = {"query": "test"}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "No columns selected"

    def test_condition_on_aggregate_misses(self):
        project = self.create_project()
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "bar@example.com"},
            },
            project_id=project.id,
        )

        query = {"field": ["issue.id"], "query": "event_count:>0", "orderby": "issue.id"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_next_prev_link_headers(self):
        project = self.create_project()
        events = [("a", "group_1"), ("b", "group_2"), ("c", "group_2"), ("d", "group_2")]
        for e in events:
            self.store_event(
                data={
                    "event_id": e[0] * 32,
                    "timestamp": self.min_ago,
                    "fingerprint": [e[1]],
                    "user": {"email": "foo@example.com"},
                    "tags": {"language": "C++"},
                },
                project_id=project.id,
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
        assert data[0]["count_id"] == 3
        assert data[1]["count_id"] == 1

    def test_empty_count_query(self):
        project = self.create_project()

        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(minutes=5)),
                "fingerprint": ["1123581321"],
                "user": {"email": "foo@example.com"},
                "tags": {"language": "C++"},
            },
            project_id=project.id,
        )

        query = {
            "field": ["count()"],
            "query": "issue.id:%d timestamp:>%s" % (event.group_id, self.min_ago),
            "statsPeriod": "14d",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count"] == 0

    def test_stack_wildcard_condition(self):
        project = self.create_project()
        data = load_data("javascript")
        data["timestamp"] = self.min_ago
        self.store_event(data=data, project_id=project.id)

        query = {"field": ["stack.filename", "message"], "query": "stack.filename:*.js"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["message"] == "string"

    def test_email_wildcard_condition(self):
        project = self.create_project()
        data = load_data("javascript")
        data["timestamp"] = self.min_ago
        self.store_event(data=data, project_id=project.id)

        query = {"field": ["stack.filename", "message"], "query": "user.email:*@example.org"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["message"] == "string"

    def test_release_wildcard_condition(self):
        release = self.create_release(version="test@1.2.3+123")

        self.store_event(
            data={"release": release.version, "timestamp": self.min_ago},
            project_id=self.project.id,
        )

        query = {"field": ["stack.filename", "release"], "query": "release:test*"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["release"] == release.version

    def test_transaction_event_type(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        self.store_event(data=data, project_id=project.id)

        query = {
            "field": ["transaction", "transaction.duration", "transaction.status"],
            "query": "event.type:transaction",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["transaction.duration"] == "duration"
        assert response.data["meta"]["transaction.status"] == "string"
        assert response.data["data"][0]["transaction.status"] == "ok"

    def test_trace_columns(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        self.store_event(data=data, project_id=project.id)

        query = {"field": ["trace"], "query": "event.type:transaction"}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["trace"] == "string"
        assert response.data["data"][0]["trace"] == data["contexts"]["trace"]["trace_id"]

    def test_issue_in_columns(self):
        project1 = self.create_project()
        project2 = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
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
                "timestamp": self.two_min_ago,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
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
                "timestamp": self.two_min_ago,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "go really fast plz",
                "timestamp": self.two_min_ago,
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
        project1 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {"field": ["count()"], "query": "issue.id:112358"}
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count"] == 0

    def test_issue_alias_inside_aggregate(self):
        project1 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )

        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
                "fingerprint": ["group_2"],
            },
            project_id=project1.id,
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
        assert data[0]["count_id"] == 2
        assert data[0]["count_unique_issue_id"] == 2
        assert data[0]["count_unique_issue"] == 2

    def test_project_alias_inside_aggregate(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
                "fingerprint": ["group_1"],
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
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
        assert data[0]["count_id"] == 2
        assert data[0]["count_unique_project_id"] == 2
        assert data[0]["count_unique_project"] == 2

    def test_user_display(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
                "user": {"email": "cathy@example.com"},
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
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
        self.login_as(user=self.user)

        project1 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
                "user": {"email": "cathy@example.com"},
            },
            project_id=project1.id,
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
        assert data[0]["count_unique_user_display"] == 1

    def test_orderby_user_display(self):
        project1 = self.create_project()
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
                "user": {"email": "cathy@example.com"},
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
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
                "timestamp": self.two_min_ago,
                "user": {"email": "cathy@example.com"},
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
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
        project1 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": iso_format(day_ago),
                "user": {"email": "cathy@example.com"},
            },
            project_id=project1.id,
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
        result = {r["any_user_display"] for r in data}
        assert result == {"cathy@example.com"}
        result = {r["any_timestamp_to_day"][:19] for r in data}
        assert result == {iso_format(day_ago.replace(hour=0, minute=0, second=0, microsecond=0))}
        result = {r["any_timestamp_to_hour"][:19] for r in data}
        assert result == {iso_format(day_ago.replace(minute=0, second=0, microsecond=0))}

    def test_field_aliases_in_conflicting_functions(self):
        day_ago = before_now(days=1).replace(hour=10, minute=11, second=12, microsecond=13)
        project1 = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": iso_format(day_ago),
                "user": {"email": "cathy@example.com"},
            },
            project_id=project1.id,
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
        project = self.create_project()
        event = self.store_event(
            {"timestamp": iso_format(before_now(minutes=1)), "message": "a"}, project_id=project.id
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
        project = self.create_project()
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/transactionstatus/1"
        self.store_event(data, project_id=project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "count(id)"],
            "query": "event.type:transaction has:transaction.status",
            "sort": "-count(id)",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count_id"] == 1

    def test_not_has_transaction_status(self):
        project = self.create_project()
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/transactionstatus/1"
        self.store_event(data, project_id=project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "count(id)"],
            "query": "event.type:transaction !has:transaction.status",
            "sort": "-count(id)",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count_id"] == 0

    def test_tag_that_looks_like_aggregation(self):
        project = self.create_project()
        data = {
            "message": "Failure state",
            "timestamp": self.two_min_ago,
            "tags": {"count_diff": 99},
        }
        self.store_event(data, project_id=project.id)
        query = {
            "field": ["message", "count_diff", "count()"],
            "query": "",
            "project": [project.id],
            "statsPeriod": "24h",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        meta = response.data["meta"]
        assert "string" == meta["count_diff"], "tags should not be counted as integers"
        assert "string" == meta["message"]
        assert "integer" == meta["count"]
        assert 1 == len(response.data["data"])
        data = response.data["data"][0]
        assert "99" == data["count_diff"]
        assert "Failure state" == data["message"]
        assert 1 == data["count"]

    def test_aggregate_negation(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        self.store_event(data, project_id=project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["event.type", "p99()"],
            "query": "event.type:transaction p99():5s",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1

        query = {
            "field": ["event.type", "p99()"],
            "query": "event.type:transaction !p99():5s",
            "statsPeriod": "24h",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 0

    def test_all_aggregates_in_columns(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=2),
            start_timestamp=before_now(minutes=2, seconds=5),
        )
        data["transaction"] = "/failure_rate/1"
        self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["transaction"] = "/failure_rate/1"
        data["contexts"]["trace"]["status"] = "unauthenticated"
        event = self.store_event(data, project_id=project.id)

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
        meta = response.data["meta"]
        assert meta["p50"] == "duration"
        assert meta["p75"] == "duration"
        assert meta["p95"] == "duration"
        assert meta["p99"] == "duration"
        assert meta["p100"] == "duration"
        assert meta["percentile_transaction_duration_0_99"] == "duration"
        assert meta["apdex_300"] == "number"
        assert meta["failure_rate"] == "percentage"
        assert meta["user_misery_300"] == "number"
        assert meta["count_miserable_user_300"] == "integer"

        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p50"] == 5000
        assert data[0]["p75"] == 5000
        assert data[0]["p95"] == 5000
        assert data[0]["p99"] == 5000
        assert data[0]["p100"] == 5000
        assert data[0]["percentile_transaction_duration_0_99"] == 5000
        assert data[0]["apdex_300"] == 0.0
        assert data[0]["count_miserable_user_300"] == 1
        assert data[0]["user_misery_300"] == 0.058
        assert data[0]["failure_rate"] == 0.5

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
            "project": [project.id],
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        meta = response.data["meta"]
        assert meta["p50"] == "duration"
        assert meta["p75"] == "duration"
        assert meta["p95"] == "duration"
        assert meta["p99"] == "duration"
        assert meta["p100"] == "duration"
        assert meta["percentile_transaction_duration_0_99"] == "duration"
        assert meta["apdex_300"] == "number"
        assert meta["apdex"] == "number"
        assert meta["failure_rate"] == "percentage"
        assert meta["user_misery_300"] == "number"
        assert meta["count_miserable_user_300"] == "integer"
        assert meta["project_threshold_config"] == "string"
        assert meta["user_misery"] == "number"
        assert meta["count_miserable_user"] == "integer"

        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p50"] == 5000
        assert data[0]["p75"] == 5000
        assert data[0]["p95"] == 5000
        assert data[0]["p99"] == 5000
        assert data[0]["p100"] == 5000
        assert data[0]["percentile_transaction_duration_0_99"] == 5000
        assert data[0]["apdex_300"] == 0.0
        assert data[0]["apdex"] == 0.0
        assert data[0]["count_miserable_user_300"] == 1
        assert data[0]["user_misery_300"] == 0.058
        assert data[0]["failure_rate"] == 0.5
        assert data[0]["project_threshold_config"] == ["duration", 300]
        assert data[0]["user_misery"] == 0.058
        assert data[0]["count_miserable_user"] == 1

        query = {
            "field": ["event.type", "last_seen()", "latest_event()"],
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert iso_format(before_now(minutes=1))[:-5] in data[0]["last_seen"]
        assert data[0]["latest_event"] == event.event_id

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
                "sum(transaction.duration)",
            ],
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count"] == 2
        assert data[0]["count_id"] == 2
        assert data[0]["count_unique_project"] == 1
        assert data[0]["min_transaction_duration"] == 5000
        assert data[0]["max_transaction_duration"] == 5000
        assert data[0]["avg_transaction_duration"] == 5000
        assert data[0]["stddev_transaction_duration"] == 0.0
        assert data[0]["var_transaction_duration"] == 0.0
        assert data[0]["cov_transaction_duration_transaction_duration"] == 0.0
        assert data[0]["corr_transaction_duration_transaction_duration"] == 0.0
        assert data[0]["sum_transaction_duration"] == 10000

    @requires_not_arm64
    def test_null_user_misery_returns_zero(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=2),
            start_timestamp=before_now(minutes=2, seconds=5),
        )
        data["user"] = None
        data["transaction"] = "/no_users/1"
        self.store_event(data, project_id=project.id)
        features = {"organizations:discover-basic": True, "organizations:global-views": True}

        query = {
            "field": ["user_misery(300)"],
            "query": "event.type:transaction",
        }

        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        meta = response.data["meta"]
        assert meta["user_misery_300"] == "number"
        data = response.data["data"]
        assert data[0]["user_misery_300"] == 0

    @requires_not_arm64
    def test_null_user_misery_new_returns_zero(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=2),
            start_timestamp=before_now(minutes=2, seconds=5),
        )
        data["user"] = None
        data["transaction"] = "/no_users/1"
        self.store_event(data, project_id=project.id)
        features = {
            "organizations:discover-basic": True,
        }

        query = {
            "field": ["user_misery()"],
            "query": "event.type:transaction",
        }

        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        meta = response.data["meta"]
        assert meta["user_misery"] == "number"
        data = response.data["data"]
        assert data[0]["user_misery"] == 0

    def test_all_aggregates_in_query(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=2),
            start_timestamp=before_now(minutes=2, seconds=5),
        )
        data["transaction"] = "/failure_rate/1"
        self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["transaction"] = "/failure_rate/2"
        data["contexts"]["trace"]["status"] = "unauthenticated"
        self.store_event(data, project_id=project.id)

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
        assert data[0]["p50"] == 5000
        assert data[0]["p75"] == 5000
        assert data[0]["p95"] == 5000
        assert data[0]["p100"] == 5000
        assert data[0]["percentile_transaction_duration_0_99"] == 5000

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
        assert data[0]["apdex_300"] == 0.0
        assert data[0]["count_miserable_user_300"] == 1
        assert data[0]["user_misery_300"] == 0.058
        assert data[0]["failure_rate"] == 0.5

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
        assert data[0]["count"] == 2
        assert data[0]["count_id"] == 2
        assert data[0]["count_unique_transaction"] == 2

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
        assert data[0]["min_transaction_duration"] == 5000
        assert data[0]["max_transaction_duration"] == 5000
        assert data[0]["avg_transaction_duration"] == 5000
        assert data[0]["sum_transaction_duration"] == 10000
        assert data[0]["stddev_transaction_duration"] == 0.0
        assert data[0]["var_transaction_duration"] == 0.0
        assert data[0]["cov_transaction_duration_transaction_duration"] == 0.0
        assert data[0]["corr_transaction_duration_transaction_duration"] == 0.0

        query = {
            "field": ["event.type", "apdex(400)"],
            "query": "event.type:transaction apdex(400):0",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["apdex_400"] == 0

    def test_functions_in_orderby(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=2),
            start_timestamp=before_now(minutes=2, seconds=5),
        )
        data["transaction"] = "/failure_rate/1"
        self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["transaction"] = "/failure_rate/2"
        data["contexts"]["trace"]["status"] = "unauthenticated"
        event = self.store_event(data, project_id=project.id)

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
        assert data[0]["p75"] == 5000

        query = {
            "field": ["event.type", "percentile(transaction.duration, 0.99)"],
            "sort": "-percentile_transaction_duration_0_99",
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["percentile_transaction_duration_0_99"] == 5000

        query = {
            "field": ["event.type", "apdex(300)"],
            "sort": "-apdex(300)",
            "query": "event.type:transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["apdex_300"] == 0.0

        query = {
            "field": ["event.type", "latest_event()"],
            "query": "event.type:transaction",
            "sort": "latest_event",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["latest_event"] == event.event_id

        query = {
            "field": ["event.type", "count_unique(transaction)"],
            "query": "event.type:transaction",
            "sort": "-count_unique_transaction",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count_unique_transaction"] == 2

        query = {
            "field": ["event.type", "min(transaction.duration)"],
            "query": "event.type:transaction",
            "sort": "-min_transaction_duration",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["min_transaction_duration"] == 5000

    def test_issue_alias_in_aggregate(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.two_min_ago, "fingerprint": ["group_1"]},
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago, "fingerprint": ["group_2"]},
            project_id=project.id,
        )

        query = {"field": ["event.type", "count_unique(issue)"], "query": "count_unique(issue):>1"}
        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count_unique_issue"] == 2

    def test_deleted_issue_in_results(self):
        project = self.create_project()
        event1 = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.two_min_ago, "fingerprint": ["group_1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago, "fingerprint": ["group_2"]},
            project_id=project.id,
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
        project = self.create_project()
        self.store_event(
            data={"event_id": "f" * 32, "timestamp": self.two_min_ago, "fingerprint": ["group_1"]},
            project_id=project.id,
        )

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {"field": ["id", "last_seen()"], "query": "last_seen():-30d"}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["id"] == "f" * 32

    def test_last_seen_aggregate_condition(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "f" * 32, "timestamp": self.two_min_ago, "fingerprint": ["group_1"]},
            project_id=project.id,
        )

        query = {
            "field": ["id", "last_seen()"],
            "query": f"last_seen():>{iso_format(before_now(days=30))}",
        }
        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["id"] == "f" * 32

    def test_conditional_filter(self):
        project = self.create_project()
        for v in ["a", "b"]:
            self.store_event(
                data={
                    "event_id": v * 32,
                    "timestamp": self.two_min_ago,
                    "fingerprint": ["group_1"],
                },
                project_id=project.id,
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
        project = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_1"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "staging",
            },
            project_id=project.id,
        )
        event = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "prod",
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": self.min_ago,
                "fingerprint": ["group_2"],
                "user": {"email": "foo@example.com"},
                "environment": "canary",
            },
            project_id=project.id,
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
        assert data[0]["count_id"] == 2

    def run_test_in_query(self, query, expected_events, expected_negative_events=None):
        params = {
            "field": ["id"],
            "query": query,
            "orderby": "id",
        }
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
                "timestamp": self.min_ago,
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
                "timestamp": self.min_ago,
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
                "timestamp": self.min_ago,
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
        project_1 = self.create_project()
        test_js = self.store_event(
            load_data(
                "javascript",
                timestamp=before_now(minutes=1),
                start_timestamp=before_now(minutes=1, seconds=5),
            ),
            project_id=project_1.id,
        )
        test_java = self.store_event(
            load_data(
                "java",
                timestamp=before_now(minutes=1),
                start_timestamp=before_now(minutes=1, seconds=5),
            ),
            project_id=project_1.id,
        )
        self.run_test_in_query(
            "stack.filename:[../../sentry/scripts/views.js]", [test_js], [test_java]
        )

    def test_in_query_transactions(self):
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["event_id"] = "a" * 32
        data["contexts"]["trace"]["status"] = "ok"
        transaction_1 = self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["event_id"] = "b" * 32
        data["contexts"]["trace"]["status"] = "aborted"
        transaction_2 = self.store_event(data, project_id=project.id)

        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        data["event_id"] = "c" * 32
        data["contexts"]["trace"]["status"] = "already_exists"
        transaction_3 = self.store_event(data, project_id=project.id)

        self.run_test_in_query(
            "transaction.status:[aborted, already_exists]",
            [transaction_2, transaction_3],
            [transaction_1],
        )

    def test_messed_up_function_values(self):
        # TODO (evanh): It would be nice if this surfaced an error to the user.
        # The problem: The && causes the parser to treat that term not as a bad
        # function call but a valid raw search with parens in it. It's not trivial
        # to change the parser to recognize "bad function values" and surface them.
        project = self.create_project()
        for v in ["a", "b"]:
            self.store_event(
                data={
                    "event_id": v * 32,
                    "timestamp": self.two_min_ago,
                    "fingerprint": ["group_1"],
                },
                project_id=project.id,
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
        project = self.create_project()
        event_data = load_data("android")
        transaction_data = load_data("transaction")
        event_data["spans"] = transaction_data["spans"]
        event_data["contexts"]["trace"] = transaction_data["contexts"]["trace"]
        event_data["type"] = "transaction"
        event_data["transaction"] = "/failure_rate/1"
        event_data["timestamp"] = iso_format(before_now(minutes=1))
        event_data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        event_data["user"]["geo"] = {"country_code": "US", "region": "CA", "city": "San Francisco"}
        self.store_event(event_data, project_id=project.id)
        event_data["type"] = "error"
        self.store_event(event_data, project_id=project.id)

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
            assert results[0]["count"] == 1, datum

            for field in fields:
                key, value = field.split(".", 1)
                expected = str(event_data["contexts"][key][value])
                assert results[0][field] == expected, field + str(datum)

    def test_http_fields_between_datasets(self):
        project = self.create_project()
        event_data = load_data("android")
        transaction_data = load_data("transaction")
        event_data["spans"] = transaction_data["spans"]
        event_data["contexts"]["trace"] = transaction_data["contexts"]["trace"]
        event_data["type"] = "transaction"
        event_data["transaction"] = "/failure_rate/1"
        event_data["timestamp"] = iso_format(before_now(minutes=1))
        event_data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        event_data["user"]["geo"] = {"country_code": "US", "region": "CA", "city": "San Francisco"}
        event_data["request"] = transaction_data["request"]
        self.store_event(event_data, project_id=project.id)
        event_data["type"] = "error"
        self.store_event(event_data, project_id=project.id)

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
            assert results[0]["count"] == 1, datum

            for (field, exp) in zip(fields, expected):
                assert results[0][field] == exp, field + str(datum)

    def test_failure_count_alias_field(self):
        project = self.create_project()

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/failure_count/success"
        self.store_event(data, project_id=project.id)

        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = "/failure_count/unknown"
        data["contexts"]["trace"]["status"] = "unknown_error"
        self.store_event(data, project_id=project.id)

        for i in range(6):
            data = load_data("transaction", timestamp=before_now(minutes=1))
            data["transaction"] = f"/failure_count/{i}"
            data["contexts"]["trace"]["status"] = "unauthenticated"
            self.store_event(data, project_id=project.id)

        query = {"field": ["count()", "failure_count()"], "query": "event.type:transaction"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["count"] == 8
        assert data[0]["failure_count"] == 6

    @mock.patch("sentry.utils.snuba.quantize_time")
    def test_quantize_dates(self, mock_quantize):
        self.create_project()
        mock_quantize.return_value = before_now(days=1).replace(tzinfo=utc)

        # Don't quantize short time periods
        query = {"statsPeriod": "1h", "query": "", "field": ["id", "timestamp"]}
        self.do_request(query)

        # Don't quantize absolute date periods
        self.do_request(query)
        query = {
            "start": iso_format(before_now(days=20)),
            "end": iso_format(before_now(days=15)),
            "query": "",
            "field": ["id", "timestamp"],
        }
        self.do_request(query)
        assert len(mock_quantize.mock_calls) == 0

        # Quantize long date periods
        query = {"field": ["id", "timestamp"], "statsPeriod": "90d", "query": ""}
        self.do_request(query)
        assert len(mock_quantize.mock_calls) == 2

    @mock.patch("sentry.snuba.discover.query")
    def test_valid_referrer(self, mock):
        mock.return_value = {}
        project = self.create_project()
        data = load_data("transaction", timestamp=before_now(hours=1))
        self.store_event(data=data, project_id=project.id)

        query = {
            "field": ["user"],
            "referrer": "api.performance.transaction-summary",
        }
        self.do_request(query)
        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], "api.performance.transaction-summary")

    @mock.patch("sentry.snuba.discover.query")
    def test_invalid_referrer(self, mock):
        mock.return_value = {}
        project = self.create_project()
        data = load_data("transaction", timestamp=before_now(hours=1))
        self.store_event(data=data, project_id=project.id)

        query = {
            "field": ["user"],
            "referrer": "api.performance.invalid",
        }
        self.do_request(query)
        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], "api.organization-events-v2")

    @mock.patch("sentry.snuba.discover.query")
    def test_empty_referrer(self, mock):
        mock.return_value = {}
        project = self.create_project()
        data = load_data("transaction", timestamp=before_now(hours=1))
        self.store_event(data=data, project_id=project.id)

        query = {
            "field": ["user"],
        }
        self.do_request(query)
        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], "api.organization-events-v2")

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
        project = self.create_project()
        data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=5),
        )
        self.store_event(data, project_id=project.id)

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
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        meta = response.data["meta"]
        assert meta["percentile_transaction_duration_0_95"] == "duration"
        assert meta["percentile_measurements_fp_0_95"] == "duration"
        assert meta["percentile_measurements_fcp_0_95"] == "duration"
        assert meta["percentile_measurements_lcp_0_95"] == "duration"
        assert meta["percentile_measurements_fid_0_95"] == "duration"
        assert meta["percentile_measurements_ttfb_0_95"] == "duration"
        assert meta["percentile_measurements_ttfb_requesttime_0_95"] == "duration"
        assert meta["percentile_measurements_cls_0_95"] == "number"
        assert meta["percentile_measurements_foo_0_95"] == "number"
        assert meta["percentile_measurements_bar_0_95"] == "number"

    def test_count_at_least_query(self):
        self.store_event(self.transaction_data, self.project.id)

        response = self.do_request({"field": "count_at_least(measurements.fcp, 0)"})
        assert response.status_code == 200
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["count_at_least_measurements_fcp_0"] == 1

        # a value that's a little bigger than the stored fcp
        fcp = int(self.transaction_data["measurements"]["fcp"]["value"] + 1)
        response = self.do_request({"field": f"count_at_least(measurements.fcp, {fcp})"})
        assert response.status_code == 200
        assert len(response.data["data"]) == 1
        assert response.data["data"][0][f"count_at_least_measurements_fcp_{fcp}"] == 0

    def test_measurements_query(self):
        self.store_event(self.transaction_data, self.project.id)
        query = {
            "field": [
                "measurements.fp",
                "measurements.fcp",
                "measurements.lcp",
                "measurements.fid",
            ]
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
            ]
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
        query = {
            "field": [
                "percentile(measurements.fcp, 0.5)",
                "count_unique(measurements.fcp)",
                "min(measurements.fcp)",
                "max(measurements.fcp)",
                "avg(measurements.fcp)",
                "sum(measurements.fcp)",
            ],
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert (
            response.data["data"][0]["percentile_measurements_fcp_0_5"]
            == self.transaction_data["measurements"]["fcp"]["value"]
        )
        assert response.data["data"][0]["count_unique_measurements_fcp"] == 1
        assert (
            response.data["data"][0]["min_measurements_fcp"]
            == self.transaction_data["measurements"]["fcp"]["value"]
        )
        assert (
            response.data["data"][0]["max_measurements_fcp"]
            == self.transaction_data["measurements"]["fcp"]["value"]
        )
        assert (
            response.data["data"][0]["avg_measurements_fcp"]
            == self.transaction_data["measurements"]["fcp"]["value"]
        )
        assert (
            response.data["data"][0]["sum_measurements_fcp"]
            == self.transaction_data["measurements"]["fcp"]["value"]
        )

    def get_measurement_condition_response(self, query_str, field):
        query = {
            "field": ["transaction", "count()"] + (field if field else []),
            "query": query_str,
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        return response

    def assert_measurement_condition_without_results(self, query_str, field=None):
        response = self.get_measurement_condition_response(query_str, field)
        assert len(response.data["data"]) == 0

    def assert_measurement_condition_with_results(self, query_str, field=None):
        response = self.get_measurement_condition_response(query_str, field)
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["transaction"] == self.transaction_data["metadata"]["title"]
        assert response.data["data"][0]["count"] == 1

    def test_measurements_conditions(self):
        self.store_event(self.transaction_data, self.project.id)

        fcp = self.transaction_data["measurements"]["fcp"]["value"]

        # equality condition
        # We use json dumps here to ensure precision when converting from float to str
        # This is necessary because equality on floating point values need to be precise
        self.assert_measurement_condition_with_results(f"measurements.fcp:{json.dumps(fcp)}")

        # greater than condition
        self.assert_measurement_condition_with_results(f"measurements.fcp:>{fcp - 1}")
        self.assert_measurement_condition_without_results(f"measurements.fcp:>{fcp + 1}")

        # less than condition
        self.assert_measurement_condition_with_results(f"measurements.fcp:<{fcp + 1}")
        self.assert_measurement_condition_without_results(f"measurements.fcp:<{fcp - 1}")

        # has condition
        self.assert_measurement_condition_with_results("has:measurements.fcp")
        self.assert_measurement_condition_without_results("!has:measurements.fcp")

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

        for function in functions:
            self.assert_measurement_condition_with_results(
                f"{function}:>{fcp - 1}", field=[function]
            )
            self.assert_measurement_condition_without_results(
                f"{function}:>{fcp + 1}", field=[function]
            )
            self.assert_measurement_condition_with_results(
                f"{function}:<{fcp + 1}", field=[function]
            )
            self.assert_measurement_condition_without_results(
                f"{function}:<{fcp - 1}", field=[function]
            )

        count_unique = "count_unique(measurements.fcp)"
        self.assert_measurement_condition_with_results(f"{count_unique}:1", field=[count_unique])
        self.assert_measurement_condition_without_results(f"{count_unique}:0", field=[count_unique])

    def test_compare_numeric_aggregate(self):
        self.store_event(self.transaction_data, self.project.id)

        query = {
            "field": [
                "p75(measurements.fcp)",
                "compare_numeric_aggregate(p75_measurements_fcp,greater,0)",
            ],
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert (
            response.data["data"][0]["compare_numeric_aggregate_p75_measurements_fcp_greater_0"]
            == 1
        )

        query = {
            "field": ["p75()", "compare_numeric_aggregate(p75,equals,0)"],
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["compare_numeric_aggregate_p75_equals_0"] == 0

    def test_no_team_key_transactions(self):
        transactions = [
            "/blah_transaction/",
            "/foo_transaction/",
            "/zoo_transaction/",
        ]

        for transaction in transactions:
            self.transaction_data["transaction"] = transaction
            self.store_event(self.transaction_data, self.project.id)

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
            "sentry.search.events.datasets.discover.MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS",
            MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS,
        ):
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
            data={"event_id": "a" * 32, "timestamp": self.min_ago, "fingerprint": ["group1"]},
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
        assert response.data["data"][0]["apdex_300"] == 0

    def test_equation_simple(self):
        event_data = load_data("transaction", timestamp=before_now(minutes=1))
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 1500
        self.store_event(data=event_data, project_id=self.project.id)

        query = {
            "field": ["spans.http", "equation|spans.http / 3"],
            "project": [self.project.id],
            "query": "event.type:transaction",
        }
        response = self.do_request(
            query,
            {
                "organizations:discover-basic": True,
            },
        )
        assert response.status_code == 200
        assert len(response.data["data"]) == 1
        assert (
            response.data["data"][0]["equation[0]"]
            == event_data["breakdowns"]["span_ops"]["ops.http"]["value"] / 3
        )

    def test_equation_sort(self):
        event_data = load_data("transaction", timestamp=before_now(minutes=1))
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 1500
        self.store_event(data=event_data, project_id=self.project.id)

        event_data2 = load_data("transaction", timestamp=before_now(minutes=1))
        event_data2["breakdowns"]["span_ops"]["ops.http"]["value"] = 2000
        self.store_event(data=event_data2, project_id=self.project.id)

        query = {
            "field": ["spans.http", "equation|spans.http / 3"],
            "project": [self.project.id],
            "orderby": "equation[0]",
            "query": "event.type:transaction",
        }
        response = self.do_request(
            query,
            {
                "organizations:discover-basic": True,
            },
        )
        assert response.status_code == 200
        assert len(response.data["data"]) == 2
        assert (
            response.data["data"][0]["equation[0]"]
            == event_data["breakdowns"]["span_ops"]["ops.http"]["value"] / 3
        )
        assert (
            response.data["data"][1]["equation[0]"]
            == event_data2["breakdowns"]["span_ops"]["ops.http"]["value"] / 3
        )

    def test_equation_operation_limit(self):
        query = {
            "field": ["spans.http", f"equation|spans.http{' * 2' * 11}"],
            "project": [self.project.id],
            "query": "event.type:transaction",
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
        query = {
            "field": ["spans.http", "transaction.duration", "equation|5 * 2"],
            "project": [self.project.id],
            "query": "event.type:transaction",
        }
        response = self.do_request(
            query,
            {
                "organizations:discover-basic": True,
            },
        )

        assert response.status_code == 400

    def test_count_if(self):
        for i in range(5):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + i)),
                start_timestamp=before_now(minutes=(1 + i), milliseconds=100 if i < 3 else 200),
            )
            data["tags"] = {"sub_customer.is-Enterprise-42": "yes" if i == 0 else "no"}
            self.store_event(data, project_id=self.project.id)

        query = {
            "field": [
                "count_if(transaction.duration, less, 150)",
                "count_if(transaction.duration, greater, 150)",
                "count_if(sub_customer.is-Enterprise-42, equals, yes)",
                "count_if(sub_customer.is-Enterprise-42, notEquals, yes)",
            ],
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1

        assert response.data["data"][0]["count_if_transaction_duration_less_150"] == 3
        assert response.data["data"][0]["count_if_transaction_duration_greater_150"] == 2

        assert response.data["data"][0]["count_if_sub_customer_is_Enterprise_42_equals_yes"] == 1
        assert response.data["data"][0]["count_if_sub_customer_is_Enterprise_42_notEquals_yes"] == 4

    def test_count_if_filter(self):
        for i in range(5):
            data = load_data(
                "transaction",
                timestamp=before_now(minutes=(1 + i)),
                start_timestamp=before_now(minutes=(1 + i), milliseconds=100 if i < 3 else 200),
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

        assert response.data["data"][0]["count_if_transaction_duration_less_150"] == 3

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
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = r"/:a*/:b-:c(\d\.\e+)"
        self.store_event(data, project_id=self.project.id)

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
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["transaction"] = r"a\b\c@d"
        self.store_event(data, project_id=self.project.id)

        query = {
            "field": ["transaction", "transaction.duration"],
            "query": r'transaction:"a\b\c@d"',
            "project": [self.project.id],
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert len(response.data["data"]) == 1

    def test_mobile_measurements(self):
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data["measurements"]["frames_total"] = {"value": 100}
        data["measurements"]["frames_slow"] = {"value": 10}
        data["measurements"]["frames_frozen"] = {"value": 5}
        data["measurements"]["stall_count"] = {"value": 2}
        data["measurements"]["stall_total_time"] = {"value": 12}
        data["measurements"]["stall_longest_time"] = {"value": 7}
        self.store_event(data, project_id=self.project.id)

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
        meta = response.data["meta"]
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
        assert data[0]["p75_measurements_frames_slow_rate"] == 0.1
        assert data[0]["p75_measurements_frames_frozen_rate"] == 0.05
        assert data[0]["p75_measurements_stall_percentage"] == 0.004
        assert data[0]["percentile_measurements_frames_slow_rate_0_5"] == 0.1
        assert data[0]["percentile_measurements_frames_frozen_rate_0_5"] == 0.05
        assert data[0]["percentile_measurements_stall_percentage_0_5"] == 0.004
        meta = response.data["meta"]
        assert meta["p75_measurements_frames_slow_rate"] == "percentage"
        assert meta["p75_measurements_frames_frozen_rate"] == "percentage"
        assert meta["p75_measurements_stall_percentage"] == "percentage"
        assert meta["percentile_measurements_frames_slow_rate_0_5"] == "percentage"
        assert meta["percentile_measurements_stall_percentage_0_5"] == "percentage"

    def test_project_auto_fields(self):
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        query = {"field": ["environment"]}
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["environment"] == "staging"
        assert response.data["data"][0]["project.name"] == project.slug


class OrganizationEventsV2EndpointTestWithSnql(OrganizationEventsV2EndpointTest):
    def setUp(self):
        super().setUp()
        self.features["organizations:discover-use-snql"] = True

    def test_timestamp_different_from_params(self):
        project = self.create_project()
        fifteen_days_ago = iso_format(before_now(days=15))
        fifteen_days_later = iso_format(before_now(days=-15))

        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(minutes=5)),
                "fingerprint": ["1123581321"],
                "user": {"email": "foo@example.com"},
                "tags": {"language": "C++"},
            },
            project_id=project.id,
        )

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
            }
            response = self.do_request(query)

            assert response.status_code == 400, query_text

    @mock.patch("sentry.search.events.builder.raw_snql_query")
    def test_removes_unnecessary_default_project_and_transaction_thresholds(self, mock_snql_query):
        mock_snql_query.side_effect = [{"meta": {}, "data": []}]

        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.organization,
            # these are the default values that we use
            threshold=DEFAULT_PROJECT_THRESHOLD,
            metric=TransactionMetric.DURATION.value,
        )
        ProjectTransactionThresholdOverride.objects.create(
            transaction="transaction",
            project=self.project,
            organization=self.organization,
            # these are the default values that we use
            threshold=DEFAULT_PROJECT_THRESHOLD,
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
            in mock_snql_query.call_args_list[0][0][0].select
        )

    @mock.patch("sentry.search.events.builder.raw_snql_query")
    def test_removes_unnecessary_default_project_and_transaction_thresholds_keeps_others(
        self, mock_snql_query
    ):
        mock_snql_query.side_effect = [{"meta": {}, "data": []}]

        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.organization,
            # these are the default values that we use
            threshold=DEFAULT_PROJECT_THRESHOLD,
            metric=TransactionMetric.DURATION.value,
        )
        ProjectTransactionThresholdOverride.objects.create(
            transaction="transaction",
            project=self.project,
            organization=self.organization,
            # these are the default values that we use
            threshold=DEFAULT_PROJECT_THRESHOLD,
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
            in mock_snql_query.call_args_list[0][0][0].select
        )
