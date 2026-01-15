from functools import cached_property
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.locks import locks
from sentry.models.apiapplication import ApiApplication
from sentry.models.apidevicecode import ApiDeviceCode
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test
class OAuthTokenTest(TestCase):
    @cached_property
    def path(self) -> str:
        return "/oauth/token/"

    def test_no_get(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(self.path)

        assert resp.status_code == 405

    def test_missing_grant_type(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(self.path, {"client_id": "abcd", "client_secret": "abcd"})

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_request"}

    def test_invalid_grant_type(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {"grant_type": "foo", "client_id": "abcd", "client_secret": "abcd"},
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "unsupported_grant_type"}


@control_silo_test
class OAuthTokenCodeTest(TestCase):
    @cached_property
    def path(self) -> str:
        return "/oauth/token/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.client_secret = self.application.client_secret
        self.grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
        )

    def _basic_auth_value(self) -> str:
        import base64

        creds = f"{self.application.client_id}:{self.client_secret}".encode()
        return f"Basic {base64.b64encode(creds).decode('ascii')}"

    def test_basic_auth_header_too_large(self) -> None:
        self.login_as(self.user)
        oversized = "A" * 5001  # valid base64 chars, exceeds limit

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
            },
            HTTP_AUTHORIZATION=f"Basic {oversized}",
        )
        assert resp.status_code == 401
        assert resp.json() == {"error": "invalid_client"}

    def test_basic_auth_success(self) -> None:
        self.login_as(self.user)
        auth_value = self._basic_auth_value()
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
            },
            HTTP_AUTHORIZATION=auth_value,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["expires_in"], int)
        assert data["token_type"] == "Bearer"
        assert "no-store" in resp["Cache-Control"]

    def test_basic_auth_invalid_base64_character(self) -> None:
        self.login_as(self.user)
        invalid_value = f"{self._basic_auth_value()}$"
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
            },
            HTTP_AUTHORIZATION=invalid_value,
        )
        assert resp.status_code == 401
        assert resp.json() == {"error": "invalid_client"}
        assert resp["WWW-Authenticate"].startswith("Basic ")
        assert "no-store" in resp["Cache-Control"]

    def test_basic_and_body_conflict(self) -> None:
        self.login_as(self.user)
        auth_value = self._basic_auth_value()
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
            HTTP_AUTHORIZATION=auth_value,
        )
        assert resp.status_code == 400
        assert resp.json() == {"error": "invalid_request"}
        assert "no-store" in resp["Cache-Control"]

    def test_missing_client_id(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 401
        assert json.loads(resp.content) == {"error": "invalid_client"}
        assert resp["WWW-Authenticate"].startswith("Basic ")
        assert "no-store" in resp["Cache-Control"]

    def test_invalid_client_id(self) -> None:
        self.login_as(self.user)
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": "def",
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 401
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_missing_client_secret(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "client_id": self.application.client_id,
                "code": self.grant.code,
            },
        )
        assert resp.status_code == 401
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_invalid_client_secret(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": "rodrick_rules",
            },
        )
        assert resp.status_code == 401
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_missing_code(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_invalid_code(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": "abc",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_expired_grant(self) -> None:
        self.login_as(self.user)
        expired_grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            expires_at="2022-01-01 11:11+00:00",
        )
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": expired_grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_one_time_use_grant(self) -> None:
        self.login_as(self.user)
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

        # attempt to re-use the same grant code
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400

    def test_grant_lock(self) -> None:
        self.login_as(self.user)

        # Simulate a concurrent request by using an existing grant
        # that has its grant lock taken out.
        lock = locks.get(ApiGrant.get_lock_key(self.grant.id), duration=10, name="api_grant")
        lock.acquire()

        # Attempt to create a token with the same grant
        # This should fail because the lock is held by the previous request
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert resp.json() == {"error": "invalid_grant"}

    def test_inactive_application_rejects_token_creation(self) -> None:
        """Test that tokens cannot be created for inactive applications.

        This verifies the fix for a TOCTOU vulnerability where an application
        could be deactivated between the initial grant query and token creation.
        The application status check inside the lock prevents this race condition.
        """
        self.login_as(self.user)

        # Deactivate the application after grant was created
        from sentry.models.apiapplication import ApiApplicationStatus

        self.application.status = ApiApplicationStatus.inactive
        self.application.save()

        # Attempt to exchange the authorization code for a token
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        # Should fail because application is not active.
        # Per RFC 6749 §5.2, this is invalid_grant (grant is "revoked") not invalid_client
        # (client authentication succeeded - we verified the credentials).
        assert resp.status_code == 400
        assert resp.json() == {"error": "invalid_grant"}

        # Verify grant was deleted (RFC 6749 §10.5: invalidate on failure)
        assert not ApiGrant.objects.filter(id=self.grant.id).exists()

        # Verify no token was created
        assert not ApiToken.objects.filter(application=self.application, user=self.user).exists()

    def test_invalid_redirect_uri(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "redirect_uri": "cheese.org",
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_no_open_id_token(self) -> None:
        """
        Checks that the OIDC token is not returned unless the right scope is approved.
        """
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "code": self.grant.code,
                "redirect_uri": self.application.get_default_redirect_uri(),
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert "id_token" not in data

    def test_missing_redirect_uri_when_bound(self) -> None:
        """
        When the grant stored a redirect_uri, the token request must include
        the exact same redirect_uri.
        """
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_valid_params(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 200
        data = json.loads(resp.content)

        token = ApiToken.objects.get(token=data["access_token"])
        assert token.application == self.application
        assert token.user == self.grant.user
        assert token.get_scopes() == self.grant.get_scopes()

        assert data["access_token"] == token.token
        assert data["refresh_token"] == token.refresh_token
        assert isinstance(data["expires_in"], int)
        assert data["token_type"] == "Bearer"
        assert "no-store" in resp["Cache-Control"]
        assert data["user"]["id"] == str(token.user_id)

    def test_expires_in_value(self) -> None:
        """
        Verify that expires_in correctly represents seconds until expiry.
        The old code incorrectly calculated (now - expires_at) instead of
        (expires_at - now), producing negative values for valid tokens.
        """
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 200
        data = json.loads(resp.content)

        # Default token expiration is 30 days (2,592,000 seconds)
        # expires_in should be positive and close to 30 days
        expires_in = data["expires_in"]
        assert isinstance(expires_in, int)
        assert expires_in > 0, "expires_in should be positive (seconds until expiry)"
        # Allow for a few seconds of test execution time, but should be close to 30 days
        expected_seconds = 30 * 24 * 60 * 60  # 2,592,000 seconds
        assert expires_in >= expected_seconds - 60, "expires_in should be close to 30 days"
        assert expires_in <= expected_seconds, "expires_in should not exceed 30 days"

    def test_valid_params_id_token(self) -> None:
        self.login_as(self.user)
        open_id_grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            scope_list=["openid"],
        )
        with self.options({"codecov.signing_secret": "signing_secret"}):
            resp = self.client.post(
                self.path,
                {
                    "grant_type": "authorization_code",
                    "redirect_uri": self.application.get_default_redirect_uri(),
                    "code": open_id_grant.code,
                    "client_id": self.application.client_id,
                    "client_secret": self.client_secret,
                },
            )
            assert resp.status_code == 200

            data = json.loads(resp.content)
            token = ApiToken.objects.get(token=data["access_token"])

            assert token.get_scopes() == ["openid"]
            assert data["refresh_token"] == token.refresh_token
            assert data["access_token"] == token.token
            assert isinstance(data["expires_in"], int)
            assert data["token_type"] == "Bearer"
            assert data["user"]["id"] == str(token.user_id)

            assert data["id_token"].count(".") == 2

    def test_valid_params_id_token_additional_scopes(self) -> None:
        self.login_as(self.user)
        open_id_grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            scope_list=["openid", "profile", "email"],
        )
        with self.options({"codecov.signing_secret": "signing_secret"}):
            resp = self.client.post(
                self.path,
                {
                    "grant_type": "authorization_code",
                    "redirect_uri": self.application.get_default_redirect_uri(),
                    "code": open_id_grant.code,
                    "client_id": self.application.client_id,
                    "client_secret": self.client_secret,
                },
            )
            assert resp.status_code == 200

            data = json.loads(resp.content)
            token = ApiToken.objects.get(token=data["access_token"])

            assert token.get_scopes() == ["email", "openid", "profile"]
            assert data["refresh_token"] == token.refresh_token
            assert data["access_token"] == token.token
            assert isinstance(data["expires_in"], int)
            assert data["token_type"] == "Bearer"
            assert data["user"]["id"] == str(token.user_id)

            assert data["id_token"].count(".") == 2


@control_silo_test
class OAuthTokenRefreshTokenTest(TestCase):
    @cached_property
    def path(self) -> str:
        return "/oauth/token/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.client_secret = self.application.client_secret

        self.grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
        )
        self.token = ApiToken.objects.create(
            application=self.application, user=self.user, expires_at=timezone.now()
        )

    def test_missing_client_id(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "refresh_token",
                "refresh_token": self.token.refresh_token,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 401
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_invalid_client_id(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "refresh_token",
                "client_id": "abc",
                "refresh_token": self.token.refresh_token,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 401
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_missing_refresh_token(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "refresh_token",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_request"}

    def test_invalid_refresh_token(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "refresh_token",
                "client_id": self.application.client_id,
                "refresh_token": "foo",
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_valid_params(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "refresh_token",
                "client_id": self.application.client_id,
                "refresh_token": self.token.refresh_token,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 200

        token2 = ApiToken.objects.get(id=self.token.id)

        assert token2.application == self.token.application
        assert token2.user == self.token.user
        assert token2.get_scopes() == self.token.get_scopes()
        assert self.token.expires_at is not None
        assert token2.expires_at is not None
        assert token2.expires_at > self.token.expires_at
        assert token2.token != self.token.token
        assert token2.refresh_token != self.token.refresh_token
        assert token2.refresh_token

    def test_inactive_application_rejects_token_refresh(self) -> None:
        """Test that inactive applications cannot refresh tokens.

        This verifies that when an application is deactivated (e.g., for security
        reasons), existing refresh tokens cannot be used to generate new access
        tokens, preventing the application from continuing to access the API.
        """
        self.login_as(self.user)

        # Deactivate the application after token was created
        from sentry.models.apiapplication import ApiApplicationStatus

        self.application.status = ApiApplicationStatus.inactive
        self.application.save()

        # Attempt to refresh the token
        resp = self.client.post(
            self.path,
            {
                "grant_type": "refresh_token",
                "client_id": self.application.client_id,
                "refresh_token": self.token.refresh_token,
                "client_secret": self.client_secret,
            },
        )

        # Should fail because application is not active.
        # Per RFC 6749 §5.2, this is invalid_grant (token is "revoked") not invalid_client
        # (client authentication succeeded - we verified the credentials).
        assert resp.status_code == 400
        assert resp.json() == {"error": "invalid_grant"}

        # Verify the token was not refreshed (still has old values)
        token_after = ApiToken.objects.get(id=self.token.id)
        assert token_after.token == self.token.token
        assert token_after.refresh_token == self.token.refresh_token
        assert token_after.expires_at == self.token.expires_at


@control_silo_test
class OAuthTokenOrganizationScopedTest(TestCase):
    @cached_property
    def path(self) -> str:
        return "/oauth/token/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="https://example.com",
            scopes=["org:read"],
            requires_org_level_access=True,
        )
        self.client_secret = self.application.client_secret
        self.grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            organization_id=self.organization.id,
        )

    def test_valid_params(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 200
        data = json.loads(resp.content)

        token = ApiToken.objects.get(token=data["access_token"])
        assert token.application == self.application
        assert token.user == self.grant.user
        assert token.get_scopes() == self.grant.get_scopes()
        assert token.organization_id == self.organization.id


@control_silo_test
class OAuthTokenPKCETest(TestCase):
    """Tests for PKCE (Proof Key for Code Exchange) verification per RFC 7636."""

    @cached_property
    def path(self) -> str:
        return "/oauth/token/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.client_secret = self.application.client_secret

    def test_pkce_s256_valid_verifier(self) -> None:
        """Test that valid S256 PKCE verifier is accepted."""
        # code_verifier that generates the challenge below when hashed with SHA256
        code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        # BASE64URL(SHA256(code_verifier)) without padding
        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant.code,
                "code_verifier": code_verifier,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert "access_token" in data
        assert data["token_type"] == "Bearer"

    def test_pkce_missing_verifier_when_challenge_exists(self) -> None:
        """Test that missing code_verifier is rejected when challenge exists."""
        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant.code,
                # Missing code_verifier
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_grant"

    def test_pkce_invalid_verifier_s256(self) -> None:
        """Test that incorrect code_verifier is rejected for S256."""
        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant.code,
                "code_verifier": "wrong_verifier_that_does_not_match_challenge_at_all",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_grant"

    def test_pkce_verifier_too_short(self) -> None:
        """Test that code_verifier shorter than 43 chars is rejected."""
        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant.code,
                "code_verifier": "too_short",  # Only 9 chars, min is 43
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_grant"

    def test_pkce_plain_method_rejected(self) -> None:
        """Test that 'plain' PKCE method is rejected per OAuth 2.1."""
        code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            code_challenge=code_verifier,
            code_challenge_method="plain",
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant.code,
                "code_verifier": code_verifier,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_grant"
        # Verify the grant was deleted
        assert not ApiGrant.objects.filter(code=grant.code).exists()

    def test_pkce_verifier_invalid_characters(self) -> None:
        """Test that code_verifier with invalid characters is rejected."""
        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        # Invalid characters (spaces, !) - only unreserved chars allowed
        invalid_verifier = "invalid verifier! with spaces and special chars@#$"

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant.code,
                "code_verifier": invalid_verifier,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_grant"

    def test_pkce_no_challenge_no_verifier_works(self) -> None:
        """Test that grants without PKCE work when no verifier is provided."""
        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            # No code_challenge or code_challenge_method
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant.code,
                # No code_verifier
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert "access_token" in data

    def test_pkce_failed_verifier_invalidates_grant(self) -> None:
        """Test that failed PKCE verification immediately invalidates the grant (RFC 6749 §10.5)."""
        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        # Attempt with wrong verifier
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant.code,
                "code_verifier": "wrong_verifier_that_does_not_match_challenge",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_grant"

        # Grant should be immediately deleted (single-use per RFC 6749)
        assert not ApiGrant.objects.filter(id=grant.id).exists()

    def test_pkce_second_attempt_after_failure_rejected(self) -> None:
        """Test that authorization code cannot be reused after failed PKCE attempt."""
        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        grant_code = grant.code

        # First attempt with wrong verifier
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant_code,
                "code_verifier": "wrong_verifier_that_does_not_match_challenge",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400

        # Second attempt with correct verifier should fail (code already consumed)
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant_code,
                "code_verifier": code_verifier,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_grant"

    def test_failed_redirect_uri_invalidates_grant(self) -> None:
        """Test that invalid redirect_uri immediately invalidates the grant (RFC 6749 §10.5)."""
        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
        )

        # Attempt with wrong redirect_uri
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://evil.com",
                "code": grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_grant"

        # Grant should be immediately deleted
        assert not ApiGrant.objects.filter(id=grant.id).exists()

    def test_pkce_verifier_too_long(self) -> None:
        """Test that code_verifier longer than 128 chars is rejected.

        Per RFC 7636 §4.1, code_verifier must be 43-128 characters.
        """
        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        # Generate a 129-character verifier (exceeds max of 128)
        invalid_verifier = "a" * 129

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": "https://example.com",
                "code": grant.code,
                "code_verifier": invalid_verifier,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 400
        data = json.loads(resp.content)
        assert data["error"] == "invalid_grant"

        # Grant should be immediately deleted on validation failure
        assert not ApiGrant.objects.filter(id=grant.id).exists()


@control_silo_test
class OAuthTokenDeviceCodeTest(TestCase):
    """Tests for device code grant type (RFC 8628 §3.4/§3.5)."""

    @cached_property
    def path(self) -> str:
        return "/oauth/token/"

    def setUp(self) -> None:
        super().setUp()
        from sentry.models.apidevicecode import ApiDeviceCode, DeviceCodeStatus

        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.client_secret = self.application.client_secret
        self.device_code = ApiDeviceCode.objects.create(
            application=self.application,
            scope_list=["project:read"],
        )
        self.DeviceCodeStatus = DeviceCodeStatus

    def test_missing_device_code(self) -> None:
        """Missing device_code should return invalid_request."""
        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_request"}

    def test_invalid_device_code(self) -> None:
        """Invalid device_code should return invalid_grant."""
        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": "invalid",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_authorization_pending(self) -> None:
        """Pending device code should return authorization_pending."""
        assert self.device_code.status == self.DeviceCodeStatus.PENDING

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "authorization_pending"}

        # Device code should still exist
        assert ApiDeviceCode.objects.filter(id=self.device_code.id).exists()

    def test_access_denied(self) -> None:
        """Denied device code should return access_denied and delete the code."""
        self.device_code.status = self.DeviceCodeStatus.DENIED
        self.device_code.save()

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "access_denied"}

        # Device code should be deleted
        assert not ApiDeviceCode.objects.filter(id=self.device_code.id).exists()

    def test_expired_token(self) -> None:
        """Expired device code should return expired_token and delete the code."""
        from datetime import timedelta

        self.device_code.expires_at = timezone.now() - timedelta(minutes=1)
        self.device_code.save()

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "expired_token"}

        # Device code should be deleted
        assert not ApiDeviceCode.objects.filter(id=self.device_code.id).exists()

    def test_success_approved(self) -> None:
        """Approved device code should return access token and delete the code."""
        from sentry.models.apidevicecode import ApiDeviceCode

        self.device_code.status = self.DeviceCodeStatus.APPROVED
        self.device_code.user = self.user
        self.device_code.save()

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

        data = json.loads(resp.content)
        assert "access_token" in data
        assert data["token_type"] == "Bearer"
        assert "expires_in" in data
        assert data["scope"] == "project:read"
        assert data["user"]["id"] == str(self.user.id)

        # Device code should be deleted
        assert not ApiDeviceCode.objects.filter(id=self.device_code.id).exists()

        # Token should be created
        token = ApiToken.objects.get(token=data["access_token"])
        assert token.user == self.user
        assert token.application == self.application

    def test_success_with_organization(self) -> None:
        """Approved device code with org should include organization_id."""
        organization = self.create_organization(owner=self.user)

        self.device_code.status = self.DeviceCodeStatus.APPROVED
        self.device_code.user = self.user
        self.device_code.organization_id = organization.id
        self.device_code.save()

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

        data = json.loads(resp.content)
        assert data["organization_id"] == str(organization.id)

    def test_wrong_application(self) -> None:
        """Device code for different application should return invalid_grant."""
        other_app = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://other.com"
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": other_app.client_id,
                "client_secret": other_app.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_slow_down(self) -> None:
        """Polling too fast should return slow_down error."""
        from unittest.mock import patch

        # First request should succeed (returns authorization_pending)
        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "authorization_pending"}

        # Second request within the rate limit window should return slow_down
        with patch("sentry.ratelimits.backend.is_limited", return_value=True):
            resp = self.client.post(
                self.path,
                {
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "device_code": self.device_code.device_code,
                    "client_id": self.application.client_id,
                    "client_secret": self.client_secret,
                },
            )
            assert resp.status_code == 400
            assert json.loads(resp.content) == {"error": "slow_down"}

    def test_success_returns_refresh_token(self) -> None:
        """Approved device code should return refresh_token for token renewal.

        Per RFC 6749 §5.1, refresh_token is OPTIONAL but RECOMMENDED for
        headless clients that cannot easily re-authenticate interactively.
        """
        self.device_code.status = self.DeviceCodeStatus.APPROVED
        self.device_code.user = self.user
        self.device_code.save()

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

        data = json.loads(resp.content)
        assert "refresh_token" in data
        assert data["refresh_token"]

        # Verify the refresh_token can be used
        token = ApiToken.objects.get(token=data["access_token"])
        assert token.refresh_token == data["refresh_token"]

    def test_inactive_application_rejects_device_code_grant(self) -> None:
        """Inactive applications cannot exchange approved device codes for tokens.

        This prevents tokens from being issued after an application is disabled
        (e.g., for security reasons) even if the device code was approved while
        the application was still active.
        """
        from sentry.models.apiapplication import ApiApplicationStatus

        self.device_code.status = self.DeviceCodeStatus.APPROVED
        self.device_code.user = self.user
        self.device_code.save()

        # Deactivate the application after approval
        self.application.status = ApiApplicationStatus.inactive
        self.application.save()

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )

        # Per RFC 6749 §5.2, invalid_grant when grant is "revoked"
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

        # Device code should be deleted
        assert not ApiDeviceCode.objects.filter(id=self.device_code.id).exists()

        # No token should be created
        assert not ApiToken.objects.filter(application=self.application, user=self.user).exists()

    def test_public_client_success(self) -> None:
        """Public clients (without client_secret) should be able to exchange device codes.

        Per RFC 8628 §5.6, device clients are generally public clients that cannot
        securely store credentials. They should be able to authenticate with just
        client_id.
        """
        self.device_code.status = self.DeviceCodeStatus.APPROVED
        self.device_code.user = self.user
        self.device_code.save()

        # Request without client_secret (public client)
        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                # No client_secret - this is a public client
            },
        )
        assert resp.status_code == 200

        data = json.loads(resp.content)
        assert "access_token" in data
        assert data["token_type"] == "Bearer"
        assert data["scope"] == "project:read"
        assert data["user"]["id"] == str(self.user.id)

        # Device code should be deleted
        assert not ApiDeviceCode.objects.filter(id=self.device_code.id).exists()

        # Token should be created
        token = ApiToken.objects.get(token=data["access_token"])
        assert token.user == self.user
        assert token.application == self.application

    def test_public_client_invalid_client_id(self) -> None:
        """Public clients with invalid client_id should return invalid_client."""
        self.device_code.status = self.DeviceCodeStatus.APPROVED
        self.device_code.user = self.user
        self.device_code.save()

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": "nonexistent_client_id",
                # No client_secret - public client
            },
        )
        assert resp.status_code == 401
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_public_client_missing_client_id(self) -> None:
        """Device flow without client_id should return invalid_client."""
        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                # No client_id or client_secret
            },
        )
        assert resp.status_code == 401
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_public_client_authorization_pending(self) -> None:
        """Public client polling pending device code should return authorization_pending."""
        assert self.device_code.status == self.DeviceCodeStatus.PENDING

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                # No client_secret - public client
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "authorization_pending"}

        # Device code should still exist
        assert ApiDeviceCode.objects.filter(id=self.device_code.id).exists()

    def test_confidential_client_wrong_secret_rejected(self) -> None:
        """Device flow with wrong client_secret should be rejected.

        When a client provides client_secret, we should validate it even
        though device flow supports public clients. This allows confidential
        clients to use device flow with full credential validation.
        """
        self.device_code.status = self.DeviceCodeStatus.APPROVED
        self.device_code.user = self.user
        self.device_code.save()

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device_code.device_code,
                "client_id": self.application.client_id,
                "client_secret": "wrong_secret",
            },
        )
        assert resp.status_code == 401
        assert json.loads(resp.content) == {"error": "invalid_client"}


