from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiTokenDetailTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.api_token = ApiToken.objects.create(user=self.user)
        self.url = reverse("sentry-api-0-api-token-details", kwargs={"token_id": self.api_token.id})

    def test_simple(self):
        self.login_as(self.user)
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content

    def test_never_cache(self):
        self.login_as(self.user)
        response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_deny_token_access(self):
        token = ApiToken.objects.create(user=self.user, scope_list=[])

        response = self.client.get(
            self.url, format="json", HTTP_AUTHORIZATION=f"Bearer {token.token}"
        )
        assert response.status_code == 403, response.content

    def test_updating_name(self):
        self.login_as(self.user)
        response = self.client.patch(
            self.url,
            data={"name": "testname1"},
        )

        assert response.status_code == 204, response.content

        self.api_token.refresh_from_db()
        assert self.api_token.name == "testname1"

    def test_updating_scopes_denied(self):
        self.login_as(self.user)
        response = self.client.patch(self.url, data={"scopes": ["event:read"]})
        assert response.status_code == 400, response.content

    def test_delete_token(self):
        self.login_as(self.user)
        response = self.client.delete(self.url)
        assert response.status_code == 204, response.content

    def test_cannot_delete_token_as_wrong_user(self):
        user = self.create_user()
        self.login_as(user=user)
        response = self.client.delete(self.url)

        # we do not want to return a 401/403 here as this would be an security enumeration bug
        assert response.status_code == 404, response.content
