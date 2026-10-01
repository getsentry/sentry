import time
from urllib.parse import parse_qs, urlsplit

from django.conf import settings
from rest_framework.test import APIClient

from sentry.api.endpoints.oauth_authorize import OAUTH_AUTHORIZE_SESSION_TTL
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class OAuthAuthorizeTestBase(APITestCase):
    endpoint = "sentry-api-0-oauth-authorize"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(owner=self.user)
        self.query = {
            "client_id": self.application.client_id,
            "response_type": "code",
            "scope": "project:read",
            "state": "return & preserve state",
        }

    def prepare_consent(self, **query: str) -> str:
        response = self.get_success_response(method="get", **(self.query | query))
        return response.data["transactionId"]


@control_silo_test
class OAuthAuthorizeGetTest(OAuthAuthorizeTestBase):
    method = "get"

    def test_consent_context(self) -> None:
        self.login_as(self.user)
        response = self.get_success_response(**self.query)

        assert response.data == {
            "stage": "consent",
            "application": {
                "clientId": self.application.client_id,
                "name": self.application.name,
                "homepageUrl": None,
                "privacyUrl": None,
                "termsUrl": None,
                "requiresOrgLevelAccess": False,
            },
            "scopes": ["project:read"],
            "permissions": ["Read access to projects."],
            "organizationOptions": [],
            "transactionId": response.data["transactionId"],
            "userCode": None,
        }
        assert response.data["transactionId"]
        assert "no-store" in response["Cache-Control"]
        assert not ApiGrant.objects.filter(application=self.application).exists()
        assert not ApiToken.objects.filter(application=self.application).exists()

    def test_organization_options_are_memberships(self) -> None:
        self.login_as(self.user)
        organization = self.create_organization(owner=self.user)
        self.create_organization(owner=self.create_user())
        self.application.update(requires_org_level_access=True, scopes=["project:read"])

        response = self.get_success_response(**self.query)

        assert response.data["organizationOptions"] == [
            {"id": str(organization.id), "slug": organization.slug, "name": organization.name}
        ]
        assert response.data["application"]["requiresOrgLevelAccess"] is True

    def test_invalid_client_missing(self) -> None:
        query: dict[str, str] = {}
        self.login_as(self.user)
        response = self.get_error_response(status_code=400, **query)
        assert response.data == {"detail": "Missing or invalid client_id parameter."}

    def test_invalid_client_unknown(self) -> None:
        query = {"client_id": "invalid"}
        self.login_as(self.user)
        response = self.get_error_response(status_code=400, **query)
        assert response.data == {"detail": "Missing or invalid client_id parameter."}

    def test_unregistered_redirect(self) -> None:
        self.login_as(self.user)
        response = self.get_error_response(
            status_code=400, **(self.query | {"redirect_uri": "https://other.example/callback"})
        )
        assert response.data == {"detail": "Missing or invalid redirect_uri parameter."}
        assert "redirectUrl" not in response.data

    def test_invalid_scope_returns_oauth_redirect(self) -> None:
        self.login_as(self.user)
        response = self.get_success_response(**(self.query | {"scope": "invalid"}))
        assert response.data["stage"] == "redirect"
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query) == {
            "error": ["invalid_scope"],
            "state": [self.query["state"]],
        }

    def test_unsafe_redirect_scheme(self) -> None:
        self.login_as(self.user)
        self.application.update(redirect_uris="javascript:alert(1)")
        response = self.get_error_response(status_code=400, **self.query)
        assert response.data == {"detail": "Missing or invalid redirect_uri parameter."}
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_invalid_pkce_challenge(self) -> None:
        challenge = "short"
        method = "S256"
        self.login_as(self.user)
        response = self.get_success_response(
            **(self.query | {"code_challenge": challenge, "code_challenge_method": method})
        )
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["error"] == [
            "invalid_request"
        ]
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_invalid_pkce_method(self) -> None:
        challenge = "a" * 43
        method = "plain"
        self.login_as(self.user)
        response = self.get_success_response(
            **(self.query | {"code_challenge": challenge, "code_challenge_method": method})
        )
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["error"] == [
            "invalid_request"
        ]
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_existing_consent_redirects_and_force_prompt_displays_consent(self) -> None:
        self.login_as(self.user)
        transaction_id = self.prepare_consent()
        self.get_success_response(method="post", transactionId=transaction_id, op="approve")

        response = self.get_success_response(**self.query)
        assert response.data["stage"] == "redirect"
        assert "code" in parse_qs(urlsplit(response.data["redirectUrl"]).query)

        response = self.get_success_response(**(self.query | {"force_prompt": "1"}))
        assert response.data["stage"] == "consent"

    def test_requires_session(self) -> None:
        self.get_error_response(status_code=403, **self.query)

    def test_requires_completed_mfa(self) -> None:
        self.login_as(self.user)
        self.session["_pending_2fa"] = [self.user.id, time.time()]
        self.save_session()
        self.get_error_response(status_code=403, **self.query)

    def test_rejects_bearer_token_even_with_session(self) -> None:
        self.login_as(self.user)
        token = self.create_user_auth_token(user=self.user)
        self.get_error_response(
            status_code=403,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            **self.query,
        )

    def test_rejects_unavailable_account_inactive(self) -> None:
        field = "is_active"
        self.login_as(self.user)
        self.user.update(**{field: field == "is_suspended"})
        self.get_error_response(status_code=403, **self.query)

    def test_rejects_unavailable_account_suspended(self) -> None:
        field = "is_suspended"
        self.login_as(self.user)
        self.user.update(**{field: field == "is_suspended"})
        self.get_error_response(status_code=403, **self.query)


