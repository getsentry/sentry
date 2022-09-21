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
