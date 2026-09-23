from django.urls import reverse

from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryStarred
from sentry.testutils.cases import APITestCase


class DiscoverSavedQueryStarredTest(APITestCase):
    feature_flags = {
        "organizations:visibility-explore-view": True,
        "organizations:discover-queries-in-all-queries": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]
        query = {"fields": ["title"], "conditions": "", "limit": 10}

        model = DiscoverSavedQuery.objects.create(
            organization=self.org, created_by_id=self.user.id, name="Test query", query=query
        )

        model.set_projects(self.project_ids)

        self.query_id = model.id

        self.url = reverse(
            "sentry-api-0-discover-saved-query-starred", args=[self.org.slug, self.query_id]
        )

    def test_post(self) -> None:
        with self.feature(self.feature_flags):
            assert not DiscoverSavedQuery.objects.filter(
                id__in=DiscoverSavedQueryStarred.objects.filter(
                    organization=self.org, user_id=self.user.id
                ).values_list("discover_saved_query_id", flat=True)
            ).exists()
            response = self.client.post(self.url, data={"starred": "1"})
            assert response.status_code == 200, response.content
            assert DiscoverSavedQuery.objects.filter(
                id__in=DiscoverSavedQueryStarred.objects.filter(
                    organization=self.org, user_id=self.user.id
                ).values_list("discover_saved_query_id", flat=True)
            ).exists()
            response = self.client.post(self.url, data={"starred": "0"})
            assert response.status_code == 200, response.content
            assert not DiscoverSavedQuery.objects.filter(
                id__in=DiscoverSavedQueryStarred.objects.filter(
                    organization=self.org, user_id=self.user.id
                ).values_list("discover_saved_query_id", flat=True)
            ).exists()
