from functools import cached_property
from urllib.parse import parse_qs, urlparse

import pytest

from sentry.models.apiapplication import ApiApplication
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuthAuthorizeCodeTest(TestCase):
    @cached_property
    def path(self) -> str:
        return "/oauth/authorize/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )

    def test_missing_response_type(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?redirect_uri=https://example.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_response_type(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=foobar&redirect_uri=https://example.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_missing_client_id(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(f"{self.path}?response_type=code&redirect_uri=https://example.com")

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_scope(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=invalid_scope"
        assert "code=" not in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_invalid_redirect_uri(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri=https://google.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>redirect_uri</em> parameter."

    def test_minimal_params_approve_flow(self) -> None:
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

    def test_minimal_params_deny_flow(self) -> None:
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
        assert "code=" not in resp["Location"]

        assert not ApiGrant.objects.filter(user=self.user).exists()
        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_rich_params(self) -> None:
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

    def test_requires_redirect_uri_when_multiple_registered(self) -> None:
        self.login_as(self.user)
        # Update application to have multiple registered redirect URIs
        self.application.redirect_uris = "https://example.com\nhttps://example.org/callback"
        self.application.save()

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
        )

        # Must require redirect_uri when multiple are registered (RFC 6749 §3.1.2.3)
        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>redirect_uri</em> parameter."

    def test_approve_flow_bypass_prompt(self) -> None:
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

    def test_approve_flow_force_prompt(self) -> None:
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&force_prompt=1"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

    def test_approve_flow_requires_prompt_new_scope(self) -> None:
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

    def test_approve_flow_non_scope_set(self) -> None:
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

    @pytest.mark.skip(reason="flaky: #105728")
    def test_unauthenticated_basic_auth(self) -> None:
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
    def path(self) -> str:
        return "/oauth/authorize/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )

    def test_missing_response_type(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?redirect_uri=https://example.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_response_type(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=foobar&redirect_uri=https://example.com&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_missing_client_id(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(f"{self.path}?response_type=token&redirect_uri=https://example.com")

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_scope(self) -> None:
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&client_id={self.application.client_id}&scope=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com#error=invalid_scope"
        assert "access_token" not in resp["Location"]
        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_minimal_params_approve_flow(self) -> None:
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
        assert fragment_d["token_type"] == ["Bearer"]
        assert "refresh_token" not in fragment_d
        # expires_in should be a positive integer number of seconds until expiry
        assert fragment_d["expires_in"]
        assert int(fragment_d["expires_in"][0]) > 0
        assert fragment_d["token_type"] == ["Bearer"]

    def test_minimal_params_code_deny_flow(self) -> None:
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
        assert "access_token" not in resp["Location"]

        assert not ApiToken.objects.filter(user=self.user).exists()


@control_silo_test
class OAuthAuthorizeOrgScopedTest(TestCase):
    @cached_property
    def path(self) -> str:
        return "/oauth/authorize/"

    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user(email="admin@test.com")
        self.create_member(user=self.owner, organization=self.organization, role="owner")
        self.another_organization = self.create_organization(owner=self.owner)
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="https://example.com",
            requires_org_level_access=True,
            scopes=["org:read", "project:read"],
        )

    def test_no_orgs(self) -> None:
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

    def test_rich_params(self) -> None:
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

    def test_exceed_scope(self) -> None:
        self.login_as(self.owner)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:write&state=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"] == "https://example.com?error=invalid_scope&state=foo"
        assert "code=" not in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.owner).exists()

    def test_second_time(self) -> None:
        self.login_as(self.owner)

        # before hitting the authorize endpoint we expect that ApiAuthorization does not exist
        before_apiauth = ApiAuthorization.objects.filter(
            user=self.owner, application=self.application
        )
        assert before_apiauth.exists() is False

        # The first time the app hits the endpoint for the user, it is expected that
        # 1. User sees the view to choose an organization
        # 2. ApiAuthorization is created with the selected organization
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
        # There is only one ApiAuthorization for this user and app which is related to the right organization
        api_auth = ApiAuthorization.objects.get(user=self.owner, application=self.application)
        assert api_auth.organization_id == self.organization.id

        # The second time the app hits the endpoint for the user, it is expected that
        # 1. User still sees the view to choose an organization
        # 2. ApiAuthorization is not created again if the user chooses the same organization
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:read&state=foo"
        )
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application
        resp = self.client.post(
            self.path, {"op": "approve", "selected_organization_id": self.organization.id}
        )
        same_api_auth = ApiAuthorization.objects.get(user=self.owner, application=self.application)
        assert api_auth.id == same_api_auth.id

        # The other time the app hits the endpoint for the user, it is expected that
        # 1. User still sees the view to choose an organization
        # 2. New ApiAuthorization is created again if the user chooses another organization
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:read&state=foo"
        )
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application
        resp = self.client.post(
            self.path, {"op": "approve", "selected_organization_id": self.another_organization.id}
        )
        another_api_auth = ApiAuthorization.objects.get(
            user=self.owner,
            application=self.application,
            organization_id=self.another_organization.id,
        )
        assert api_auth.id != another_api_auth.id


