from __future__ import absolute_import

import six
import random
import mock

from pytz import utc
from datetime import timedelta
from math import ceil

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now, iso_format

from sentry.utils.samples import load_data
from sentry.utils.compat.mock import patch
from sentry.utils.compat import zip
from sentry.utils.snuba import RateLimitExceeded, QueryIllegalTypeOfArgument, QueryExecutionError


class OrganizationEventsV2EndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsV2EndpointTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.two_min_ago = iso_format(before_now(minutes=2))

    def do_request(self, query, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
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

    @patch("sentry.snuba.discover.raw_query")
    def test_handling_snuba_errors(self, mock_query):
        mock_query.side_effect = RateLimitExceeded("test")

        project = self.create_project()

        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast"}, project_id=project.id
        )

        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Query timeout. Please try again. If the problem persists try a smaller date range or fewer projects."
        )

        mock_query.side_effect = QueryExecutionError("test")

        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Internal error. Your query failed to run."

        mock_query.side_effect = QueryIllegalTypeOfArgument("test")

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
            == "Invalid query. Project %s does not exist or is not an actively selected project."
            % project.slug
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
            == "Invalid query. Project morty does not exist or is not an actively selected project."
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
            "query": "!project:{}".format(project2.slug),
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
            "query": "!project:{}".format(project2.slug),
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
                "query": "{}:{}".format(field, value),
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

    def test_has_issue(self):
        project = self.create_project()
        event = self.store_event(
            {"timestamp": iso_format(before_now(minutes=1))}, project_id=project.id
        )

        data = load_data("transaction", timestamp=before_now(minutes=1))
        self.store_event(data, project_id=project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {"field": ["project", "issue"], "query": "has:issue", "statsPeriod": "14d"}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == event.group.qualified_short_id

        query = {"field": ["project", "issue"], "query": "!has:issue", "statsPeriod": "14d"}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["issue"] == "unknown"

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
        assert "order by" in response.data["detail"]

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
            data["transaction"] = "/failure_rate/{}".format(i)
            data["contexts"]["trace"]["status"] = "unauthenticated"
            self.store_event(data, project_id=project.id)

        query = {"field": ["failure_rate()"], "query": "event.type:transaction"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["failure_rate"] == 0.75

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
            data["event_id"] = "{}".format(idx) * 32
            data["transaction"] = "/user_misery/horribilis/{}".format(idx)
            data["user"] = {"email": "{}@example.com".format(event[0])}
            self.store_event(data, project_id=project.id)
        query = {"field": ["user_misery(300)"], "query": "event.type:transaction"}
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["user_misery_300"] == 2

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
        assert data[0]["count_sub_customer_is-Enterprise-42"] == 1
        assert data[1]["count_sub_customer_is-Enterprise-42"] == 3

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
        response.data["meta"]["max_timestamp"] == "date"
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
            "query": "!issue:{}".format(event1.group.qualified_short_id),
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
        result = set([r["user.display"] for r in data])
        assert result == set(["catherine", "cathy@example.com"])

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
        result = set([r["user.display"] for r in data])
        assert result == set(["cathy@example.com"])

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

        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p50"] == 5000
        assert data[0]["p75"] == 5000
        assert data[0]["p95"] == 5000
        assert data[0]["p99"] == 5000
        assert data[0]["p100"] == 5000
        assert data[0]["percentile_transaction_duration_0_99"] == 5000
        assert data[0]["apdex_300"] == 0.0
        assert data[0]["user_misery_300"] == 1
        assert data[0]["failure_rate"] == 0.5

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
        assert data[0]["sum_transaction_duration"] == 10000

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
            "field": ["event.type", "apdex(300)", "user_misery(300)", "failure_rate()"],
            "query": "event.type:transaction apdex(300):>-1.0 failure_rate():>0.25",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["apdex_300"] == 0.0
        assert data[0]["user_misery_300"] == 1
        assert data[0]["failure_rate"] == 0.5

        query = {
            "field": ["event.type", "last_seen()", "latest_event()"],
            "query": u"event.type:transaction last_seen():>1990-12-01T00:00:00",
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
            ],
            "query": "event.type:transaction min(transaction.duration):>1000 max(transaction.duration):>1000 avg(transaction.duration):>1000 sum(transaction.duration):>1000",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["min_transaction_duration"] == 5000
        assert data[0]["max_transaction_duration"] == 5000
        assert data[0]["avg_transaction_duration"] == 5000
        assert data[0]["sum_transaction_duration"] == 10000

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
            "query": u"event.type:transaction",
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
        query = {"field": ["issue", "count()"], "sort": "issue"}
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
            "query": "last_seen():>{}".format(iso_format(before_now(days=30))),
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
                expected = six.text_type(event_data["contexts"][key][value])
                assert results[0][field] == expected, field + six.text_type(datum)

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
                assert results[0][field] == exp, field + six.text_type(datum)

    def test_histogram_function(self):
        project = self.create_project()
        start = before_now(minutes=2).replace(microsecond=0)
        latencies = [
            (1, 500, 5),
            (1000, 1500, 4),
            (3000, 3500, 3),
            (6000, 6500, 2),
            (10000, 10000, 1),  # just to make the math easy
        ]
        values = []
        for bucket in latencies:
            for i in range(bucket[2]):
                # Don't generate a wide range of variance as the buckets can mis-align.
                milliseconds = random.randint(bucket[0], bucket[1])
                values.append(milliseconds)
                data = load_data("transaction")
                data["transaction"] = "/failure_rate/{}".format(milliseconds)
                data["timestamp"] = iso_format(start)
                data["start_timestamp"] = (start - timedelta(milliseconds=milliseconds)).isoformat()
                self.store_event(data, project_id=project.id)

        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        query = {
            "field": ["histogram(transaction.duration, 10)", "count()"],
            "query": "event.type:transaction",
            "sort": "histogram_transaction_duration_10",
        }
        response = self.do_request(query, features=features)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 11
        bucket_size = ceil((max(values) - min(values)) / 10.0)
        expected = [
            (0, 5),
            (bucket_size, 4),
            (bucket_size * 2, 0),
            (bucket_size * 3, 3),
            (bucket_size * 4, 0),
            (bucket_size * 5, 0),
            (bucket_size * 6, 2),
            (bucket_size * 7, 0),
            (bucket_size * 8, 0),
            (bucket_size * 9, 0),
            (bucket_size * 10, 1),
        ]
        for idx, datum in enumerate(data):
            assert datum["histogram_transaction_duration_10"] == expected[idx][0]
            assert datum["count"] == expected[idx][1]

    def test_histogram_function_with_filters(self):
        project = self.create_project()
        start = before_now(minutes=2).replace(microsecond=0)
        latencies = [
            (1, 500, 5),
            (1000, 1500, 4),
            (3000, 3500, 3),
            (6000, 6500, 2),
            (10000, 10000, 1),  # just to make the math easy
        ]
        values = []
        for bucket in latencies:
            for i in range(bucket[2]):
                milliseconds = random.randint(bucket[0], bucket[1])
                values.append(milliseconds)
                data = load_data("transaction")
                data["transaction"] = "/failure_rate/sleepy_gary/{}".format(milliseconds)
                data["timestamp"] = iso_format(start)
                data["start_timestamp"] = (start - timedelta(milliseconds=milliseconds)).isoformat()
                self.store_event(data, project_id=project.id)

        # Add a transaction that totally throws off the buckets
        milliseconds = random.randint(bucket[0], bucket[1])
        data = load_data("transaction")
        data["transaction"] = "/failure_rate/hamurai"
        data["timestamp"] = iso_format(start)
        data["start_timestamp"] = iso_format(start - timedelta(milliseconds=1000000))
        self.store_event(data, project_id=project.id)

        query = {
            "field": ["histogram(transaction.duration, 10)", "count()"],
            "query": "event.type:transaction transaction:/failure_rate/sleepy_gary*",
            "sort": "histogram_transaction_duration_10",
        }
        features = {"organizations:discover-basic": True, "organizations:global-views": True}
        response = self.do_request(query, features=features)

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 11
        bucket_size = ceil((max(values) - min(values)) / 10.0)
        expected = [
            (0, 5),
            (bucket_size, 4),
            (bucket_size * 2, 0),
            (bucket_size * 3, 3),
            (bucket_size * 4, 0),
            (bucket_size * 5, 0),
            (bucket_size * 6, 2),
            (bucket_size * 7, 0),
            (bucket_size * 8, 0),
            (bucket_size * 9, 0),
            (bucket_size * 10, 1),
        ]
        for idx, datum in enumerate(data):
            assert datum["histogram_transaction_duration_10"] == expected[idx][0]
            assert datum["count"] == expected[idx][1]

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
