from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import ANY, MagicMock, patch

from django.test import override_settings

from sentry.dashboards.on_completion_hook import DashboardOnCompletionHook
from sentry.seer.models import SeerPermissionError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode


@override_settings(SENTRY_SELF_HOSTED=False)
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

    @patch("sentry.dashboards.endpoints.organization_dashboard_generate.SeerAgentClient")
    def test_post_starts_run_and_returns_run_id(self, mock_client_class: MagicMock) -> None:
        run_uuid = uuid.uuid4()
        mock_client = MagicMock()
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=789, uuid=run_uuid)
        mock_client_class.return_value = mock_client

        data = {"prompt": "Show me error rates by project"}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 789, "sentry_run_id": str(run_uuid)}

        mock_client_class.assert_called_once_with(
            self.organization,
            ANY,
            on_completion_hook=DashboardOnCompletionHook,
            category_key="dashboard_generate",
            category_value=str(self.organization.id),
            reasoning_effort="medium",
        )
        call_kwargs = mock_client.start_run.call_args[1]
        assert "Show me error rates by project" in call_kwargs["prompt"]
        assert call_kwargs["artifact_key"] == "dashboard"

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

    @patch("sentry.dashboards.endpoints.organization_dashboard_generate.SeerAgentClient")
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

    def test_post_with_invalid_current_dashboard_returns_400(self) -> None:
        data = {
            "prompt": "Add an error widget",
            "current_dashboard": {
                "title": "Bad Dashboard",
                "widgets": [
                    {
                        "displayType": "not_a_real_type",
                    }
                ],
            },
        }
        response = self.client.post(self.url, data, format="json")
        assert response.status_code == 400

    @patch("sentry.dashboards.endpoints.organization_dashboard_generate.SeerAgentClient")
    def test_post_with_current_dashboard_uses_edit_context(
        self, mock_client_class: MagicMock
    ) -> None:
        run_uuid = uuid.uuid4()
        mock_client = MagicMock()
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=123, uuid=run_uuid)
        mock_client_class.return_value = mock_client

        data = {
            "prompt": "Add a widget showing error rates by project",
            "current_dashboard": {
                "title": "My Dashboard",
                "widgets": [
                    {
                        "title": "Error Count",
                        "description": "Total errors",
                        "displayType": "line",
                        "widgetType": "error-events",
                        "queries": [
                            {
                                "aggregates": ["count()"],
                                "columns": [],
                                "fields": ["count()"],
                                "conditions": "",
                                "orderby": "",
                            }
                        ],
                        "layout": {"x": 0, "y": 0, "w": 3, "h": 2, "minH": 2},
                        "limit": 5,
                        "interval": "1h",
                    }
                ],
            },
        }
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 123, "sentry_run_id": str(run_uuid)}

        mock_client_class.assert_called_once_with(
            self.organization,
            ANY,
            on_completion_hook=DashboardOnCompletionHook,
            category_key="dashboard_generate",
            category_value=str(self.organization.id),
            reasoning_effort="medium",
        )

        # Verify on_page_context includes the current dashboard JSON
        call_kwargs = mock_client.start_run.call_args[1]
        assert "My Dashboard" in call_kwargs["on_page_context"]
        assert "Error Count" in call_kwargs["on_page_context"]


@override_settings(SENTRY_SELF_HOSTED=False)
@with_feature("organizations:granular-permission-scopes")
@patch("sentry.dashboards.endpoints.organization_dashboard_generate.SeerAgentClient")
class OrganizationDashboardGenerateScopeTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = f"/api/0/organizations/{self.organization.slug}/dashboards/generate/"
        self.data = {"prompt": "Show me error rates by project"}

    def _use_token(self, scope_list: list[str]) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = self.create_user_auth_token(user=self.user, scope_list=scope_list)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.token}")

    def _mock_run(self, mock_client_class: MagicMock) -> None:
        mock_client_class.return_value.start_run.return_value = MagicMock(
            seer_run_state_id=789, uuid=uuid.uuid4()
        )

    def test_read_scope_can_generate(self, mock_client_class: MagicMock) -> None:
        self._mock_run(mock_client_class)
        self._use_token(["dashboard:read"])
        response = self.client.post(self.url, self.data, format="json")
        assert response.status_code == 200, response.content

    def test_write_scope_cannot_generate(self, mock_client_class: MagicMock) -> None:
        # Write does not imply read.
        self._use_token(["dashboard:write"])
        response = self.client.post(self.url, self.data, format="json")
        assert response.status_code == 403
        mock_client_class.assert_not_called()

    @override_options({"auth.deprecated-scope-translation.enabled": True})
    def test_org_read_token_is_translated(self, mock_client_class: MagicMock) -> None:
        self._mock_run(mock_client_class)
        self._use_token(["org:read"])
        response = self.client.post(self.url, self.data, format="json")
        assert response.status_code == 200, response.content

    @override_settings(DEPRECATED_SCOPE_TRANSLATIONS={})
    @override_options({"auth.deprecated-scope-translation.enabled": True})
    def test_org_read_not_accepted(self, mock_client_class: MagicMock) -> None:
        self._use_token(["org:read"])
        response = self.client.post(self.url, self.data, format="json")
        assert response.status_code == 403
        mock_client_class.assert_not_called()

    @override_settings(DEPRECATED_SCOPE_TRANSLATIONS={})
    @override_options({"auth.deprecated-scope-translation.enabled": True})
    @with_feature({"organizations:granular-permission-scopes": False})
    def test_org_read_accepted_without_granular_scopes(self, mock_client_class: MagicMock) -> None:
        self._mock_run(mock_client_class)
        self._use_token(["org:read"])
        response = self.client.post(self.url, self.data, format="json")
        assert response.status_code == 200, response.content
