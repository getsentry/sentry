from django.conf import settings
from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
@override_settings(AUTH_V2_SECRET="test")
class CsrfTokenEndpointTest(APITestCase):
    endpoint = "sentry-api-0-auth-v2-csrf"

    def setUp(self):
        super().setUp()
        self.url = reverse(self.endpoint)
        self.user = self.create_user()

    def test_get_csrf_token_anonymous(self):
        response = self.client.get(self.url, HTTP_X_SENTRY_AUTH_V2="test")

        assert response.status_code == 200
        assert response.json()["detail"] == "Set CSRF cookie"
        assert response.json()["session"] is not None
        assert response.json()["session"]["userId"] is None
        assert response.json()["session"]["sessionCsrfToken"] is not None

        # Verify CSRF cookie is set
        assert settings.CSRF_COOKIE_NAME in response.cookies

    def test_get_csrf_token_authenticated(self):
        self.login_as(self.user)
        response = self.client.get(self.url, HTTP_X_SENTRY_AUTH_V2="test")

        assert response.status_code == 200
        assert response.json()["detail"] == "Set CSRF cookie"
        assert response.json()["session"] is not None
        assert response.json()["session"]["userId"] == str(self.user.id)
        assert response.json()["session"]["sessionCsrfToken"] is not None

        # Verify CSRF cookie is set
        assert settings.CSRF_COOKIE_NAME in response.cookies

    def test_rotate_csrf_token_anonymous(self):
        # Get initial CSRF token
        initial_response = self.client.get(self.url, HTTP_X_SENTRY_AUTH_V2="test")
        initial_csrf = initial_response.cookies[settings.CSRF_COOKIE_NAME].value

        # Then rotate the token
        response = self.client.put(self.url, HTTP_X_SENTRY_AUTH_V2="test")
        assert response.status_code == 200

        assert response.json()["detail"] == "Rotated CSRF cookie"
        assert response.json()["session"] is not None
        assert response.json()["session"]["userId"] is None
        assert response.json()["session"]["sessionCsrfToken"] is not None

        # Verify CSRF cookie is rotated
        assert settings.CSRF_COOKIE_NAME in response.cookies
        rotated_csrf = response.cookies[settings.CSRF_COOKIE_NAME].value
        assert rotated_csrf != initial_csrf

    def test_rotate_csrf_token_authenticated(self):
        self.login_as(self.user)

        # Get initial CSRF token
        initial_response = self.client.get(self.url, HTTP_X_SENTRY_AUTH_V2="test")
        initial_csrf = initial_response.cookies[settings.CSRF_COOKIE_NAME].value

        # Then rotate the token
        response = self.client.put(self.url, HTTP_X_SENTRY_AUTH_V2="test")
        assert response.status_code == 200

        assert response.json()["detail"] == "Rotated CSRF cookie"
        assert response.json()["session"] is not None
        assert response.json()["session"]["userId"] == str(self.user.id)
        assert response.json()["session"]["sessionCsrfToken"] is not None

        # Verify CSRF cookie is rotated
        assert settings.CSRF_COOKIE_NAME in response.cookies
        rotated_csrf = response.cookies[settings.CSRF_COOKIE_NAME].value
        assert rotated_csrf != initial_csrf
