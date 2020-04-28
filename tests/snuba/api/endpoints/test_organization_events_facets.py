from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse
from uuid import uuid4

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventsFacetsEndpointTest(SnubaTestCase, APITestCase):
    feature_list = ("organizations:discover-basic", "organizations:global-views")

    def setUp(self):
        super(OrganizationEventsFacetsEndpointTest, self).setUp()
        self.min_ago = before_now(minutes=1).replace(microsecond=0)
        self.day_ago = before_now(days=1).replace(microsecond=0)
        self.login_as(user=self.user)
        self.project = self.create_project()
        self.project2 = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-events-facets",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        self.min_ago_iso = iso_format(self.min_ago)

    def assert_facet(self, response, key, expected):
        actual = None
        for facet in response.data:
            if facet["key"] == key:
                actual = facet
                break
        assert actual is not None, "Could not find {} facet in {}".format(key, response.data)
        assert "topValues" in actual
        assert sorted(expected) == sorted(actual["topValues"])

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
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        expected = [
            {"count": 2, "name": "one", "value": "one"},
            {"count": 1, "name": "two", "value": "two"},
        ]
        self.assert_facet(response, "number", expected)

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
            response = self.client.get(self.url, {"query": "delet"}, format="json")

        assert response.status_code == 200, response.content
        expected = [
            {"count": 1, "name": "yellow", "value": "yellow"},
            {"count": 1, "name": "red", "value": "red"},
        ]
        self.assert_facet(response, "color", expected)

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
            response = self.client.get(self.url, {"query": "color:yellow"}, format="json")

        assert response.status_code == 200, response.content
        expected = [{"count": 1, "name": "yellow", "value": "yellow"}]
        self.assert_facet(response, "color", expected)

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
                {"start": iso_format(self.day_ago), "end": iso_format(self.min_ago)},
                format="json",
            )

        assert response.status_code == 200, response.content
        expected = [{"count": 2, "name": "red", "value": "red"}]
        self.assert_facet(response, "color", expected)

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
            response = self.client.get(self.url, format="json", data={"project": [self.project.id]})

        assert response.status_code == 200, response.content
        expected = [
            {"count": 2, "name": self.user2.email, "value": self.user2.email},
            {"count": 1, "name": self.user.email, "value": self.user.email},
        ]
        self.assert_facet(response, "user", expected)

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        url = reverse(
            "sentry-api-0-organization-events-facets", kwargs={"organization_slug": org.slug}
        )
        with self.feature("organizations:discover-basic"):
            response = self.client.get(url, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "A valid project must be included."}

    def test_multiple_projects_without_global_view(self):
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project.id)
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project2.id)

        with self.feature("organizations:discover-basic"):
            response = self.client.get(self.url, format="json")
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
            response = self.client.get(self.url, {"project": [self.project.id]}, format="json")

        assert response.status_code == 200, response.content
        expected = [{"name": "two", "value": "two", "count": 1}]
        self.assert_facet(response, "number", expected)

    def test_project_filtered(self):
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
                self.url, {"query": "project:{}".format(self.project.slug)}, format="json"
            )

        assert response.status_code == 200, response.content
        expected = [{"name": "two", "value": "two", "count": 1}]
        self.assert_facet(response, "number", expected)

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
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        expected = [
            {"count": 3, "name": self.project.slug, "value": self.project.id},
            {"count": 1, "name": self.project2.slug, "value": self.project2.id},
        ]
        self.assert_facet(response, "project", expected)

    def test_project_key_with_project_tag(self):
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        member_user = self.create_user()
        team = self.create_team(members=[member_user])
        private_project1 = self.create_project(organization=self.organization, teams=[team])
        private_project2 = self.create_project(organization=self.organization, teams=[team])
        self.login_as(member_user)

        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"color": "green", "project": "%d" % private_project1.id},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"number": "one", "project": "%d" % private_project1.id},
            },
            project_id=private_project1.id,
        )
        self.store_event(
            data={
                "event_id": uuid4().hex,
                "timestamp": self.min_ago_iso,
                "tags": {"color": "green"},
            },
            project_id=private_project1.id,
        )
        self.store_event(
            data={"event_id": uuid4().hex, "timestamp": self.min_ago_iso, "tags": {"color": "red"}},
            project_id=private_project2.id,
        )
        self.store_event(
            data={"event_id": uuid4().hex, "timestamp": self.min_ago_iso, "tags": {"color": "red"}},
            project_id=private_project2.id,
        )

        with self.feature(self.feature_list):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        expected = [
            {"count": 2, "name": private_project1.slug, "value": private_project1.id},
            {"count": 2, "name": private_project2.slug, "value": private_project2.id},
        ]

        self.assert_facet(response, "project", expected)

    def test_malformed_query(self):
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project.id)
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project2.id)

        with self.feature(self.feature_list):
            response = self.client.get(self.url, format="json", data={"query": "\n\n\n\n"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "Parse error at '\n\n\n\n' (column 1). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        }

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
            response = self.client.get(self.url, format="json")

            assert response.status_code == 200, response.content
            expected = [
                {"count": 1, "name": "production", "value": "production"},
                {"count": 1, "name": "staging", "value": "staging"},
                {"count": 1, "name": None, "value": None},
            ]
            self.assert_facet(response, "environment", expected)

        with self.feature(self.feature_list):
            # query by an environment
            response = self.client.get(self.url, {"environment": "staging"}, format="json")

            assert response.status_code == 200, response.content
            expected = [{"count": 1, "name": "staging", "value": "staging"}]
            self.assert_facet(response, "environment", expected)

        with self.feature(self.feature_list):
            # query by multiple environments
            response = self.client.get(
                self.url, {"environment": ["staging", "production"]}, format="json"
            )

            assert response.status_code == 200, response.content

            expected = [
                {"count": 1, "name": "production", "value": "production"},
                {"count": 1, "name": "staging", "value": "staging"},
            ]
            self.assert_facet(response, "environment", expected)

        with self.feature(self.feature_list):
            # query by multiple environments, including the "no environment" environment
            response = self.client.get(
                self.url, {"environment": ["staging", "production", ""]}, format="json"
            )
            assert response.status_code == 200, response.content
            expected = [
                {"count": 1, "name": "production", "value": "production"},
                {"count": 1, "name": "staging", "value": "staging"},
                {"count": 1, "name": None, "value": None},
            ]
            self.assert_facet(response, "environment", expected)

    def test_out_of_retention(self):
        with self.options({"system.event-retention-days": 10}):
            with self.feature(self.feature_list):
                response = self.client.get(
                    self.url,
                    format="json",
                    data={
                        "start": iso_format(before_now(days=20)),
                        "end": iso_format(before_now(days=15)),
                    },
                )
        assert response.status_code == 400