@control_silo_test
class OAuthAuthorizePostTest(OAuthAuthorizeTestBase):
    method = "post"

    def test_approve_preserves_pkce_state_and_session_parameters(self) -> None:
        self.login_as(self.user)
        transaction_id = self.prepare_consent(code_challenge="a" * 43, code_challenge_method="S256")
        response = self.get_success_response(
            transactionId=transaction_id,
            op="approve",
            scope="org:write",
            redirectUri="https://other.example/callback",
            clientId="other-client",
            state="other-state",
        )

        grant = ApiGrant.objects.get(application=self.application, user=self.user)
        assert grant.redirect_uri == self.application.get_default_redirect_uri()
        assert grant.get_scopes() == ["project:read"]
        assert grant.code_challenge == "a" * 43
        assert grant.code_challenge_method == "S256"
        assert response.data["stage"] == "redirect"
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query) == {
            "code": [grant.code],
            "state": [self.query["state"]],
        }
        assert f"oa2:{transaction_id}" not in self.client.session

    def test_deny(self) -> None:
        self.login_as(self.user)
        transaction_id = self.prepare_consent()
        response = self.get_success_response(transactionId=transaction_id, op="deny")

        assert parse_qs(urlsplit(response.data["redirectUrl"]).query) == {
            "error": ["access_denied"],
            "state": [self.query["state"]],
        }
        assert not ApiGrant.objects.filter(application=self.application).exists()
        assert not ApiAuthorization.objects.filter(application=self.application).exists()

    def test_implicit_response(self) -> None:
        self.login_as(self.user)
        transaction_id = self.prepare_consent(response_type="token")
        response = self.get_success_response(transactionId=transaction_id, op="approve")

        token = ApiToken.objects.get(application=self.application, user=self.user)
        fragment = parse_qs(urlsplit(response.data["redirectUrl"]).fragment)
        assert fragment["access_token"] == [token.token]
        assert fragment["state"] == [self.query["state"]]
        assert token.get_scopes() == ["project:read"]

    def test_custom_scheme_redirect(self) -> None:
        self.login_as(self.user)
        self.application.update(redirect_uris="sentry-apple://callback")
        transaction_id = self.prepare_consent()
        response = self.get_success_response(transactionId=transaction_id, op="approve")
        assert response.data["redirectUrl"].startswith("sentry-apple://callback/?code=")

    def test_organization_selection(self) -> None:
        self.login_as(self.user)
        organization = self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        transaction_id = self.prepare_consent()
        self.get_success_response(
            transactionId=transaction_id,
            op="approve",
            selectedOrganizationId=str(organization.id),
        )
        grant = ApiGrant.objects.get(application=self.application, user=self.user)
        assert grant.organization_id == organization.id

    def test_invalid_organization_selection_missing(self) -> None:
        self.login_as(self.user)
        self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        transaction_id = self.prepare_consent()
        organization_id = None
        response = self.get_success_response(
            transactionId=transaction_id,
            op="approve",
            selectedOrganizationId=organization_id,
        )
        assert "error" in parse_qs(urlsplit(response.data["redirectUrl"]).query)
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_invalid_organization_selection_malformed(self) -> None:
        self.login_as(self.user)
        self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        transaction_id = self.prepare_consent()
        organization_id = "invalid"
        response = self.get_success_response(
            transactionId=transaction_id,
            op="approve",
            selectedOrganizationId=organization_id,
        )
        assert "error" in parse_qs(urlsplit(response.data["redirectUrl"]).query)
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_invalid_organization_selection_foreign(self) -> None:
        self.login_as(self.user)
        self.create_organization(owner=self.user)
        foreign_org = self.create_organization(owner=self.create_user())
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        transaction_id = self.prepare_consent()
        organization_id = str(foreign_org.id)
        response = self.get_success_response(
            transactionId=transaction_id,
            op="approve",
            selectedOrganizationId=organization_id,
        )
        assert "error" in parse_qs(urlsplit(response.data["redirectUrl"]).query)
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_user_level_app_ignores_organization(self) -> None:
        self.login_as(self.user)
        foreign_org = self.create_organization(owner=self.create_user())
        transaction_id = self.prepare_consent()
        self.get_success_response(
            transactionId=transaction_id,
            op="approve",
            selectedOrganizationId=str(foreign_org.id),
        )
        assert ApiGrant.objects.get(application=self.application).organization_id is None

    def test_parallel_flows_and_replay(self) -> None:
        self.login_as(self.user)
        first = self.prepare_consent(state="first")
        second = self.prepare_consent(state="second")
        response = self.get_success_response(transactionId=first, op="approve")
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["state"] == ["first"]
        assert f"oa2:{second}" in self.client.session
        self.get_error_response(transactionId=first, op="approve", status_code=400)
        response = self.get_success_response(transactionId=second, op="approve")
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["state"] == ["second"]
        assert ApiGrant.objects.filter(application=self.application).count() == 2

    def test_rejects_invalid_session_binding_user(self) -> None:
        self.login_as(self.user)
        transaction_id = self.prepare_consent()
        session = self.client.session
        payload = session[f"oa2:{transaction_id}"]
        payload["uid"] = self.create_user().id
        session[f"oa2:{transaction_id}"] = payload
        session.save()
        assert session.session_key is not None
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key

        self.get_error_response(transactionId=transaction_id, op="approve", status_code=400)
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_rejects_invalid_session_binding_transaction(self) -> None:
        self.login_as(self.user)
        transaction_id = self.prepare_consent()
        session = self.client.session
        payload = session[f"oa2:{transaction_id}"]
        payload["tx"] = "different-transaction"
        session[f"oa2:{transaction_id}"] = payload
        session.save()
        assert session.session_key is not None
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key

        self.get_error_response(transactionId=transaction_id, op="approve", status_code=400)
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_rejects_invalid_session_binding_expired(self) -> None:
        self.login_as(self.user)
        transaction_id = self.prepare_consent()
        session = self.client.session
        payload = session[f"oa2:{transaction_id}"]
        payload["ts"] = time.time() - OAUTH_AUTHORIZE_SESSION_TTL - 1
        session[f"oa2:{transaction_id}"] = payload
        session.save()
        assert session.session_key is not None
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key

        self.get_error_response(transactionId=transaction_id, op="approve", status_code=400)
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_deactivated_application(self) -> None:
        self.login_as(self.user)
        transaction_id = self.prepare_consent()
        self.application.update(status=ApiApplicationStatus.inactive)
        self.get_error_response(transactionId=transaction_id, op="approve", status_code=400)
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_invalid_request_missing_fields(self) -> None:
        data: dict[str, str] = {}
        self.login_as(self.user)
        self.get_error_response(status_code=400, **data)

    def test_invalid_request_missing_decision_field(self) -> None:
        data = {"op": "approve"}
        self.login_as(self.user)
        self.get_error_response(status_code=400, **data)

    def test_invalid_request_unknown_operation(self) -> None:
        data = {"transactionId": "missing", "op": "invalid"}
        self.login_as(self.user)
        self.get_error_response(status_code=400, **data)

    def test_missing_session_transaction(self) -> None:
        self.login_as(self.user)
        self.get_error_response(transactionId="missing", op="approve", status_code=400)

    def test_requires_session(self) -> None:
        self.get_error_response(transactionId="missing", op="approve", status_code=403)

    def test_requires_completed_mfa(self) -> None:
        self.login_as(self.user)
        transaction_id = self.prepare_consent()
        self.session = self.client.session
        self.session["_pending_2fa"] = [self.user.id, time.time()]
        self.save_session()
        self.get_error_response(transactionId=transaction_id, op="approve", status_code=403)
        assert not ApiGrant.objects.filter(application=self.application).exists()

    def test_csrf_protection(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        self.login_as(self.user)
        transaction_id = self.prepare_consent()
        self.get_error_response(transactionId=transaction_id, op="approve", status_code=403)
        assert not ApiGrant.objects.filter(application=self.application).exists()

        csrf_token = "a" * 32
        self.client.cookies[settings.CSRF_COOKIE_NAME] = csrf_token
        self.get_success_response(
            transactionId=transaction_id,
            op="approve",
            extra_headers={"HTTP_X_CSRFTOKEN": csrf_token},
        )
        assert ApiGrant.objects.filter(application=self.application, user=self.user).exists()
