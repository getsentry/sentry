from __future__ import absolute_import


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
        assert meta["project.name"] == "string"
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
        assert response.data["data"][0]["project.name"] == project.slug
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
        assert response.data["data"][0]["project.name"] == project2.slug
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
        assert meta["project.name"] == "string"
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
