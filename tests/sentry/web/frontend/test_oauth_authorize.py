from functools import cached_property
from urllib.parse import parse_qs, urlparse

from sentry.models.apiapplication import ApiApplication
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuthAuthorizeCodeTest(TestCase):
    @cached_property
    def path(self):
        return "/oauth/authorize/"

    def setUp(self):
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )

    def test_missing_response_type(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?redirect_uri=https://example.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_response_type(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=foobar&redirect_uri=https://example.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_missing_client_id(self):
        self.login_as(self.user)

        resp = self.client.get(f"{self.path}?response_type=code&redirect_uri=https://example.com")

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_scope(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=invalid_scope"

    def test_invalid_redirect_uri(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri=https://google.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>redirect_uri</em> parameter."

    def test_minimal_params_approve_flow(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
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
        assert resp["Location"] == f"https://example.com?code={grant.code}"

        authorization = ApiAuthorization.objects.get(user=self.user, application=self.application)
        assert authorization.get_scopes() == grant.get_scopes()

    def test_minimal_params_deny_flow(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
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
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org%3Aread&state=foo"
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
            f"state=foo&code={grant.code}"
        )

        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_approve_flow_bypass_prompt(self):
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
        )

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.application.get_default_redirect_uri()
        assert grant.application == self.application
        assert not grant.get_scopes()

        assert resp.status_code == 302
        assert resp["Location"] == f"https://example.com?code={grant.code}"

    def test_approve_flow_force_prompt(self):
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&force_prompt=1"
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
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:read"
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
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=member:read member:admin"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application
        assert resp.context["scopes"] == ["member:read", "member:admin"]
        assert resp.context["permissions"] == [
            "Read, write, and admin access to organization members."
        ]

    def test_unauthenticated_basic_auth(self):
        full_path = f"{self.path}?response_type=code&client_id={self.application.client_id}"

        resp = self.client.get(full_path)

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/login.html")
        assert resp.context["banner"] == f"Connect Sentry to {self.application.name}"

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
        assert resp["Location"] == f"https://example.com?code={grant.code}"

        authorization = ApiAuthorization.objects.get(user=self.user, application=self.application)
        assert authorization.get_scopes() == grant.get_scopes()


@control_silo_test
class OAuthAuthorizeTokenTest(TestCase):
    @cached_property
    def path(self):
        return "/oauth/authorize/"

    def setUp(self):
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )

    def test_missing_response_type(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?redirect_uri=https://example.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_response_type(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=foobar&redirect_uri=https://example.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_missing_client_id(self):
        self.login_as(self.user)

        resp = self.client.get(f"{self.path}?response_type=token&redirect_uri=https://example.com")

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_scope(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&client_id={self.application.client_id}&scope=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com#error=invalid_scope"

    def test_minimal_params_approve_flow(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&client_id={self.application.client_id}"
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
        fragment_d = parse_qs(fragment)
        assert fragment_d["access_token"] == [token.token]
        assert fragment_d["token_type"] == ["bearer"]
        assert "refresh_token" not in fragment_d
        assert fragment_d["expires_in"]
        assert fragment_d["token_type"] == ["bearer"]

    def test_minimal_params_code_deny_flow(self):
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "deny"})

        assert resp.status_code == 302
        location, fragment = resp["Location"].split("#", 1)
        assert location == "https://example.com"
        fragment_d = parse_qs(fragment)
        assert fragment_d == {"error": ["access_denied"]}

        assert not ApiToken.objects.filter(user=self.user).exists()


@control_silo_test
class OAuthAuthorizeOrgScopedTest(TestCase):
    @cached_property
    def path(self):
        return "/oauth/authorize/"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(email="admin@test.com")
        self.create_member(user=self.owner, organization=self.organization, role="owner")
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="https://example.com",
            requires_org_level_access=True,
            scopes=["org:read", "project:read"],
        )

    def test_no_orgs(self):
        # If the user has no organizations, this oauth flow should not be possible
        user = self.create_user(email="user1@test.com")
        self.login_as(user)
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:read&state=foo"
        )
        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert (
            resp.context["error"]
            == "This authorization flow is only available for users who are members of an organization."
        )

    def test_rich_params(self):
        self.login_as(self.owner)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:read&state=foo"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(
            self.path, {"op": "approve", "selected_organization_id": self.organization.id}
        )

        grant = ApiGrant.objects.get(user=self.owner)
        assert grant.redirect_uri == self.application.get_default_redirect_uri()
        assert grant.application == self.application
        assert grant.get_scopes() == ["org:read"]
        assert grant.organization_id == self.organization.id

        assert resp.status_code == 302

        # XXX: Compare parsed query strings to avoid ordering differences
        # between py2/3
        assert parse_qs(urlparse(resp["Location"]).query) == parse_qs(
            f"state=foo&code={grant.code}"
        )

        assert not ApiToken.objects.filter(user=self.owner).exists()

    def test_exceed_scope(self):
        self.login_as(self.owner)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:write&state=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=invalid_scope&state=foo"
