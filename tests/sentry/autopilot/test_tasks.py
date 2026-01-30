from unittest import mock

import pytest

from sentry.autopilot.tasks import (
    AutopilotDetectorName,
    MissingSdkIntegrationFinishReason,
    MissingSdkIntegrationsResult,
    run_missing_sdk_integration_detector_for_organization,
    run_missing_sdk_integration_detector_for_project_task,
    run_sdk_update_detector_for_organization,
)
from sentry.constants import ObjectStatus
from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options


class TestRunSdkUpdateDetector(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project2 = self.create_project(organization=self.organization)

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.4.0"},
    )
    def test_simple(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 1
        assert updates[0] == {
            "projectId": str(self.project.id),
            "sdkName": "example.sdk",
            "sdkVersion": "1.0.0",
            "newestSdkVersion": "1.4.0",
            "needsUpdate": True,
        }

        # Verify that an instrumentation issue was created
        assert mock_create_issue.call_count == 1
        call_kwargs = mock_create_issue.call_args[1]
        assert call_kwargs["project_id"] == self.project.id
        assert call_kwargs["detector_name"] == AutopilotDetectorName.SDK_UPDATE
        assert "example.sdk" in call_kwargs["title"]
        assert "1.0.0" in call_kwargs["subtitle"]
        assert "1.4.0" in call_kwargs["subtitle"]

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.4.0"},
    )
    def test_it_handles_multiple_projects(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
                "sdk": {"name": "example.sdk", "version": "0.9.0"},
            },
            project_id=self.project2.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 2
        assert updates[0] == {
            "projectId": str(self.project2.id),
            "sdkName": "example.sdk",
            "sdkVersion": "0.9.0",
            "newestSdkVersion": "1.4.0",
            "needsUpdate": True,
        }
        assert updates[1] == {
            "projectId": str(self.project.id),
            "sdkName": "example.sdk",
            "sdkVersion": "1.0.0",
            "newestSdkVersion": "1.4.0",
            "needsUpdate": True,
        }

        # Verify that an instrumentation issue was created for each update
        assert mock_create_issue.call_count == 2

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.4.0", "example.sdk2": "1.2.0"},
    )
    def test_it_handles_multiple_sdks(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
                "sdk": {"name": "example.sdk2", "version": "0.9.0"},
            },
            project_id=self.project2.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 2
        assert updates[0] == {
            "projectId": str(self.project2.id),
            "sdkName": "example.sdk2",
            "sdkVersion": "0.9.0",
            "newestSdkVersion": "1.2.0",
            "needsUpdate": True,
        }
        assert updates[1] == {
            "projectId": str(self.project.id),
            "sdkName": "example.sdk",
            "sdkVersion": "1.0.0",
            "newestSdkVersion": "1.4.0",
            "needsUpdate": True,
        }

        # Verify that an instrumentation issue was created for each SDK
        assert mock_create_issue.call_count == 2

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.0.5"},
    )
    def test_it_ignores_patch_versions(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 0
        # No instrumentation issue should be created
        assert mock_create_issue.call_count == 0

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.0.5"},
    )
    def test_it_ignores_unknown_sdks(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk.unknown", "version": "0.9.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 0
        # No instrumentation issue should be created
        assert mock_create_issue.call_count == 0

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.0.5"},
    )
    def test_it_ignores_invalid_sdk_versions(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "abcdefg"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 0
        # No instrumentation issue should be created
        assert mock_create_issue.call_count == 0


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
        "sentry.autopilot.tasks.run_missing_sdk_integration_detector_for_project_task.delay"
    )
    def test_skips_project_without_repository_mapping(self, mock_delay: mock.MagicMock) -> None:
        run_missing_sdk_integration_detector_for_organization(self.organization)
        # No task should be spawned for projects without code mappings
        assert not mock_delay.called

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.run_missing_sdk_integration_detector_for_project_task.delay"
    )
    def test_skips_inactive_repositories(self, mock_delay: mock.MagicMock) -> None:
        # Create a code mapping with an inactive repository
        code_mapping = self._create_code_mapping(self.project, "inactive-repo")
        code_mapping.repository.status = ObjectStatus.PENDING_DELETION
        code_mapping.repository.save()

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # No task should be spawned since repo is inactive
        assert not mock_delay.called

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.run_missing_sdk_integration_detector_for_project_task.delay"
    )
    def test_spawns_task_for_project_with_mapping(self, mock_delay: mock.MagicMock) -> None:
        self._create_code_mapping(self.project, "test-repo")

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # Task should be spawned with correct arguments
        mock_delay.assert_called_once_with(self.organization.id, self.project.id, "test-repo", "")


class TestRunMissingSdkIntegrationDetectorForProject(TestCase):
    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
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
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
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
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
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
    @mock.patch("sentry.autopilot.tasks.create_instrumentation_issue")
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
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
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
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
    @mock.patch("sentry.autopilot.tasks.create_instrumentation_issue")
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
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
