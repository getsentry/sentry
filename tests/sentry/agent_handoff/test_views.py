from unittest.mock import patch
from urllib.parse import urlencode

from django.http import HttpResponse

from sentry.agent_handoff.codes import (
    HandoffFlow,
    _get_redis_client,
    _handoff_key,
    consume_handoff,
    issue_handoff,
)
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apisetupcode import ApiSetupCode
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class AgentHandoffViewTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(client_secret=None)
        self.organization = self.create_organization(owner=self.user)
        self.enterContext(
            self.options(
                {
                    "onboarding.agent-handoff.client-id": self.application.client_id,
                    "oauth.setup-code.allowed-client-ids": [self.application.client_id],
                }
            )
        )

    def issue(self) -> str:
        return issue_handoff(
            flow=HandoffFlow.ONBOARDING,
            user_id=self.user.id,
            organization_id=self.organization.id,
            application_id=self.application.id,
            scope_list=["org:read"],
        ).code

    def claim(self, code: str) -> HttpResponse:
        return self.client.post(
            "/agents/",
            urlencode({"handoff_code": code}),
            content_type="application/x-www-form-urlencoded",
        )

    def test_claim_mints_once_and_returns_the_private_guide(self) -> None:
        code = self.issue()
        response = self.claim(code)
        assert response.status_code == 200
        assert "SENTRY_SETUP_CODE=sntryc_" in response.content.decode()
        assert "Now ask the user" in response.content.decode()
        assert "no-store" in response["Cache-Control"]
        assert response["Referrer-Policy"] == "no-referrer"
        assert response["Content-Type"] == "text/markdown; charset=utf-8"
        setup = ApiSetupCode.objects.get(user_id=self.user.id)
        assert setup.application_id == self.application.id
        assert setup.scope_list == ["org:read"]
        assert setup.organization_id is None
        assert (
            ApiAuthorization.objects.get(
                application=self.application, user=self.user
            ).organization_id
            is None
        )
        assert self.claim(code).status_code == 410
        assert ApiSetupCode.objects.filter(user_id=self.user.id).count() == 1

    def test_claim_dispatches_flow_with_authorized_handoff_context(self) -> None:
        with patch(
            "sentry.agent_handoff.claims.get_flow_instructions",
            return_value="Follow the onboarding guide.",
        ) as instructions:
            response = self.claim(self.issue())

        assert response.status_code == 200
        assert response.content.decode().rstrip().endswith("Follow the onboarding guide.")
        instructions.assert_called_once()
        handoff = instructions.call_args.args[0]
        assert handoff.flow is HandoffFlow.ONBOARDING
        assert handoff.user_id == self.user.id
        assert handoff.organization_id == self.organization.id

    def test_organization_scoped_application_retains_selected_organization(self) -> None:
        self.application.update(requires_org_level_access=True, scopes=["org:read"])
        assert self.claim(self.issue()).status_code == 200
        assert (
            ApiSetupCode.objects.get(user_id=self.user.id).organization_id == self.organization.id
        )
        assert (
            ApiAuthorization.objects.get(
                application=self.application, user=self.user
            ).organization_id
            == self.organization.id
        )

    def test_expired_handoff_is_unavailable(self) -> None:
        code = self.issue()
        _get_redis_client().expire(_handoff_key(code), 0)
        assert self.claim(code).status_code == 410
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()

    def assert_unavailable(self, code: str) -> None:
        assert self.claim(code).status_code == 410
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()

    def test_inactive_user_prevents_claim(self) -> None:
        code = self.issue()
        self.user.update(is_active=False)
        self.assert_unavailable(code)

    def test_suspended_user_prevents_claim(self) -> None:
        code = self.issue()
        self.user.update(is_suspended=True)
        self.assert_unavailable(code)

    def test_inactive_application_prevents_claim(self) -> None:
        code = self.issue()
        self.application.update(status=ApiApplicationStatus.inactive)
        self.assert_unavailable(code)

    def test_confidential_application_prevents_claim(self) -> None:
        code = self.issue()
        self.application.update(client_secret="example-secret")
        self.assert_unavailable(code)

    def test_scope_revocation_prevents_claim(self) -> None:
        code = self.issue()
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        self.assert_unavailable(code)

    def test_allowlist_revocation_prevents_claim(self) -> None:
        code = self.issue()
        with self.options({"oauth.setup-code.allowed-client-ids": []}):
            self.assert_unavailable(code)

    def test_configured_client_change_prevents_claim(self) -> None:
        code = self.issue()
        with self.options({"onboarding.agent-handoff.client-id": "another-client"}):
            self.assert_unavailable(code)

    def test_handoff_remains_bound_to_original_application(self) -> None:
        code = self.issue()
        replacement = self.create_api_application(client_secret=None)
        with self.options(
            {
                "onboarding.agent-handoff.client-id": replacement.client_id,
                "oauth.setup-code.allowed-client-ids": [replacement.client_id],
            }
        ):
            self.assert_unavailable(code)

    def test_membership_revocation_prevents_claim(self) -> None:
        code = self.issue()
        with assume_test_silo_mode(SiloMode.CELL):
            self.organization.member_set.filter(user_id=self.user.id).delete()
        assert self.claim(code).status_code == 410
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()

    def test_preview_is_public_and_preserves_the_code(self) -> None:
        code = self.issue()
        response = self.client.get(f"/agents/#{code}")
        assert response.status_code == 200
        assert "original guide URL" in response.content.decode()
        assert consume_handoff(code) is not None

    def test_missing_code_is_rejected(self) -> None:
        assert self.claim("").status_code == 400

    def test_malformed_code_is_rejected(self) -> None:
        assert self.claim("invalid").status_code == 400

    def test_oversized_code_is_rejected(self) -> None:
        assert self.claim("sntryh_" + "a" * 2000).status_code == 400

    def test_rate_limit_preserves_the_code(self) -> None:
        code = self.issue()
        with patch("sentry.agent_handoff.views.ratelimiter.is_limited", return_value=True):
            response = self.claim(code)
        assert response.status_code == 429
        assert response["Retry-After"] == "60"
        assert consume_handoff(code) is not None
