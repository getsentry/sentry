import re
from unittest.mock import MagicMock, patch
from urllib.parse import urlencode

from django.http import HttpResponse
from django.utils import timezone

from sentry.agent_handoff.claims import ClaimOutcome
from sentry.agent_handoff.codes import (
    HANDOFF_LIFETIME,
    HandoffFlow,
    ProjectSetupContext,
    _get_redis_client,
    _handoff_key,
    consume_handoff,
    issue_handoff,
    revoke_handoff,
)
from sentry.analytics.events.agent_handoff import AgentHandoffClaimedEvent
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apisetupcode import ApiSetupCode
from sentry.onboarding.agentic_progress.model import ProgressUpdate, Stage, StageStatus
from sentry.onboarding.agentic_progress.service import get_onboarding_progress_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class AgentHandoffViewTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(client_secret=None)
        self.organization = self.create_organization(owner=self.user)
        run, _ = get_onboarding_progress_service().create_or_resume(
            user_id=self.user.id, organization_id=self.organization.id, client_run_id="browser"
        )
        self.onboarding_context = ProjectSetupContext(run_id=run.run_id)
        self.enterContext(
            self.options(
                {
                    "onboarding.agent-handoff.client-id": self.application.client_id,
                    "oauth.setup-code.allowed-client-ids": [self.application.client_id],
                }
            )
        )

    def issue(
        self,
        context: ProjectSetupContext | None = None,
        *,
        ip_address: str = "127.0.0.1",
        disable_ip_pinning: bool = False,
    ) -> str:
        return issue_handoff(
            flow=HandoffFlow.ONBOARDING,
            user_id=self.user.id,
            organization_id=self.organization.id,
            application_id=self.application.id,
            scope_list=["org:read"],
            ip_address=ip_address,
            disable_ip_pinning=disable_ip_pinning,
            context=context or self.onboarding_context,
        ).code

    def claim(self, code: str, ip_address: str = "127.0.0.1") -> HttpResponse:
        return self.client.post(
            "/agent-handoff.md",
            urlencode({"handoff_code": code}),
            content_type="application/x-www-form-urlencoded",
            REMOTE_ADDR=ip_address,
        )

    def test_claim_mints_once_and_returns_the_private_guide(self) -> None:
        code = self.issue()
        response = self.client.post(
            "/agent-handoff.md",
            urlencode({"handoff_code": code}),
            content_type="application/x-www-form-urlencoded",
            HTTP_ACCEPT="text/markdown",
        )
        assert response.status_code == 200
        assert "SENTRY_SETUP_CODE=sntryc_" in response.content.decode()
        assert "agent-setup/get-started.md" in response.content.decode()
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

    def test_claim_activates_existing_onboarding_run(self) -> None:
        progress = get_onboarding_progress_service()
        run, _ = progress.create_or_resume(
            user_id=self.user.id, organization_id=self.organization.id, client_run_id="browser"
        )
        context = ProjectSetupContext(run_id=run.run_id)
        response = self.claim(self.issue(context))
        assert response.status_code == 200
        match = re.search(r"onboarding run code is `([A-Za-z0-9]{10})`", response.content.decode())
        assert match is not None
        code = match[1]
        updated, changed, _ = progress.update(
            token=code,
            user_id=self.user.id,
            organization_id=self.organization.id,
            update=ProgressUpdate(stage=Stage.ANALYZE_PROJECT, status=StageStatus.ACTIVE),
        )
        assert changed
        assert updated.run_id == run.run_id
        retried = self.claim(self.issue(context))
        assert retried.status_code == 200
        assert f"onboarding run code is `{code}`" in retried.content.decode()

    def test_foreign_run_prevents_claim_and_setup_code_minting(self) -> None:
        run, _ = get_onboarding_progress_service().create_or_resume(
            user_id=self.create_user().id,
            organization_id=self.organization.id,
            client_run_id="browser",
        )
        response = self.claim(self.issue(ProjectSetupContext(run_id=run.run_id)))
        assert response.status_code == 410
        assert not ApiSetupCode.objects.exists()
        assert not ApiAuthorization.objects.exists()

    def test_claim_dispatches_flow_with_authorized_handoff_context(self) -> None:
        with patch(
            "sentry.agent_handoff.flows.onboarding.OnboardingFlow.render",
            return_value="Follow the onboarding guide.",
        ) as instructions:
            response = self.claim(self.issue())

        assert response.status_code == 200
        assert response.content.decode().rstrip().endswith("Follow the onboarding guide.")
        instructions.assert_called_once_with(
            self.onboarding_context,
            user_id=self.user.id,
            organization_id=self.organization.id,
        )

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
        response = self.client.get("/agent-handoff.md", HTTP_ACCEPT="text/markdown")
        assert response.status_code == 200
        assert "The user initiated this agent handoff in Sentry" in response.content.decode()
        assert "It does not run those instructions" in response.content.decode()
        assert consume_handoff(code, ip_address="127.0.0.1") is not None

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
        assert "retry the same handoff code" in response.content.decode()
        assert consume_handoff(code, ip_address="127.0.0.1") is not None

    def test_ip_mismatch_explains_recovery_and_preserves_handoff(self) -> None:
        code = self.issue(ip_address="192.0.2.1")
        with patch("sentry.agent_handoff.views.metrics.incr") as incr:
            response = self.claim(code, ip_address="192.0.2.2")

        incr.assert_any_call("agent_handoff.claim.ip_mismatch", sample_rate=1.0)
        assert response.status_code == 403
        assert response["Content-Type"] == "text/markdown; charset=utf-8"
        assert "no-store" in response["Cache-Control"]
        body = response.content.decode()
        assert "different network" in body
        assert "Advanced options" in body
        assert '"Use IP pinning"' in body
        assert "copy a new prompt" in body
        assert "192.0.2.1" not in body
        assert code not in body
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()
        assert not ApiAuthorization.objects.filter(user_id=self.user.id).exists()
        assert self.claim(code, ip_address="192.0.2.1").status_code == 200

    def test_unpinned_handoff_accepts_remote_agent(self) -> None:
        code = self.issue(disable_ip_pinning=True)
        assert self.claim(code, ip_address="192.0.2.2").status_code == 200

    def assert_claim_recorded(
        self, record: MagicMock, outcome: ClaimOutcome, *, attributed: bool = True
    ) -> None:
        assert_last_analytics_event(
            record,
            AgentHandoffClaimedEvent(
                outcome=outcome.value,
                user_id=self.user.id if attributed else None,
                organization_id=self.organization.id if attributed else None,
                flow=HandoffFlow.ONBOARDING.value if attributed else None,
                run_id=self.onboarding_context.run_id if attributed else None,
            ),
        )

    @patch("sentry.analytics.record")
    def test_records_accepted_claim(self, record: MagicMock) -> None:
        assert self.claim(self.issue()).status_code == 200
        self.assert_claim_recorded(record, ClaimOutcome.ACCEPTED)

    @patch("sentry.analytics.record")
    def test_records_expired_claim(self, record: MagicMock) -> None:
        code = self.issue()
        with freeze_time(timezone.now() + HANDOFF_LIFETIME):
            assert self.claim(code).status_code == 410
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()
        self.assert_claim_recorded(record, ClaimOutcome.EXPIRED)

    @patch("sentry.analytics.record")
    def test_records_ip_mismatch_claim(self, record: MagicMock) -> None:
        code = self.issue(ip_address="192.0.2.1")
        assert self.claim(code, ip_address="192.0.2.2").status_code == 403
        self.assert_claim_recorded(record, ClaimOutcome.IP_MISMATCH)

    @patch("sentry.analytics.record")
    def test_records_claim_that_fails_revalidation_as_invalid(self, record: MagicMock) -> None:
        code = self.issue()
        self.user.update(is_active=False)
        assert self.claim(code).status_code == 410
        self.assert_claim_recorded(record, ClaimOutcome.INVALID)

    @patch("sentry.analytics.record")
    def test_records_reused_claim_as_unattributed_invalid(self, record: MagicMock) -> None:
        code = self.issue()
        assert self.claim(code).status_code == 200
        assert self.claim(code).status_code == 410
        self.assert_claim_recorded(record, ClaimOutcome.INVALID, attributed=False)

    @patch("sentry.analytics.record")
    def test_records_revoked_claim_as_unattributed_invalid(self, record: MagicMock) -> None:
        code = self.issue()
        revoke_handoff(code)
        assert self.claim(code).status_code == 410
        self.assert_claim_recorded(record, ClaimOutcome.INVALID, attributed=False)


