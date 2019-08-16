from __future__ import absolute_import

import six

from django.utils import timezone
from exam import fixture

from sentry.models import ApiApplication, ApiGrant, ApiToken
from sentry.testutils import TestCase
from sentry.utils import json


class OAuthTokenTest(TestCase):
    @fixture
    def path(self):
        return "/oauth/token/"

    def test_no_get(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)

        assert resp.status_code == 405

    def test_missing_grant_type(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "unsupported_grant_type"}

    def test_invalid_grant_type(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, {"grant_type": "foo"})

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "unsupported_grant_type"}


class OAuthTokenCodeTest(TestCase):
    @fixture
    def path(self):
        return "/oauth/token/"

    def setUp(self):
        super(OAuthTokenCodeTest, self).setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
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
            },
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_invalid_client_id(self):
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": "def",
            },
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_missing_code(self):
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "client_id": self.application.client_id,
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
            },
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_grant"}

    def test_valid_params(self):
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "authorization_code",
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code": self.grant.code,
                "client_id": self.application.client_id,
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
        assert data["user"]["id"] == six.text_type(token.user_id)


class OAuthTokenRefreshTokenTest(TestCase):
    @fixture
    def path(self):
        return "/oauth/token/"

    def setUp(self):
        super(OAuthTokenRefreshTokenTest, self).setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.grant = ApiGrant.objects.create(
            user=self.user, application=self.application, redirect_uri="https://example.com"
        )
        self.token = ApiToken.objects.create(
            application=self.application, user=self.user, expires_at=timezone.now()
        )

    def test_missing_client_id(self):
        self.login_as(self.user)

        resp = self.client.post(
            self.path, {"grant_type": "refresh_token", "refresh_token": self.token.refresh_token}
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_invalid_client_id(self):
        self.login_as(self.user)

        resp = self.client.post(
            self.path,
            {
                "grant_type": "refresh_token",
                "client_id": "abc",
                "refresh_token": self.token.refresh_token,
            },
        )

        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "invalid_client"}

    def test_missing_refresh_token(self):
        self.login_as(self.user)

        resp = self.client.post(
            self.path, {"grant_type": "refresh_token", "client_id": self.application.client_id}
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
            },
        )

        assert resp.status_code == 200

        token2 = ApiToken.objects.get(id=self.token.id)

        assert token2.application == self.token.application
        assert token2.user == self.token.user
        assert token2.get_scopes() == self.token.get_scopes()
        assert token2.expires_at > self.token.expires_at
        assert token2.token != self.token.token
        assert token2.refresh_token != self.token.refresh_token
        assert token2.refresh_token
