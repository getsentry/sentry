from __future__ import annotations

import base64
from functools import cached_property
from typing import Any
from unittest import mock
from urllib.parse import parse_qs, urlparse

import responses
from django.contrib.messages import get_messages
from django.urls import reverse

from sentry import audit_log
from sentry.auth.providers.oauth2 import ERR_INVALID_STATE
from sentry.auth.providers.oidc.constants import ERR_EMAIL_NOT_VERIFIED, ERR_INVALID_RESPONSE
from sentry.auth.providers.oidc.discovery import build_provider_config
from sentry.auth.providers.oidc.provider import identity_id
from sentry.auth.providers.oidc.secrets import decrypt_client_secret, encrypt_client_secret
from sentry.auth.providers.oidc.views import pkce_challenge
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.testutils.cases import AuthProviderTestCase
from sentry.testutils.silo import control_silo_test

from . import CLIENT_ID, CLIENT_SECRET, ISSUER, FakeIdP

FEATURES = ["organizations:sso-basic", "organizations:sso-oidc"]


def authorize_params(location: str) -> dict[str, str]:
    url = urlparse(location)
    assert f"{url.scheme}://{url.netloc}{url.path}" == f"{ISSUER}/authorize"
    return {k: v[0] for k, v in parse_qs(url.query).items()}


def token_request_body() -> dict[str, str]:
    call = next(c for c in responses.calls if c.request.url == f"{ISSUER}/token")
    body = call.request.body
    assert isinstance(body, str)
    return {k: v[0] for k, v in parse_qs(body).items()}


def error_messages(resp: Any) -> list[str]:
    return [str(m) for m in get_messages(resp.wsgi_request)]


