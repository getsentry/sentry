from django.urls import reverse

from sentry.api.serializers import serialize
from sentry.discover.models import DiscoverSavedQuery
from tests.snuba.api.endpoints.test_discover_saved_queries import DiscoverSavedQueryBase

FEATURES = ("organizations:discover-query",)


class DiscoverHomepageQueryTest(DiscoverSavedQueryBase):
    def setUp(self):
        super().setUp()
        self.url = reverse("sentry-api-0-discover-homepage-query", args=[self.org.slug])
        self.query = {"fields": ["test"], "conditions": [], "limit": 10}
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]

    def test_returns_no_response_if_no_homepage_query_for_user(self):
        with self.feature(FEATURES):
            response = self.client.get(self.url)

        assert response.status_code == 204, response.content
        assert response.data is None

    def test_returns_serialized_saved_query_if_homepage_is_set(self):
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query=self.query,
            is_homepage=True,
        )
        with self.feature(FEATURES):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert response.data == serialize(saved_query)

    def test_put_updates_existing_homepage_query_to_reflect_new_data(self):
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query=self.query,
            is_homepage=True,
        )
        with self.feature(FEATURES):
            response = self.client.put(
                self.url,
                {
                    "name": "A new homepage query update",
                    "projects": self.project_ids,
                    "fields": ["field1", "field2"],
                },
            )

        assert response.status_code == 200, response.content

        saved_query.refresh_from_db()
        assert response.data == serialize(saved_query)
        assert saved_query.query["fields"] == ["field1", "field2"]
        assert set(saved_query.projects.values_list("id", flat=True)) == set(self.project_ids)

    def test_put_creates_new_discover_saved_query_if_none_exists(self):
        homepage_query_payload = {
            "version": 2,
            "name": "New Homepage Query",
            "projects": self.project_ids,
            "environment": ["alpha"],
            "fields": ["environment", "platform.name"],
            "orderby": "-timestamp",
            "range": None,
        }
        with self.feature(FEATURES):
            response = self.client.put(self.url, data=homepage_query_payload)

        assert response.status_code == 201, response.content

        new_query = DiscoverSavedQuery.objects.get(
            created_by_id=self.user.id, organization=self.org, is_homepage=True
        )
        assert response.data == serialize(new_query)
        assert new_query.query["fields"] == homepage_query_payload["fields"]
        assert new_query.query["environment"] == homepage_query_payload["environment"]
        assert set(new_query.projects.values_list("id", flat=True)) == set(self.project_ids)

    def test_put_responds_with_saved_empty_name_field(self):
        homepage_query_payload = {
            "version": 2,
            "name": "New Homepage Query",
            "projects": self.project_ids,
            "environment": ["alpha"],
            "fields": ["environment", "platform.name"],
            "orderby": "-timestamp",
            "range": None,
        }
        with self.feature(FEATURES):
            response = self.client.put(self.url, data=homepage_query_payload)

        assert response.status_code == 201, response.content

        new_query = DiscoverSavedQuery.objects.get(
            created_by_id=self.user.id, organization=self.org, is_homepage=True
        )
        assert new_query.name == ""
        assert response.data["name"] == ""

    def test_put_with_no_name(self):
        homepage_query_payload = {
            "version": 2,
            "name": "",
            "projects": self.project_ids,
            "environment": ["alpha"],
            "fields": ["environment", "platform.name"],
            "orderby": "-timestamp",
            "range": None,
        }
        with self.feature(FEATURES):
            response = self.client.put(self.url, data=homepage_query_payload)

        assert response.status_code == 201, response.content

        new_query = DiscoverSavedQuery.objects.get(
            created_by_id=self.user.id, organization=self.org, is_homepage=True
        )
        assert new_query.name == ""
        assert response.data["name"] == ""

    def test_post_not_allowed(self):
        homepage_query_payload = {
            "version": 2,
            "name": "New Homepage Query",
            "projects": ["-1"],
            "environment": ["alpha"],
            "fields": ["environment", "platform.name"],
            "orderby": "-timestamp",
            "range": None,
        }
        with self.feature(FEATURES):
            response = self.client.post(self.url, data=homepage_query_payload)

        assert response.status_code == 405, response.content

    def test_delete_resets_saved_query(self):
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query=self.query,
            is_homepage=True,
        )
        with self.feature(FEATURES):
            response = self.client.delete(self.url)

        assert response.status_code == 204
        assert not DiscoverSavedQuery.objects.filter(
            created_by_id=self.user.id, organization=self.org, is_homepage=True
        ).exists()
