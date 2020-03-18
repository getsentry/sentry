from __future__ import absolute_import

import six
import pytest
import random
from datetime import timedelta

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now, iso_format

from sentry.utils.samples import load_data
from sentry.utils.compat.mock import patch
from sentry.utils.snuba import (
    RateLimitExceeded,
    QueryOutsideRetentionError,
    QueryIllegalTypeOfArgument,
    QueryExecutionError,
)


class OrganizationEventsV2EndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsV2EndpointTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.two_min_ago = iso_format(before_now(minutes=2))
        self.url = reverse(
            "sentry-api-0-organization-eventsv2",
            kwargs={"organization_slug": self.organization.slug},
        )

    def test_no_projects(self):
        self.login_as(user=self.user)
        with self.feature("organizations:discover-basic"):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_multi_project_feature_gate_rejection(self):
        self.login_as(user=self.user)
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
        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": False}
        ):
            response = self.client.get(self.url, query, format="json")
        assert response.status_code == 400
        assert "events from multiple projects" in response.data["detail"]

    def test_invalid_search_terms(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast", "timestamp": self.min_ago},
            project_id=project.id,
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url, {"field": ["id"], "query": "hi \n there"}, format="json"
            )

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Parse error at 'hi \n ther' (column 4). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_handling_snuba_errors(self, mock_query):
        mock_query.side_effect = RateLimitExceeded("test")

        self.login_as(user=self.user)
        project = self.create_project()

        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast"}, project_id=project.id
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Query timeout. Please try again. If the problem persists try a smaller date range or fewer projects."
        )

        mock_query.side_effect = QueryExecutionError("test")
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Internal error. Your query failed to run."

        mock_query.side_effect = QueryIllegalTypeOfArgument("test")
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Invalid query. Argument to function is wrong type."

        mock_query.side_effect = QueryOutsideRetentionError("test")
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Invalid date range. Please try a more recent date range."

    def test_raw_data(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["id", "project.id", "user.email", "user.ip", "timestamp"],
                    "orderby": "-timestamp",
                },
            )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["id"] == "b" * 32
        assert data[0]["project.id"] == project.id
        assert data[0]["user.email"] == "foo@example.com"
        meta = response.data["meta"]
        assert meta["id"] == "string"
        assert meta["user.email"] == "string"
        assert meta["user.ip"] == "string"
        assert meta["timestamp"] == "date"

    def test_project_name(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url, format="json", data={"field": ["project.name", "environment"]}
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project.name"] == project.slug
        assert "project.id" not in response.data["data"][0]
        assert response.data["data"][0]["environment"] == "staging"

    def test_project_without_name(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url, format="json", data={"field": ["project", "environment"]}
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == project.slug
        assert response.data["meta"]["project"] == "string"
        assert "project.id" not in response.data["data"][0]
        assert response.data["data"][0]["environment"] == "staging"

    def test_project_in_query(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["project", "count()"],
                    "query": 'project:"%s"' % project.slug,
                    "statsPeriod": "14d",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == project.slug
        assert "project.id" not in response.data["data"][0]

    def test_project_in_query_not_in_header(self):
        self.login_as(user=self.user)
        project = self.create_project()
        other_project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["project", "count()"],
                    "query": 'project:"%s"' % project.slug,
                    "statsPeriod": "14d",
                    "project": other_project.id,
                },
            )

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Invalid query. Project %s does not exist or is not an actively selected project."
            % project.slug
        )

    def test_project_in_query_does_not_exist(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=project.id,
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["project", "count()"],
                    "query": "project:morty",
                    "statsPeriod": "14d",
                },
            )

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Invalid query. Project morty does not exist or is not an actively selected project."
        )

    def test_user_search(self):
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("transaction")
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        data["user"] = {
            "email": "foo@example.com",
            "id": "123",
            "ip_address": "127.0.0.1",
            "username": "foo",
        }
        self.store_event(data, project_id=project.id)

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            for value in data["user"].values():
                response = self.client.get(
                    self.url,
                    format="json",
                    data={
                        "field": ["project", "user"],
                        "query": "user:{}".format(value),
                        "statsPeriod": "14d",
                    },
                )

                assert response.status_code == 200, response.content
                assert len(response.data["data"]) == 1
                assert response.data["data"][0]["user.email"] == data["user"]["email"]
                assert response.data["data"][0]["user.id"] == data["user"]["id"]
                assert response.data["data"][0]["user.ip"] == data["user"]["ip_address"]
                assert response.data["data"][0]["user.username"] == data["user"]["username"]

    def test_has_user(self):
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("transaction")
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        self.store_event(data, project_id=project.id)

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            for value in data["user"].values():
                response = self.client.get(
                    self.url,
                    format="json",
                    data={"field": ["project", "user"], "query": "has:user", "statsPeriod": "14d"},
                )

                assert response.status_code == 200, response.content
                assert len(response.data["data"]) == 1
                assert response.data["data"][0]["user.ip"] == data["user"]["ip_address"]

    def test_not_project_in_query(self):
        self.login_as(user=self.user)
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

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["project", "count()"],
                    "query": '!project:"%s"' % project1.slug,
                    "statsPeriod": "14d",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project"] == project2.slug
        assert "project.id" not in response.data["data"][0]

    def test_implicit_groupby(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={"field": ["count(id)", "project.id", "issue.id"], "orderby": "issue.id"},
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0] == {
            "project.id": project.id,
            "project.name": project.slug,
            "issue.id": event1.group_id,
            "count_id": 2,
            "latest_event": event1.event_id,
        }
        assert data[1] == {
            "project.id": project.id,
            "project.name": project.slug,
            "issue.id": event2.group_id,
            "count_id": 1,
            "latest_event": event2.event_id,
        }
        meta = response.data["meta"]
        assert meta["count_id"] == "integer"

    def test_automatic_id_and_project(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.two_min_ago, "fingerprint": ["group_1"]},
            project_id=project.id,
        )
        event = self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago, "fingerprint": ["group_1"]},
            project_id=project.id,
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(self.url, format="json", data={"field": ["count(id)"]})

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0] == {
            "project.name": project.slug,
            "count_id": 2,
            "latest_event": event.event_id,
        }
        meta = response.data["meta"]
        assert meta["count_id"] == "integer"
        assert meta["latest_event"] == "string"

    def test_orderby(self):
        self.login_as(user=self.user)
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
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]},
            )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0]["id"] == "c" * 32
        assert data[1]["id"] == "b" * 32
        assert data[2]["id"] == "a" * 32

    def test_sort_title(self):
        self.login_as(user=self.user)
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
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url, format="json", data={"field": ["id", "title"], "sort": "title"}
            )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0]["id"] == "c" * 32
        assert data[1]["id"] == "b" * 32
        assert data[2]["id"] == "a" * 32

    def test_sort_invalid(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.two_min_ago}, project_id=project.id
        )
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url, format="json", data={"field": ["id"], "sort": "garbage"}
            )
        assert response.status_code == 400
        assert "order by" in response.content

    def test_aliased_fields(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["issue.id", "issue_title", "count(id)", "count_unique(user)"],
                    "orderby": "issue.id",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["issue.id"] == event1.group_id
        assert data[0]["count_id"] == 1
        assert data[0]["count_unique_user"] == 1
        assert "latest_event" in data[0]
        assert "project.name" in data[0]
        assert "projectid" not in data[0]
        assert "project.id" not in data[0]
        assert data[1]["issue.id"] == event2.group_id
        assert data[1]["count_id"] == 2
        assert data[1]["count_unique_user"] == 2

    def test_aggregate_field_with_dotted_param(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["issue.id", "issue_title", "count(id)", "count_unique(user.email)"],
                    "orderby": "issue.id",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["issue.id"] == event1.group_id
        assert data[0]["count_id"] == 1
        assert data[0]["count_unique_user_email"] == 1
        assert "latest_event" in data[0]
        assert "project.name" in data[0]
        assert "projectid" not in data[0]
        assert "project.id" not in data[0]
        assert data[1]["issue.id"] == event2.group_id
        assert data[1]["count_id"] == 2
        assert data[1]["count_unique_user_email"] == 2

    def test_error_rate_alias_field(self):
        self.login_as(user=self.user)
        project = self.create_project()
        data = load_data("transaction")
        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        event = self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        data["contexts"]["trace"]["status"] = "unauthenticated"
        self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        data["contexts"]["trace"]["status"] = "unauthenticated"
        self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        data["contexts"]["trace"]["status"] = "unauthenticated"
        self.store_event(data, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={"field": ["transaction", "error_rate()"], "query": "event.type:transaction"},
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == event.transaction
        assert data[0]["error_rate"] == 0.75

    def test_aggregation(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": [
                        "sub_customer.is-Enterprise-42",
                        "count(sub_customer.is-Enterprise-42)",
                    ],
                    "orderby": "sub_customer.is-Enterprise-42",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["count_sub_customer_is-Enterprise-42"] == 1
        assert data[1]["count_sub_customer_is-Enterprise-42"] == 3

    def test_aggregation_comparison(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["issue.id", "count(id)", "count_unique(user)"],
                    "query": "count(id):>1 count_unique(user):>1",
                    "orderby": "issue.id",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["issue.id"] == event.group_id
        assert data[0]["count_id"] == 2
        assert data[0]["count_unique_user"] == 2

    def test_aggregation_alias_comparison(self):
        self.login_as(user=self.user)
        project = self.create_project()
        data = load_data("transaction")
        data["transaction"] = "/aggregates/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/aggregates/2"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=3))
        event = self.store_event(data, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["transaction", "p95"],
                    "query": "event.type:transaction p95:<4000",
                    "orderby": ["transaction"],
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == event.transaction
        assert data[0]["p95"] == 3000

    def test_aggregation_alias_comparison_with_brackets(self):
        self.login_as(user=self.user)
        project = self.create_project()
        data = load_data("transaction")
        data["transaction"] = "/aggregates/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/aggregates/2"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=3))
        event = self.store_event(data, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["transaction", "p95()"],
                    "query": "event.type:transaction p95():<4000",
                    "orderby": ["transaction"],
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == event.transaction
        assert data[0]["p95"] == 3000

    def test_aggregation_comparison_with_conditions(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["issue.id", "count(id)"],
                    "query": "count(id):>1 user.email:foo@example.com environment:prod",
                    "orderby": "issue.id",
                },
            )

        assert response.status_code == 200, response.content

        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["issue.id"] == event.group_id
        assert data[0]["count_id"] == 2

    def test_aggregation_date_comparison_with_conditions(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["issue.id", "max(timestamp)"],
                    "query": "max(timestamp):>1 user.email:foo@example.com environment:prod",
                    "orderby": "issue.id",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["issue.id"] == event.group_id

    def test_percentile_function(self):
        self.login_as(user=self.user)
        project = self.create_project()
        data = load_data("transaction")
        data["transaction"] = "/aggregates/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        event1 = self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/aggregates/2"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=3))
        event2 = self.store_event(data, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["transaction", "percentile(transaction.duration, 0.95)"],
                    "query": "event.type:transaction",
                    "orderby": ["transaction"],
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["transaction"] == event1.transaction
        assert data[0]["percentile_transaction_duration_0_95"] == 5000
        assert data[1]["transaction"] == event2.transaction
        assert data[1]["percentile_transaction_duration_0_95"] == 3000

    def test_percentile_function_as_condition(self):
        self.login_as(user=self.user)
        project = self.create_project()
        data = load_data("transaction")
        data["transaction"] = "/aggregates/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        event1 = self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/aggregates/2"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=3))
        self.store_event(data, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["transaction", "percentile(transaction.duration, 0.95)"],
                    "query": "event.type:transaction percentile(transaction.duration, 0.95):>4000",
                    "orderby": ["transaction"],
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == event1.transaction
        assert data[0]["percentile_transaction_duration_0_95"] == 5000

    def test_rpm_function(self):
        self.login_as(user=self.user)
        project = self.create_project()

        data = load_data("transaction")
        data["transaction"] = "/aggregates/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        event1 = self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/aggregates/2"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=3))
        event2 = self.store_event(data, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["transaction", "rpm()"],
                    "query": "event.type:transaction",
                    "orderby": ["transaction"],
                    "statsPeriod": "2m",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        assert data[0]["transaction"] == event1.transaction
        assert data[0]["rpm"] == 0.5
        assert data[1]["transaction"] == event2.transaction
        assert data[1]["rpm"] == 0.5

    def test_nonexistent_fields(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast", "timestamp": self.min_ago},
            project_id=project.id,
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(self.url, format="json", data={"field": ["issue_world.id"]})
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["issue_world.id"] == ""

    def test_no_requested_fields_or_grouping(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "message": "how to make fast", "timestamp": self.min_ago},
            project_id=project.id,
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(self.url, format="json", data={"query": "test"})
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "No columns selected"

    def test_condition_on_aggregate_misses(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={"field": ["issue.id"], "query": "event_count:>0", "orderby": "issue.id"},
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_next_prev_link_headers(self):
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["count(id)", "issue.id", "context.key"],
                    "sort": "-count_id",
                    "query": "language:C++",
                },
            )

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
        self.login_as(user=self.user)
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["count()"],
                    "query": "issue.id:%d timestamp:>%s" % (event.group_id, self.min_ago),
                    "statsPeriod": "14d",
                },
            )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["project.name"] == ""
        assert data[0]["count"] == 0
        assert data[0]["latest_event"] == ""

    def test_reference_event(self):
        self.login_as(user=self.user)

        project = self.create_project()
        reference = self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": self.two_min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "transaction": "/example",
                "message": "how to make more faster?",
                "timestamp": self.min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "transaction": "/nomatch",
                "message": "how to make fast",
                "timestamp": self.min_ago,
            },
            project_id=project.id,
        )
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["transaction", "count()"],
                    "query": "",
                    "referenceEvent": "{}:{}".format(project.slug, reference.event_id),
                },
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["transaction"] == "/example"
        assert data[0]["latest_event"] == "b" * 32

    def test_stack_wildcard_condition(self):
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("javascript")
        data["timestamp"] = self.min_ago
        self.store_event(data=data, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={"field": ["stack.filename", "message"], "query": "stack.filename:*.js"},
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["message"] == "string"

    def test_transaction_event_type(self):
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("transaction")
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        self.store_event(data=data, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["transaction", "transaction.duration", "transaction.status"],
                    "query": "event.type:transaction",
                },
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["transaction.duration"] == "duration"
        assert response.data["meta"]["transaction.status"] == "string"
        assert response.data["data"][0]["transaction.status"] == "ok"

    def test_trace_columns(self):
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("transaction")
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        self.store_event(data=data, project_id=project.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={"field": ["trace"], "query": "event.type:transaction"},
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["meta"]["trace"] == "string"
        assert response.data["data"][0]["trace"] == data["contexts"]["trace"]["trace_id"]

    def test_issue_in_columns(self):
        self.login_as(user=self.user)

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

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url, format="json", data={"field": ["id", "issue"], "orderby": ["id"]}
            )

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
        self.login_as(user=self.user)

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

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            for testdata in tests:
                response = self.client.get(
                    self.url, format="json", data={"field": [testdata[0]], "query": testdata[1]}
                )

                assert response.status_code == 200, response.content
                data = response.data["data"]
                assert len(data) == 1
                assert data[0]["id"] == event1.event_id
                assert data[0]["issue.id"] == event1.group_id
                if testdata[0] == "issue":
                    assert data[0]["issue"] == event1.group.qualified_short_id
                else:
                    assert data[0].get("issue", None) is None

    def test_search_for_nonexistent_issue(self):
        self.login_as(user=self.user)

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

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url, format="json", data={"field": ["count()"], "query": "issue.id:112358"}
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["count"] == 0

    def test_issue_alias_inside_aggregate(self):
        self.login_as(user=self.user)

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

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": [
                        "project",
                        "count(id)",
                        "count_unique(issue.id)",
                        "count_unique(issue)",
                    ],
                    "sort": "-count(id)",
                    "statsPeriod": "24h",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["count_id"] == 2
            assert data[0]["count_unique_issue_id"] == 2
            assert data[0]["count_unique_issue"] == 2

    def test_project_alias_inside_aggregate(self):
        self.login_as(user=self.user)

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

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": [
                        "event.type",
                        "count(id)",
                        "count_unique(project.id)",
                        "count_unique(project)",
                    ],
                    "sort": "-count(id)",
                    "statsPeriod": "24h",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["count_id"] == 2
            assert data[0]["count_unique_project_id"] == 2
            assert data[0]["count_unique_project"] == 2

    def test_has_transaction_status(self):
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("transaction")

        data["transaction"] = "/transactionstatus/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        self.store_event(data, project_id=project.id)

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "count(id)"],
                    "query": "event.type:transaction has:transaction.status",
                    "sort": "-count(id)",
                    "statsPeriod": "24h",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["count_id"] == 1

    def test_not_has_transaction_status(self):
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("transaction")

        data["transaction"] = "/transactionstatus/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        self.store_event(data, project_id=project.id)

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "count(id)"],
                    "query": "event.type:transaction !has:transaction.status",
                    "sort": "-count(id)",
                    "statsPeriod": "24h",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["count_id"] == 0

    def test_all_aggregates_in_columns(self):
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("transaction")
        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=2))
        data["start_timestamp"] = iso_format(before_now(minutes=2, seconds=5))
        self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        data["contexts"]["trace"]["status"] = "unauthenticated"
        event = self.store_event(data, project_id=project.id)

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": [
                        "event.type",
                        "p75",
                        "p95()",
                        "percentile(transaction.duration, 0.99)",
                        "apdex(300)",
                        "impact()",
                        "error_rate()",
                    ],
                    "query": "event.type:transaction",
                },
            )

            assert response.status_code == 200, response.content
            meta = response.data["meta"]
            assert meta["p75"] == "duration"
            assert meta["p95"] == "duration"
            assert meta["percentile_transaction_duration_0_99"] == "duration"
            assert meta["apdex_300"] == "number"
            assert meta["impact"] == "number"

            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["p75"] == 5000
            assert data[0]["p95"] == 5000
            assert data[0]["percentile_transaction_duration_0_99"] == 5000
            assert data[0]["apdex_300"] == 0.0
            assert data[0]["impact"] == 1.0
            assert data[0]["error_rate"] == 0.5

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "last_seen", "latest_event()"],
                    "query": "event.type:transaction",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert iso_format(before_now(minutes=1))[:-5] in data[0]["last_seen"]
            assert data[0]["latest_event"] == event.event_id

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
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
                },
            )

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
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("transaction")

        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=2))
        data["start_timestamp"] = iso_format(before_now(minutes=2, seconds=5))
        self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/error_rate/2"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        data["contexts"]["trace"]["status"] = "unauthenticated"
        self.store_event(data, project_id=project.id)

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": [
                        "event.type",
                        "p75",
                        "p95()",
                        "percentile(transaction.duration, 0.99)",
                    ],
                    "query": "event.type:transaction p75:>1000 p95():>1000 percentile(transaction.duration, 0.99):>1000",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["p75"] == 5000
            assert data[0]["p95"] == 5000
            assert data[0]["percentile_transaction_duration_0_99"] == 5000

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "apdex", "impact()", "error_rate()"],
                    "query": "event.type:transaction apdex:>-1.0 impact():>0.5 error_rate():>0.25",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["apdex"] == 0.0
            assert data[0]["impact"] == 1.0
            assert data[0]["error_rate"] == 0.5

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "last_seen", "latest_event()"],
                    "query": u"event.type:transaction last_seen:>1990-12-01T00:00:00",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 0

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "count()", "count(id)", "count_unique(transaction)"],
                    "query": "event.type:transaction count():>1 count(id):>1 count_unique(transaction):>1",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["count"] == 2
            assert data[0]["count_id"] == 2
            assert data[0]["count_unique_transaction"] == 2

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": [
                        "event.type",
                        "min(transaction.duration)",
                        "max(transaction.duration)",
                        "avg(transaction.duration)",
                        "sum(transaction.duration)",
                    ],
                    "query": "event.type:transaction min(transaction.duration):>1000 max(transaction.duration):>1000 avg(transaction.duration):>1000 sum(transaction.duration):>1000",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["min_transaction_duration"] == 5000
            assert data[0]["max_transaction_duration"] == 5000
            assert data[0]["avg_transaction_duration"] == 5000
            assert data[0]["sum_transaction_duration"] == 10000

    def test_functions_in_orderby(self):
        self.login_as(user=self.user)

        project = self.create_project()
        data = load_data("transaction")

        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=2))
        data["start_timestamp"] = iso_format(before_now(minutes=2, seconds=5))
        self.store_event(data, project_id=project.id)

        data = load_data("transaction")
        data["transaction"] = "/error_rate/2"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        data["contexts"]["trace"]["status"] = "unauthenticated"
        event = self.store_event(data, project_id=project.id)

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "p75"],
                    "sort": "-p75",
                    "query": "event.type:transaction",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["p75"] == 5000

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "percentile(transaction.duration, 0.99)"],
                    "sort": "-percentile_transaction_duration_0_99",
                    "query": "event.type:transaction",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["percentile_transaction_duration_0_99"] == 5000

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "apdex()"],
                    "sort": "-apdex",
                    "query": "event.type:transaction",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["apdex"] == 0.0

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "latest_event()"],
                    "query": u"event.type:transaction",
                    "sort": "latest_event",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["latest_event"] == event.event_id

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "count_unique(transaction)"],
                    "query": "event.type:transaction",
                    "sort": "-count_unique_transaction",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["count_unique_transaction"] == 2

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "min(transaction.duration)"],
                    "query": "event.type:transaction",
                    "sort": "-min_transaction_duration",
                },
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 1
            assert data[0]["min_transaction_duration"] == 5000

    def test_issue_alias_in_aggregate(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.two_min_ago, "fingerprint": ["group_1"]},
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "timestamp": self.min_ago, "fingerprint": ["group_2"]},
            project_id=project.id,
        )

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["event.type", "count_unique(issue)"],
                    "query": "count_unique(issue):>1",
                },
            )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count_unique_issue"] == 2

    def test_deleted_issue_in_results(self):
        self.login_as(user=self.user)

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

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url, format="json", data={"field": ["issue", "count()"], "sort": "issue"}
            )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["issue"] == event1.group.qualified_short_id
        assert data[1]["issue"] == "unknown"

    def test_context_fields(self):
        self.login_as(user=self.user)
        project = self.create_project()
        data = load_data("android")
        transaction_data = load_data("transaction")
        data["spans"] = transaction_data["spans"]
        data["contexts"]["trace"] = transaction_data["contexts"]["trace"]
        data["type"] = "transaction"
        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        data["user"]["geo"] = {"country_code": "US", "region": "CA", "city": "San Francisco"}
        data["contexts"]["http"] = {
            "method": "GET",
            "referer": "something.something",
            "url": "https://areyouasimulation.com",
        }
        self.store_event(data, project_id=project.id)

        fields = [
            "http.method",
            "http.referer",
            "http.url",
            "os.build",
            "os.kernel_version",
            "device.arch",
            "device.battery_level",
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={"field": fields + ["count()"], "query": "event.type:transaction"},
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        results = response.data["data"]

        for field in fields:
            key, value = field.split(".", 1)
            expected = data["contexts"][key][value]

            # TODO (evanh) There is a bug in snuba right now where if a promoted column is used for a boolean
            # value, it returns "1" or "0" instead of "True" and "False" (not that those make more sense)
            if expected in (True, False):
                expected = six.text_type(expected)
            # All context columns are treated as strings, regardless of the type of data they stored.
            elif isinstance(expected, six.integer_types):
                expected = "{:.1f}".format(expected)

            assert results[0][field] == expected
        assert results[0]["count"] == 1

    @pytest.mark.xfail(reason="these fields behave differently between the types of events")
    def test_context_fields_in_errors(self):
        self.login_as(user=self.user)
        project = self.create_project()
        data = load_data("android")
        transaction_data = load_data("transaction")
        data["spans"] = transaction_data["spans"]
        data["contexts"]["trace"] = transaction_data["contexts"]["trace"]
        data["type"] = "error"
        data["transaction"] = "/error_rate/1"
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=5))
        data["user"]["geo"] = {"country_code": "US", "region": "CA", "city": "San Francisco"}
        data["contexts"]["http"] = {
            "method": "GET",
            "referer": "something.something",
            "url": "https://areyouasimulation.com",
        }
        self.store_event(data, project_id=project.id)

        fields = [
            "http.method",
            "http.referer",
            "http.url",
            "os.build",
            "os.kernel_version",
            "device.arch",
            "device.battery_level",
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={"field": fields + ["count()"], "query": "event.type:error"},
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        results = response.data["data"]

        for field in fields:
            key, value = field.split(".", 1)
            expected = data["contexts"][key][value]

            # TODO (evanh) There is a bug in snuba right now where if a promoted column is used for a boolean
            # value, it returns "1" or "0" instead of "True" and "False" (not that those make more sense)
            if expected in (True, False):
                expected = six.text_type(expected)
            # All context columns are treated as strings, regardless of the type of data they stored.
            elif isinstance(expected, six.integer_types):
                expected = "{:.1f}".format(expected)

            assert results[0][field] == expected

        assert results[0]["count"] == 1

    def test_histogram_function(self):
        self.login_as(user=self.user)
        project = self.create_project()
        start = before_now(minutes=2).replace(microsecond=0)
        latencies = [
            (1, 999, 5),
            (1000, 1999, 4),
            (3000, 3999, 3),
            (6000, 6999, 2),
            (10000, 10000, 1),  # just to make the math easy
        ]
        for bucket in latencies:
            for i in range(bucket[2]):
                milliseconds = random.randint(bucket[0], bucket[1])
                data = load_data("transaction")
                data["transaction"] = "/error_rate/{}".format(milliseconds)
                data["timestamp"] = iso_format(start)
                data["start_timestamp"] = iso_format(start - timedelta(milliseconds=milliseconds))
                self.store_event(data, project_id=project.id)

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["histogram(transaction.duration, 10)", "count()"],
                    "query": "event.type:transaction",
                    "sort": "histogram_transaction_duration_10",
                },
            )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 10
        expected = [
            (1000, 5),
            (2000, 4),
            (3000, 0),
            (4000, 3),
            (5000, 0),
            (6000, 0),
            (7000, 2),
            (8000, 0),
            (9000, 0),
            (10000, 1),
        ]
        for idx, datum in enumerate(data):
            assert datum["histogram_transaction_duration_10"] == expected[idx][0]
            assert datum["count"] == expected[idx][1]

    def test_histogram_function_with_filters(self):
        self.login_as(user=self.user)
        project = self.create_project()
        start = before_now(minutes=2).replace(microsecond=0)
        latencies = [
            (1, 999, 5),
            (1000, 1999, 4),
            (3000, 3999, 3),
            (6000, 6999, 2),
            (10000, 10000, 1),  # just to make the math easy
        ]
        for bucket in latencies:
            for i in range(bucket[2]):
                milliseconds = random.randint(bucket[0], bucket[1])
                data = load_data("transaction")
                data["transaction"] = "/error_rate/sleepy_gary/{}".format(milliseconds)
                data["timestamp"] = iso_format(start)
                data["start_timestamp"] = iso_format(start - timedelta(milliseconds=milliseconds))
                self.store_event(data, project_id=project.id)

        # Add a transaction that totally throws off the buckets
        milliseconds = random.randint(bucket[0], bucket[1])
        data = load_data("transaction")
        data["transaction"] = "/error_rate/hamurai"
        data["timestamp"] = iso_format(start)
        data["start_timestamp"] = iso_format(start - timedelta(milliseconds=1000000))
        self.store_event(data, project_id=project.id)

        with self.feature(
            {"organizations:discover-basic": True, "organizations:global-views": True}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "field": ["histogram(transaction.duration, 10)", "count()"],
                    "query": "event.type:transaction transaction:/error_rate/sleepy_gary*",
                    "sort": "histogram_transaction_duration_10",
                },
            )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 10
        expected = [
            (1000, 5),
            (2000, 4),
            (3000, 0),
            (4000, 3),
            (5000, 0),
            (6000, 0),
            (7000, 2),
            (8000, 0),
            (9000, 0),
            (10000, 1),
        ]
        for idx, datum in enumerate(data):
            assert datum["histogram_transaction_duration_10"] == expected[idx][0]
            assert datum["count"] == expected[idx][1]
