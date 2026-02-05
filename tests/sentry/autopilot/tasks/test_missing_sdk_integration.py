from unittest import mock

import pytest

from sentry.autopilot.tasks.common import AutopilotDetectorName
from sentry.autopilot.tasks.missing_sdk_integration import (
    MissingSdkIntegrationFinishReason,
    MissingSdkIntegrationsResult,
    run_missing_sdk_integration_detector_for_organization,
    run_missing_sdk_integration_detector_for_project_task,
)
from sentry.constants import ObjectStatus
from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import TestCase


class TestRunMissingSdkIntegrationDetectorForOrganization(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="12345",
            provider="github",
        )

    def _create_code_mapping(self, project, repo_name: str):
        """Helper to create a repository with code mapping."""
        repo = self.create_repo(
            project=project,
            name=repo_name,
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        return self.create_code_mapping(
            project=project,
            repo=repo,
            stack_root="",
            source_root="",
        )

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.missing_sdk_integration.run_missing_sdk_integration_detector_for_project_task.apply_async"
    )
    def test_skips_project_without_repository_mapping(
        self, mock_apply_async: mock.MagicMock
    ) -> None:
        self.project.platform = "python"
        self.project.save()
        run_missing_sdk_integration_detector_for_organization(self.organization)
        # No task should be spawned for projects without code mappings
        assert not mock_apply_async.called

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.missing_sdk_integration.run_missing_sdk_integration_detector_for_project_task.apply_async"
    )
    def test_skips_inactive_repositories(self, mock_apply_async: mock.MagicMock) -> None:
        self.project.platform = "python"
        self.project.save()
        # Create a code mapping with an inactive repository
        code_mapping = self._create_code_mapping(self.project, "inactive-repo")
        code_mapping.repository.status = ObjectStatus.PENDING_DELETION
        code_mapping.repository.save()

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # No task should be spawned since repo is inactive
        assert not mock_apply_async.called

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.missing_sdk_integration.run_missing_sdk_integration_detector_for_project_task.apply_async"
    )
    def test_spawns_task_for_project_with_mapping(self, mock_apply_async: mock.MagicMock) -> None:
        self.project.platform = "python"
        self.project.save()
        self._create_code_mapping(self.project, "test-repo")

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # Task should be spawned with correct arguments
        mock_apply_async.assert_called_once_with(
            args=(self.organization.id, self.project.id, "test-repo", ""),
            headers={"sentry-propagate-traces": False},
        )

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.missing_sdk_integration.run_missing_sdk_integration_detector_for_project_task.apply_async"
    )
    def test_only_processes_supported_platforms(self, mock_apply_async: mock.MagicMock) -> None:
        # Create projects with supported platforms
        python_project = self.create_project(organization=self.organization, platform="python")
        node_project = self.create_project(organization=self.organization, platform="node")
        js_project = self.create_project(organization=self.organization, platform="javascript")
        js_react_project = self.create_project(
            organization=self.organization, platform="javascript-react"
        )
        python_django_project = self.create_project(
            organization=self.organization, platform="python-django"
        )
        node_express_project = self.create_project(
            organization=self.organization, platform="node-express"
        )

        # Create projects with unsupported platforms
        go_project = self.create_project(organization=self.organization, platform="go")
        ruby_project = self.create_project(organization=self.organization, platform="ruby")
        java_project = self.create_project(organization=self.organization, platform="java")

        # Create code mappings for all projects
        self._create_code_mapping(python_project, "python-repo")
        self._create_code_mapping(node_project, "node-repo")
        self._create_code_mapping(js_project, "js-repo")
        self._create_code_mapping(js_react_project, "js-react-repo")
        self._create_code_mapping(python_django_project, "python-django-repo")
        self._create_code_mapping(node_express_project, "node-express-repo")
        self._create_code_mapping(go_project, "go-repo")
        self._create_code_mapping(ruby_project, "ruby-repo")
        self._create_code_mapping(java_project, "java-repo")

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # Only supported platforms should have tasks spawned
        assert mock_apply_async.call_count == 6

        # Collect all project IDs that had tasks spawned
        spawned_project_ids = {call[1]["args"][1] for call in mock_apply_async.call_args_list}

        # Supported platforms should be included
        assert python_project.id in spawned_project_ids
        assert node_project.id in spawned_project_ids
        assert js_project.id in spawned_project_ids
        assert js_react_project.id in spawned_project_ids
        assert python_django_project.id in spawned_project_ids
        assert node_express_project.id in spawned_project_ids

        # Unsupported platforms should NOT be included
        assert go_project.id not in spawned_project_ids
        assert ruby_project.id not in spawned_project_ids
        assert java_project.id not in spawned_project_ids


