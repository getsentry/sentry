from unittest.mock import patch
from urllib.parse import urlsplit

from django.conf import settings
from django.test import override_settings
from rest_framework.test import APIClient

from sentry.agent_handoff.codes import consume_handoff
from sentry.agent_handoff.endpoints.organization_agent_handoff import HANDOFF_SCOPES
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apisetupcode import ApiSetupCode
from sentry.testutils.cases import APITestCase
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
        assert url.path == "/agents/"
        assert not url.query
        assert response.data["prompt"] == (
            f"Follow these instructions to get started with Sentry:\n{response.data['guideUrl']}"
        )
        record = consume_handoff(url.fragment)
        assert record is not None
        assert record.user_id == self.user.id
        assert record.organization_id == self.organization.id
        assert record.application_id == self.application.id
        assert record.scope_list == HANDOFF_SCOPES
        assert not ApiSetupCode.objects.filter(user=self.user).exists()
        assert "no-store" in response["Cache-Control"]
        assert "private" in response["Cache-Control"]
        assert response.data["expiresAt"]

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
