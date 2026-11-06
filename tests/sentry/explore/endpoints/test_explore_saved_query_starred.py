from django.urls import reverse

from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryStarred
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode


class ExploreSavedQueryStarredTest(APITestCase, SnubaTestCase):
    feature_name = "organizations:visibility-explore-view"

    def setUp(self) -> None:
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

    def test_post(self) -> None:
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

    def _use_token(self, scope_list: list[str]) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()
            token = self.create_user_auth_token(user=self.user, scope_list=scope_list)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.token}")

    @with_feature("organizations:granular-permission-scopes")
    def test_user_preference_write_can_star(self) -> None:
        self._use_token(["user_preference:write"])
        with self.feature(self.feature_name):
            response = self.client.post(self.url, data={"starred": "1"})
        assert response.status_code == 200, response.content
        assert ExploreSavedQueryStarred.objects.filter(
            organization=self.org, user_id=self.user.id, explore_saved_query_id=self.query_id
        ).exists()

    @with_feature("organizations:granular-permission-scopes")
    def test_user_preference_read_cannot_star(self) -> None:
        self._use_token(["user_preference:read"])
        with self.feature(self.feature_name):
            response = self.client.post(self.url, data={"starred": "1"})
        assert response.status_code == 403
