from django.urls import reverse

from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryStarred
from sentry.testutils.cases import APITestCase, SnubaTestCase


class ExploreSavedQueryStarredTest(APITestCase, SnubaTestCase):
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

        model = ExploreSavedQuery.objects.create(
            organization=self.org, created_by_id=self.user.id, name="Test query", query=query
        )

        model.set_projects(self.project_ids)

        self.query_id = model.id

        self.url = reverse(
            "sentry-api-0-explore-saved-query-starred", args=[self.org.slug, self.query_id]
        )

    def test_post(self):
        with self.feature(self.feature_name):
            assert not ExploreSavedQuery.objects.filter(
                id__in=ExploreSavedQueryStarred.objects.filter(
                    organization=self.org, user_id=self.user.id
                ).values_list("explore_saved_query_id", flat=True)
            ).exists()
            response = self.client.post(self.url, data={"starred": "1"})
            assert response.status_code == 200, response.content
            assert ExploreSavedQuery.objects.filter(
                id__in=ExploreSavedQueryStarred.objects.filter(
                    organization=self.org, user_id=self.user.id
                ).values_list("explore_saved_query_id", flat=True)
            ).exists()
            response = self.client.post(self.url, data={"starred": "0"})
            assert response.status_code == 200, response.content
            assert not ExploreSavedQuery.objects.filter(
                id__in=ExploreSavedQueryStarred.objects.filter(
                    organization=self.org, user_id=self.user.id
                ).values_list("explore_saved_query_id", flat=True)
            ).exists()
