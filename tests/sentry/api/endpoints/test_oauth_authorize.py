import base64
import hashlib
import time
from unittest.mock import patch
from urllib.parse import parse_qs, urlencode, urlsplit

from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient

from sentry.api.helpers.oauth_authorize.transactions import OAUTH_AUTHORIZE_SESSION_TTL
from sentry.api.helpers.oauth_consent import persist_authorization
from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.impersonation import simulate_impersonation
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuthAuthorizeGetTest(APITestCase):
    endpoint = "sentry-api-0-oauth-authorize"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(redirect_uris="https://example.com/callback")
        self.query = {
            "client_id": self.application.client_id,
            "response_type": "code",
            "scope": "project:read",
            "state": "return & preserve state",
        }

    def test_consent_preparation(self) -> None:
        self.login_as(self.user)
        response = self.get_success_response(
            **{**self.query, "code_challenge": "a" * 43, "code_challenge_method": "S256"}
        )

        assert response.data == {
            "stage": "consent",
            "transactionId": response.data["transactionId"],
            "hasExistingConsent": False,
            "organizationOptions": [],
        }
        payload = self.client.session[f"oa2:{response.data['transactionId']}"]
        assert payload["uid"] == self.user.id
        assert payload["st"] == self.query["state"]
        assert payload["cc"] == "a" * 43
        assert payload["ccm"] == "S256"
        assert "no-store" in response["Cache-Control"]
        assert not ApiGrant.objects.filter(application=self.application).exists()
        assert not ApiToken.objects.filter(application=self.application).exists()

    def test_requires_session_authentication(self) -> None:
        self.get_error_response(**self.query, status_code=403)

    def test_rejects_bearer_token_even_with_session(self) -> None:
        self.login_as(self.user)
        token = self.create_user_auth_token(user=self.user)
        self.get_error_response(
            **self.query,
            status_code=403,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

    def test_suspended_account(self) -> None:
        self.login_as(self.user)
        self.user.update(is_suspended=True)
        self.get_error_response(**self.query, status_code=403)

    def test_invalid_client(self) -> None:
        self.login_as(self.user)
        self.get_error_response(**{**self.query, "client_id": "invalid"}, status_code=400)

    def test_organization_choices(self) -> None:
        self.login_as(self.user)
        organization = self.create_organization(owner=self.user)
        self.create_organization(owner=self.create_user())
        self.application.update(requires_org_level_access=True, scopes=["project:read"])

        response = self.get_success_response(**self.query)

        assert response.data["organizationOptions"] == [
            {"id": str(organization.id), "slug": organization.slug, "name": organization.name}
        ]

    def test_requires_eligible_organization(self) -> None:
        self.login_as(self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        self.get_error_response(**self.query, status_code=400)

    def test_existing_consent_prepares_transaction(self) -> None:
        self.login_as(self.user)
        persist_authorization(self.application, self.user.id, ["project:read"], None)

        response = self.get_success_response(**self.query)

        assert response.data["stage"] == "consent"
        assert response.data["transactionId"]
        assert response.data["hasExistingConsent"] is True
        assert not ApiGrant.objects.filter(application=self.application).exists()
        assert not ApiToken.objects.filter(application=self.application).exists()

    def test_invalid_scope_returns_callback_error(self) -> None:
        self.login_as(self.user)
        response = self.get_success_response(**{**self.query, "scope": "invalid"})
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query) == {
            "error": ["invalid_scope"],
            "state": [self.query["state"]],
        }

    def test_new_scopes_require_consent(self) -> None:
        self.login_as(self.user)
        persist_authorization(self.application, self.user.id, ["org:read"], None)

        response = self.get_success_response(**self.query)

        assert response.data["hasExistingConsent"] is False
        assert response.data["transactionId"]

    def test_public_context_login_and_consent_api_sequence(self) -> None:
        context = self.client.get(reverse("sentry-api-0-oauth-authorize-context"), self.query)
        assert context.status_code == 200
        assert context.data["application"]["clientId"] == self.application.client_id
        self.get_error_response(**self.query, status_code=403)

        next_uri = "/oauth/authorize/?" + urlencode(self.query)
        config = self.client.get(reverse("sentry-api-0-auth-config"), {"next": next_uri})
        assert config.status_code == 200
        login = self.client.post(
            reverse("sentry-api-0-auth-login"),
            {"username": self.user.username, "password": "admin"},
        )
        assert login.status_code == 200
        assert login.data["nextUri"] == next_uri

        consent = self.get_success_response(**self.query)
        assert consent.data["stage"] == "consent"
        payload = self.client.session[f"oa2:{consent.data['transactionId']}"]
        assert payload["uid"] == self.user.id
        assert payload["st"] == self.query["state"]
        approved = self.get_success_response(
            method="post", transactionId=consent.data["transactionId"], op="approve"
        )
        assert approved.data["stage"] == "redirect"
        assert parse_qs(urlsplit(approved.data["redirectUrl"]).query)["state"] == [
            self.query["state"]
        ]

    def test_public_context_mfa_and_consent_api_sequence(self) -> None:
        interface = TotpInterface()
        interface.enroll(self.user)
        context = self.client.get(reverse("sentry-api-0-oauth-authorize-context"), self.query)
        assert context.status_code == 200
        self.get_error_response(**self.query, status_code=403)

        next_uri = "/oauth/authorize/?" + urlencode(self.query)
        self.client.get(reverse("sentry-api-0-auth-config"), {"next": next_uri})
        login = self.client.post(
            reverse("sentry-api-0-auth-login"),
            {"username": self.user.username, "password": "admin"},
        )
        assert login.status_code == 202
        self.get_error_response(**self.query, status_code=403)

        config = self.client.get(reverse("sentry-api-0-auth-config"))
        assert config.data["pendingMfa"]["mfaMethods"] == [{"id": "totp"}]
        with patch.object(interface.__class__, "validate_otp", return_value=True):
            completed = self.client.post(
                reverse("sentry-api-0-auth-2fa"), {"method": "totp", "otp": "123456"}
            )
        assert completed.status_code == 200
        assert completed.data["nextUri"] == next_uri

        consent = self.get_success_response(**self.query)
        assert consent.data["stage"] == "consent"
        approved = self.get_success_response(
            method="post", transactionId=consent.data["transactionId"], op="approve"
        )
        grant = ApiGrant.objects.get(application=self.application, user=self.user)
        assert parse_qs(urlsplit(approved.data["redirectUrl"]).query)["code"] == [grant.code]

    def test_account_switch_prepares_fresh_consent(self) -> None:
        self.login_as(self.user)
        first = self.get_success_response(**self.query)
        old_transaction = first.data["transactionId"]
        logout = self.client.delete(reverse("sentry-api-0-auth"))
        assert logout.status_code == 204
        self.get_error_response(**self.query, status_code=403)

        other = self.create_user(email="other@example.com")
        self.client.get(reverse("sentry-api-0-auth-config"))
        login = self.client.post(
            reverse("sentry-api-0-auth-login"),
            {"username": other.username, "password": "admin"},
        )
        assert login.status_code == 200, login.data

        consent = self.get_success_response(**self.query)
        transaction = consent.data["transactionId"]
        assert transaction != old_transaction
        assert self.client.session[f"oa2:{transaction}"]["uid"] == other.id
        assert f"oa2:{old_transaction}" not in self.client.session


@control_silo_test
class OAuthAuthorizePostTest(APITestCase):
    endpoint = "sentry-api-0-oauth-authorize"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(redirect_uris="https://example.com/callback")
        self.query = {
            "client_id": self.application.client_id,
            "response_type": "code",
            "scope": "project:read",
            "state": "example-state",
        }
        self.login_as(self.user)

    def prepare(self, **query: str) -> str:
        response = self.get_success_response(method="get", **{**self.query, **query})
        return response.data["transactionId"]

    def test_approve_and_exchange_pkce_code(self) -> None:
        verifier = "v" * 43
        challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .rstrip(b"=")
            .decode()
        )
        transaction = self.prepare(code_challenge=challenge, code_challenge_method="S256")
        approved = self.get_success_response(
            transactionId=transaction,
            op="approve",
            scope="org:admin",
            redirectUri="https://other.example/callback",
        )
        callback = urlsplit(approved.data["redirectUrl"])
        assert callback.netloc == "example.com"
        params = parse_qs(callback.query)
        assert params["state"] == [self.query["state"]]
        grant = ApiGrant.objects.get(application=self.application, user=self.user)
        assert grant.scope_list == ["project:read"]
        assert grant.code_challenge == challenge

        exchanged = self.client.post(
            reverse("sentry-oauth-token"),
            {
                "grant_type": "authorization_code",
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
                "code": params["code"][0],
                "redirect_uri": self.application.get_default_redirect_uri(),
                "code_verifier": verifier,
            },
            format="multipart",
        )
        assert exchanged.status_code == 200
        token = ApiToken.objects.get(application=self.application, user=self.user)
        assert exchanged.json()["access_token"] == token.token
        assert token.scope_list == ["project:read"]

    def test_deny(self) -> None:
        transaction = self.prepare()
        response = self.get_success_response(transactionId=transaction, op="deny")
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query) == {
            "error": ["access_denied"],
            "state": [self.query["state"]],
        }
        assert not ApiGrant.objects.filter(application=self.application).exists()
        assert not ApiAuthorization.objects.filter(application=self.application).exists()

    def test_impersonated_approval_blocked(self) -> None:
        impersonator = self.create_user(is_superuser=True)
        with simulate_impersonation(impersonator):
            transaction = self.prepare()
            self.get_error_response(transactionId=transaction, op="approve", status_code=403)

        assert not ApiAuthorization.objects.filter(application=self.application).exists()
        assert not ApiGrant.objects.filter(application=self.application).exists()
        assert not ApiToken.objects.filter(application=self.application).exists()

    def test_parallel_flows_and_replay(self) -> None:
        first = self.prepare(state="first")
        second = self.prepare(state="second")
        response = self.get_success_response(transactionId=first, op="approve")
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["state"] == ["first"]
        self.get_error_response(transactionId=first, op="approve", status_code=400)
        response = self.get_success_response(transactionId=second, op="deny")
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["state"] == ["second"]

    def test_expired_transaction(self) -> None:
        transaction = self.prepare()
        with patch(
            "sentry.api.helpers.oauth_authorize.transactions.time.time",
            return_value=time.time() + OAUTH_AUTHORIZE_SESSION_TTL + 1,
        ):
            self.get_error_response(transactionId=transaction, op="approve", status_code=400)

    def test_different_account(self) -> None:
        transaction = self.prepare()
        self.login_as(self.create_user())
        self.get_error_response(transactionId=transaction, op="approve", status_code=400)

    def test_requires_session(self) -> None:
        transaction = self.prepare()
        self.client.logout()
        self.get_error_response(transactionId=transaction, op="approve", status_code=403)

    def test_organization_selection(self) -> None:
        organization = self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        transaction = self.prepare()
        self.get_success_response(
            transactionId=transaction, op="approve", selectedOrganizationId=str(organization.id)
        )
        assert ApiGrant.objects.get(application=self.application).organization_id == organization.id

    def test_foreign_organization(self) -> None:
        self.create_organization(owner=self.user)
        other = self.create_organization(owner=self.create_user())
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        transaction = self.prepare()
        response = self.get_success_response(
            transactionId=transaction, op="approve", selectedOrganizationId=str(other.id)
        )
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["error"] == [
            "unauthorized_client"
        ]
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_invalid_decision_preserves_transaction(self) -> None:
        transaction = self.prepare()
        self.get_error_response(transactionId=transaction, op="invalid", status_code=400)
        self.get_success_response(transactionId=transaction, op="deny")

    def test_csrf_protection(self) -> None:
        transaction = self.prepare()
        authenticated_client = self.client
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.cookies.update(authenticated_client.cookies)
        self.get_error_response(transactionId=transaction, op="approve", status_code=403)
        csrf_token = "a" * 32
        self.client.cookies[settings.CSRF_COOKIE_NAME] = csrf_token
        self.get_success_response(
            transactionId=transaction, op="approve", extra_headers={"HTTP_X_CSRFTOKEN": csrf_token}
        )

    def test_implicit_token_response(self) -> None:
        transaction = self.prepare(response_type="token")
        response = self.get_success_response(transactionId=transaction, op="approve")
        token = ApiToken.objects.get(application=self.application, user=self.user)
        fragment = parse_qs(urlsplit(response.data["redirectUrl"]).fragment)
        assert fragment["access_token"] == [token.token]
        assert fragment["state"] == [self.query["state"]]

    def test_approval_extends_saved_scopes(self) -> None:
        first = self.prepare()
        self.get_success_response(transactionId=first, op="approve")
        second = self.prepare(scope="project:read org:read")
        self.get_success_response(transactionId=second, op="approve")
        authorization = ApiAuthorization.objects.get(application=self.application, user=self.user)
        assert set(authorization.scope_list) == {"project:read", "org:read"}

    def test_missing_organization_selection(self) -> None:
        self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        transaction = self.prepare()
        response = self.get_success_response(transactionId=transaction, op="approve")
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["error"] == [
            "invalid_request"
        ]
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_existing_consent_requires_decision_to_issue_grant(self) -> None:
        persist_authorization(self.application, self.user.id, ["project:read"], None)
        consent = self.get_success_response(method="get", **self.query)
        assert consent.data["hasExistingConsent"] is True
        assert not ApiGrant.objects.filter(application=self.application).exists()

        response = self.get_success_response(
            transactionId=consent.data["transactionId"], op="approve"
        )

        grant = ApiGrant.objects.get(application=self.application, user=self.user)
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["code"] == [grant.code]
