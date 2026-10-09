from unittest.mock import MagicMock, patch

from django.test import override_settings

from sentry.models.dashboard_permissions import DashboardPermissions
from sentry.seer.models import SeerApiError
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

PAYLOAD = {
    "route": "/issues/:groupId/",
    "page_context": '{"version": 1, "nodes": []}',
}


@with_feature(["organizations:seer-explorer", "organizations:seer-chat-suggestions"])
@override_settings(SENTRY_SELF_HOSTED=False)
class OrganizationSeerChatSuggestionsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-chat-suggestions"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.login_as(user=self.user)

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_suggestions(self, mock_run_oneshot: MagicMock) -> None:
        mock_run_oneshot.return_value = {
            "suggestions": [{"text": "What's causing this TypeError?", "kind": "question"}],
            "dropped": {"unknown_type": 1},
        }
        project = self.create_project(
            organization=self.organization, slug="frontend-web", platform="javascript-react"
        )

        response = self.get_success_response(
            self.organization.slug, **PAYLOAD, project_ids=[project.id]
        )

        assert response.data == {
            "suggestions": [
                {"text": "What's causing this TypeError?", "kind": "question", "action_type": None}
            ]
        }
        oneshot_id, payload, organization = mock_run_oneshot.call_args.args
        assert oneshot_id == "chat_suggestions"
        assert organization == self.organization
        assert payload == {
            **PAYLOAD,
            "projects": [{"slug": "frontend-web", "platform": "javascript-react"}],
            "code_mode": False,
            "can_create_alerts": True,
            "can_edit_node_type": None,
        }

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_alert_access_when_org_disallows_member_alerts(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        mock_run_oneshot.return_value = {"suggestions": []}
        self.organization.update_option("sentry:alerts_member_write", False)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(user=member)

        self.get_success_response(self.organization.slug, **PAYLOAD)

        assert mock_run_oneshot.call_args.args[1]["can_create_alerts"] is False

    @with_feature("organizations:seer-explorer-code-mode-tools")
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_code_mode_when_enabled(self, mock_run_oneshot: MagicMock) -> None:
        mock_run_oneshot.return_value = {"suggestions": []}

        self.get_success_response(self.organization.slug, **PAYLOAD)

        assert mock_run_oneshot.call_args.args[1]["code_mode"] is True

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_empty_suggestions_when_none_pass(self, mock_run_oneshot: MagicMock) -> None:
        mock_run_oneshot.return_value = {"suggestions": []}

        response = self.get_success_response(self.organization.slug, **PAYLOAD)

        assert response.data == {"suggestions": []}

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_502_when_generation_fails(self, mock_run_oneshot: MagicMock) -> None:
        mock_run_oneshot.return_value = {}

        self.get_error_response(self.organization.slug, status_code=502, **PAYLOAD)

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_502_when_seer_errors(self, mock_run_oneshot: MagicMock) -> None:
        mock_run_oneshot.side_effect = SeerApiError("Seer request failed", 500)

        self.get_error_response(self.organization.slug, status_code=502, **PAYLOAD)

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_502_when_seer_times_out(self, mock_run_oneshot: MagicMock) -> None:
        mock_run_oneshot.side_effect = TimeoutError()

        self.get_error_response(self.organization.slug, status_code=502, **PAYLOAD)

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_502_when_result_is_invalid(self, mock_run_oneshot: MagicMock) -> None:
        mock_run_oneshot.return_value = {"suggestions": [{"text": "Hi", "kind": "other"}]}

        self.get_error_response(self.organization.slug, status_code=502, **PAYLOAD)

    def test_returns_400_when_page_context_is_missing(self) -> None:
        self.get_error_response(self.organization.slug, status_code=400, route="/issues/")

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_member_projects_when_none_selected(self, mock_run_oneshot: MagicMock) -> None:
        mock_run_oneshot.return_value = {"suggestions": []}
        self.create_project(organization=self.organization, teams=[self.team], slug="mine")
        self.create_project(
            organization=self.organization, teams=[self.create_team()], slug="not-mine"
        )

        self.get_success_response(self.organization.slug, **PAYLOAD)

        assert mock_run_oneshot.call_args.args[1]["projects"] == [
            {"slug": "mine", "platform": None}
        ]

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_403_for_another_orgs_project(self, mock_run_oneshot: MagicMock) -> None:
        project = self.create_project(organization=self.create_organization())

        self.get_error_response(
            self.organization.slug, status_code=403, **PAYLOAD, project_ids=[project.id]
        )
        mock_run_oneshot.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_403_when_ai_features_are_hidden(self, mock_run_oneshot: MagicMock) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)

        self.get_error_response(self.organization.slug, status_code=403, **PAYLOAD)
        mock_run_oneshot.assert_not_called()

    @with_feature({"organizations:seer-chat-suggestions": False})
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_403_when_flag_is_off(self, mock_run_oneshot: MagicMock) -> None:
        self.get_error_response(self.organization.slug, status_code=403, **PAYLOAD)
        mock_run_oneshot.assert_not_called()

    @with_feature({"organizations:seer-explorer": False})
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_returns_403_without_agent_access(self, mock_run_oneshot: MagicMock) -> None:
        self.get_error_response(self.organization.slug, status_code=403, **PAYLOAD)
        mock_run_oneshot.assert_not_called()

    def _can_edit_node_type(self, mock_run_oneshot: MagicMock, route: str, **route_params: str):
        mock_run_oneshot.return_value = {"suggestions": []}
        self.get_success_response(
            self.organization.slug, **{**PAYLOAD, "route": route, "route_params": route_params}
        )
        return mock_run_oneshot.call_args.args[1]["can_edit_node_type"]

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_dashboard_edit_access_when_user_can_edit(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        dashboard = self.create_dashboard(organization=self.organization)

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/dashboard/:dashboardId/", dashboardId=str(dashboard.id)
            )
            == "dashboard"
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_dashboard_edit_access_when_dashboard_is_restricted(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        dashboard = self.create_dashboard(organization=self.organization)
        DashboardPermissions.objects.create(dashboard=dashboard, is_editable_by_everyone=False)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(user=member)

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/dashboard/:dashboardId/", dashboardId=str(dashboard.id)
            )
            is None
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_dashboard_edit_access_for_another_orgs_dashboard(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        dashboard = self.create_dashboard(organization=self.create_organization())

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/dashboard/:dashboardId/", dashboardId=str(dashboard.id)
            )
            is None
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_alert_edit_access_when_user_can_edit(self, mock_run_oneshot: MagicMock) -> None:
        workflow = self.create_workflow(organization=self.organization)

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/monitors/alerts/:automationId/", automationId=str(workflow.id)
            )
            == "alert-detail"
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_alert_edit_access_when_user_cannot_edit(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        workflow = self.create_workflow(organization=self.organization)
        self.create_detector_workflow(detector=self.create_detector(), workflow=workflow)
        self.organization.update_option("sentry:alerts_member_write", False)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(user=member)

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/monitors/alerts/:automationId/", automationId=str(workflow.id)
            )
            is None
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_alert_edit_access_when_alert_uses_all_projects_monitor_without_org_write(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        workflow = self.create_workflow(organization=self.organization)
        self.create_detector_workflow(
            detector=self.create_all_projects_detector(organization=self.organization),
            workflow=workflow,
        )
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(user=member)

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/monitors/alerts/:automationId/", automationId=str(workflow.id)
            )
            is None
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_alert_edit_access_for_another_orgs_alert(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        workflow = self.create_workflow(organization=self.create_organization())

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/monitors/alerts/:automationId/", automationId=str(workflow.id)
            )
            is None
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_monitor_edit_access_when_user_can_edit(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        detector = self.create_detector(project=self.create_project(organization=self.organization))

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/monitors/:detectorId/", detectorId=str(detector.id)
            )
            == "monitor-detail"
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_monitor_edit_access_when_user_cannot_edit(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        detector = self.create_detector(project=self.create_project(organization=self.organization))
        self.organization.update_option("sentry:alerts_member_write", False)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(user=member)

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/monitors/:detectorId/", detectorId=str(detector.id)
            )
            is None
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_monitor_edit_access_for_another_orgs_monitor(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        detector = self.create_detector(
            project=self.create_project(organization=self.create_organization())
        )

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/monitors/:detectorId/", detectorId=str(detector.id)
            )
            is None
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_monitor_edit_access_for_all_projects_monitor(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        detector = self.create_all_projects_detector(organization=self.organization)

        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/monitors/:detectorId/", detectorId=str(detector.id)
            )
            is None
        )

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_no_edit_access_when_route_param_is_invalid(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        assert (
            self._can_edit_node_type(
                mock_run_oneshot, "/dashboard/:dashboardId/", dashboardId="abc"
            )
            is None
        )
