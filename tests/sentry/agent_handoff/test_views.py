import re
from unittest.mock import MagicMock, patch

from django.http import HttpResponse
from django.utils import timezone

from sentry.agent_handoff.claims import ClaimOutcome
from sentry.agent_handoff.codes import (
    HANDOFF_LIFETIME,
    AddFeatureContext,
    AddFeatureProduct,
    HandoffFlow,
    ProjectSetupContext,
    _get_redis_client,
    _handoff_key,
    consume_handoff,
    issue_handoff,
    revoke_handoff,
)
from sentry.analytics.events.agent_handoff import AgentHandoffClaimedEvent
from sentry.analytics.events.oauth_setup_code import OAuthSetupCodeIssuedEvent
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apisetupcode import ApiSetupCode
from sentry.onboarding.agentic_progress.model import ProgressUpdate, Stage, StageStatus
from sentry.onboarding.agentic_progress.service import get_onboarding_progress_service
from sentry.projects.services.project.model import RpcProject
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import (
    assert_any_analytics_event,
    assert_last_analytics_event,
    assert_not_analytics_event,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


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
        issued = issue_handoff(
            flow=HandoffFlow.ONBOARDING,
            user_id=self.user.id,
            organization_id=self.organization.id,
            application_id=self.application.id,
            scope_list=["org:read"],
            ip_address=ip_address,
            disable_ip_pinning=disable_ip_pinning,
            context=context or self.onboarding_context,
        )
        self.handoff_id = issued.handoff_id
        return issued.code

    def claim_api(self, code: str, ip_address: str = "127.0.0.1") -> HttpResponse:
        return self.client.post(
            "/api/0/agent-handoff/",
            {"handoff_code": code},
            content_type="application/json",
            REMOTE_ADDR=ip_address,
        )

    @patch("sentry.analytics.record")
    def test_api_claim_returns_dynamic_content_as_json(self, record: MagicMock) -> None:
        with patch(
            "sentry.agent_handoff.flows.onboarding.OnboardingFlow.render",
            return_value="Follow the onboarding guide.",
        ):
            response = self.claim_api(self.issue())

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"
        body = json.loads(response.content)
        assert body == {
            "sentryUrl": "http://testserver",
            "userEmail": self.user.email,
            "organizationName": self.organization.name,
            "organizationSlug": self.organization.slug,
            "clientId": self.application.client_id,
            "setupCode": body["setupCode"],
            "flowInstructions": "Follow the onboarding guide.",
        }
        assert body["setupCode"].startswith("sntryc_")
        assert "no-store" in response["Cache-Control"]
        setup = ApiSetupCode.objects.get(user_id=self.user.id)
        assert_any_analytics_event(
            record,
            OAuthSetupCodeIssuedEvent(
                user_id=self.user.id,
                organization_id=None,
                application_id=self.application.id,
                setup_code_id=setup.id,
                flow=HandoffFlow.ONBOARDING.value,
            ),
        )

    def test_claim_activates_existing_onboarding_run(self) -> None:
        progress = get_onboarding_progress_service()
        run, _ = progress.create_or_resume(
            user_id=self.user.id, organization_id=self.organization.id, client_run_id="browser"
        )
        context = ProjectSetupContext(run_id=run.run_id)
        response = self.claim_api(self.issue(context))
        assert response.status_code == 200
        instructions = json.loads(response.content)["flowInstructions"]
        match = re.search(r"onboarding run code is `([A-Za-z0-9]{10})`", instructions)
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
        retried = self.claim_api(self.issue(context))
        assert retried.status_code == 200
        assert f"onboarding run code is `{code}`" in json.loads(retried.content)["flowInstructions"]

    @patch("sentry.analytics.record")
    def test_foreign_run_prevents_claim_and_setup_code_minting(
        self, mock_record: MagicMock
    ) -> None:
        run, _ = get_onboarding_progress_service().create_or_resume(
            user_id=self.create_user().id,
            organization_id=self.organization.id,
            client_run_id="browser",
        )
        response = self.claim_api(self.issue(ProjectSetupContext(run_id=run.run_id)))
        assert response.status_code == 410
        assert not ApiSetupCode.objects.exists()
        assert not ApiAuthorization.objects.exists()
        assert_not_analytics_event(mock_record, OAuthSetupCodeIssuedEvent)

    def test_claim_dispatches_flow_with_authorized_handoff_context(self) -> None:
        with patch(
            "sentry.agent_handoff.flows.onboarding.OnboardingFlow.render",
            return_value="Follow the onboarding guide.",
        ) as instructions:
            response = self.claim_api(self.issue())

        assert response.status_code == 200
        assert json.loads(response.content)["flowInstructions"] == "Follow the onboarding guide."
        instructions.assert_called_once_with(
            self.onboarding_context,
            user_id=self.user.id,
            organization_id=self.organization.id,
        )

    def test_organization_scoped_application_retains_selected_organization(self) -> None:
        self.application.update(requires_org_level_access=True, scopes=["org:read"])
        assert self.claim_api(self.issue()).status_code == 200
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
        assert self.claim_api(code).status_code == 410
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()

    def assert_unavailable(self, code: str) -> None:
        assert self.claim_api(code).status_code == 410
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
        assert self.claim_api(code).status_code == 410
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()

    def test_public_guide_installs_the_cli_and_preserves_the_code(self) -> None:
        code = self.issue()
        response = self.client.get("/agent-handoff.md", HTTP_ACCEPT="text/markdown")

        assert response.status_code == 200
        assert response["Content-Type"] == "text/markdown; charset=utf-8"
        assert "no-store" in response["Cache-Control"]
        assert response["Referrer-Policy"] == "no-referrer"
        body = response.content.decode()
        assert (
            "curl -fsSL https://cli.sentry.dev/install | "
            "SENTRY_HOST=http://testserver SENTRY_HANDOFF=HANDOFF_CODE bash"
        ) in body
        assert "$env:SENTRY_HOST = 'http://testserver'" in body
        assert "$env:SENTRY_HANDOFF = 'HANDOFF_CODE'" in body
        assert "irm https://cli.sentry.dev/install.ps1 | iex" in body
        assert consume_handoff(code, ip_address="127.0.0.1") is not None

    def test_missing_code_is_rejected(self) -> None:
        assert self.claim_api("").status_code == 400

    def test_malformed_code_is_rejected(self) -> None:
        assert self.claim_api("invalid").status_code == 400

    def test_api_claim_errors_return_json(self) -> None:
        response = self.claim_api("invalid")

        assert response.status_code == 400
        assert response["Content-Type"] == "application/json"
        assert json.loads(response.content) == {
            "detail": {
                "code": "agent-handoff-unavailable",
                "message": "Handoff code unavailable.",
                "extra": {},
            }
        }

    def test_api_claim_rejects_non_object_json(self) -> None:
        response = self.client.post(
            "/api/0/agent-handoff/",
            ["invalid"],
            content_type="application/json",
        )

        assert response.status_code == 400
        assert json.loads(response.content) == {
            "detail": {
                "code": "agent-handoff-unavailable",
                "message": "Handoff code unavailable.",
                "extra": {},
            }
        }

    def test_api_claim_accepts_json_charset(self) -> None:
        response = self.client.post(
            "/api/0/agent-handoff/",
            json.dumps({"handoff_code": self.issue()}),
            content_type="application/json; charset=utf-8",
        )

        assert response.status_code == 200

    def test_api_claim_rejects_cross_origin_requests(self) -> None:
        code = self.issue()

        response = self.client.post(
            "/api/0/agent-handoff/",
            {"handoff_code": code},
            content_type="application/json",
            HTTP_ORIGIN="https://example.com",
        )

        assert response.status_code == 403
        assert json.loads(response.content) == {
            "detail": {
                "code": "agent-handoff-cross-origin",
                "message": "Cross-origin handoff claims are not allowed.",
                "extra": {},
            }
        }
        assert consume_handoff(code, ip_address="127.0.0.1") is not None

    def test_api_claim_is_available_only_once(self) -> None:
        code = self.issue()
        assert self.claim_api(code).status_code == 200

        response = self.claim_api(code)

        assert response.status_code == 410
        assert json.loads(response.content) == {
            "detail": {
                "code": "agent-handoff-unavailable",
                "message": "Handoff code unavailable.",
                "extra": {},
            }
        }

    def test_api_claim_reports_ip_mismatch_as_json(self) -> None:
        code = self.issue(ip_address="192.0.2.1")

        response = self.claim_api(code, ip_address="192.0.2.2")

        assert response.status_code == 403
        assert json.loads(response.content) == {
            "detail": {
                "code": "agent-handoff-ip-mismatch",
                "message": "The handoff code is pinned to a different IP address.",
                "extra": {},
            }
        }
        assert consume_handoff(code, ip_address="192.0.2.1") is not None

    def test_api_claim_rate_limit_preserves_the_code(self) -> None:
        code = self.issue()
        with patch(
            "sentry.agent_handoff.endpoints.claim_agent_handoff.ratelimiter.is_limited",
            return_value=True,
        ):
            response = self.claim_api(code)

        assert response.status_code == 429
        assert response["Retry-After"] == "60"
        assert json.loads(response.content) == {
            "detail": {
                "code": "agent-handoff-rate-limited",
                "message": "Wait 60 seconds, then retry the same handoff code.",
                "extra": {},
            }
        }
        assert consume_handoff(code, ip_address="127.0.0.1") is not None

    def test_oversized_code_is_rejected(self) -> None:
        assert self.claim_api("sntryh_" + "a" * 2000).status_code == 400

    def test_unpinned_handoff_accepts_remote_agent(self) -> None:
        code = self.issue(disable_ip_pinning=True)
        assert self.claim_api(code, ip_address="192.0.2.2").status_code == 200

    def issue_add_feature(self, project_id: int) -> str:
        issued = issue_handoff(
            flow=HandoffFlow.ADD_FEATURE,
            user_id=self.user.id,
            organization_id=self.organization.id,
            application_id=self.application.id,
            scope_list=["org:read"],
            ip_address="127.0.0.1",
            context=AddFeatureContext(product=AddFeatureProduct.TRACING, project_id=project_id),
        )
        self.handoff_id = issued.handoff_id
        return issued.code

    def test_add_feature_claim_returns_guide(self) -> None:
        with patch(
            "sentry.agent_handoff.flows.add_feature.get_accessible_project",
            return_value=RpcProject(id=1, slug="my-app", organization_id=self.organization.id),
        ):
            response = self.claim_api(self.issue_add_feature(project_id=1))
        assert response.status_code == 200
        instructions = json.loads(response.content)["flowInstructions"]
        assert "instrument.md" in instructions
        assert "my\\-app" in instructions
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).count() > 1

    def test_add_feature_deleted_project_prevents_claim(self) -> None:
        code = self.issue_add_feature(project_id=999)
        with patch(
            "sentry.agent_handoff.flows.add_feature.get_accessible_project",
            return_value=None,
        ):
            response = self.claim_api(code)
        assert response.status_code == 410
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()

    def test_add_feature_access_revoked_prevents_claim(self) -> None:
        code = self.issue_add_feature(project_id=1)
        with patch(
            "sentry.agent_handoff.flows.add_feature.get_accessible_project",
            return_value=None,
        ):
            response = self.claim_api(code)
        assert response.status_code == 410
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()

    def assert_claim_recorded(
        self, record: MagicMock, outcome: ClaimOutcome, *, attributed: bool = True
    ) -> None:
        assert_last_analytics_event(
            record,
            AgentHandoffClaimedEvent(
                outcome=outcome.value,
                handoff_id=self.handoff_id if attributed else None,
                user_id=self.user.id if attributed else None,
                organization_id=self.organization.id if attributed else None,
                flow=HandoffFlow.ONBOARDING.value if attributed else None,
            ),
        )

    @patch("sentry.analytics.record")
    def test_records_accepted_claim(self, record: MagicMock) -> None:
        assert self.claim_api(self.issue()).status_code == 200
        self.assert_claim_recorded(record, ClaimOutcome.ACCEPTED)

    @patch("sentry.analytics.record")
    def test_records_expired_claim(self, record: MagicMock) -> None:
        code = self.issue()
        with freeze_time(timezone.now() + HANDOFF_LIFETIME):
            assert self.claim_api(code).status_code == 410
        assert not ApiSetupCode.objects.filter(user_id=self.user.id).exists()
        self.assert_claim_recorded(record, ClaimOutcome.EXPIRED)

    @patch("sentry.analytics.record")
    def test_records_ip_mismatch_claim(self, record: MagicMock) -> None:
        code = self.issue(ip_address="192.0.2.1")
        assert self.claim_api(code, ip_address="192.0.2.2").status_code == 403
        self.assert_claim_recorded(record, ClaimOutcome.IP_MISMATCH)

    @patch("sentry.analytics.record")
    def test_records_claim_that_fails_revalidation_as_invalid(self, record: MagicMock) -> None:
        code = self.issue()
        self.user.update(is_active=False)
        assert self.claim_api(code).status_code == 410
        self.assert_claim_recorded(record, ClaimOutcome.INVALID)

    @patch("sentry.analytics.record")
    def test_records_reused_claim_as_unattributed_invalid(self, record: MagicMock) -> None:
        code = self.issue()
        assert self.claim_api(code).status_code == 200
        assert self.claim_api(code).status_code == 410
        self.assert_claim_recorded(record, ClaimOutcome.INVALID, attributed=False)

    @patch("sentry.analytics.record")
    def test_records_revoked_claim_as_unattributed_invalid(self, record: MagicMock) -> None:
        code = self.issue()
        revoke_handoff(code)
        assert self.claim_api(code).status_code == 410
        self.assert_claim_recorded(record, ClaimOutcome.INVALID, attributed=False)
