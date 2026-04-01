from __future__ import annotations

from typing import Any
from unittest.mock import ANY, MagicMock, patch

from sentry.dashboards.on_completion_hook import DashboardOnCompletionHook
from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:dashboards-ai-generate")
@with_feature("organizations:gen-ai-features")
class OrganizationDashboardGenerateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-dashboards-generate"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/dashboards/generate/"

    def test_post_without_prompt_returns_400(self) -> None:
        data: dict[str, Any] = {}
        response = self.client.post(self.url, data, format="json")
        assert response.status_code == 400

    def test_post_with_empty_prompt_returns_400(self) -> None:
        data = {"prompt": ""}
        response = self.client.post(self.url, data, format="json")
        assert response.status_code == 400

    @patch("sentry.dashboards.endpoints.organization_dashboard_generate.SeerExplorerClient")
    def test_post_starts_run_and_returns_run_id(self, mock_client_class: MagicMock) -> None:
        mock_client = MagicMock()
        mock_client.start_run.return_value = 789
        mock_client_class.return_value = mock_client

        data = {"prompt": "Show me error rates by project"}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 789}

        mock_client_class.assert_called_once_with(
            self.organization,
            ANY,
            on_completion_hook=DashboardOnCompletionHook,
            category_key="dashboard_generate",
            category_value=str(self.organization.id),
        )
        mock_client.start_run.assert_called_once_with(
            prompt="Show me error rates by project",
            on_page_context=ANY,
            artifact_key="dashboard",
            artifact_schema=ANY,
            request=ANY,
        )

    @with_feature({"organizations:dashboards-ai-generate": False})
    def test_post_without_feature_flag_returns_403(self) -> None:
        data = {"prompt": "Show me error rates"}
        response = self.client.post(self.url, data, format="json")
        assert response.status_code == 403

    @patch(
        "sentry.dashboards.endpoints.organization_dashboard_generate.has_seer_access_with_detail"
    )
    def test_post_without_seer_access_returns_403(self, mock_has_seer_access: MagicMock) -> None:
        mock_has_seer_access.return_value = (
            False,
            "AI features are disabled for this organization.",
        )
        data = {"prompt": "Show me error rates"}
        response = self.client.post(self.url, data, format="json")
        assert response.status_code == 403

    @patch("sentry.dashboards.endpoints.organization_dashboard_generate.SeerExplorerClient")
    def test_post_seer_permission_error_returns_403(self, mock_client_class: MagicMock) -> None:
        mock_client = MagicMock()
        mock_client.start_run.side_effect = SeerPermissionError("Forbidden")
        mock_client_class.return_value = mock_client

        data = {"prompt": "Show me error rates"}
        response = self.client.post(self.url, data, format="json")
        assert response.status_code == 403

    def test_get_not_allowed(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 405
