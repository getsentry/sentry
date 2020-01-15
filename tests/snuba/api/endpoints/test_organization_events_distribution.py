from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse
from uuid import uuid4

from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventsDistributionEndpointTest(SnubaTestCase, APITestCase):
    feature_list = ("organizations:events-v2", "organizations:global-views")

    def setUp(self):
        super(OrganizationEventsDistributionEndpointTest, self).setUp()
        self.min_ago = before_now(minutes=1).replace(microsecond=0)
        self.day_ago = before_now(days=1).replace(microsecond=0)
        self.login_as(user=self.user)
        self.project = self.create_project()
        self.project2 = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-events-distribution",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        self.min_ago_iso = iso_format(self.min_ago)

    def test_simple(self):
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "one"},
            },
            project_id=self.project2.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "one"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "two"},
            },
            project_id=self.project.id,
        )

        with self.feature(self.feature_list):
            response = self.client.get(self.url, {"key": "number"}, format="json")

        assert response.status_code == 200, response.content

        assert response.data == {
            "topValues": [
                {"count": 2, "name": "one", "value": "one"},
                {"count": 1, "name": "two", "value": "two"},
            ],
            "key": "number",
        }

    def test_with_message_query(self):
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "message": "how to make fast",
                "tags": {"color": "green"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "message": "Delet the Data",
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "message": "Data the Delet ",
                "tags": {"color": "yellow"},
            },
            project_id=self.project2.id,
        )

        with self.feature(self.feature_list):
            response = self.client.get(self.url, {"query": "delet", "key": "color"}, format="json")

        assert response.status_code == 200, response.content

        assert response.data == {
            "topValues": [
                {"count": 1, "name": "yellow", "value": "yellow"},
                {"count": 1, "name": "red", "value": "red"},
            ],
            "key": "color",
        }

    def test_with_condition(self):
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "message": "how to make fast",
                "tags": {"color": "green"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "message": "Delet the Data",
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "message": "Data the Delet ",
                "tags": {"color": "yellow"},
            },
            project_id=self.project2.id,
        )

        with self.feature(self.feature_list):
            response = self.client.get(
                self.url, {"query": "color:yellow", "key": "color"}, format="json"
            )

        assert response.status_code == 200, response.content

        assert response.data == {
            "topValues": [{"count": 1, "name": "yellow", "value": "yellow"}],
            "key": "color",
        }

    def test_start_end(self):
        two_days_ago = self.day_ago - timedelta(days=1)
        hour_ago = self.min_ago - timedelta(hours=1)
        two_hours_ago = hour_ago - timedelta(hours=1)

        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": iso_format(two_days_ago),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": iso_format(hour_ago),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": iso_format(two_hours_ago),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": iso_format(timezone.now()),
                "tags": {"color": "red"},
            },
            project_id=self.project2.id,
        )

        with self.feature(self.feature_list):
            response = self.client.get(
                self.url,
                {
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.min_ago),
                    "key": ["color"],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data == {
            "topValues": [{"count": 2, "name": "red", "value": "red"}],
            "key": "color",
        }

    def test_excluded_tag(self):
        self.user = self.create_user()
        self.user2 = self.create_user()
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": iso_format(self.day_ago),
                "message": "very bad",
                "tags": {"sentry:user": self.user.email},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": iso_format(self.day_ago),
                "message": "very bad",
                "tags": {"sentry:user": self.user2.email},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": iso_format(self.day_ago),
                "message": "very bad",
                "tags": {"sentry:user": self.user2.email},
            },
            project_id=self.project.id,
        )

        with self.feature(self.feature_list):
            response = self.client.get(
                self.url, format="json", data={"key": "user", "project": [self.project.id]}
            )

        assert response.status_code == 200, response.content
        assert response.data == {
            "topValues": [
                {"count": 2, "name": self.user2.email, "value": self.user2.email},
                {"count": 1, "name": self.user.email, "value": self.user.email},
            ],
            "key": "user",
        }

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        url = reverse(
            "sentry-api-0-organization-events-distribution", kwargs={"organization_slug": org.slug}
        )
        with self.feature("organizations:events-v2"):
            response = self.client.get(url, {"key": "color"}, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "A valid project must be included."}

    def test_no_key_param(self):
        with self.feature("organizations:events-v2"):
            response = self.client.get(self.url, {"project": [self.project.id]}, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Tag key must be specified."}

    def test_multiple_projects_without_global_view(self):
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project.id)
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project2.id)

        with self.feature("organizations:events-v2"):
            response = self.client.get(self.url, {"key": "color"}, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "You cannot view events from multiple projects."}

    def test_project_selected(self):
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "two"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "one"},
            },
            project_id=self.project2.id,
        )

        with self.feature(self.feature_list):
            response = self.client.get(
                self.url, {"key": "number", "project": [self.project.id]}, format="json"
            )

        assert response.status_code == 200, response.content
        assert response.data == {
            "topValues": [{"name": "two", "value": "two", "count": 1}],
            "key": "number",
        }

    def test_project_key(self):
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"color": "green"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "one"},
            },
            project_id=self.project2.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"color": "green"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": uuid4().hex, "timestamp": self.min_ago_iso, "tags": {"color": "red"}},
            project_id=self.project.id,
        )

        with self.feature(self.feature_list):
            response = self.client.get(self.url, {"key": "project.name"}, format="json")

        assert response.status_code == 200, response.content

        assert response.data == {
            "topValues": [
                {"count": 3, "name": self.project.slug, "value": self.project.slug},
                {"count": 1, "name": self.project2.slug, "value": self.project2.slug},
            ],
            "key": "project.name",
        }

    def test_non_tag_key(self):
        user1 = {
            "id": "1",
            "ip_address": "127.0.0.1",
            "email": "foo@example.com",
            "username": "foo",
        }
        user2 = {
            "id": "2",
            "ip_address": "127.0.0.2",
            "email": "bar@example.com",
            "username": "bar",
        }
        self.store_event(
            data={"event_id": uuid4().hex, "timestamp": self.min_ago_iso, "user": user1},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"color": "green"},
                "user": user2,
            },
            project_id=self.project2.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"color": "green"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"color": "red"},
                "user": user1,
            },
            project_id=self.project.id,
        )

        with self.feature(self.feature_list):
            response = self.client.get(self.url, {"key": "user.email"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {
            "topValues": [
                {"count": 2, "name": user1["email"], "value": user1["email"]},
                {"count": 1, "name": None, "value": None},
                {"count": 1, "name": user2["email"], "value": user2["email"]},
            ],
            "key": "user.email",
        }

    def test_value_limit(self):
        for i in range(0, 12):
            self.store_event(
                data={
                    "event_id": uuid4().hex,
                    "timestamp": self.min_ago_iso,
                    "tags": {"color": "color%d" % i},
                },
                project_id=self.create_project().id,
            )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"color": "yellow"},
            },
            project_id=self.project2.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"color": "yellow"},
            },
            project_id=self.project2.id,
        )
        with self.feature(self.feature_list):
            response = self.client.get(self.url, {"key": "color"}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data["topValues"]) == TOP_VALUES_DEFAULT_LIMIT
        assert response.data["topValues"][0] == {"count": 2, "name": "yellow", "value": "yellow"}

    def test_malformed_query(self):
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project.id)
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project2.id)

        with self.feature(self.feature_list):
            response = self.client.get(
                self.url, format="json", data={"key": ["color"], "query": "\n\n\n\n"}
            )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "Parse error: 'search' (column 1). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."
        }

    def test_invalid_tag(self):
        with self.feature(self.feature_list):
            response = self.client.get(self.url, data={"key": ["color;;;"]}, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Tag key color;;; is not valid."}

    def test_environment(self):
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "one"},
                "environment": "staging",
            },
            project_id=self.project2.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "one"},
                "environment": "production",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "two"},
            },
            project_id=self.project.id,
        )

        with self.feature(self.feature_list):
            # get top values for the key "environment"
            response = self.client.get(self.url, {"key": "environment"}, format="json")

            assert response.status_code == 200, response.content

            assert response.data == {
                "topValues": [
                    {"count": 1, "name": None, "value": None},
                    {"count": 1, "name": "staging", "value": "staging"},
                    {"count": 1, "name": "production", "value": "production"},
                ],
                "key": "environment",
            }

        with self.feature(self.feature_list):
            # query by an environment
            response = self.client.get(
                self.url, {"key": "environment", "environment": "staging"}, format="json"
            )

            assert response.status_code == 200, response.content

            assert response.data == {
                "topValues": [{"count": 1, "name": "staging", "value": "staging"}],
                "key": "environment",
            }

        with self.feature(self.feature_list):
            # query by multiple environments
            response = self.client.get(
                self.url,
                {"key": "environment", "environment": ["staging", "production"]},
                format="json",
            )

            assert response.status_code == 200, response.content

            assert response.data == {
                "topValues": [
                    {"count": 1, "name": "staging", "value": "staging"},
                    {"count": 1, "name": "production", "value": "production"},
                ],
                "key": "environment",
            }

        with self.feature(self.feature_list):
            # query by the "no environment" environment
            response = self.client.get(
                self.url, {"key": "environment", "environment": ""}, format="json"
            )

            assert response.status_code == 200, response.content

            assert response.data == {
                "topValues": [{"count": 1, "name": None, "value": None}],
                "key": "environment",
            }

        with self.feature(self.feature_list):
            # query by multiple environments, including the "no environment" environment
            response = self.client.get(
                self.url,
                {"key": "environment", "environment": ["staging", "production", ""]},
                format="json",
            )

            assert response.status_code == 200, response.content

            assert response.data == {
                "topValues": [
                    {"count": 1, "name": None, "value": None},
                    {"count": 1, "name": "staging", "value": "staging"},
                    {"count": 1, "name": "production", "value": "production"},
                ],
                "key": "environment",
            }