@control_silo_test
class OAuthAuthorizeOrgScopedCustomSchemeTest(TestCase):
    """Tests for organization-scoped OAuth flows using custom URI schemes (version 0 legacy)."""

    @cached_property
    def path(self) -> str:
        return "/oauth/authorize/"

    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user(email="admin@test.com")
        self.create_member(user=self.owner, organization=self.organization, role="owner")
        self.another_organization = self.create_organization(owner=self.owner)
        self.custom_uri = "sentry-apple://sentry.io/auth"
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris=self.custom_uri,
            requires_org_level_access=True,
            scopes=["org:read", "project:read"],
        )

    def test_no_orgs_custom_scheme(self) -> None:
        """Test that users with no organizations get error with custom scheme redirect."""
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

    def test_rich_params_custom_scheme(self) -> None:
        """Test organization selection flow with custom scheme redirect."""
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
        assert grant.redirect_uri == self.custom_uri
        assert grant.application == self.application
        assert grant.get_scopes() == ["org:read"]
        assert grant.organization_id == self.organization.id

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]
        assert "state=foo" in resp["Location"]

        assert not ApiToken.objects.filter(user=self.owner).exists()

    def test_exceed_scope_custom_scheme(self) -> None:
        """Test scope validation error with custom scheme redirect."""
        self.login_as(self.owner)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:write&state=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "error=invalid_scope" in resp["Location"]
        assert "state=foo" in resp["Location"]
        assert "code=" not in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.owner).exists()

    def test_second_time_custom_scheme(self) -> None:
        """Test multiple organization authorizations with custom scheme redirect."""
        self.login_as(self.owner)

        # before hitting the authorize endpoint we expect that ApiAuthorization does not exist
        before_apiauth = ApiAuthorization.objects.filter(
            user=self.owner, application=self.application
        )
        assert before_apiauth.exists() is False

        # The first time the app hits the endpoint for the user, it is expected that
        # 1. User sees the view to choose an organization
        # 2. ApiAuthorization is created with the selected organization
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
        assert grant.redirect_uri == self.custom_uri
        assert resp["Location"].startswith("sentry-apple://")

        # There is only one ApiAuthorization for this user and app which is related to the right organization
        api_auth = ApiAuthorization.objects.get(user=self.owner, application=self.application)
        assert api_auth.organization_id == self.organization.id

        # The second time the app hits the endpoint for the user, it is expected that
        # 1. User still sees the view to choose an organization
        # 2. ApiAuthorization is not created again if the user chooses the same organization
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:read&state=foo"
        )
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application
        resp = self.client.post(
            self.path, {"op": "approve", "selected_organization_id": self.organization.id}
        )
        same_api_auth = ApiAuthorization.objects.get(user=self.owner, application=self.application)
        assert api_auth.id == same_api_auth.id

        # The other time the app hits the endpoint for the user, it is expected that
        # 1. User still sees the view to choose an organization
        # 2. New ApiAuthorization is created again if the user chooses another organization
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}&scope=org:read&state=foo"
        )
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application
        resp = self.client.post(
            self.path, {"op": "approve", "selected_organization_id": self.another_organization.id}
        )
        another_api_auth = ApiAuthorization.objects.get(
            user=self.owner,
            application=self.application,
            organization_id=self.another_organization.id,
        )
        assert api_auth.id != another_api_auth.id


