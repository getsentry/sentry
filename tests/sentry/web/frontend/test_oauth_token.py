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
    def path(self):
        return "/oauth/token/"

    def test_no_get(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)

        assert resp.status_code == 405

    def test_missing_grant_type(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, {"client_id": "abcd", "client_secret": "abcd"})

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "unsupported_grant_type"}

    def test_invalid_grant_type(self):
        self.login_as(self.user)

        resp = self.client.post(
            self.path, {"grant_type": "foo", "client_id": "abcd", "client_secret": "abcd"}
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "unsupported_grant_type"}


@control_silo_test
class OAuthTokenCodeTest(TestCase):
    @cached_property
    def path(self):
        return "/oauth/token/"

    def setUp(self):
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.client_secret = self.application.client_secret
        self.grant = ApiGrant.objects.create(
            user=self.user, application=self.application, redirect_uri="https://example.com"
        )

    def test_missing_client_id(self):
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

    def test_invalid_client_id(self):
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

    def test_missing_client_secret(self):
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

    def test_invalid_client_secret(self):
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

    def test_missing_code(self):
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

    def test_invalid_code(self):
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

    def test_expired_grant(self):
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

    def test_one_time_use_grant(self):
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

    def test_grant_lock(self):
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

    def test_invalid_redirect_uri(self):
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

    def test_no_open_id_token(self):
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
                "client_secret": self.client_secret,
            },
        )

        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert "id_token" not in data

    def test_valid_no_redirect_uri(self):
        """
        Checks that we get the correct redirect URI if we don't pass one in
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

    def test_valid_params(self):
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

    def test_valid_params_id_token(self):
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

    def test_valid_params_id_token_additional_scopes(self):
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
    def path(self):
        return "/oauth/token/"

    def setUp(self):
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

    def test_missing_client_id(self):
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

    def test_invalid_client_id(self):
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

    def test_missing_refresh_token(self):
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

    def test_invalid_refresh_token(self):
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

    def test_valid_params(self):
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
    def path(self):
        return "/oauth/token/"

    def setUp(self):
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

    def test_valid_params(self):
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