class TestRunMissingSdkIntegrationDetectorForProject(TestCase):
    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.missing_sdk_integration.SeerExplorerClient")
    def test_returns_none_for_nonexistent_organization(
        self, mock_seer_client: mock.MagicMock
    ) -> None:
        result = run_missing_sdk_integration_detector_for_project_task(
            organization_id=999999,
            project_id=self.project.id,
            repo_name="test-repo",
            source_root="",
        )
        assert result is None
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.missing_sdk_integration.SeerExplorerClient")
    def test_returns_none_for_nonexistent_project(self, mock_seer_client: mock.MagicMock) -> None:
        result = run_missing_sdk_integration_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=999999,
            repo_name="test-repo",
            source_root="",
        )
        assert result is None
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.missing_sdk_integration.SeerExplorerClient")
    def test_returns_none_without_seer_access(self, mock_seer_client: mock.MagicMock) -> None:
        mock_seer_client.side_effect = SeerPermissionError("Access denied")

        result = run_missing_sdk_integration_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repo_name="test-repo",
            source_root="",
        )

        assert result is None
        assert mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.missing_sdk_integration.create_instrumentation_issue")
    @mock.patch("sentry.autopilot.tasks.missing_sdk_integration.SeerExplorerClient")
    def test_creates_issues_for_missing_integrations(
        self, mock_seer_client: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        # Mock the client instance with artifact result
        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.return_value = 123
        mock_state = mock.MagicMock()
        mock_state.status = "completed"
        mock_state.blocks = []
        mock_state.get_artifact.return_value = MissingSdkIntegrationsResult(
            missing_integrations=["anthropicIntegration", "openaiIntegration"],
            finish_reason=MissingSdkIntegrationFinishReason.SUCCESS,
        )
        mock_client_instance.get_run.return_value = mock_state
        mock_seer_client.return_value = mock_client_instance

        result = run_missing_sdk_integration_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repo_name="test-repo",
            source_root="src/",
        )

        # Should return the list of missing integrations
        assert result == ["anthropicIntegration", "openaiIntegration"]

        # Check that start_run was called with artifact schema
        assert mock_client_instance.start_run.call_count == 1
        call_kwargs = mock_client_instance.start_run.call_args[1]
        assert call_kwargs.get("artifact_key") == "missing_integrations"
        assert call_kwargs.get("artifact_schema") == MissingSdkIntegrationsResult

        # Check that the prompt includes the repo name and source root
        prompt = mock_client_instance.start_run.call_args[0][0]
        assert "test-repo" in prompt
        assert "src/" in prompt

        # Verify that an instrumentation issue was created for each missing integration
        assert mock_create_issue.call_count == 2

        # Check that each integration got its own issue
        call_args_list = [call[1] for call in mock_create_issue.call_args_list]
        titles = [args["title"] for args in call_args_list]
        assert "Missing SDK Integration: anthropicIntegration" in titles
        assert "Missing SDK Integration: openaiIntegration" in titles

        # Verify common attributes
        for call_kwargs in call_args_list:
            assert call_kwargs["project_id"] == self.project.id
            assert call_kwargs["detector_name"] == AutopilotDetectorName.MISSING_SDK_INTEGRATION
            assert call_kwargs["repository_name"] == "test-repo"

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.missing_sdk_integration.SeerExplorerClient")
    def test_handles_seer_explorer_error_gracefully(self, mock_seer_client: mock.MagicMock) -> None:
        # Mock the client to raise an error on start_run
        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.side_effect = Exception("API error")
        mock_seer_client.return_value = mock_client_instance

        # Should not raise, just return None
        result = run_missing_sdk_integration_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repo_name="test-repo",
            source_root="",
        )
        assert result is None

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.missing_sdk_integration.create_instrumentation_issue")
    @mock.patch("sentry.autopilot.tasks.missing_sdk_integration.SeerExplorerClient")
    def test_does_not_create_issues_when_no_missing_integrations(
        self, mock_seer_client: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.return_value = 123
        mock_state = mock.MagicMock()
        mock_state.status = "completed"
        mock_state.blocks = []
        mock_state.get_artifact.return_value = MissingSdkIntegrationsResult(
            missing_integrations=[], finish_reason=MissingSdkIntegrationFinishReason.SUCCESS
        )
        mock_client_instance.get_run.return_value = mock_state
        mock_seer_client.return_value = mock_client_instance

        result = run_missing_sdk_integration_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repo_name="test-repo",
            source_root="",
        )

        assert result == []
        assert mock_create_issue.call_count == 0
