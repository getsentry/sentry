from unittest.mock import MagicMock, patch
from urllib.parse import urlsplit

from django.conf import settings
from django.test import override_settings
from rest_framework.test import APIClient

from sentry.agent_handoff.codes import HandoffFlow, ProjectSetupContext, consume_handoff
from sentry.agent_handoff.endpoints.organization_agent_handoff import HANDOFF_SCOPES
from sentry.analytics.events.agent_handoff import AgentHandoffPromptCreatedEvent
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apisetupcode import ApiSetupCode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.impersonation import simulate_impersonation
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationAgentHandoffTest(APITestCase):
    endpoint = "sentry-api-0-organization-agent-handoff"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(client_secret=None)
        self.organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        configured_options = self.options(
            {
                "onboarding.agent-handoff.client-id": self.application.client_id,
                "oauth.setup-code.allowed-client-ids": [self.application.client_id],
            }
        )
        configured_options.__enter__()
        self.addCleanup(configured_options.__exit__, None, None, None)

    def test_create_prompt(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            clientId="untrusted-client",
            scopes=["org:admin"],
            status_code=201,
        )
        url = urlsplit(response.data["guideUrl"])
        assert url.path == "/agent-handoff.md"
        assert not url.query
        assert not url.fragment
        code = response.data["code"]
        assert code.startswith("sntryh_")
        assert response.data["prompt"] == (
            f"Follow the instructions verbatim at {response.data['guideUrl']}. "
            f"Your handoff code is `{code}`."
        )
        record = consume_handoff(code, ip_address="127.0.0.1")
        assert record is not None
        assert record.flow is HandoffFlow.GUIDED_NEXT_STEPS
        assert record.user_id == self.user.id
        assert record.organization_id == self.organization.id
        assert record.application_id == self.application.id
        assert record.scope_list == HANDOFF_SCOPES
        assert record.ip_address == "127.0.0.1"
        assert not ApiSetupCode.objects.filter(user=self.user).exists()
        assert "no-store" in response["Cache-Control"]
        assert "private" in response["Cache-Control"]
        assert response.data["expiresAt"]

    def test_select_guided_next_steps_flow(self) -> None:
        response = self.get_success_response(
            self.organization.slug, flow="guided_next_steps", status_code=201
        )
        handoff = consume_handoff(response.data["code"], ip_address="127.0.0.1")
        assert handoff is not None
        assert handoff.flow is HandoffFlow.GUIDED_NEXT_STEPS

    def test_select_onboarding_flow(self) -> None:
        with patch(
            "sentry.agent_handoff.flows.onboarding.organization_service.has_active_onboarding_run",
            return_value=True,
        ) as validate:
            response = self.get_success_response(
                self.organization.slug,
                flow="onboarding",
                context={"runId": "a" * 32},
                status_code=201,
            )
        validate.assert_called_once_with(
            organization_id=self.organization.id, user_id=self.user.id, run_id="a" * 32
        )
        handoff = consume_handoff(response.data["code"], ip_address="127.0.0.1")
        assert handoff is not None
        assert handoff.flow is HandoffFlow.ONBOARDING
        assert handoff.context == ProjectSetupContext(run_id="a" * 32)

    @patch("sentry.analytics.record")
    def test_records_prompt_created(self, record: MagicMock) -> None:
        with patch(
            "sentry.agent_handoff.flows.common.organization_service.has_active_onboarding_run",
            return_value=True,
        ):
            self.get_success_response(
                self.organization.slug,
                flow="onboarding",
                context={"runId": "a" * 32},
                disableIpPinning=True,
                status_code=201,
            )
        assert_last_analytics_event(
            record,
            AgentHandoffPromptCreatedEvent(
                user_id=self.user.id,
                organization_id=self.organization.id,
                flow=HandoffFlow.ONBOARDING.value,
                run_id="a" * 32,
                ip_pinning=False,
            ),
        )

    @patch("sentry.analytics.record")
    def test_records_prompt_created_without_run(self, record: MagicMock) -> None:
        self.get_success_response(self.organization.slug, status_code=201)
        assert_last_analytics_event(
            record,
            AgentHandoffPromptCreatedEvent(
                user_id=self.user.id,
                organization_id=self.organization.id,
                flow=HandoffFlow.GUIDED_NEXT_STEPS.value,
                run_id=None,
                ip_pinning=True,
            ),
        )

    def test_select_create_project_flow(self) -> None:
        with patch(
            "sentry.agent_handoff.flows.common.organization_service.has_active_onboarding_run",
            return_value=True,
        ):
            response = self.get_success_response(
                self.organization.slug,
                flow="create_project",
                context={"runId": "a" * 32},
                status_code=201,
            )
        handoff = consume_handoff(response.data["code"], ip_address="127.0.0.1")
        assert handoff is not None
        assert handoff.flow is HandoffFlow.CREATE_PROJECT
        assert handoff.context == ProjectSetupContext(run_id="a" * 32)

    def test_onboarding_requires_run_context(self) -> None:
        response = self.get_error_response(
            self.organization.slug, flow="onboarding", status_code=400
        )
        assert "context" in response.data

    def test_guided_next_steps_rejects_run_context(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            flow="guided_next_steps",
            context={"runId": "a" * 32},
            status_code=400,
        )
        assert "context" in response.data

    def test_onboarding_rejects_unavailable_run(self) -> None:
        with patch(
            "sentry.agent_handoff.flows.onboarding.organization_service.has_active_onboarding_run",
            return_value=False,
        ):
            response = self.get_error_response(
                self.organization.slug,
                flow="onboarding",
                context={"runId": "a" * 32},
                status_code=400,
            )
        assert response.data == {"context": {"runId": ["Onboarding run is unavailable."]}}

    def test_rejects_invalid_run_identifier(self) -> None:
        response = self.get_error_response(
            self.organization.slug, flow="onboarding", context={"runId": "invalid"}, status_code=400
        )
        assert response.data == {
            "context": {"runId": ["This value does not match the required pattern."]}
        }

    def test_onboarding_requires_run_identifier(self) -> None:
        response = self.get_error_response(
            self.organization.slug, flow="onboarding", context={}, status_code=400
        )
        assert response.data == {"context": {"runId": ["This field is required."]}}

    def test_unknown_flow(self) -> None:
        response = self.get_error_response(
            self.organization.slug, flow="unsupported", status_code=400
        )
        assert "flow" in response.data

    def test_null_flow(self) -> None:
        response = self.get_error_response(self.organization.slug, flow=None, status_code=400)
        assert "flow" in response.data

    def test_requires_session(self) -> None:
        self.client.logout()
        self.get_error_response(self.organization.slug, status_code=403)

    def test_rejects_bearer_even_with_session(self) -> None:
        token = self.create_user_auth_token(user=self.user)
        self.get_error_response(
            self.organization.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=403,
        )

    def test_requires_membership(self) -> None:
        other = self.create_organization(owner=self.create_user())
        self.get_error_response(other.slug, status_code=403)

    def test_rejects_impersonation(self) -> None:
        with simulate_impersonation(self.create_user(is_superuser=True)):
            self.get_error_response(self.organization.slug, status_code=403)

    def test_missing_client(self) -> None:
        with self.options({"onboarding.agent-handoff.client-id": ""}):
            self.get_error_response(self.organization.slug, status_code=503)

    def test_unknown_client(self) -> None:
        with self.options({"onboarding.agent-handoff.client-id": "unknown"}):
            self.get_error_response(self.organization.slug, status_code=503)

    def test_disallowed_client(self) -> None:
        with self.options({"oauth.setup-code.allowed-client-ids": []}):
            self.get_error_response(self.organization.slug, status_code=503)

    def test_inactive_client(self) -> None:
        self.application.update(status=ApiApplicationStatus.inactive)
        self.get_error_response(self.organization.slug, status_code=503)

    def test_confidential_client(self) -> None:
        self.application.update(client_secret="example-secret")
        self.get_error_response(self.organization.slug, status_code=503)

    def test_suspended_user(self) -> None:
        self.user.update(is_suspended=True)
        self.get_error_response(self.organization.slug, status_code=403)

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_rate_limited(self) -> None:
        for _ in range(10):
            self.get_success_response(self.organization.slug, status_code=201)

        self.get_error_response(self.organization.slug, status_code=429)

    def test_org_application_scopes(self) -> None:
        self.application.update(requires_org_level_access=True, scopes=["org:read"])
        self.get_error_response(self.organization.slug, status_code=503)
        self.application.update(scopes=list(HANDOFF_SCOPES))
        self.get_success_response(self.organization.slug, status_code=201)

    def test_get_does_not_mint(self) -> None:
        with patch(
            "sentry.agent_handoff.endpoints.organization_agent_handoff.issue_handoff"
        ) as issue:
            self.get_error_response(self.organization.slug, method="get", status_code=405)
        issue.assert_not_called()

    def test_csrf(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        self.login_as(self.user)
        self.get_error_response(self.organization.slug, status_code=403)
        csrf_token = "a" * 32
        self.client.cookies[settings.CSRF_COOKIE_NAME] = csrf_token
        self.get_success_response(
            self.organization.slug,
            extra_headers={"HTTP_X_CSRFTOKEN": csrf_token},
            status_code=201,
        )

    def test_pins_to_request_ip(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            extra_headers={"REMOTE_ADDR": "192.0.2.1"},
            ipAddress="192.0.2.2",
            status_code=201,
        )
        handoff = consume_handoff(response.data["code"], ip_address="192.0.2.1")
        assert handoff is not None
        assert handoff.ip_address == "192.0.2.1"

    def test_disable_ip_pinning(self) -> None:
        response = self.get_success_response(
            self.organization.slug, disableIpPinning=True, status_code=201
        )
        handoff = consume_handoff(response.data["code"], ip_address="192.0.2.2")
        assert handoff is not None
        assert handoff.ip_address == "127.0.0.1"
        assert handoff.disable_ip_pinning

    def test_rejects_invalid_disable_ip_pinning(self) -> None:
        response = self.get_error_response(
            self.organization.slug, disableIpPinning="invalid", status_code=400
        )
        assert "disableIpPinning" in response.data
