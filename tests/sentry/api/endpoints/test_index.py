from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import control_silo_test
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


@control_silo_test
def test_anonymous(client: APIClient) -> None:
    response = client.get(reverse("sentry-api-index"))
    assert response.status_code == 200
    assert response.data["version"] == "0"
    assert not response.data["user"]
    assert not response.data["auth"]


@control_silo_test
class ApiIndexTest(APITestCase):
    endpoint = "sentry-api-index"

    def test_session_auth(self) -> None:
        self.login_as(user=self.user)
        response = self.get_success_response()
        assert response.data["version"] == "0"
        assert response.data["user"]["id"] == str(self.user.id)
        assert not response.data["auth"]

    def test_key_auth(self) -> None:
        org = self.create_organization()
        key = ApiKey.objects.create(organization_id=org.id)
        url = reverse("sentry-api-index")
        response = self.client.get(
            url,
            HTTP_AUTHORIZATION=self.create_basic_auth_header(key.key),
        )
        assert response.status_code == 200
        assert response.data["version"] == "0"
        assert response.data["auth"]["scopes"] == key.get_scopes()
        assert not response.data["user"]

    def test_token_auth(self) -> None:
        token = ApiToken.objects.create(user=self.user)
        url = reverse("sentry-api-index")
        response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.status_code == 200
        assert response.data["version"] == "0"
        assert response.data["auth"]["scopes"] == token.get_scopes()
        assert response.data["user"]["id"] == str(self.user.id)

    def test_token_auth_returns_stored_scopes(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
        url = reverse("sentry-api-index")
        response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.status_code == 200
        # Deprecated scope translations (org:read -> dashboard:*) are not reported.
        assert response.data["auth"]["scopes"] == ["org:read"]

    @override_settings(SEER_API_SHARED_SECRET="service-account-secret")
    @with_feature("organizations:service-accounts")
    def test_service_account_has_no_user(self) -> None:
        service_account = self.create_service_account(
            organization=self.organization, scope_list=["org:read"]
        )
        viewer_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.organization.id,
            ),
            key="service-account-secret",
        )
        response = self.client.get(
            reverse("sentry-api-index"), HTTP_X_VIEWER_CONTEXT=viewer_context
        )
        assert response.status_code == 200, response.content
        assert response.data["user"] is None
        assert response.data["auth"]["scopes"] == ["org:read"]
