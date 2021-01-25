from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventsGeoEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsGeoEndpointTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))

    def do_request(self, query, features=None):
        if features is None:
            features = {"organizations:dashboards-v2": True}
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-events-geo",
            kwargs={"organization_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request({})

        assert response.status_code == 200, response.data
        assert len(response.data) == 0

    def test_no_field(self):
        query = {
            "field": [],
            "project": [self.project.id],
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data["detail"] == "No column selected"

    def test_require_aggregate_field(self):
        query = {
            "field": ["i_am_a_tag"],
            "project": [self.project.id],
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data["detail"] == "Functions may only be given"

    def test_happy_path(self):
        other_project = self.create_project()
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=other_project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "environment": "production",
                "timestamp": self.min_ago,
                "user": {
                    "email": "foo@example.com",
                    "id": "123",
                    "ip_address": "127.0.0.1",
                    "username": "foo",
                    "geo": {"country_code": "CA", "region": "Canada"},
                },
            },
            project_id=self.project.id,
        )

        query = {
            "project": [self.project.id],
            "field": ["count()"],
            "statsPeriod": "24h",
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert len(response.data["data"]) == 2
        assert response.data["data"] == [
            {"count": 1, "geo.country_code": None},
            {"count": 1, "geo.country_code": "CA"},
        ]
        # Expect no pagination
        assert "Link" not in response

    def test_only_use_last_field(self):
        self.store_event(
            data={"event_id": "a" * 32, "environment": "staging", "timestamp": self.min_ago},
            project_id=self.project.id,
        )

        query = {
            "project": [self.project.id],
            "field": ["p75()", "count()"],
            "statsPeriod": "24h",
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert len(response.data["data"]) == 1
        assert response.data["data"] == [
            {"count": 1, "geo.country_code": None},
        ]
