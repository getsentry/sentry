from base64 import b64encode

from django.urls import reverse

from sentry.models import ApiKey, ApiToken
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class ApiIndexTest(APITestCase):
    endpoint = "sentry-api-index"

    def test_anonymous(self):
        response = self.get_success_response()
        assert response.data["version"] == "0"
        assert not response.data["user"]
        assert not response.data["auth"]

    def test_session_auth(self):
        self.login_as(user=self.user)
        response = self.get_success_response()
        assert response.data["version"] == "0"
        assert response.data["user"]["id"] == str(self.user.id)
        assert not response.data["auth"]

    def test_key_auth(self):
        org = self.create_organization()
        key = ApiKey.objects.create(organization_id=org.id)
        url = reverse("sentry-api-index")
        response = self.client.get(
            url, HTTP_AUTHORIZATION=b"Basic " + b64encode(f"{key.key}:".encode())
        )
        assert response.status_code == 200
        assert response.data["version"] == "0"
        assert response.data["auth"]["scopes"] == key.get_scopes()
        assert not response.data["user"]

    def test_token_auth(self):
        token = ApiToken.objects.create(user=self.user)
        url = reverse("sentry-api-index")
        response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.status_code == 200
        assert response.data["version"] == "0"
        assert response.data["auth"]["scopes"] == token.get_scopes()
        assert response.data["user"]["id"] == str(self.user.id)
