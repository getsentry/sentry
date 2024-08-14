from unittest.mock import patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuthLoginEndpointTest(APITestCase):
    endpoint = "sentry-api-0-auth-login"
    method = "post"

    def setUp(self):
        # Requests to set the test cookie
        self.client.get(reverse("sentry-api-0-auth-config"))

    def test_login_invalid_password(self):
        response = self.get_error_response(
            username=self.user.username, password="bizbar", status_code=400
        )
        assert response.data["errors"]["__all__"] == [
            "Please enter a correct username and password. Note that both fields may be case-sensitive."
        ]

    def test_login_valid_credentials(self):
        response = self.get_success_response(username=self.user.username, password="admin")
        assert response.data["nextUri"] == "/organizations/new/"

    def test_must_reactivate(self):
        self.user.update(is_active=False)

        response = self.get_success_response(username=self.user.username, password="admin")
        assert response.data["nextUri"] == "/auth/reactivate/"

    @patch(
        "sentry.api.endpoints.auth_login.ratelimiter.backend.is_limited",
        autospec=True,
        return_value=True,
    )
    def test_login_ratelimit(self, is_limited):
        response = self.get_error_response(
            username=self.user.username, password="admin", status_code=400
        )
        assert [str(s) for s in response.data["errors"]["__all__"]] == [
            "You have made too many failed authentication attempts. Please try again later."
        ]
