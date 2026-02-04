from unittest import mock

import pytest

from sentry.autopilot.tasks import (
    AutopilotDetectorName,
    InstrumentationIssueCategory,
    MissingSdkIntegrationFinishReason,
    MissingSdkIntegrationsResult,
    TraceInstrumentationFinishReason,
    TraceInstrumentationIssue,
    TraceInstrumentationResult,
    run_missing_sdk_integration_detector_for_organization,
    run_missing_sdk_integration_detector_for_project_task,
    run_sdk_update_detector_for_organization,
    run_trace_instrumentation_detector_for_organization,
    run_trace_instrumentation_detector_for_project_task,
    sample_trace_for_instrumentation_analysis,
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
        "sentry.autopilot.tasks.run_missing_sdk_integration_detector_for_project_task.apply_async"
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
        "sentry.autopilot.tasks.run_missing_sdk_integration_detector_for_project_task.apply_async"
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
        "sentry.autopilot.tasks.run_missing_sdk_integration_detector_for_project_task.apply_async"
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
        "sentry.autopilot.tasks.run_missing_sdk_integration_detector_for_project_task.apply_async"
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


class TestRunTraceInstrumentationDetectorForOrganization(TestCase):
    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.run_trace_instrumentation_detector_for_project_task.apply_async"
    )
    def test_spawns_task_for_active_projects(self, mock_apply_async: mock.MagicMock) -> None:
        active_project = self.create_project(organization=self.organization)
        self.create_project(organization=self.organization, status=ObjectStatus.PENDING_DELETION)

        run_trace_instrumentation_detector_for_organization(self.organization)

        # Should only spawn task for active project
        assert mock_apply_async.call_count == 1
        mock_apply_async.assert_called_once_with(
            args=(self.organization.id, active_project.id),
            headers={"sentry-propagate-traces": False},
        )

    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.run_trace_instrumentation_detector_for_project_task.apply_async"
    )
    def test_spawns_tasks_for_multiple_projects(self, mock_apply_async: mock.MagicMock) -> None:
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        run_trace_instrumentation_detector_for_organization(self.organization)

        # Should spawn task for each project
        assert mock_apply_async.call_count == 3
        spawned_project_ids = {call[1]["args"][1] for call in mock_apply_async.call_args_list}
        assert spawned_project_ids == {project1.id, project2.id, project3.id}


class TestSampleTraceForInstrumentationAnalysis(TestCase):
    @pytest.mark.django_db
    @mock.patch(
        "sentry.autopilot.tasks.get_project_top_transaction_traces_for_llm_detection",
        return_value=[],
    )
    def test_returns_none_when_no_traces_found(self, mock_get_traces: mock.MagicMock) -> None:
        result = sample_trace_for_instrumentation_analysis(self.project)
        assert result is None
        mock_get_traces.assert_called_once_with(
            project_id=self.project.id,
            limit=1,
            start_time_delta_minutes=24 * 60,
        )

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.get_project_top_transaction_traces_for_llm_detection")
    def test_returns_first_trace_when_found(self, mock_get_traces: mock.MagicMock) -> None:
        from sentry.seer.sentry_data_models import TraceMetadata

        expected_trace = TraceMetadata(
            trace_id="abc123",
            transaction_name="GET /api/users",
        )
        mock_get_traces.return_value = [expected_trace]

        result = sample_trace_for_instrumentation_analysis(self.project)

        assert result == expected_trace
        mock_get_traces.assert_called_once_with(
            project_id=self.project.id,
            limit=1,
            start_time_delta_minutes=24 * 60,
        )


