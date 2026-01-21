import datetime

from django.urls import reverse
from rest_framework.test import APIClient

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuthUserInfoTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.path = reverse(
            "sentry-api-0-oauth-userinfo",
        )
        self.client = APIClient()

    def test_requires_access_token(self) -> None:
        response = self.client.get(self.path)

        assert response.status_code == 401
        assert response.data["detail"] == "Bearer token required"
        assert response["WWW-Authenticate"] == 'Bearer realm="api"'

    def test_rejects_non_bearer_scheme(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["openid"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

        response = self.client.get(self.path)

        assert response.status_code == 401
        assert response.data["detail"] == "Bearer token required"
        assert response["WWW-Authenticate"] == 'Bearer realm="api"'

    def test_declines_invalid_token(self) -> None:
        self.client.credentials(HTTP_AUTHORIZATION="Bearer abcd")

        response = self.client.get(self.path)

        assert response.status_code == 401
        assert response.data["error"] == "invalid_token"
        assert response.data["error_description"] == "Access token not found"
        assert response["WWW-Authenticate"] == 'Bearer realm="api", error="invalid_token"'

    def test_declines_if_no_openid_scope(self) -> None:
        token_without_openid_scope = self.create_user_auth_token(user=self.user, scope_list=[])
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + token_without_openid_scope.token)

        response = self.client.get(self.path)

        assert response.status_code == 403
        assert response.data["error"] == "insufficient_scope"
        assert response.data["error_description"] == "openid scope is required"
        assert (
            response["WWW-Authenticate"]
            == 'Bearer realm="api", error="insufficient_scope", scope="openid"'
        )

    def test_gets_sub_with_openid_scope(self) -> None:
        openid_only_token = self.create_user_auth_token(user=self.user, scope_list=["openid"])

        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + openid_only_token.token)

        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data == {"sub": self.user.id}

    def test_gets_email_information(self) -> None:
        email_token = self.create_user_auth_token(user=self.user, scope_list=["openid", "email"])
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + email_token.token)

        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data == {
            "sub": self.user.id,
            "email": self.user.email,
            "email_verified": True,
        }

    def test_gets_profile_information(self) -> None:
        profile_token = self.create_user_auth_token(
            user=self.user, scope_list=["openid", "profile"]
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + profile_token.token)

        response = self.client.get(self.path)

        assert response.status_code == 200

        assert response.data["avatar_type"] == 0
        assert response.data["avatar_url"] is None
        assert isinstance(response.data["date_joined"], datetime.datetime)
        assert response.data["name"] == ""
        assert response.data["sub"] == self.user.id

    def test_gets_multiple_scopes(self) -> None:
        all_access_token = self.create_user_auth_token(
            user=self.user, scope_list=["openid", "profile", "email"]
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + all_access_token.token)

        response = self.client.get(self.path)

        assert response.status_code == 200

        # profile information
        assert response.data["avatar_type"] == 0
        assert response.data["avatar_url"] is None
        assert isinstance(response.data["date_joined"], datetime.datetime)
        assert response.data["name"] == ""

        # email information
        assert response.data["email"] == self.user.email
        assert response.data["email_verified"]

        # openid information
        assert response.data["sub"] == self.user.id
