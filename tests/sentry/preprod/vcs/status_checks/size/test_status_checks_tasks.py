from __future__ import annotations

import uuid
from unittest.mock import Mock, patch

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.models.repository import Repository
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class CreatePreprodStatusCheckTaskTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )

    def _create_preprod_artifact(
        self,
        state=PreprodArtifact.ArtifactState.PROCESSED,
        with_commit_comparison=True,
        error_message=None,
        app_id="com.example.app",
        unique_shas=True,
    ):
        """Helper to create PreprodArtifact with optional CommitComparison."""
        preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=state,
            error_message=error_message,
            app_id=app_id,
        )

        if with_commit_comparison:
            # Generate unique SHAs if requested to avoid constraint violations
            if unique_shas:
                unique_suffix = str(uuid.uuid4()).replace("-", "")[:8]
                head_sha = unique_suffix.ljust(40, "a")  # Pad with 'a' to make 40 chars
                base_sha = unique_suffix.ljust(40, "b")  # Pad with 'b' to make 40 chars
            else:
                head_sha = "a" * 40
                base_sha = "b" * 40

            commit_comparison = CommitComparison.objects.create(
                organization_id=self.organization.id,
                head_sha=head_sha,
                base_sha=base_sha,
                provider="github",
                head_repo_name="owner/repo",
                base_repo_name="owner/repo",
                head_ref="feature/test",
                base_ref="main",
            )
            preprod_artifact.commit_comparison = commit_comparison
            preprod_artifact.save()

        return preprod_artifact

    def _create_working_status_check_setup(self, preprod_artifact):
        """Helper to mock a working status check setup with GitHub integration."""
        # Create repository that matches the commit comparison
        repository = Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
        )

        # Mock the status check client and provider chain
        mock_client = Mock()
        mock_provider = Mock()
        mock_provider.create_status_check.return_value = "check_12345"

        patcher_client = patch(
            "sentry.preprod.vcs.status_checks.size.tasks._get_status_check_client",
            return_value=(mock_client, repository),
        )
        patcher_provider = patch(
            "sentry.preprod.vcs.status_checks.size.tasks._get_status_check_provider",
            return_value=mock_provider,
        )

        return mock_client, mock_provider, patcher_client, patcher_provider

    def _create_no_api_calls_setup(self):
        """Helper to mock setup for tests that expect no API calls to be made."""
        mock_client = Mock()
        mock_provider = Mock()

        patcher_client = patch(
            "sentry.preprod.vcs.status_checks.size.tasks._get_status_check_client",
            return_value=(mock_client, None),
        )
        patcher_provider = patch(
            "sentry.preprod.vcs.status_checks.size.tasks._get_status_check_provider",
            return_value=mock_provider,
        )

        return mock_client, mock_provider, patcher_client, patcher_provider

    def test_create_preprod_status_check_task_nonexistent_artifact(self):
        """Test task handles nonexistent PreprodArtifact gracefully and makes no API calls."""
        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(99999)  # Nonexistent ID

            # Verify no API calls were made since artifact doesn't exist
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_no_commit_comparison(self):
        """Test task returns early when PreprodArtifact has no CommitComparison and makes no API calls."""
        preprod_artifact = self._create_preprod_artifact(with_commit_comparison=False)
        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made since there's no commit comparison
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_missing_git_info(self):
        """Test task handles missing git info in CommitComparison and makes no API calls."""
        preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
        )

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="",  # Empty string instead of None to avoid constraint violation
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )
        preprod_artifact.commit_comparison = commit_comparison
        preprod_artifact.save()

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to missing git info
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_missing_head_repo_name(self):
        """Test task handles missing head_repo_name in CommitComparison and makes no API calls."""
        preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
        )

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="",  # Empty string instead of None to avoid constraint violation
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )
        preprod_artifact.commit_comparison = commit_comparison
        preprod_artifact.save()

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to missing head_repo_name
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_no_repository_integration(self):
        """Test task handles missing repository integration gracefully and makes no API calls."""
        preprod_artifact = self._create_preprod_artifact()

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to missing repository integration
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_repository_no_integration_id(self):
        """Test task handles repository with no integration_id and makes no API calls."""
        preprod_artifact = self._create_preprod_artifact()

        # Create repository without integration
        Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=None,
        )

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to missing integration_id
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_unsupported_provider(self):
        """Test task handles unsupported VCS provider gracefully and makes no API calls."""
        preprod_artifact = self._create_preprod_artifact()
        # Change provider to unsupported one (GitLab is not supported)
        preprod_artifact.commit_comparison.provider = "gitlab"
        preprod_artifact.commit_comparison.save()

        _, mock_provider, client_patch, provider_patch = self._create_no_api_calls_setup()

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

            # Verify no API calls were made due to unsupported provider
            mock_provider.create_status_check.assert_not_called()

    def test_create_preprod_status_check_task_all_artifact_states(self):
        """Test task handles all valid artifact states and creates correct status checks."""
        test_cases = [
            (PreprodArtifact.ArtifactState.UPLOADING, StatusCheckStatus.IN_PROGRESS, None),
            (PreprodArtifact.ArtifactState.UPLOADED, StatusCheckStatus.IN_PROGRESS, None),
            (PreprodArtifact.ArtifactState.PROCESSED, StatusCheckStatus.SUCCESS, None),
            (PreprodArtifact.ArtifactState.FAILED, StatusCheckStatus.FAILURE, "Test error message"),
        ]

        for artifact_state, expected_status, error_message in test_cases:
            with self.subTest(state=artifact_state):
                preprod_artifact = self._create_preprod_artifact(
                    state=artifact_state,
                    error_message=error_message,
                    app_id=f"com.test.{artifact_state.name.lower()}",
                )

                if artifact_state == PreprodArtifact.ArtifactState.PROCESSED:
                    PreprodArtifactSizeMetrics.objects.create(
                        preprod_artifact=preprod_artifact,
                        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                        state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                        min_download_size=1024 * 1024,
                        max_download_size=1024 * 1024,
                        min_install_size=2 * 1024 * 1024,
                        max_install_size=2 * 1024 * 1024,
                    )

                _, mock_provider, client_patch, provider_patch = (
                    self._create_working_status_check_setup(preprod_artifact)
                )

                with client_patch, provider_patch:
                    with self.tasks():
                        create_preprod_status_check_task(preprod_artifact.id)

                mock_provider.create_status_check.assert_called_once()
                call_kwargs = mock_provider.create_status_check.call_args.kwargs

                assert call_kwargs["repo"] == "owner/repo"
                assert call_kwargs["sha"] == preprod_artifact.commit_comparison.head_sha
                assert call_kwargs["status"] == expected_status
                assert call_kwargs["title"] == "Size Analysis"

                if expected_status == StatusCheckStatus.SUCCESS:
                    # SUCCESS only when processed AND has completed size metrics
                    assert "1 app" in call_kwargs["subtitle"]
                elif expected_status == StatusCheckStatus.IN_PROGRESS:
                    assert "1 app processing" in call_kwargs["subtitle"]
                elif expected_status == StatusCheckStatus.FAILURE:
                    assert "1 app errored" in call_kwargs["subtitle"]

                assert call_kwargs["summary"]  # Just check it exists
                assert call_kwargs["external_id"] == str(preprod_artifact.id)

    def test_create_preprod_status_check_task_api_failure_handling(self):
        """Test task handles status check API failures gracefully."""
        preprod_artifact = self._create_preprod_artifact(
            state=PreprodArtifact.ArtifactState.PROCESSED
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        _, mock_provider, client_patch, provider_patch = self._create_working_status_check_setup(
            preprod_artifact
        )

        # TODO(telkins): come up with a better error case
        mock_provider.create_status_check.return_value = None  # Simulate API failure

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(preprod_artifact.id)

        # Verify API was called but task completed without exception
        mock_provider.create_status_check.assert_called_once()

    def test_create_preprod_status_check_task_multiple_artifacts_same_commit(self):
        """Test task handles multiple artifacts for the same commit (monorepo scenario)."""
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        # Create multiple artifacts for the same commit (monorepo scenario)
        artifacts = []
        for i in range(3):
            artifact = PreprodArtifact.objects.create(
                project=self.project,
                state=PreprodArtifact.ArtifactState.PROCESSED,
                app_id=f"com.example.app{i}",
                build_version="1.0.0",
                build_number=i + 1,
                commit_comparison=commit_comparison,
            )
            PreprodArtifactSizeMetrics.objects.create(
                preprod_artifact=artifact,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                min_download_size=1024 * 1024,
                max_download_size=1024 * 1024,
                min_install_size=2 * 1024 * 1024,
                max_install_size=2 * 1024 * 1024,
            )
            artifacts.append(artifact)

        _, mock_provider, client_patch, provider_patch = self._create_working_status_check_setup(
            artifacts[0]
        )

        with client_patch, provider_patch:
            with self.tasks():
                # Call with just one artifact ID - it should find all sibling artifacts
                create_preprod_status_check_task(artifacts[0].id)

        mock_provider.create_status_check.assert_called_once()
        call_kwargs = mock_provider.create_status_check.call_args.kwargs

        assert call_kwargs["title"] == "Size Analysis"
        assert call_kwargs["subtitle"] == "3 apps analyzed"  # All processed with completed metrics

        summary = call_kwargs["summary"]
        assert "com.example.app0" in summary
        assert "com.example.app1" in summary
        assert "com.example.app2" in summary

    def test_create_preprod_status_check_task_mixed_states_monorepo(self):
        """Test task handles mixed artifact states in monorepo scenario."""
        from sentry.preprod.models import PreprodArtifactSizeMetrics

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        processed_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.processed",
            commit_comparison=commit_comparison,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=processed_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        _ = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADING,
            app_id="com.example.uploading",
            commit_comparison=commit_comparison,
        )

        _ = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.FAILED,
            app_id="com.example.failed",
            error_message="Upload timeout",
            commit_comparison=commit_comparison,
        )

        _, mock_provider, client_patch, provider_patch = self._create_working_status_check_setup(
            processed_artifact
        )

        with client_patch, provider_patch:
            with self.tasks():
                create_preprod_status_check_task(processed_artifact.id)

        mock_provider.create_status_check.assert_called_once()
        call_kwargs = mock_provider.create_status_check.call_args.kwargs

        assert call_kwargs["title"] == "Size Analysis"
        assert call_kwargs["subtitle"] == "1 app analyzed, 1 app processing, 1 app errored"
        assert call_kwargs["status"] == StatusCheckStatus.FAILURE  # Failed takes priority

        summary = call_kwargs["summary"]
        assert "com.example.processed" in summary
        assert "com.example.uploading" in summary
        assert "com.example.failed" in summary
        assert "Upload timeout" in summary