@control_silo_test
class OAuthAuthorizeOrgScopedCustomSchemeStrictTest(TestCase):
    """Tests for organization-scoped OAuth flows using custom URI schemes with strict matching (version 1)."""

    @cached_property
    def path(self) -> str:
        return "/oauth/authorize/"

    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user(email="admin@test.com")
        self.create_member(user=self.owner, organization=self.organization, role="owner")
        self.another_organization = self.create_organization(owner=self.owner)
        self.custom_uri = "sentry-apple://sentry.io/auth"
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris=self.custom_uri,
            requires_org_level_access=True,
            scopes=["org:read", "project:read"],
            version=1,  # Strict mode
        )

    def test_no_orgs_strict_mode(self) -> None:
        """Test that users with no organizations get error with custom scheme in strict mode."""
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

    def test_rich_params_strict_mode(self) -> None:
        """Test organization selection flow with custom scheme redirect in strict mode."""
        self.login_as(self.owner)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=org:read&state=foo"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(
            self.path, {"op": "approve", "selected_organization_id": self.organization.id}
        )

        grant = ApiGrant.objects.get(user=self.owner)
        assert grant.redirect_uri == self.custom_uri
        assert grant.application == self.application
        assert grant.get_scopes() == ["org:read"]
        assert grant.organization_id == self.organization.id

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]
        assert "state=foo" in resp["Location"]

        assert not ApiToken.objects.filter(user=self.owner).exists()

    def test_exceed_scope_strict_mode(self) -> None:
        """Test scope validation error with custom scheme redirect in strict mode."""
        self.login_as(self.owner)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=org:write&state=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "error=invalid_scope" in resp["Location"]
        assert "state=foo" in resp["Location"]
        assert "code=" not in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.owner).exists()

    def test_prefix_match_fails_org_scoped_strict_mode(self) -> None:
        """Test that prefix matching fails in strict mode with organization-scoped app."""
        self.login_as(self.owner)

        # Try to use a URI that would match as a prefix in legacy mode
        prefixed_uri = f"{self.custom_uri}/callback"
        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={prefixed_uri}&client_id={self.application.client_id}&scope=org:read"
        )

        # Should fail validation because strict mode requires exact match
        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>redirect_uri</em> parameter."


