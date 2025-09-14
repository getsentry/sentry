from functools import cached_property

from django.utils import timezone

from sentry.locks import locks
from sentry.models.apiapplication import ApiApplication
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
        assert json.loads(resp.content) == {"error": "unsupported_grant_type"}

    def test_invalid_grant_type(self) -> None:
        self.login_as(self.user)

        resp = self.client.post(
            self.path, {"grant_type": "foo", "client_id": "abcd", "client_secret": "abcd"}
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
            user=self.user, application=self.application, redirect_uri="https://example.com"
        )

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

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "missing_client_id"}

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
        assert json.loads(resp.content) == {"error": "invalid_credentials"}

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

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "missing_client_secret"}

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
        assert json.loads(resp.content) == {"error": "invalid_credentials"}

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
                "redirect_uri": self.application.get_default_redirect_uri(),
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert resp.json() == {"error": "invalid_grant"}

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
                "client_id": self.application.client_id,
                "redirect_uri": self.application.get_default_redirect_uri(),
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert "id_token" not in data

    def test_redirect_binding_required_when_grant_has_redirect(self) -> None:
        """
        Omitting redirect_uri on token exchange must fail when grant stored it.
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

    def test_redirect_binding_mismatch(self) -> None:
        self.login_as(self.user)
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "code": self.grant.code,
                "client_id": self.application.client_id,
                "redirect_uri": "https://example.org/callback",
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_pkce_s256_happy_path(self) -> None:
        import base64
        import hashlib

        self.login_as(self.user)
        # Create a grant with S256 code challenge derived from a known verifier
        verifier = "a" * 50
        digest = hashlib.sha256(verifier.encode("ascii")).digest()
        challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")

        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri=self.application.get_default_redirect_uri(),
            code_challenge=challenge,
            code_challenge_method="S256",
        )

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": grant.code,
                "code_verifier": verifier,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 200

    def test_pkce_missing_verifier(self) -> None:
        self.login_as(self.user)
        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri=self.application.get_default_redirect_uri(),
            code_challenge="x" * 43,
            code_challenge_method="S256",
        )
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": grant.code,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_pkce_length_and_charset(self) -> None:
        self.login_as(self.user)
        # too short
        grant1 = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri=self.application.get_default_redirect_uri(),
            code_challenge="x" * 43,
            code_challenge_method="S256",
        )
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": grant1.code,
                "code_verifier": "a" * 42,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

        # too long
        grant2 = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri=self.application.get_default_redirect_uri(),
            code_challenge="x" * 43,
            code_challenge_method="S256",
        )
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": grant2.code,
                "code_verifier": "a" * 129,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

        # invalid charset
        grant3 = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri=self.application.get_default_redirect_uri(),
            code_challenge="x" * 43,
            code_challenge_method="S256",
        )
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": grant3.code,
                "code_verifier": "invalid*chars",
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_pkce_s256_mismatch(self) -> None:
        self.login_as(self.user)
        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri=self.application.get_default_redirect_uri(),
            code_challenge="x" * 43,
            code_challenge_method="S256",
        )
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": grant.code,
                "code_verifier": "a" * 50,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_pkce_plain_mode(self) -> None:
        # plain should be denied by default
        self.login_as(self.user)
        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri=self.application.get_default_redirect_uri(),
            code_challenge="a" * 50,
            code_challenge_method="PLAIN",
        )
        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": grant.code,
                "code_verifier": "a" * 50,
                "client_id": self.application.client_id,
                "client_secret": self.client_secret,
            },
        )
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

        # Temporarily allow plain and expect success
        from sentry.web.frontend import oauth_token as oauth_token_module

        original = oauth_token_module.PKCE_ALLOW_PLAIN
        oauth_token_module.PKCE_ALLOW_PLAIN = True
        try:
            grant2 = ApiGrant.objects.create(
                user=self.user,
                application=self.application,
                redirect_uri=self.application.get_default_redirect_uri(),
                code_challenge="b" * 60,
                code_challenge_method="plain",
            )
            resp = self.client.post(
                self.path,
                {
                    "grant_type": "authorization_code",
                    "redirect_uri": self.application.get_default_redirect_uri(),
                    "code": grant2.code,
                    "code_verifier": "b" * 60,
                    "client_id": self.application.client_id,
                    "client_secret": self.client_secret,
                },
            )
            assert resp.status_code == 200
        finally:
            oauth_token_module.PKCE_ALLOW_PLAIN = original

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
        assert data["token_type"] == "bearer"
        assert data["user"]["id"] == str(token.user_id)

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
            assert data["token_type"] == "bearer"
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
            assert data["token_type"] == "bearer"
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
            user=self.user, application=self.application, redirect_uri="https://example.com"
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

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "missing_client_id"}

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
        assert json.loads(resp.content) == {"error": "invalid_credentials"}

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
