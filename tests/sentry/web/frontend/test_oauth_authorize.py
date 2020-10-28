from __future__ import absolute_import

from exam import fixture
from six.moves.urllib.parse import parse_qs, urlparse

from sentry.models import ApiApplication, ApiAuthorization, ApiGrant, ApiToken
from sentry.testutils import TestCase


class OAuthAuthorizeCodeTest(TestCase):
    @fixture
    def path(self):
        return "/oauth/authorize/"

    def setUp(self):
        super(OAuthAuthorizeCodeTest, self).setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )

    def test_missing_response_type(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?redirect_uri={}&client_id={}".format(
                self.path, "https://example.com", self.application.client_id
            )
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=unsupported_response_type"

    def test_invalid_response_type(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=foobar&redirect_uri={}&client_id={}".format(
                self.path, "https://example.com", self.application.client_id
            )
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=unsupported_response_type"

    def test_missing_client_id(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=code&redirect_uri={}".format(self.path, "https://example.com")
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_scope(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=code&client_id={}&scope=foo".format(
                self.path, self.application.client_id
            )
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=invalid_scope"

    def test_invalid_redirect_uri(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=code&redirect_uri=https://google.com&client_id={}".format(
                self.path, self.application.client_id
            )
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>redirect_uri</em> parameter."

    def test_minimal_params_approve_flow(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=code&client_id={}".format(self.path, self.application.client_id)
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.application.get_default_redirect_uri()
        assert grant.application == self.application
        assert not grant.get_scopes()

        assert resp.status_code == 302
        assert resp["Location"] == u"https://example.com?code={}".format(grant.code)

        authorization = ApiAuthorization.objects.get(user=self.user, application=self.application)
        assert authorization.get_scopes() == grant.get_scopes()

    def test_minimal_params_deny_flow(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=code&client_id={}".format(self.path, self.application.client_id)
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "deny"})

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=access_denied"

        assert not ApiGrant.objects.filter(user=self.user).exists()
        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_rich_params(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=code&client_id={}&scope=org%3Aread&state=foo".format(
                self.path, self.application.client_id
            )
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.application.get_default_redirect_uri()
        assert grant.application == self.application
        assert grant.get_scopes() == ["org:read"]

        assert resp.status_code == 302

        # XXX: Compare parsed query strings to avoid ordering differences
        # between py2/3
        assert parse_qs(urlparse(resp["Location"]).query) == parse_qs(
            u"state=foo&code={}".format(grant.code)
        )

        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_approve_flow_bypass_prompt(self):
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            u"{}?response_type=code&client_id={}".format(self.path, self.application.client_id)
        )

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.application.get_default_redirect_uri()
        assert grant.application == self.application
        assert not grant.get_scopes()

        assert resp.status_code == 302
        assert resp["Location"] == u"https://example.com?code={}".format(grant.code)

    def test_approve_flow_force_prompt(self):
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            u"{}?response_type=code&client_id={}&force_prompt=1".format(
                self.path, self.application.client_id
            )
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

    def test_approve_flow_requires_prompt_new_scope(self):
        self.login_as(self.user)

        authorization = ApiAuthorization.objects.create(
            user=self.user, application=self.application, scope_list=["org:write"]
        )

        resp = self.client.get(
            u"{}?response_type=code&client_id={}&scope=org:read".format(
                self.path, self.application.client_id
            )
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        authorization = ApiAuthorization.objects.get(id=authorization.id)
        assert sorted(authorization.get_scopes()) == ["org:read", "org:write"]

    def test_approve_flow_non_scope_set(self):
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            u"{}?response_type=code&client_id={}&scope=member:read member:admin".format(
                self.path, self.application.client_id
            )
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application
        assert resp.context["scopes"] == ["member:read", "member:admin"]
        assert resp.context["permissions"] == [
            "Read, write, and admin access to organization members."
        ]

    def test_unauthenticated_basic_auth(self):
        full_path = u"{}?response_type=code&client_id={}".format(
            self.path, self.application.client_id
        )

        resp = self.client.get(full_path)

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/login.html")
        assert resp.context["banner"] == u"Connect Sentry to {}".format(self.application.name)

        resp = self.client.post(
            full_path, {"username": self.user.username, "password": "admin", "op": "login"}
        )
        self.assertRedirects(resp, full_path)

        resp = self.client.get(full_path)
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(full_path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.application.get_default_redirect_uri()
        assert grant.application == self.application
        assert not grant.get_scopes()

        assert resp.status_code == 302
        assert resp["Location"] == u"https://example.com?code={}".format(grant.code)

        authorization = ApiAuthorization.objects.get(user=self.user, application=self.application)
        assert authorization.get_scopes() == grant.get_scopes()


class OAuthAuthorizeTokenTest(TestCase):
    @fixture
    def path(self):
        return "/oauth/authorize/"

    def setUp(self):
        super(OAuthAuthorizeTokenTest, self).setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )

    def test_missing_response_type(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?redirect_uri={}&client_id={}".format(
                self.path, "https://example.com", self.application.client_id
            )
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=unsupported_response_type"

    def test_invalid_response_type(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=foobar&redirect_uri={}&client_id={}".format(
                self.path, "https://example.com", self.application.client_id
            )
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=unsupported_response_type"

    def test_missing_client_id(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=token&redirect_uri={}".format(self.path, "https://example.com")
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_scope(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=token&client_id={}&scope=foo".format(
                self.path, self.application.client_id
            )
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com#error=invalid_scope"

    def test_minimal_params_approve_flow(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=token&client_id={}".format(self.path, self.application.client_id)
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        assert not ApiGrant.objects.filter(user=self.user).exists()

        token = ApiToken.objects.get(user=self.user)
        assert token.application == self.application
        assert not token.get_scopes()
        assert not token.refresh_token

        assert resp.status_code == 302
        location, fragment = resp["Location"].split("#", 1)
        assert location == "https://example.com"
        fragment = parse_qs(fragment)
        assert fragment["access_token"] == [token.token]
        assert fragment["token_type"] == ["bearer"]
        assert "refresh_token" not in fragment
        assert fragment["expires_in"]
        assert fragment["token_type"] == ["bearer"]

    def test_minimal_params_code_deny_flow(self):
        self.login_as(self.user)

        resp = self.client.get(
            u"{}?response_type=token&client_id={}".format(self.path, self.application.client_id)
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "deny"})

        assert resp.status_code == 302
        location, fragment = resp["Location"].split("#", 1)
        assert location == "https://example.com"
        fragment = parse_qs(fragment)
        assert fragment == {"error": ["access_denied"]}

        assert not ApiToken.objects.filter(user=self.user).exists()
