from unittest.mock import patch
from urllib.parse import parse_qs, urlencode, urlsplit

from django.urls import reverse

from sentry.api.helpers.oauth_consent import persist_authorization
from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
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
        assert consent.data["transactionId"]

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