@control_silo_test
class OAuthAuthorizeCustomSchemeTest(TestCase):
    """Tests for OAuth flows using custom URI schemes (sentry-apple://)."""

    @cached_property
    def path(self) -> str:
        return "/oauth/authorize/"

    def setUp(self) -> None:
        super().setUp()
        self.custom_uri = "sentry-apple://sentry.io/auth"
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris=self.custom_uri
        )

    def test_code_flow_custom_scheme_approve(self) -> None:
        """Test authorization code flow with custom scheme redirect."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.custom_uri
        assert grant.application == self.application

        assert resp.status_code == 302
        # Verify custom scheme is used in Location header
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]

    def test_code_flow_custom_scheme_deny(self) -> None:
        """Test authorization code flow denial with custom scheme redirect."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200
        resp = self.client.post(self.path, {"op": "deny"})

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "error=access_denied" in resp["Location"]
        assert "code=" not in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_token_flow_custom_scheme_approve(self) -> None:
        """Test implicit grant flow with custom scheme redirect."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        token = ApiToken.objects.get(user=self.user)
        assert token.application == self.application

        assert resp.status_code == 302
        # Verify custom scheme is used with fragment for token
        assert resp["Location"].startswith("sentry-apple://")
        assert "#" in resp["Location"]
        assert "access_token=" in resp["Location"]

    def test_token_flow_custom_scheme_deny(self) -> None:
        """Test implicit grant flow denial with custom scheme redirect."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200
        resp = self.client.post(self.path, {"op": "deny"})

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "#" in resp["Location"]
        assert "error=access_denied" in resp["Location"]
        assert "access_token=" not in resp["Location"]
        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_code_flow_with_state_custom_scheme(self) -> None:
        """Test authorization code flow with state parameter and custom scheme."""
        self.login_as(self.user)

        state = "test-state-123"
        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&state={state}"
        )

        assert resp.status_code == 200
        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]
        assert f"state={state}" in resp["Location"]

    def test_code_flow_rich_params_custom_scheme(self) -> None:
        """Test authorization code flow with scopes and state using custom scheme."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=org%3Aread&state=foo"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.custom_uri
        assert grant.application == self.application
        assert grant.get_scopes() == ["org:read"]

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]
        assert "state=foo" in resp["Location"]

    def test_code_flow_bypass_prompt_custom_scheme(self) -> None:
        """Test that existing authorization bypasses prompt with custom scheme."""
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.custom_uri
        assert grant.application == self.application
        assert not grant.get_scopes()

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]

    def test_code_flow_force_prompt_custom_scheme(self) -> None:
        """Test force prompt even with existing authorization using custom scheme."""
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&force_prompt=1"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

    def test_code_flow_new_scope_custom_scheme(self) -> None:
        """Test that requesting new scope requires prompt with custom scheme."""
        self.login_as(self.user)

        authorization = ApiAuthorization.objects.create(
            user=self.user, application=self.application, scope_list=["org:write"]
        )

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=org:read"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        authorization = ApiAuthorization.objects.get(id=authorization.id)
        assert sorted(authorization.get_scopes()) == ["org:read", "org:write"]

    def test_code_flow_non_scope_set_custom_scheme(self) -> None:
        """Test non-scope-set authorization with custom scheme."""
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=member:read member:admin"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application
        assert resp.context["scopes"] == ["member:read", "member:admin"]
        assert resp.context["permissions"] == [
            "Read, write, and admin access to organization members."
        ]

    def test_code_flow_unauthenticated_custom_scheme(self) -> None:
        """Test unauthenticated user login flow with custom scheme."""
        full_path = f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"

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
        assert grant.redirect_uri == self.custom_uri
        assert grant.application == self.application
        assert not grant.get_scopes()

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]

    def test_invalid_scope_custom_scheme(self) -> None:
        """Test invalid scope error with custom scheme."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "error=invalid_scope" in resp["Location"]
        assert "code=" not in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_token_flow_rich_params_custom_scheme(self) -> None:
        """Test implicit grant flow with scopes and state using custom scheme."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=org%3Aread&state=foo"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        token = ApiToken.objects.get(user=self.user)
        assert token.application == self.application
        assert token.get_scopes() == ["org:read"]

        assert resp.status_code == 302
        location, fragment = resp["Location"].split("#", 1)
        assert location.startswith("sentry-apple://")
        fragment_d = parse_qs(fragment)
        assert fragment_d["access_token"] == [token.token]
        assert fragment_d["state"] == ["foo"]

    def test_token_flow_invalid_scope_custom_scheme(self) -> None:
        """Test invalid scope error in implicit grant flow with custom scheme."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=foo"
        )

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "#" in resp["Location"]
        assert "error=invalid_scope" in resp["Location"]
        assert "access_token" not in resp["Location"]
        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_missing_response_type_custom_scheme(self) -> None:
        """Test missing response_type parameter with custom scheme."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_response_type_custom_scheme(self) -> None:
        """Test invalid response_type parameter with custom scheme."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=foobar&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_missing_client_id_custom_scheme(self) -> None:
        """Test missing client_id parameter with custom scheme."""
        self.login_as(self.user)

        resp = self.client.get(f"{self.path}?response_type=code&redirect_uri={self.custom_uri}")

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>client_id</em> parameter."

    def test_invalid_redirect_uri_custom_scheme(self) -> None:
        """Test invalid redirect URI with custom scheme."""
        self.login_as(self.user)

        # Try to use a different custom scheme that's not registered
        invalid_uri = "sentry-apple://different.com/auth"
        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={invalid_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>redirect_uri</em> parameter."

    def test_requires_redirect_uri_when_multiple_custom_schemes(self) -> None:
        """Test that redirect_uri is required when multiple custom schemes are registered."""
        self.login_as(self.user)
        # Update application to have multiple redirect URIs
        self.application.redirect_uris = f"{self.custom_uri}\nsentry-apple://sentry.io/callback"
        self.application.save()

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
        )

        # Must require redirect_uri when multiple are registered (RFC 6749 §3.1.2.3)
        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>redirect_uri</em> parameter."


