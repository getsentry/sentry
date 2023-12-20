from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class LoginTest(APITestCase):
    def test_simple(self):
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
    def test_simple(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user)

        url = reverse("sentry-api-0-auth")
        response = self.client.delete(url, format="json")

        assert response.status_code == 204, response.content