class TestRunTraceInstrumentationDetectorForProject(TestCase):
    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    @mock.patch("sentry.autopilot.tasks.sample_trace_for_instrumentation_analysis")
    def test_skips_llm_for_nonexistent_organization(
        self, mock_sample_trace: mock.MagicMock, mock_seer_client: mock.MagicMock
    ) -> None:
        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=999999,
            project_id=self.project.id,
        )
        assert result is None
        assert not mock_sample_trace.called
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    @mock.patch("sentry.autopilot.tasks.sample_trace_for_instrumentation_analysis")
    def test_skips_llm_for_nonexistent_project(
        self, mock_sample_trace: mock.MagicMock, mock_seer_client: mock.MagicMock
    ) -> None:
        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=999999,
        )
        assert result is None
        assert not mock_sample_trace.called
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    @mock.patch("sentry.autopilot.tasks.get_trace_waterfall")
    @mock.patch("sentry.autopilot.tasks.sample_trace_for_instrumentation_analysis")
    def test_skips_llm_when_no_trace_sampled(
        self,
        mock_sample_trace: mock.MagicMock,
        mock_get_waterfall: mock.MagicMock,
        mock_seer_client: mock.MagicMock,
    ) -> None:
        mock_sample_trace.return_value = None

        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        assert result is None
        assert not mock_get_waterfall.called
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    @mock.patch("sentry.autopilot.tasks.get_trace_waterfall")
    @mock.patch("sentry.autopilot.tasks.sample_trace_for_instrumentation_analysis")
    def test_skips_llm_when_trace_query_fails(
        self,
        mock_sample_trace: mock.MagicMock,
        mock_get_waterfall: mock.MagicMock,
        mock_seer_client: mock.MagicMock,
    ) -> None:
        from sentry.seer.sentry_data_models import TraceMetadata

        mock_sample_trace.return_value = TraceMetadata(
            trace_id="abc123",
            transaction_name="GET /api/users",
        )
        mock_get_waterfall.side_effect = Exception("Query failed")

        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        assert result is None
        assert not mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    @mock.patch("sentry.autopilot.tasks.get_trace_waterfall")
    @mock.patch("sentry.autopilot.tasks.sample_trace_for_instrumentation_analysis")
    def test_handles_missing_seer_access(
        self,
        mock_sample_trace: mock.MagicMock,
        mock_get_waterfall: mock.MagicMock,
        mock_seer_client: mock.MagicMock,
    ) -> None:
        from sentry.seer.sentry_data_models import EAPTrace, TraceMetadata

        mock_sample_trace.return_value = TraceMetadata(
            trace_id="abc123",
            transaction_name="GET /api/users",
        )
        mock_get_waterfall.return_value = EAPTrace(
            trace_id="abc123",
            trace=[{"event_type": "span", "id": "span1"}],
        )
        mock_seer_client.side_effect = SeerPermissionError("Access denied")

        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        assert result is None
        assert mock_seer_client.called

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.create_instrumentation_issue")
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    @mock.patch("sentry.autopilot.tasks.get_trace_waterfall")
    @mock.patch("sentry.autopilot.tasks.sample_trace_for_instrumentation_analysis")
    def test_creates_issues_for_instrumentation_gaps(
        self,
        mock_sample_trace: mock.MagicMock,
        mock_get_waterfall: mock.MagicMock,
        mock_seer_client: mock.MagicMock,
        mock_create_issue: mock.MagicMock,
    ) -> None:
        from sentry.seer.sentry_data_models import EAPTrace, TraceMetadata

        mock_sample_trace.return_value = TraceMetadata(
            trace_id="abc123",
            transaction_name="GET /api/users",
        )
        mock_get_waterfall.return_value = EAPTrace(
            trace_id="abc123",
            trace=[
                {
                    "event_type": "span",
                    "id": "span1",
                    "op": "http.server",
                    "description": "GET /api/users",
                }
            ],
        )

        # Mock Seer client to return instrumentation issues
        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.return_value = 123
        mock_state = mock.MagicMock()
        mock_state.status = "completed"
        mock_state.blocks = []

        issue1 = TraceInstrumentationIssue(
            explanation="Database queries are not instrumented with db.* spans",
            impact="Cannot identify slow queries or N+1 problems",
            evidence="Time gap of 250ms between spans span1 and span2",
            offender_span_ids=["span1", "span2"],
            missing_telemetry="Add db.query spans for database operations",
            title="Missing Database Instrumentation",
            category=InstrumentationIssueCategory.MISSING_INSTRUMENTATION,
            subcategory="Missing Database Spans",
        )
        issue2 = TraceInstrumentationIssue(
            explanation="HTTP requests to external APIs lack http.* spans",
            impact="External dependency performance cannot be tracked",
            evidence="Parent span duration suggests external calls at span3",
            offender_span_ids=["span3"],
            missing_telemetry="Add http.client spans for external API calls",
            title="Missing HTTP Instrumentation",
            category=InstrumentationIssueCategory.MISSING_INSTRUMENTATION,
            subcategory="Missing HTTP Spans",
        )

        mock_state.get_artifact.return_value = TraceInstrumentationResult(
            issues=[issue1, issue2],
            finish_reason=TraceInstrumentationFinishReason.SUCCESS,
        )
        mock_client_instance.get_run.return_value = mock_state
        mock_seer_client.return_value = mock_client_instance

        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        # Should return the list of issues
        assert result is not None
        assert len(result) == 2
        assert result[0].title == "Missing Database Instrumentation"
        assert result[1].title == "Missing HTTP Instrumentation"

        # Verify Seer client was called correctly
        assert mock_client_instance.start_run.call_count == 1
        call_kwargs = mock_client_instance.start_run.call_args[1]
        assert call_kwargs.get("artifact_key") == "issues"
        assert call_kwargs.get("artifact_schema") == TraceInstrumentationResult

        # Verify prompt includes trace data
        prompt = mock_client_instance.start_run.call_args[0][0]
        assert self.project.slug in prompt
        assert "DETECTION CRITERIA" in prompt

        # Verify issues were created
        assert mock_create_issue.call_count == 2

        # Check first issue
        call_args_list = [call[1] for call in mock_create_issue.call_args_list]
        assert call_args_list[0]["project_id"] == self.project.id
        assert call_args_list[0]["detector_name"] == AutopilotDetectorName.TRACE_INSTRUMENTATION
        assert call_args_list[0]["title"] == "Missing Database Instrumentation"
        assert call_args_list[0]["subtitle"] == "Missing Database Spans"
        assert "Database queries are not instrumented" in call_args_list[0]["description"]
        assert "span1, span2" in call_args_list[0]["description"]

        # Check second issue
        assert call_args_list[1]["title"] == "Missing HTTP Instrumentation"
        assert call_args_list[1]["subtitle"] == "Missing HTTP Spans"

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.SeerExplorerClient")
    @mock.patch("sentry.autopilot.tasks.get_trace_waterfall")
    @mock.patch("sentry.autopilot.tasks.sample_trace_for_instrumentation_analysis")
    def test_handles_seer_explorer_error_gracefully(
        self,
        mock_sample_trace: mock.MagicMock,
        mock_get_waterfall: mock.MagicMock,
        mock_seer_client: mock.MagicMock,
    ) -> None:
        from sentry.seer.sentry_data_models import EAPTrace, TraceMetadata

        mock_sample_trace.return_value = TraceMetadata(
            trace_id="abc123",
            transaction_name="GET /api/users",
        )
        mock_get_waterfall.return_value = EAPTrace(
            trace_id="abc123",
            trace=[{"event_type": "span", "id": "span1"}],
        )

        # Mock client to raise error on start_run
        mock_client_instance = mock.MagicMock()
        mock_client_instance.start_run.side_effect = Exception("API error")
        mock_seer_client.return_value = mock_client_instance

        # Should not raise, just return None
        result = run_trace_instrumentation_detector_for_project_task(
            organization_id=self.organization.id,
            project_id=self.project.id,
        )
        assert result is None