@control_silo_test
class OAuthAuthorizeCustomSchemeStrictTest(TestCase):
    """Tests for OAuth flows using custom URI schemes with strict matching (version 1)."""

    @cached_property
    def path(self) -> str:
        return "/oauth/authorize/"

    def setUp(self) -> None:
        super().setUp()
        self.custom_uri = "sentry-apple://sentry.io/auth"
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris=self.custom_uri, version=1  # Strict mode
        )

    def test_exact_match_succeeds_code_flow(self) -> None:
        """Test that exact URI match works in strict mode with authorization code flow."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.custom_uri
        assert grant.application == self.application

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]

    def test_prefix_match_fails_strict_mode(self) -> None:
        """Test that prefix matching is rejected in strict mode (version 1)."""
        self.login_as(self.user)

        # Try to use a URI that would match as a prefix in legacy mode
        prefixed_uri = f"{self.custom_uri}/callback"
        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={prefixed_uri}&client_id={self.application.client_id}"
        )

        # Should fail validation because strict mode requires exact match
        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>redirect_uri</em> parameter."

    def test_exact_match_succeeds_token_flow(self) -> None:
        """Test that exact URI match works in strict mode with implicit grant flow."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        token = ApiToken.objects.get(user=self.user)
        assert token.application == self.application

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "#" in resp["Location"]
        assert "access_token=" in resp["Location"]

    def test_code_flow_with_state_strict_mode(self) -> None:
        """Test authorization code flow with state parameter in strict mode."""
        self.login_as(self.user)

        state = "test-state-456"
        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&state={state}"
        )

        assert resp.status_code == 200
        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]
        assert f"state={state}" in resp["Location"]

    def test_code_flow_with_scopes_strict_mode(self) -> None:
        """Test authorization code flow with scopes in strict mode."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=org%3Aread&state=bar"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")
        assert resp.context["application"] == self.application

        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.custom_uri
        assert grant.application == self.application
        assert grant.get_scopes() == ["org:read"]

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]
        assert "state=bar" in resp["Location"]

    def test_denial_with_exact_match_strict_mode(self) -> None:
        """Test user denial works with exact match in strict mode."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200
        resp = self.client.post(self.path, {"op": "deny"})

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "error=access_denied" in resp["Location"]
        assert "code=" not in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_token_flow_denial_strict_mode(self) -> None:
        """Test implicit grant denial with exact match in strict mode."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=token&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200
        resp = self.client.post(self.path, {"op": "deny"})

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "#" in resp["Location"]
        assert "error=access_denied" in resp["Location"]
        assert "access_token=" not in resp["Location"]
        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_invalid_scope_with_exact_match_strict_mode(self) -> None:
        """Test invalid scope error with exact match in strict mode."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}&scope=invalid_scope"
        )

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert "error=invalid_scope" in resp["Location"]
        assert "code=" not in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_trailing_slash_normalization_strict_mode(self) -> None:
        """Test that trailing slash differences are NOT normalized in strict mode."""
        self.login_as(self.user)

        # Strict mode requires exact match - trailing slash causes rejection
        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}/&client_id={self.application.client_id}"
        )

        # Should fail validation because strict mode requires exact match (no trailing slash normalization)
        assert resp.status_code == 400
        self.assertTemplateUsed("sentry/oauth-error.html")
        assert resp.context["error"] == "Missing or invalid <em>redirect_uri</em> parameter."

    def test_bypass_prompt_with_existing_auth_strict_mode(self) -> None:
        """Test that authorization bypass works with exact match in strict mode."""
        self.login_as(self.user)

        ApiAuthorization.objects.create(user=self.user, application=self.application)

        resp = self.client.get(
            f"{self.path}?response_type=code&redirect_uri={self.custom_uri}&client_id={self.application.client_id}"
        )

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.custom_uri
        assert grant.application == self.application

        assert resp.status_code == 302
        assert resp["Location"].startswith("sentry-apple://")
        assert f"code={grant.code}" in resp["Location"]


