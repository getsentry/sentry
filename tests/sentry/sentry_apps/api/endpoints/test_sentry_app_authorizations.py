from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse
from django.utils import timezone
from rest_framework.response import Response

from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.token_exchange.util import GrantTypes
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils import jwt

pytestmark = [requires_snuba]


@control_silo_test
class TestSentryAppAuthorizations(APITestCase):
    endpoint = "sentry-api-0-sentry-app-installation-authorizations"
    method = "post"

    def setUp(self) -> None:
        self.sentry_app = self.create_sentry_app(
            name="nulldb",
            organization=self.create_organization(),
            scopes=["org:read"],
            webhook_url="http://example.com",
        )

        self.other_sentry_app = self.create_sentry_app(
            name="slowdb",
            organization=self.create_organization(),
            scopes=[],
            webhook_url="http://example.com",
        )

        self.install = self.create_sentry_app_installation(
            organization=self.organization,
            slug="nulldb",
            user=self.user,
            prevent_token_exchange=True,
        )

    def get_response(self, *args: int | str, **params: int | str) -> Response:
        """Overriding `get_response` with some default data."""
        return super().get_response(
            self.install.uuid,
            **{
                "client_id": self.sentry_app.application.client_id,
                "client_secret": self.sentry_app.application.client_secret,
                "grant_type": GrantTypes.AUTHORIZATION,
                "code": self.install.api_grant.code,
                **params,
            },
        )

    def test_exchanges_for_token_successfully(self) -> None:
        expected_expires_at = (timezone.now() + timedelta(hours=8)).replace(second=0, microsecond=0)

        response = self.get_success_response()

        token = ApiToken.objects.get(application=self.sentry_app.application)

        assert response.data["scopes"] == self.sentry_app.scope_list
        assert response.data["token"] == token.token
        assert response.data["refreshToken"] == token.refresh_token

        expires_at = response.data["expiresAt"].replace(second=0, microsecond=0)

        assert expires_at == expected_expires_at

    def test_exchange_for_token_missing_data(self) -> None:
        response = self.get_error_response(code=None)

        assert response.status_code == 400

        # This is rejected by the base `SentryAppAuthorizationBaseEndpoint`
        # class's authentication, so expect an unauthorized error.
        response = self.get_error_response(client_id=None)
        assert response.status_code == 401

    def test_incorrect_grant_type(self) -> None:
        self.get_error_response(grant_type="notit", status_code=403)

    def test_invalid_installation(self) -> None:
        self.install = self.create_sentry_app_installation(
            organization=self.organization,
            slug="slowdb",
            user=self.user,
            prevent_token_exchange=True,
        )

        # URL with this new Install's uuid in it
        self.get_error_response(self.install.uuid, status_code=403)

    def test_non_sentry_app_user(self) -> None:
        app = ApiApplication.objects.create(owner=self.create_user())
        self.get_error_response(
            client_id=app.client_id, client_secret=app.client_secret, status_code=401
        )

    def test_invalid_grant(self) -> None:
        self.get_error_response(code="123", status_code=401)

    def test_expired_grant(self) -> None:
        self.install.api_grant.update(expires_at=timezone.now() - timedelta(minutes=2))
        response = self.get_error_response(status_code=401)
        assert response.data["detail"] == "Grant has already expired"

    def test_request_with_exchanged_access_token(self) -> None:
        response = self.get_response()
        token = response.data["token"]

        url = reverse("sentry-api-0-organization-details", args=[self.organization.slug])

        with assume_test_silo_mode(SiloMode.REGION):
            response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token}")

        assert response.status_code == 200
        assert response.data["id"] == str(self.organization.id)

    def test_state(self) -> None:
        response = self.get_success_response(state="abc123")
        assert response.data["state"] == "abc123"

    def test_refresh_token_exchange(self) -> None:
        response = self.get_success_response()

        token_id = response.data["id"]
        token = response.data["token"]
        refresh_token = response.data["refreshToken"]

        response = self.get_success_response(
            code=None, refresh_token=refresh_token, grant_type="refresh_token"
        )

        assert response.data["token"] != token
        assert response.data["refreshToken"] != refresh_token
        assert response.data["expiresAt"] > timezone.now()

        old_token = ApiToken.objects.filter(id=token_id)
        assert not old_token.exists()

        new_token = ApiToken.objects.filter(token=response.data["token"])
        assert new_token.exists()

        new_token = ApiToken.objects.filter(refresh_token=response.data["refreshToken"])
        assert new_token.exists()

    def test_refresh_token_exchange_with_missing_data(self) -> None:
        response = self.get_success_response()

        refresh_token = response.data["refreshToken"]

        assert response.data["refreshToken"] is not None

        response = self.get_error_response(
            code=None, refresh_token=None, grant_type="refresh_token"
        )

        assert response.status_code == 400

        # This is rejected by the base `SentryAppAuthorizationBaseEndpoint`
        # class's authentication, so expect an unauthorized error.
        response = self.get_error_response(
            code=None, refresh_token=refresh_token, grant_type="refresh_token", client_id=None
        )
        assert response.status_code == 401

    def _create_jwt(self, client_id: str, client_secret: str, exp: datetime | None = None) -> str:
        """Helper to create a JWT token for client_secret_jwt grant type"""
        if exp is None:
            exp = datetime.now(UTC) + timedelta(hours=1)

        payload = {
            "iss": client_id,  # Issuer
            "sub": client_id,  # Subject
            "iat": int(datetime.now(UTC).timestamp()),  # Issued at
            "exp": int(exp.timestamp()),  # Expiration
            "jti": str(uuid4()),  # JWT ID (unique identifier)
        }
        return jwt.encode(payload, client_secret, algorithm="HS256")

    @with_feature("organizations:sentry-app-manual-token-refresh")
    def test_client_secret_jwt_exchange_success(self) -> None:
        # First exchange the grant for a token
        self.get_success_response()

        # Now use client_secret_jwt to refresh
        jwt_token = self._create_jwt(
            self.sentry_app.application.client_id, self.sentry_app.application.client_secret
        )

        response = self.get_success_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {jwt_token}"},
            status_code=201,
        )

        assert response.data["scopes"] == self.sentry_app.scope_list
        assert response.data["token"] is not None
        assert response.data["refreshToken"] is not None
        assert response.data["expiresAt"] > timezone.now()

    @with_feature("organizations:sentry-app-manual-token-refresh")
    def test_client_secret_jwt_deletes_old_token(self) -> None:
        # First exchange the grant for a token
        initial_response = self.get_success_response()
        old_token_id = initial_response.data["id"]

        # Now use client_secret_jwt to refresh
        jwt_token = self._create_jwt(
            self.sentry_app.application.client_id, self.sentry_app.application.client_secret
        )

        response = self.get_success_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {jwt_token}"},
            status_code=201,
        )

        assert not ApiToken.objects.filter(id=old_token_id).exists()

        new_token = ApiToken.objects.filter(token=response.data["token"])
        assert new_token.exists()

    @with_feature("organizations:sentry-app-manual-token-refresh")
    def test_client_secret_jwt_missing_authorization_header(self) -> None:
        # First exchange the grant for a token
        self.get_success_response()

        response = self.get_error_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            status_code=401,
        )

        assert "Header is in invalid form" in response.data["detail"]

    @with_feature("organizations:sentry-app-manual-token-refresh")
    def test_client_secret_jwt_expired_token(self) -> None:
        # First exchange the grant for a token
        self.get_success_response()

        # Create an expired JWT
        expired_time = datetime.now(UTC) - timedelta(hours=1)
        jwt_token = self._create_jwt(
            self.sentry_app.application.client_id,
            self.sentry_app.application.client_secret,
            exp=expired_time,
        )

        response = self.get_error_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {jwt_token}"},
            status_code=401,
        )

        assert "Could not validate JWT" in response.data["detail"]

    @with_feature("organizations:sentry-app-manual-token-refresh")
    def test_client_secret_jwt_invalid_signature(self) -> None:
        # First exchange the grant for a token
        self.get_success_response()

        # Create a JWT with wrong secret
        jwt_token = self._create_jwt(self.sentry_app.application.client_id, "wrong-secret")

        response = self.get_error_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {jwt_token}"},
            status_code=401,
        )

        assert "Could not validate JWT" in response.data["detail"]

    @with_feature("organizations:sentry-app-manual-token-refresh")
    def test_client_secret_jwt_wrong_client_id(self) -> None:
        # First exchange the grant for a token
        self.get_success_response()

        jwt_token = self._create_jwt("wrong-client-id", self.sentry_app.application.client_secret)

        response = self.get_error_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {jwt_token}"},
            status_code=401,
        )

        assert "JWT is not valid for this application" in response.data["detail"]

    @with_feature("organizations:sentry-app-manual-token-refresh")
    def test_client_secret_jwt_requires_existing_token(self) -> None:
        # CLIENT_SECRET_JWT should only be used to refresh existing tokens
        # Attempting to use it without first exchanging the grant should fail
        jwt_token = self._create_jwt(
            self.sentry_app.application.client_id, self.sentry_app.application.client_secret
        )

        response = self.get_error_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {jwt_token}"},
            status_code=401,
        )

        # Should fail because there's no existing token to refresh
        assert response.data["detail"] == "Installation does not have a token"

    def test_client_secret_jwt_requires_feature_flag(self) -> None:
        self.get_success_response()

        jwt_token = self._create_jwt(
            self.sentry_app.application.client_id, self.sentry_app.application.client_secret
        )

        response = self.get_error_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {jwt_token}"},
            status_code=403,
        )

        assert (
            response.data["detail"] == "Manual token refresh is not enabled for this organization"
        )

    @with_feature("organizations:sentry-app-manual-token-refresh")
    def test_client_secret_jwt_request_with_new_token(self) -> None:
        # First exchange the grant for a token
        self.get_success_response()

        # Use client_secret_jwt to get a new token
        jwt_token = self._create_jwt(
            self.sentry_app.application.client_id, self.sentry_app.application.client_secret
        )

        response = self.get_success_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {jwt_token}"},
            status_code=201,
        )

        new_token = response.data["token"]

        # Verify the new token works for API requests
        url = reverse("sentry-api-0-organization-details", args=[self.organization.slug])

        with assume_test_silo_mode(SiloMode.REGION):
            response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {new_token}")

        assert response.status_code == 200
        assert response.data["id"] == str(self.organization.id)

    @patch(
        "sentry.sentry_apps.api.endpoints.sentry_app_authorizations.ratelimiter.backend.is_limited",
        return_value=True,
    )
    def test_refresh_token_rate_limited(self, mock_is_limited) -> None:
        """Test that excessive token refresh attempts are rate limited."""
        response = self.get_success_response()
        refresh_token = response.data["refreshToken"]

        response = self.get_error_response(
            code=None, refresh_token=refresh_token, grant_type="refresh_token", status_code=429
        )

        assert response.data["detail"] == "Too many token refresh attempts"
        mock_is_limited.assert_called_once_with(
            f"sentry-app:refresh:{self.sentry_app.id}:{self.sentry_app.proxy_user_id}",
            limit=10,
            window=60,
        )

    @with_feature("organizations:sentry-app-manual-token-refresh")
    @patch(
        "sentry.sentry_apps.api.endpoints.sentry_app_authorizations.ratelimiter.backend.is_limited",
        return_value=True,
    )
    def test_client_secret_jwt_rate_limited(self, mock_is_limited) -> None:
        """Test that excessive manual token refresh attempts are rate limited."""
        self.get_success_response()

        jwt_token = self._create_jwt(
            self.sentry_app.application.client_id, self.sentry_app.application.client_secret
        )

        response = self.get_error_response(
            self.install.uuid,
            grant_type=GrantTypes.CLIENT_SECRET_JWT,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {jwt_token}"},
            status_code=429,
        )

        assert response.data["detail"] == "Too many token refresh attempts"
        mock_is_limited.assert_called_once_with(
            f"sentry-app:refresh:{self.sentry_app.id}:{self.sentry_app.proxy_user_id}",
            limit=10,
            window=60,
        )
