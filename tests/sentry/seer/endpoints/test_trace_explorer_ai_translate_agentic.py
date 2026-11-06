from unittest.mock import MagicMock, patch

from django.test import override_settings
from rest_framework import status

from sentry.models.apitoken import ApiToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode


@with_feature("organizations:seer-explorer")
@override_settings(SENTRY_SELF_HOSTED=False)
class SearchAgentTranslateEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = f"/api/0/organizations/{self.organization.slug}/search-agent/translate/"

        self.seer_access_patcher = patch(
            "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.has_seer_access_with_detail",
            return_value=(True, None),
        )
        self.seer_access_patcher.start()

    def tearDown(self) -> None:
        self.seer_access_patcher.stop()
        super().tearDown()

    @patch(
        "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.send_translate_agentic_request"
    )
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_translate_successful(self, mock_send_request: MagicMock) -> None:
        mock_send_request.return_value = {"query": "transaction.duration:>1000", "status": "ok"}

        response = self.client.post(
            self.url,
            data={
                "project_ids": [self.project.id],
                "natural_language_query": "Find slow transactions",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"query": "transaction.duration:>1000", "status": "ok"}

        mock_send_request.assert_called_once_with(
            self.organization.id,
            self.organization.slug,
            [self.project.id],
            "Find slow transactions",
            strategy="Traces",
            user_email=self.user.email,
            timezone=None,
            model_name=None,
            metric_context=None,
            viewer_context={
                "organization_id": self.organization.id,
                "user_id": self.user.id,
            },
            options={
                "cross_event": False,
                "reflection_step": False,
                "code_mode": False,
                "source": "frontend",
            },
        )

    @patch(
        "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.send_translate_agentic_request"
    )
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_translate_forwards_mcp_source(self, mock_send_request: MagicMock) -> None:
        mock_send_request.return_value = {"query": "", "status": "ok"}
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.token}")

        response = self.client.post(
            self.url,
            data={
                "project_ids": [self.project.id],
                "natural_language_query": "Find slow transactions",
                "referrer": "search_bar",
            },
            format="json",
            HTTP_USER_AGENT="sentry-mcp/1.2.3 (https://mcp.sentry.dev)",
        )

        assert response.status_code == status.HTTP_200_OK
        assert mock_send_request.call_args.kwargs["options"]["source"] == "mcp"

    @patch(
        "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.send_translate_agentic_request"
    )
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_translate_forwards_metric_context(self, mock_send_request: MagicMock) -> None:
        """Metrics tab scopes the agent to a specific metric via options.metric_context.
        The sync translate path must forward it like the async /start/ path does."""
        mock_send_request.return_value = {"query": "metric.name:foo", "status": "ok"}

        metric_context = {
            "metric_name": "http.request.duration",
            "metric_type": "distribution",
            "metric_unit": "millisecond",
        }

        response = self.client.post(
            self.url,
            data={
                "project_ids": [self.project.id],
                "natural_language_query": "p95 of request duration",
                "strategy": "Metrics",
                "options": {"metric_context": metric_context},
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        _, kwargs = mock_send_request.call_args
        assert kwargs["strategy"] == "Metrics"
        assert kwargs["metric_context"] == metric_context

    def test_translate_missing_parameters(self) -> None:
        response = self.client.post(
            self.url,
            data={"natural_language_query": ""},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "project_ids" in response.data
        assert "natural_language_query" in response.data

    @patch(
        "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.send_translate_agentic_request"
    )
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_translate_empty_project_ids_searches_all_accessible_projects(
        self, mock_send_request: MagicMock
    ) -> None:
        """A member on no teams in an open-membership org searches every project."""
        mock_send_request.return_value = {"query": "", "status": "ok"}
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member", teams=[])
        self.login_as(user=member)

        response = self.client.post(
            self.url,
            data={"project_ids": [], "natural_language_query": "Find slow transactions"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert mock_send_request.call_args.args[2] == [self.project.id]

    @patch(
        "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.send_translate_agentic_request"
    )
    def test_translate_no_accessible_projects_returns_detail(
        self, mock_send_request: MagicMock
    ) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member", teams=[])
        self.login_as(user=member)

        response = self.client.post(
            self.url,
            data={"project_ids": [-1], "natural_language_query": "Find slow transactions"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data == {
            "detail": "You don't have access to any projects in this organization."
        }
        mock_send_request.assert_not_called()