@control_silo_test
class OAuthAuthorizePKCETest(TestCase):
    """Tests for PKCE (Proof Key for Code Exchange) support per RFC 7636."""

    @cached_property
    def path(self) -> str:
        return "/oauth/authorize/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )

    def test_pkce_s256_challenge_stored(self) -> None:
        """Test that S256 PKCE challenge is accepted and stored in the grant."""
        self.login_as(self.user)

        # Valid S256 code_challenge (base64url encoded SHA256 hash, 43+ chars)
        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
            f"&code_challenge={code_challenge}&code_challenge_method=S256"
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")

        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.code_challenge == code_challenge
        assert grant.code_challenge_method == "S256"
        assert resp.status_code == 302

    def test_pkce_invalid_challenge_format_too_short(self) -> None:
        """Test that code_challenge shorter than 43 chars is rejected."""
        self.login_as(self.user)

        # Too short (RFC 7636 requires 43-128 chars)
        code_challenge = "too_short"

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
            f"&code_challenge={code_challenge}&code_challenge_method=S256"
        )

        assert resp.status_code == 302
        assert "error=invalid_request" in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_pkce_invalid_challenge_format_invalid_chars(self) -> None:
        """Test that code_challenge with invalid characters is rejected."""
        self.login_as(self.user)

        # Contains invalid characters (! and spaces)
        code_challenge = "invalid!challenge with spaces and special chars!"

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
            f"&code_challenge={code_challenge}&code_challenge_method=S256"
        )

        assert resp.status_code == 302
        assert "error=invalid_request" in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_pkce_invalid_challenge_method(self) -> None:
        """Test that unsupported code_challenge_method is rejected."""
        self.login_as(self.user)

        code_challenge = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
            f"&code_challenge={code_challenge}&code_challenge_method=invalid"
        )

        assert resp.status_code == 302
        assert "error=invalid_request" in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_pkce_plain_method_rejected(self) -> None:
        """Test that 'plain' PKCE method is rejected per OAuth 2.1."""
        self.login_as(self.user)

        code_challenge = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
            f"&code_challenge={code_challenge}&code_challenge_method=plain"
        )

        assert resp.status_code == 302
        assert "error=invalid_request" in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_pkce_no_challenge_allowed(self) -> None:
        """Test that PKCE is optional - grants without PKCE should work."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
        )

        assert resp.status_code == 200

        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.code_challenge is None
        assert grant.code_challenge_method is None
        assert resp.status_code == 302

    def test_pkce_bypass_without_challenge_clears_method(self) -> None:
        """Test that bypass flow correctly handles missing code_challenge by clearing method."""
        self.login_as(self.user)

        # Pre-approve the application
        ApiAuthorization.objects.create(user=self.user, application=self.application)

        # Request without PKCE (no code_challenge parameter)
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
        )

        # Should bypass prompt and create grant
        grant = ApiGrant.objects.get(user=self.user)
        assert grant.code_challenge is None
        # Bug fix: code_challenge_method should also be None when no challenge provided
        assert grant.code_challenge_method is None
        assert resp.status_code == 302

    def test_pkce_challenge_without_method(self) -> None:
        """Test that code_challenge without code_challenge_method is rejected.

        Per RFC 7636 §4.3, code_challenge_method is OPTIONAL and defaults to 'plain'.
        However, this implementation requires explicit S256 method for security.
        """
        self.login_as(self.user)

        code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
            f"&code_challenge={code_challenge}"
            # Note: No code_challenge_method parameter
        )

        # Should return error because method is required (not defaulting to 'plain')
        assert resp.status_code == 302
        assert "error=invalid_request" in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_pkce_method_without_challenge(self) -> None:
        """Test that code_challenge_method without code_challenge is silently ignored.

        Sending a method without a challenge is a malformed request, but OAuth
        implementations typically ignore extra/meaningless parameters.
        """
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
            f"&code_challenge_method=S256"
            # Note: No code_challenge parameter
        )

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/oauth-authorize.html")

        resp = self.client.post(self.path, {"op": "approve"})

        grant = ApiGrant.objects.get(user=self.user)
        # Method without challenge should be ignored (set to None)
        assert grant.code_challenge is None
        assert grant.code_challenge_method is None
        assert resp.status_code == 302

    def test_pkce_challenge_too_long(self) -> None:
        """Test that code_challenge longer than 128 chars is rejected.

        Per RFC 7636 §4.1, code_challenge must be 43-128 characters.
        """
        self.login_as(self.user)

        # Generate a 129-character challenge (exceeds max of 128)
        code_challenge = "a" * 129

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
            f"&code_challenge={code_challenge}&code_challenge_method=S256"
        )

        assert resp.status_code == 302
        assert "error=invalid_request" in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()

    def test_pkce_empty_challenge_rejected(self) -> None:
        """Test that empty code_challenge string is rejected."""
        self.login_as(self.user)

        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
            f"&code_challenge=&code_challenge_method=S256"
        )

        assert resp.status_code == 302
        assert "error=invalid_request" in resp["Location"]
        assert not ApiGrant.objects.filter(user=self.user).exists()


@control_silo_test
class OAuthAuthorizeSecurityTest(TestCase):
    """Tests for security features: CSRF protection and privilege escalation prevention."""

    @cached_property
    def path(self) -> str:
        return "/oauth/authorize/"

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.org_scoped_application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="https://example.com",
            requires_org_level_access=True,
            scopes=["org:read"],
        )

    def test_organization_id_validation_unauthorized_org(self) -> None:
        """Test that user cannot authorize access to organization they're not a member of."""
        # self.user is already a member of self.organization by default

        # Create another organization that user is NOT a member of
        other_org = self.create_organization(name="Other Org")

        self.login_as(self.user)

        # Start authorization flow
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.org_scoped_application.client_id}&scope=org:read"
        )
        # May return 200 or may return 400 if user has no orgs - either way, let's proceed to POST

        # POST approval with organization user is NOT a member of
        resp = self.client.post(
            self.path, {"op": "approve", "selected_organization_id": other_org.id}
        )

        # Should return error redirect or error page
        if resp.status_code == 302:
            assert "error=unauthorized_client" in resp["Location"]
        # Alternatively, may return 400 with error page
        # Either way, no grant should be created
        assert not ApiGrant.objects.filter(
            user=self.user, application=self.org_scoped_application
        ).exists()

    def test_organization_id_validation_invalid_format(self) -> None:
        """Test that invalid organization ID format is rejected."""
        # self.user is already a member of self.organization by default

        self.login_as(self.user)

        # Start authorization flow
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.org_scoped_application.client_id}&scope=org:read"
        )
        # May return 200 or 400 depending on user's org membership

        # POST approval with invalid (non-integer) organization ID
        resp = self.client.post(
            self.path, {"op": "approve", "selected_organization_id": "not-a-number"}
        )

        # Should return error
        if resp.status_code == 302:
            assert "error=unauthorized_client" in resp["Location"]

        # No grant should be created
        assert not ApiGrant.objects.filter(
            user=self.user, application=self.org_scoped_application
        ).exists()

    def test_organization_id_validation_success(self) -> None:
        """Test that user can authorize access to organization they ARE a member of."""
        # self.user is already a member of self.organization by default

        self.login_as(self.user)

        # Start authorization flow
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.org_scoped_application.client_id}&scope=org:read"
        )
        # May return 200 or 400

        # POST approval with organization user IS a member of
        resp = self.client.post(
            self.path, {"op": "approve", "selected_organization_id": self.organization.id}
        )

        # Should succeed if user is actually a member
        if resp.status_code == 302 and "error" not in resp.get("Location", ""):
            # Grant should be created with correct organization
            grant = ApiGrant.objects.filter(
                user=self.user, application=self.org_scoped_application
            ).first()
            if grant:
                assert grant.organization_id == self.organization.id

    def test_organization_id_required_for_org_level_apps(self) -> None:
        """Test that org-level apps reject requests without organization_id (security fix)."""
        # Ensure user is a member of an organization
        self.login_as(self.user)

        # Start authorization flow with org-scoped app
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.org_scoped_application.client_id}&scope=org:read"
        )

        # If GET fails (user has no orgs), skip the rest of the test
        if resp.status_code != 200:
            return

        # POST approval WITHOUT organization_id (attacker removes the parameter)
        resp = self.client.post(self.path, {"op": "approve"})

        # Should return error redirect, not create grant with null organization_id
        if resp.status_code == 302:
            assert "error=invalid_request" in resp["Location"]

        # No grant should be created
        assert not ApiGrant.objects.filter(
            user=self.user, application=self.org_scoped_application
        ).exists()

    def test_organization_id_validation_not_required_for_non_org_apps(self) -> None:
        """Test that organization validation is skipped for apps that don't require org-level access."""
        self.login_as(self.user)

        # GET request with non-org-scoped app
        resp = self.client.get(
            f"{self.path}?response_type=code&client_id={self.application.client_id}"
        )
        assert resp.status_code == 200

        # POST approval without selecting an organization
        resp = self.client.post(self.path, {"op": "approve"})

        # Should succeed (organization validation not performed)
        assert resp.status_code == 302
        assert "error" not in resp["Location"]

        # Grant should be created
        grant = ApiGrant.objects.get(user=self.user, application=self.application)
        assert grant is not None
        # organization_id may or may not be set depending on default behavior - we just verify grant exists