@control_silo_test
class OIDCSetupFlowTest(AuthProviderTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.idp = FakeIdP()
        self.organization = self.create_organization(name="foo", owner=self.user)
        self.login_as(self.user)

    @cached_property
    def configure_path(self) -> str:
        return reverse("sentry-organization-auth-provider-settings", args=[self.organization.slug])

    def start(self) -> Any:
        return self.client.post(self.configure_path, {"provider": "oidc", "init": True})

    def submit(self, **overrides: str) -> Any:
        data = {
            "provider": "oidc",
            "action_save": "",
            "issuer": ISSUER,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        }
        data.update(overrides)
        return self.client.post(self.configure_path, data)

    def callback(self, state: str, code: str = "the-code") -> Any:
        return self.client.get(reverse("sentry-auth-sso"), {"code": code, "state": state})

    def test_requires_feature(self) -> None:
        with self.feature({"organizations:sso-basic": True, "organizations:sso-oidc": False}):
            resp = self.start()
        assert resp.status_code == 401

    def test_renders_setup_form(self) -> None:
        with self.feature(FEATURES):
            resp = self.start()
        assert resp.status_code == 200
        content = resp.content.decode()
        assert "Register OpenID Connect" in content
        assert "http://testserver/auth/sso/" in content
        assert 'name="client_secret"' in content

    @responses.activate
    def test_discovery_errors_are_shown_on_the_form(self) -> None:
        self.idp.add_discovery(issuer="https://evil.example.com")
        with self.feature(FEATURES):
            self.start()
            resp = self.submit()
        assert resp.status_code == 200
        assert "does not match the issuer URL" in resp.content.decode()
        assert not AuthProvider.objects.filter(organization_id=self.organization.id).exists()

    def test_issuer_must_be_https(self) -> None:
        with self.feature(FEATURES):
            self.start()
            resp = self.submit(issuer="http://idp.example.com")
        assert resp.status_code == 200
        assert "must start with https://" in resp.content.decode()

    @responses.activate
    def test_setup_happy_path(self) -> None:
        self.idp.add_discovery()
        self.idp.add_jwks()
        with self.feature(FEATURES):
            self.start()
            resp = self.submit()
            assert resp.status_code == 302
            params = authorize_params(resp["Location"])
            assert params["client_id"] == CLIENT_ID
            assert params["response_type"] == "code"
            assert params["scope"] == "openid email profile"
            assert params["redirect_uri"] == "http://testserver/auth/sso/"
            assert params["code_challenge_method"] == "S256"
            assert params["state"].endswith(":oidc")

            self.idp.add_token(self.idp.id_token(params["nonce"]))
            resp = self.callback(params["state"])

        self.assertRedirects(resp, self.configure_path)

        body = token_request_body()
        assert body["grant_type"] == "authorization_code"
        assert body["code"] == "the-code"
        assert pkce_challenge(body["code_verifier"]) == params["code_challenge"]
        assert "client_secret" not in body
        token_call = next(c for c in responses.calls if c.request.url == f"{ISSUER}/token")
        expected_auth = base64.b64encode(b"sentry-client:s3cret+value").decode()
        assert token_call.request.headers["Authorization"] == f"Basic {expected_auth}"

        auth_provider = AuthProvider.objects.get(organization_id=self.organization.id)
        assert auth_provider.provider == "oidc"
        assert auth_provider.config["issuer"] == ISSUER
        assert auth_provider.config["client_secret"] != CLIENT_SECRET
        assert decrypt_client_secret(auth_provider.config["client_secret"]) == CLIENT_SECRET

        identity = AuthIdentity.objects.get(auth_provider=auth_provider)
        assert identity.user_id == self.user.id
        assert identity.ident == identity_id(ISSUER, "user-123")
        assert identity.data == {"iss": ISSUER, "sub": "user-123"}

        entry = AuditLogEntry.objects.get(
            organization_id=self.organization.id, event=audit_log.get_event_id("SSO_ENABLE")
        )
        assert entry.data["config"]["issuer"] == ISSUER
        assert "client_secret" not in entry.data["config"]

    @responses.activate
    def test_unverified_email_is_rejected(self) -> None:
        self.idp.add_discovery()
        self.idp.add_jwks()
        with self.feature(FEATURES):
            self.start()
            params = authorize_params(self.submit()["Location"])
            self.idp.add_token(self.idp.id_token(params["nonce"], email_verified=False))
            resp = self.callback(params["state"])

        assert resp.status_code == 302
        assert error_messages(resp) == [f"Authentication error: {ERR_EMAIL_NOT_VERIFIED}"]
        assert not AuthProvider.objects.filter(organization_id=self.organization.id).exists()

    @responses.activate
    @mock.patch("sentry.auth.providers.oidc.views.logger")
    def test_bad_signature_is_rejected(self, logger: mock.MagicMock) -> None:
        self.idp.add_discovery()
        self.idp.add_jwks()
        with self.feature(FEATURES):
            self.start()
            params = authorize_params(self.submit()["Location"])
            self.idp.add_token(self.idp.id_token(params["nonce"], signing_key=self.idp.other_key))
            resp = self.callback(params["state"])

        assert resp.status_code == 302
        assert error_messages(resp) == [f"Authentication error: {ERR_INVALID_RESPONSE}"]
        (_, kwargs) = logger.warning.call_args
        assert "InvalidSignatureError" in kwargs["extra"]["reason"]
        assert not AuthProvider.objects.filter(organization_id=self.organization.id).exists()

    @responses.activate
    def test_state_mismatch_is_rejected(self) -> None:
        self.idp.add_discovery()
        with self.feature(FEATURES):
            self.start()
            self.submit()
            resp = self.callback("forged:oidc")

        assert resp.status_code == 302
        assert error_messages(resp) == [f"Authentication error: {ERR_INVALID_STATE}"]
        assert not any(c.request.url == f"{ISSUER}/token" for c in responses.calls)
        assert not AuthProvider.objects.filter(organization_id=self.organization.id).exists()


@control_silo_test
class OIDCLoginFlowTest(AuthProviderTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.idp = FakeIdP()

    @cached_property
    def organization(self) -> Organization:
        return self.create_organization(name="foo", owner=self.user)

    def create_auth_provider(self, **discovery_overrides: Any) -> AuthProvider:
        config = build_provider_config(
            ISSUER,
            self.idp.discovery_document(**discovery_overrides),
            client_id=CLIENT_ID,
            client_secret=encrypt_client_secret(CLIENT_SECRET),
        )
        return AuthProvider.objects.create(
            organization_id=self.organization.id, provider="oidc", config=config
        )

    def login(self) -> Any:
        path = reverse("sentry-auth-organization", args=[self.organization.slug])
        resp = self.client.post(path, {"init": True})
        assert resp.status_code == 302
        params = authorize_params(resp["Location"])
        self.idp.add_token(self.idp.id_token(params["nonce"]))
        self.idp.add_jwks()
        return self.client.get(
            reverse("sentry-auth-sso"), {"code": "the-code", "state": params["state"]}, follow=True
        )

    @responses.activate
    def test_existing_identity_logs_in(self) -> None:
        auth_provider = self.create_auth_provider()
        user = self.create_user("alice@example.com")
        self.create_member(organization=self.organization, user=user)
        AuthIdentity.objects.create(
            auth_provider=auth_provider, user=user, ident=identity_id(ISSUER, "user-123")
        )

        resp = self.login()

        assert resp.redirect_chain == [("/organizations/foo/issues/", 302)]
        assert self.client.session["_auth_user_id"] == str(user.id)

    @responses.activate
    def test_client_secret_post(self) -> None:
        auth_provider = self.create_auth_provider(
            token_endpoint_auth_methods_supported=["client_secret_post"]
        )
        user = self.create_user("alice@example.com")
        self.create_member(organization=self.organization, user=user)
        AuthIdentity.objects.create(
            auth_provider=auth_provider, user=user, ident=identity_id(ISSUER, "user-123")
        )

        self.login()

        body = token_request_body()
        assert body["client_id"] == CLIENT_ID
        assert body["client_secret"] == CLIENT_SECRET