@control_silo_test
class OAuthTokenJWTBearerTest(TestCase):
    """Tests for JWT Bearer grant type (RFC 7523) for ID-JAG tokens."""

    @cached_property
    def path(self) -> str:
        return "/oauth/token/"

    def setUp(self) -> None:
        super().setUp()
        import orjson
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from jwt import algorithms as jwt_algorithms

        from sentry.models.trustedidentityprovider import TrustedIdentityProvider
        from sentry.utils import jwt

        self.jwt = jwt
        self.orjson = orjson

        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.client_secret = self.application.client_secret

        # Generate RSA key pair for signing JWTs
        self.private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048, backend=default_backend()
        )
        self.private_key_pem = self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")

        # Create JWK from public key
        public_key = self.private_key.public_key()
        jwk_json = jwt_algorithms.RSAAlgorithm.to_jwk(public_key)
        self.jwk = orjson.loads(jwk_json)
        self.kid = "test-key-1"
        self.jwk["kid"] = self.kid
        self.jwk["use"] = "sig"
        self.jwk["alg"] = "RS256"

        self.issuer = "https://acme.okta.com"
        self.jwks_uri = "https://acme.okta.com/.well-known/jwks.json"

        # Create TrustedIdentityProvider
        self.idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer=self.issuer,
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk]},
            jwks_cached_at=timezone.now(),
        )

    def _create_jwt(self, claims: dict, kid: str | None = None) -> str:
        """Create a signed JWT for testing.

        Automatically adds 'exp' claim (1 hour from now) if not provided.
        """
        import time

        full_claims = claims.copy()
        if "exp" not in full_claims:
            full_claims["exp"] = int(time.time()) + 3600  # 1 hour from now

        return self.jwt.encode(
            full_claims,
            self.private_key_pem,
            algorithm="RS256",
            headers={"kid": kid or self.kid},
        )

    def test_missing_assertion(self) -> None:
        """Missing assertion should return invalid_request."""
        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_request"}

    def test_invalid_assertion_format(self) -> None:
        """Malformed JWT should return invalid_request."""
        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": "not.a.valid.jwt",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_request"}

    def test_missing_issuer_claim(self) -> None:
        """JWT without issuer claim should return invalid_grant."""
        token = self._create_jwt({"sub": "user@example.com", "email": self.user.email})

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_untrusted_issuer(self) -> None:
        """JWT from untrusted issuer should return invalid_grant."""
        token = self._create_jwt(
            {
                "iss": "https://untrusted.example.com",
                "sub": "user@example.com",
                "email": self.user.email,
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_disabled_idp(self) -> None:
        """JWT from disabled IdP should return invalid_grant."""
        self.idp.enabled = False
        self.idp.save()

        token = self._create_jwt(
            {"iss": self.issuer, "sub": "user@example.com", "email": self.user.email}
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_client_not_allowed(self) -> None:
        """JWT should fail if client is not in IdP's allowed list."""
        self.idp.allowed_client_ids = ["other-client-id"]
        self.idp.save()

        token = self._create_jwt(
            {"iss": self.issuer, "sub": "user@example.com", "email": self.user.email}
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_missing_subject_claim(self) -> None:
        """JWT without subject claim should return invalid_grant."""
        token = self._create_jwt(
            {"iss": self.issuer, "email": self.user.email, "aud": "http://testserver"}
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_missing_email_claim(self) -> None:
        """JWT without email claim should return invalid_grant."""
        token = self._create_jwt(
            {"iss": self.issuer, "sub": "user@example.com", "aud": "http://testserver"}
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_missing_exp_claim(self) -> None:
        """JWT without exp claim should return invalid_grant."""
        # Create JWT without exp claim by explicitly setting exp=None
        # The _create_jwt auto-adds exp, so we need to create the token manually
        claims = {
            "iss": self.issuer,
            "sub": "user@example.com",
            "email": self.user.email,
            "aud": "http://testserver",
        }
        # Don't use _create_jwt since it adds exp automatically
        token = self.jwt.encode(
            claims,
            self.private_key_pem,
            algorithm="RS256",
            headers={"kid": self.kid},
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_user_not_found(self) -> None:
        """JWT with unknown email should return invalid_grant."""
        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": "unknown@example.com",
                "aud": "http://testserver",
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_success(self) -> None:
        """Valid JWT should return access token."""
        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": self.user.email,
                "aud": "http://testserver",
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

        data = json.loads(resp.content)
        assert "access_token" in data
        assert data["token_type"] == "Bearer"
        assert data["user"]["id"] == str(self.user.id)
        assert data["organization_id"] == str(self.organization.id)

        # Verify token was created
        api_token = ApiToken.objects.get(token=data["access_token"])
        assert api_token.user == self.user
        assert api_token.application == self.application
        assert api_token.scoping_organization_id == self.organization.id

    def test_success_with_requested_scopes(self) -> None:
        """Valid JWT with requested scopes should respect IdP scope restrictions."""
        self.idp.allowed_scopes = ["org:read", "project:read"]
        self.idp.save()

        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": self.user.email,
                "aud": "http://testserver",
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "scope": "org:read event:read",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

        data = json.loads(resp.content)
        # Should only have org:read (intersection of requested and allowed)
        assert data["scope"] == "org:read"

    def test_success_case_insensitive_email(self) -> None:
        """Email matching should be case-insensitive."""
        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": self.user.email.upper(),
                "aud": "http://testserver",
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200
        assert json.loads(resp.content)["user"]["id"] == str(self.user.id)

    def test_inactive_user_rejected(self) -> None:
        """JWT for inactive user should return invalid_grant."""
        self.user.is_active = False
        self.user.save()

        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": self.user.email,
                "aud": "http://testserver",
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_client_allowed_empty_list(self) -> None:
        """Empty allowed_client_ids should allow all clients."""
        self.idp.allowed_client_ids = []
        self.idp.save()

        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": self.user.email,
                "aud": "http://testserver",
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

    def test_client_in_allowed_list(self) -> None:
        """Client in allowed_client_ids should succeed."""
        self.idp.allowed_client_ids = [self.application.client_id]
        self.idp.save()

        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": self.user.email,
                "aud": "http://testserver",
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

    @patch("sentry.web.frontend.oauth_token.ratelimiter.is_limited")
    def test_rate_limiting(self, mock_is_limited: MagicMock) -> None:
        """Rate limiting should return slow_down error."""
        mock_is_limited.return_value = True

        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": self.user.email,
                "aud": "http://testserver",
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "slow_down"}

        # Verify rate limiter was called with correct key pattern
        mock_is_limited.assert_called_once()
        call_args = mock_is_limited.call_args
        assert call_args[0][0].startswith("oauth:jwt_bearer:")
        assert call_args[1] == {"limit": 10, "window": 60}

    def test_jti_replay_prevention(self) -> None:
        """Same JWT with jti should be rejected on second use."""
        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": self.user.email,
                "aud": "http://testserver",
                "jti": "unique-token-id-12345",
            }
        )

        # First request should succeed
        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

        # Second request with same token should be rejected (replay)
        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_jwt_without_jti_still_works(self) -> None:
        """JWT without jti claim should still be accepted (jti is optional)."""
        token = self._create_jwt(
            {
                "iss": self.issuer,
                "sub": "user@example.com",
                "email": self.user.email,
                "aud": "http://testserver",
                # No jti claim
            }
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": token,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200
