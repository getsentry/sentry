from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.token import AuthTokenType


@control_silo_test
class AuthGetTest(APITestCase):
    def test_get_with_bearer_token(self) -> None:
        user = self.create_user(email="a@example.com")
        api_token = ApiToken.objects.create(token_type=AuthTokenType.USER, user=user)
        url = reverse("sentry-api-0-auth")
        response = self.client.get(
            url,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {api_token.plaintext_token}",
        )
        assert response.status_code == 200
        assert response.data["id"] == str(user.id)

    def test_get_unauthenticated(self) -> None:
        url = reverse("sentry-api-0-auth")
        response = self.client.get(url, format="json")
        assert response.status_code == 400


@control_silo_test
class LoginTest(APITestCase):
    def test_simple(self) -> None:
        user = self.create_user(email="a@example.com")
        user.set_password("test")
        user.save()

        url = reverse("sentry-api-0-auth")
        response = self.client.post(
            url,
            format="json",
            HTTP_AUTHORIZATION=self.create_basic_auth_header("a@example.com", "test"),
        )

        assert response.status_code == 200, response.content


@control_silo_test
class LogoutTest(APITestCase):
    def test_simple(self) -> None:
        user = self.create_user(email="a@example.com")

        self.login_as(user)

        url = reverse("sentry-api-0-auth")
        response = self.client.delete(url, format="json")

        assert response.status_code == 204, response.content