@control_silo_test
class AgentHandoffPreviewTest(TestCase):
    def test_public_preview_uses_placeholders(self) -> None:
        response = self.client.get("/agent-handoff.md", {"preview": "1"})

        assert response.status_code == 200
        body = response.content.decode()
        assert body.startswith("# Set Up Sentry")
        assert "<setup-code>" in body
        assert "Example Organization" in body
        assert r"user@example\.com" in body
        assert body.rstrip().endswith("Now ask the user what they would like to do next.")
        assert response["Content-Type"] == "text/plain; charset=utf-8"
        assert "no-store" in response["Cache-Control"]
        assert not ApiSetupCode.objects.exists()
        assert not ApiAuthorization.objects.exists()

    def test_onboarding_preview_does_not_issue_reporting_code(self) -> None:
        with patch(
            "sentry.agent_handoff.flows.onboarding.organization_service.issue_onboarding_reporting_code"
        ) as issue:
            response = self.client.get("/agent-handoff.md", {"preview": "1", "flow": "onboarding"})

        assert response.status_code == 200
        body = response.content.decode()
        assert "<onboarding-run-code>" in body
        assert "agent-setup/get-started.md" in body
        issue.assert_not_called()

    def test_preview_is_independent_of_the_session(self) -> None:
        anonymous = self.client.get("/agent-handoff.md", {"preview": "1"})
        self.login_as(self.user)
        authenticated = self.client.get("/agent-handoff.md", {"preview": "1"})

        assert anonymous.status_code == authenticated.status_code == 200
        assert anonymous.content == authenticated.content

    def test_unknown_preview_flow(self) -> None:
        response = self.client.get("/agent-handoff.md", {"preview": "1", "flow": "unknown"})

        assert response.status_code == 400
        assert "Unknown Handoff Flow" in response.content.decode()
