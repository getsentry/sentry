from django.urls import reverse

from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryStarred
from sentry.testutils.cases import APITestCase, SnubaTestCase


class ExploreSavedQueryStarredOrderTest(APITestCase, SnubaTestCase):
    feature_name = "organizations:visibility-explore-view"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]
        query = {"query": [{"fields": ["span.op"], "mode": "samples"}]}

        self.model_a = ExploreSavedQuery.objects.create(
            organization=self.org, created_by_id=self.user.id, name="Test query A", query=query
        )
        self.model_b = ExploreSavedQuery.objects.create(
            organization=self.org, created_by_id=self.user.id, name="Test query B", query=query
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query_id=self.model_a.id,
            position=1,
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query_id=self.model_b.id,
            position=2,
        )

        self.url = reverse("sentry-api-0-explore-saved-query-starred-order", args=[self.org.slug])

    def test_put(self):
        with self.feature(self.feature_name):
            ids = (
                ExploreSavedQueryStarred.objects.filter(organization=self.org, user_id=self.user.id)
                .order_by("position")
                .values_list("explore_saved_query_id", flat=True)
            )
            assert list(ids) == [self.model_a.id, self.model_b.id]
            response = self.client.put(
                self.url, data={"query_ids": [self.model_b.id, self.model_a.id]}
            )
            assert response.status_code == 204
            ids = (
                ExploreSavedQueryStarred.objects.filter(organization=self.org, user_id=self.user.id)
                .order_by("position")
                .values_list("explore_saved_query_id", flat=True)
            )
            assert list(ids) == [self.model_b.id, self.model_a.id]

    def test_put_invalid_query_ids(self):
        with self.feature(self.feature_name):
            response = self.client.put(
                self.url, data={"query_ids": [self.model_a.id, self.model_a.id]}
            )
            assert response.status_code == 400
