from django.urls import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventsGeoEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.features = {}

    def do_request(self, query, features=None):
        if features is None:
            features = {"organizations:dashboards-basic": True}
        features.update(self.features)
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
        assert len(response.data["data"]) == 1
        assert response.data["data"] == [{"count": 1, "geo.country_code": "CA"}]
        # Expect no pagination
        assert "Link" not in response

    def test_only_use_last_field(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
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
            "field": ["p75()", "count()"],
            "statsPeriod": "24h",
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert len(response.data["data"]) == 1
        assert response.data["data"] == [{"count": 1, "geo.country_code": "CA"}]

    def test_orderby(self):
        def get_mock_data(index, geo):
            return {
                "event_id": str(index) * 32,
                "environment": "staging",
                "timestamp": self.min_ago,
                "user": {
                    "email": "foo@example.com",
                    "id": "123",
                    "ip_address": "127.0.0.1",
                    "username": "foo",
                    "geo": geo,
                },
            }

        self.store_event(
            data=get_mock_data(0, {"country_code": "CA", "region": "Canada"}),
            project_id=self.project.id,
        )
        self.store_event(
            data=get_mock_data(1, {"country_code": "BR", "region": "Brazil"}),
            project_id=self.project.id,
        )
        self.store_event(
            data=get_mock_data(2, {"country_code": "BR", "region": "Brazil"}),
            project_id=self.project.id,
        )
        self.store_event(
            data=get_mock_data(3, {"country_code": "BR", "region": "Brazil"}),
            project_id=self.project.id,
        )
        self.store_event(
            data=get_mock_data(4, {"country_code": "JP", "region": "Japan"}),
            project_id=self.project.id,
        )
        self.store_event(
            data=get_mock_data(5, {"country_code": "JP", "region": "Japan"}),
            project_id=self.project.id,
        )

        query = {
            "project": [self.project.id],
            "field": ["count()"],
            "statsPeriod": "24h",
            "sort": "-count",
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert len(response.data["data"]) == 3
        assert response.data["data"] == [
            {"count": 3, "geo.country_code": "BR"},
            {"count": 2, "geo.country_code": "JP"},
            {"count": 1, "geo.country_code": "CA"},
        ]

        query = {
            "project": [self.project.id],
            "field": ["count()"],
            "statsPeriod": "24h",
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert len(response.data["data"]) == 3
        assert response.data["data"] == [
            {"count": 1, "geo.country_code": "CA"},
            {"count": 2, "geo.country_code": "JP"},
            {"count": 3, "geo.country_code": "BR"},
        ]


class OrganizationEventsGeoEndpointTestWithSnql(OrganizationEventsGeoEndpointTest):
    def setUp(self):
        super().setUp()
        self.features["organizations:discover-use-snql"] = True
