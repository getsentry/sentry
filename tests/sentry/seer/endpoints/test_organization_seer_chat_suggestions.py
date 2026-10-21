from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from urllib3.exceptions import TimeoutError

from sentry.models.dashboard_permissions import DashboardPermissions
from sentry.seer.models import SeerApiError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode

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
            "can_suggest_autofix": False,
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
        for seer_status in (400, 500):
            with self.subTest(seer_status=seer_status):
                mock_run_oneshot.side_effect = SeerApiError("Seer request failed", seer_status)

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
    def test_passes_no_projects_for_my_or_all_projects(self, mock_run_oneshot: MagicMock) -> None:
        mock_run_oneshot.return_value = {"suggestions": []}
        self.create_project(organization=self.organization, teams=[self.team], slug="mine")

        for project_ids in ([], [-1]):
            with self.subTest(project_ids=project_ids):
                self.get_success_response(
                    self.organization.slug, **PAYLOAD, project_ids=project_ids
                )

                assert mock_run_oneshot.call_args.args[1]["projects"] == []
                mock_run_oneshot.reset_mock()

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

    def _can_suggest_autofix(self, mock_run_oneshot: MagicMock, group_id: object) -> bool:
        mock_run_oneshot.return_value = {"suggestions": []}
        self.get_success_response(
            self.organization.slug,
            **{**PAYLOAD, "route_params": {"groupId": str(group_id)}},
        )
        return mock_run_oneshot.call_args.args[1]["can_suggest_autofix"]

    @with_feature("organizations:seat-based-seer-enabled")
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_can_suggest_autofix_on_seat_based_plan_with_linked_repos(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        group = self.create_group(project=self.project)
        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is False

        self.create_seer_project_repository(
            project=self.project, repository=self.create_repo(project=self.project)
        )
        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is True

    @with_feature("organizations:seer-added")
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_cannot_suggest_autofix_on_legacy_plan(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        self.create_seer_project_repository(
            project=self.project, repository=self.create_repo(project=self.project)
        )
        group = self.create_group(project=self.project)

        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is False

    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_cannot_suggest_autofix_without_seer_plan(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        self.create_seer_project_repository(
            project=self.project, repository=self.create_repo(project=self.project)
        )
        group = self.create_group(project=self.project)

        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is False

    @with_feature("organizations:seat-based-seer-enabled")
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_can_suggest_autofix_only_with_event_write_scope(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        mock_run_oneshot.return_value = {"suggestions": []}
        self.create_seer_project_repository(
            project=self.project, repository=self.create_repo(project=self.project)
        )
        group = self.create_group(project=self.project)

        for scopes, can_suggest_autofix in (
            (["org:read", "event:read"], False),
            (["org:read", "event:write"], True),
        ):
            with self.subTest(scopes=scopes):
                with assume_test_silo_mode(SiloMode.CONTROL):
                    token = self.create_user_auth_token(user=self.user, scope_list=scopes)
                response = self.client.post(
                    reverse(self.endpoint, args=[self.organization.slug]),
                    {**PAYLOAD, "route_params": {"groupId": str(group.id)}},
                    format="json",
                    HTTP_AUTHORIZATION=f"Bearer {token.token}",
                )

                assert response.status_code == 200
                assert (
                    mock_run_oneshot.call_args.args[1]["can_suggest_autofix"] is can_suggest_autofix
                )

    @with_feature("organizations:seat-based-seer-enabled")
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_cannot_suggest_autofix_when_autofix_ran_recently(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        self.create_seer_project_repository(
            project=self.project, repository=self.create_repo(project=self.project)
        )
        group = self.create_group(project=self.project)
        run = self.create_seer_run(last_triggered_at=timezone.now() - timedelta(days=31))
        self.create_seer_agent_run(run=run, source="autofix", group=group, project=self.project)
        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is True

        run.update(last_triggered_at=timezone.now())
        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is False

    @with_feature("organizations:seat-based-seer-enabled")
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_cannot_suggest_autofix_when_autofix_step_last_triggered_recently(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        self.create_seer_project_repository(
            project=self.project, repository=self.create_repo(project=self.project)
        )
        group = self.create_group(
            project=self.project,
            seer_explorer_autofix_last_triggered=timezone.now() - timedelta(days=31),
        )
        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is True

        group.update(seer_explorer_autofix_last_triggered=timezone.now())
        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is False

    @with_feature("organizations:seat-based-seer-enabled")
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_cannot_suggest_autofix_when_legacy_autofix_ran(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        self.create_seer_project_repository(
            project=self.project, repository=self.create_repo(project=self.project)
        )
        group = self.create_group(
            project=self.project,
            seer_autofix_last_triggered=timezone.now() - timedelta(days=90),
        )
        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is False

        group.update(seer_explorer_autofix_last_triggered=timezone.now() - timedelta(days=31))
        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is True

    @with_feature("organizations:seat-based-seer-enabled")
    @patch("sentry.seer.endpoints.organization_seer_chat_suggestions.run_oneshot")
    def test_passes_cannot_suggest_autofix_for_another_orgs_issue(
        self, mock_run_oneshot: MagicMock
    ) -> None:
        group = self.create_group(
            project=self.create_project(organization=self.create_organization())
        )

        assert self._can_suggest_autofix(mock_run_oneshot, group.id) is False
