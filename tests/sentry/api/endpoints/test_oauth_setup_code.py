from base64 import b64decode
from typing import Any

from rest_framework.response import Response

from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apisetupcode import SETUP_CODE_PREFIX, ApiSetupCode, hash_setup_code
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.impersonation import simulate_impersonation
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test
class OAuthSetupCodeTest(APITestCase):
    endpoint = "sentry-api-0-oauth-setup-code"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(client_secret=None)
        self.enterContext(
            override_options({"oauth.setup-code.allowed-client-ids": [self.application.client_id]})
        )

    def mint(self, **kwargs: Any) -> Response:
        kwargs.setdefault("clientId", self.application.client_id)
        kwargs.setdefault("scopes", ["project:read", "org:read"])
        return self.get_success_response(status_code=201, **kwargs)

    def test_requires_session_authentication(self) -> None:
        self.get_error_response(
            clientId=self.application.client_id, scopes=["project:read"], status_code=403
        )
        assert not ApiSetupCode.objects.exists()

    def test_rejects_token_authentication(self) -> None:
        token = self.create_user_auth_token(self.user, scope_list=["org:read"])
        response = self.client.post(
            "/api/0/auth/oauth/setup-code/",
            {"clientId": self.application.client_id, "scopes": ["project:read"]},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )
        assert response.status_code in (401, 403)
        assert not ApiSetupCode.objects.exists()

    def test_mints_code(self) -> None:
        self.login_as(self.user)
        response = self.mint()

        code = response.data["code"]
        assert code.startswith(SETUP_CODE_PREFIX)
        claim, secret = code.removeprefix(SETUP_CODE_PREFIX).split("_")
        assert json.loads(b64decode(claim))["url"] == "http://testserver"
        assert secret
        assert response.data["scopes"] == ["project:read", "org:read"]
        assert response.data["organizationId"] is None
        assert "no-store" in response["Cache-Control"]

        setup_code = ApiSetupCode.objects.get()
        assert setup_code.hashed_code == hash_setup_code(code)
        assert setup_code.user_id == self.user.id
        assert setup_code.application_id == self.application.id
        assert response.data["expiresAt"] == setup_code.expires_at
        assert ApiAuthorization.objects.get(
            application=self.application, user=self.user
        ).scope_list == ["project:read", "org:read"]

    def test_minting_revokes_previous_codes_for_user(self) -> None:
        other_user = self.create_user()
        self.login_as(other_user)
        other_code = self.mint().data["code"]

        self.login_as(self.user)
        first = self.mint().data["code"]
        second = self.mint().data["code"]

        assert not ApiSetupCode.objects.filter(hashed_code=hash_setup_code(first)).exists()
        assert ApiSetupCode.objects.filter(
            hashed_code=hash_setup_code(second), user=self.user
        ).exists()
        assert ApiSetupCode.objects.filter(
            hashed_code=hash_setup_code(other_code), user=other_user
        ).exists()

    def test_rejects_client_not_allowlisted(self) -> None:
        self.login_as(self.user)
        other_application = self.create_api_application()
        response = self.get_error_response(
            clientId=other_application.client_id, scopes=["project:read"], status_code=400
        )
        assert "clientId" in response.data
        assert not ApiSetupCode.objects.exists()

    def test_rejects_inactive_application(self) -> None:
        self.login_as(self.user)
        self.application.update(status=ApiApplicationStatus.inactive)
        self.get_error_response(
            clientId=self.application.client_id, scopes=["project:read"], status_code=400
        )
        assert not ApiSetupCode.objects.exists()

    def test_rejects_unknown_scope(self) -> None:
        self.login_as(self.user)
        response = self.get_error_response(
            clientId=self.application.client_id, scopes=["not:a-scope"], status_code=400
        )
        assert "scopes" in response.data

    def test_requires_scopes(self) -> None:
        self.login_as(self.user)
        self.get_error_response(clientId=self.application.client_id, scopes=[], status_code=400)

    def test_org_level_application_requires_organization(self) -> None:
        self.login_as(self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        response = self.get_error_response(
            clientId=self.application.client_id, scopes=["project:read"], status_code=400
        )
        assert "organizationId" in response.data

    def test_org_level_application_rejects_inaccessible_organization(self) -> None:
        self.login_as(self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        organization = self.create_organization(owner=self.create_user())
        response = self.get_error_response(
            clientId=self.application.client_id,
            scopes=["project:read"],
            organizationId=str(organization.id),
            status_code=400,
        )
        assert "organizationId" in response.data

    def test_org_level_application_rejects_scopes_beyond_application(self) -> None:
        self.login_as(self.user)
        organization = self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        response = self.get_error_response(
            clientId=self.application.client_id,
            scopes=["project:write"],
            organizationId=str(organization.id),
            status_code=400,
        )
        assert "scopes" in response.data

    def test_org_level_application_mints_with_organization(self) -> None:
        self.login_as(self.user)
        organization = self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        response = self.mint(scopes=["project:read"], organizationId=str(organization.id))
        assert response.data["organizationId"] == str(organization.id)
        assert ApiSetupCode.objects.get().organization_id == organization.id

    def test_impersonated_mint_blocked(self) -> None:
        impersonator = self.create_user(is_superuser=True)
        with simulate_impersonation(impersonator):
            self.login_as(self.user)
            self.get_error_response(
                clientId=self.application.client_id, scopes=["project:read"], status_code=403
            )
        assert not ApiSetupCode.objects.exists()
