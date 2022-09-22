from django.urls import reverse

from sentry.api.serializers import serialize
from sentry.discover.models import DiscoverSavedQuery
from tests.snuba.api.endpoints.test_discover_saved_queries import DiscoverSavedQueryBase


class DiscoverDefaultQueryTest(DiscoverSavedQueryBase):
    def setUp(self):
        super().setUp()
        self.url = reverse("sentry-api-0-discover-default-query", args=[self.org.slug])
        self.query = {"fields": ["test"], "conditions": [], "limit": 10}

    def test_returns_empty_dict_if_no_default_query_for_user(self):
        with self.feature("organizations:discover-query"):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert response.data == {}

    def test_returns_serialized_saved_query_if_default_is_set(self):
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by=self.user,
            name="Test query",
            query=self.query,
            is_default=True,
        )
        with self.feature("organizations:discover-query"):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert response.data == serialize(saved_query)

    def test_put_updates_existing_default_query_to_reflect_new_data(self):
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by=self.user,
            name="Test query",
            query=self.query,
            is_default=True,
        )
        with self.feature("organizations:discover-query"):
            response = self.client.put(
                self.url,
                {
                    "name": "A new default query update",
                    "projects": ["-1"],
                    "fields": ["field1", "field2"],
                },
            )

        assert response.status_code == 200, response.content

        saved_query.refresh_from_db()
        assert saved_query.name == "A new default query update"
        assert saved_query.query["fields"] == ["field1", "field2"]

    def test_put_creates_new_discover_saved_query_if_none_exists(self):
        default_query_payload = {
            "version": 2,
            "name": "New Default Query",
            "projects": ["-1"],
            "environment": ["alpha"],
            "fields": ["environment", "platform.name"],
            "orderby": "-timestamp",
            "range": None,
        }
        with self.feature("organizations:discover-query"):
            response = self.client.put(self.url, data=default_query_payload)

        assert response.status_code == 201, response.content

        new_query = DiscoverSavedQuery.objects.get(
            created_by=self.user, organization=self.org, is_default=True
        )
        assert new_query.name == default_query_payload["name"]
        assert new_query.query["fields"] == default_query_payload["fields"]
        assert new_query.query["environment"] == default_query_payload["environment"]

    def test_delete_resets_saved_query(self):
        pass
