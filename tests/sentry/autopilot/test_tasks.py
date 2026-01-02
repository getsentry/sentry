from unittest import mock

import pytest

from sentry.autopilot.tasks import (
    MissingSdkIntegrationsResult,
    run_missing_sdk_integration_detector_for_organization,
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
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.4.0"},
    )
    def test_simple(self, mock_index_state: mock.MagicMock) -> None:
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

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.4.0"},
    )
    def test_it_handles_multiple_projects(self, mock_index_state: mock.MagicMock) -> None:
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

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.4.0", "example.sdk2": "1.2.0"},
    )
    def test_it_handles_multiple_sdks(self, mock_index_state: mock.MagicMock) -> None:
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

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.0.5"},
    )
    def test_it_ignores_patch_versions(self, mock_index_state: mock.MagicMock) -> None:
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

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.0.5"},
    )
    def test_it_ignores_unknown_sdks(self, mock_index_state: mock.MagicMock) -> None:
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

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.get_sdk_versions",
        return_value={"example.sdk": "1.0.5"},
    )
    def test_it_ignores_invalid_sdk_versions(self, mock_index_state: mock.MagicMock) -> None:
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


class TestRunMissingSdkIntegrationDetector(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project2 = self.create_project(organization=self.organization)
        # Create integration for code mappings
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
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    def test_skips_project_without_repository_mapping(
        self, mock_seer_client: mock.MagicMock
    ) -> None:
        run_missing_sdk_integration_detector_for_organization(self.organization)
        # Should complete without error and not call SeerExplorerClient
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    def test_skips_project_without_seer_access(self, mock_seer_client: mock.MagicMock) -> None:
        # Create a repository with code mapping for the project
        self._create_code_mapping(self.project, "test-repo")

        mock_seer_client.side_effect = SeerPermissionError("Access denied")

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # SeerExplorerClient was called but raised permission error
        assert mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    def test_calls_seer_explorer_for_project_with_mapping(
        self, mock_seer_client: mock.MagicMock
    ) -> None:
        # Create a repository with code mapping for project1 only
        self._create_code_mapping(self.project, "test-repo")

        # Mock the client instance with artifact result
        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.return_value = 123
        mock_state = mock.MagicMock()
        mock_state.status = "completed"
        mock_state.blocks = []
        mock_state.get_artifact.return_value = MissingSdkIntegrationsResult(
            missing_integrations=["anthropicIntegration", "openaiIntegration"]
        )
        mock_client_instance.get_run.return_value = mock_state
        mock_seer_client.return_value = mock_client_instance

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # Should have created client only for project with mapping (not project2)
        assert mock_seer_client.call_count == 1

        # Check that start_run was called with artifact schema
        assert mock_client_instance.start_run.call_count == 1
        call_kwargs = mock_client_instance.start_run.call_args[1]
        assert call_kwargs.get("artifact_key") == "missing_integrations"
        assert call_kwargs.get("artifact_schema") == MissingSdkIntegrationsResult

        # Check that the prompt includes the repo name
        prompt = mock_client_instance.start_run.call_args[0][0]
        assert "test-repo" in prompt

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    def test_handles_seer_explorer_error_gracefully(self, mock_seer_client: mock.MagicMock) -> None:
        # Create a repository with code mapping
        self._create_code_mapping(self.project, "test-repo")

        # Mock the client to raise an error on start_run
        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.side_effect = Exception("API error")
        mock_seer_client.return_value = mock_client_instance

        # Should not raise, just log the error
        run_missing_sdk_integration_detector_for_organization(self.organization)

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    def test_skips_inactive_repositories(self, mock_seer_client: mock.MagicMock) -> None:
        # Create a code mapping with an inactive repository
        code_mapping = self._create_code_mapping(self.project, "inactive-repo")
        code_mapping.repository.status = ObjectStatus.PENDING_DELETION
        code_mapping.repository.save()

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # SeerExplorerClient should not be called since repo is inactive
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    def test_uses_mapped_repo_name_in_prompt(self, mock_seer_client: mock.MagicMock) -> None:
        # Create code mapping with specific repo name
        self._create_code_mapping(self.project, "my-frontend-app")

        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.return_value = 123
        mock_state = mock.MagicMock()
        mock_state.status = "completed"
        mock_state.blocks = []
        mock_state.get_artifact.return_value = MissingSdkIntegrationsResult(missing_integrations=[])
        mock_client_instance.get_run.return_value = mock_state
        mock_seer_client.return_value = mock_client_instance

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # Check that the prompt includes the mapped repository name
        prompt = mock_client_instance.start_run.call_args[0][0]
        assert "my-frontend-app" in prompt

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    def test_each_project_uses_its_own_mapped_repo(self, mock_seer_client: mock.MagicMock) -> None:
        # Create different code mappings for each project
        self._create_code_mapping(self.project, "frontend-repo")
        self._create_code_mapping(self.project2, "backend-repo")

        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.return_value = 123
        mock_state = mock.MagicMock()
        mock_state.status = "completed"
        mock_state.blocks = []
        mock_state.get_artifact.return_value = MissingSdkIntegrationsResult(missing_integrations=[])
        mock_client_instance.get_run.return_value = mock_state
        mock_seer_client.return_value = mock_client_instance

        run_missing_sdk_integration_detector_for_organization(self.organization)

        # Should have created clients for both projects
        assert mock_seer_client.call_count == 2
        assert mock_client_instance.start_run.call_count == 2

        # Check that prompts include respective repo names
        prompts = [call[0][0] for call in mock_client_instance.start_run.call_args_list]
        repo_names_in_prompts = ["frontend-repo" in p or "backend-repo" in p for p in prompts]
        assert all(repo_names_in_prompts)
